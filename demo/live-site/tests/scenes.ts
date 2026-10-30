// End to end, one scene per fictional site: a real browser enters as a guest, opens the copilot call panel, talks to it,
// and checks the copilot's answers and the fields it filled. The copilot must never submit and nothing may be sent;
// at the end of each scene the "person" presses the button and gets "Demo: nothing was sent".
// Run: node build.ts && node tests/scenes.ts [--offline] [scene...]
//   live (default): Jev + Octo through the local backend, keys from ~/Documents/projects/.env
//   --offline: keyword search over the same passages, word-overlap judge, rules (no keys, no network)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { loadEnv, start } from '../server.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const offline = process.argv.includes('--offline');
const only = process.argv.slice(2).filter(a => !a.startsWith('--'));
const srv = await start({ offline });
console.log(`backend: ${srv.mode}\n`);

const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const cached = fs.existsSync(cache) ? fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])[0] : '';
const exe = process.env.PW_CHROMIUM ?? (cached ? `${cache}/${cached}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });

const results: { scene: string; name: string; ok: boolean }[] = [];
let current = '';
const check = (name: string, ok: boolean, got?: unknown) => {
  results.push({ scene: current, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got ${JSON.stringify(got)?.slice(0, 400)}`}`);
};

// Keys must never reach the browser: no built file may contain one.
{
  current = 'keys';
  const env = loadEnv();
  const secrets = [env.OPENROUTER_JEV_KEY, env.OCTO_KEY].filter((s): s is string => !!s && s.length > 8);
  const files = (fs.readdirSync(path.join(here, '../dist'), { recursive: true }) as string[]).map(f => path.join(here, '../dist', f)).filter(f => fs.statSync(f).isFile());
  check('no key appears in any file served to the browser', files.every(f => { const t = fs.readFileSync(f, 'utf8'); return secrets.every(s => !t.includes(s)); }));
}

// The app's panel is drawn by the React app; what the copilot said is read from the SDK snapshot, the panel's source.
const T = (id: string) => `[data-testid="${id}"]`;
const BOT = `${T('call-message')}[data-who="bot"]`;
const bots = (page: Page) => page.evaluate(() => ((window as any).copilot?.getSnapshot().messages ?? []).filter((m: any) => m.who === 'bot').length as number);
const lastBot = (page: Page) => page.evaluate(() => {
  const ms = ((window as any).copilot.getSnapshot().messages as any[]).filter(m => m.who === 'bot');
  return (ms.at(-1)?.text ?? '') as string;
});
const settle = (page: Page, n: number) => page.waitForFunction(n => {
  const s = (window as any).copilot?.getSnapshot();
  return s && !s.busy && s.messages.filter((m: any) => m.who === 'bot').length > n && !document.querySelector('[data-testid="call-panel"][data-busy="true"]');
}, n, { timeout: 60_000 });

type Ctx = { page: Page; say: (t: string) => Promise<string>; answer: (t: string) => Promise<string>; val: (sel: string) => Promise<string>; sent: string[] };

async function scene(name: string, url: string, run: (c: Ctx) => Promise<void>) {
  if (only.length && !only.includes(name)) return;
  current = name;
  console.log(`\n== ${name} ${url}`);
  const page = await browser.newPage();
  const sent: string[] = [];
  let allowLeave = true; // until the scene page is open
  page.on('request', r => {
    const u = new URL(r.url());
    if (u.origin !== srv.url) sent.push(`third party: ${r.url()}`);
    else if (r.method() !== 'GET' && !u.pathname.startsWith('/api/')) sent.push(`${r.method()} ${u.pathname}`);
    else if (!allowLeave && r.isNavigationRequest() && r.frame() === page.mainFrame() && u.pathname !== url) sent.push(`navigated to ${u.pathname}`);
  });
  page.on('pageerror', e => sent.push(`page error: ${e.message}`));
  await page.goto(`${srv.url}${url}?guest=1`);
  allowLeave = false;
  check('page carries the fictional-company banner and noindex', /Demo, fictional company/.test(await page.textContent(T('demo-banner')) ?? '')
    && (await page.getAttribute('meta[name=robots]', 'content'))?.includes('noindex') === true);
  const say = async (t: string) => {
    const n = await bots(page);
    await page.fill(T('call-input'), t);
    await page.click(T('call-send'));
    await settle(page, n);
    const r = await lastBot(page);
    console.log(`      > ${t}\n      < ${r.slice(0, 200)}`);
    return r;
  };
  // An answer the copilot reads back ("…, is that right?") is confirmed with a yes, as a person would.
  const answer = async (t: string) => {
    const r = await say(t);
    return /Is that right\?$/i.test(r) ? say('yes') : r;
  };
  const val = (sel: string) => page.$eval(sel, el => (el as HTMLInputElement).value);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
  await page.click(T('call-type'));
  await settle(page, 0);
  console.log(`      < ${(await lastBot(page)).slice(0, 200)}`);
  await run({ page, say, answer, val, sent });
  check('copilot sent nothing and never left the page', sent.length === 0, sent);
  check('the panel shows every copilot message', await page.locator(BOT).count() === await bots(page), [await page.locator(BOT).count(), await bots(page)]);
  // The person presses the button themself: the fake endpoint keeps everything in the browser.
  allowLeave = true;
  for (const box of await page.$$('input[type=checkbox][required]')) await box.check(); // ticks are the person's job
  await page.click('[data-copilot-submit]');
  await page.waitForURL(/\/sent$/);
  check('pressing the button shows "Demo: nothing was sent", and no POST left the browser',
    (await page.textContent('#sent')) === 'Demo: nothing was sent' && sent.length === 0, sent);
  await page.close();
}

const nextStep = async (page: Page, say0: string) => {
  // the person presses Next; the copilot picks up the new step by itself
  const n = await bots(page);
  await page.click('fieldset[data-step]:not([hidden]) [data-copilot-submit]');
  await settle(page, n);
  const r = await lastBot(page);
  console.log(`      [person presses Next]\n      < ${r}`);
  check(`next step starts by itself: ${say0}`, /On to the next part/.test(r) && r.includes(say0), r);
};

await scene('clinic', '/clinic/book', async ({ page, say, answer, val }) => {
  const first = await page.evaluate(() => (window as any).copilot.getSnapshot().messages.find((m: any) => m.who === 'bot')?.text ?? '');
  check('opens on the booking form and asks for the child', /fill in this booking form/.test(first) && /child's full name/.test(first), first);
  // A doubled name (as an iPhone once heard it) is read back; the person misses it and says yes, then fixes it later.
  let r = await say('Leo Rahman Leo Rahman');
  check('name read back before it is typed in', /^I heard Leo Rahman Leo Rahman\. Is that right\?$/.test(r) && (await val('#child')) === '', r);
  await say('yes');
  check('child name typed in after the yes', (await val('#child')) === 'Leo Rahman Leo Rahman');
  r = await say('You actually wrote the name twice, can you fix it');
  check('a correction during the next question goes back to the name and reads out what it holds',
    /^Sure, let's fix that\. I have the child's full name as Leo Rahman Leo Rahman\./.test(r) && /child's full name\?$/.test(r) && !/I need one of these/.test(r), r);
  r = await say('Leo Rahman');
  check('the new name is read back too', /^I heard Leo Rahman\. Is that right\?$/.test(r), r);
  r = await say('yes');
  check('name fixed, then back to the question that was open', (await val('#child')) === 'Leo Rahman' && /^Thanks, that's fixed\. .*Well-child checkup/.test(r)
    && (await val('#visit')) === '', r);
  r = await answer('a checkup please');
  check('"checkup" picks Well-child checkup', (await val('#visit')) === 'wellchild' && /Here's what I have/.test(r), r);
  r = await say('yes');
  check('hands step 1 back: press Next yourself', /press Next yourself/.test(r), r);
  await nextStep(page, 'Mornings or afternoons');
  await answer('mornings if possible');
  check('morning radio checked', await page.isChecked('#tod_am'));
  await answer('Tuesday');
  check('Tuesday slot selected', (await val('#slot')) === 'tue0940');
  await say('yes');
  await nextStep(page, 'parent or guardian');
  await say('Aisha Rahman');
  await say('yes');
  r = await say('five five five, zero one zero, four four two two');
  check('phone read back before it is kept', /I heard 5550104422/.test(r) && (await val('#phone')) === '', r);
  await say('yes');
  r = await say('aisha at example dot com');
  check('email read back', /I heard aisha@example\.com/.test(r), r);
  r = await say('yes');
  check('review card lists step 3', /Here's what I have/.test(r) && /Aisha Rahman/.test(r) && /5550104422/.test(r), r);
  r = await say('yes');
  check('final hand-back names Book visit and the reminder box', /press Book visit yourself/.test(r) && /reminder/.test(r), r);
  check('all step-3 fields filled, reminder untouched', (await val('#parent')) === 'Aisha Rahman' && (await val('#phone')) === '5550104422'
    && (await val('#email')) === 'aisha@example.com' && !(await page.isChecked('#remind')));
});

await scene('appliance', '/appliance/support', async ({ page, say, answer, val }) => {
  // The mode tabs are in the open panel: the call starts as a compact bar.
  check('the call opens as a compact bar', (await page.getAttribute(T('call-panel'), 'data-expanded')) === 'false');
  await page.click(T('call-expand'));
  await page.click(T('call-mode-guide'));
  await page.waitForFunction(() => ((window as any).copilot.getSnapshot().messages as any[]).some(m => m.who === 'bot' && /Step 1 of 6/.test(m.text)));
  check('walk-through starts at step 1 of the E24 fix', true);
  let r = await say('What does E24 mean?');
  check('E24 answered from the manual with a page', /^The manual says \(page [67]\)/.test(r) && /drain/i.test(r), r);
  check('the citation links to that page of the manual',
    /\/docs\/hdw500-manual\.html#page-[67]$/.test(await page.locator(`${BOT} a`).last().getAttribute('href') ?? ''));
  r = await say('next');
  check('"next" moves to step 2', /^Step 2 of 6/.test(r), r);
  r = await say('How long is the warranty?');
  check('warranty answered with page 8', /\(page 8\)/.test(r) && /2-year/.test(r), r);
  r = await say('Can you recommend a good plumber?');
  check('outside the manual: "I don\'t know"', /^I don't know/.test(r), r);
  await page.click(T('call-mode-form'));
  r = await say('Where do I find the serial number?');
  check('side question during the form is answered from the manual, then the form goes on',
    /\(page 1\)/.test(r) && /sticker/.test(r) && /Back to the form: Can you read me the serial number/.test(r), r);
  r = await say('LS 5734SSTD');
  check('a spaced, short serial says what was heard and what is wrong',
    r.startsWith("I heard LS57-34SS-TD, that's 10 characters; the serial has 12, like 1334-592C-LSD3. Read it in groups of four.") && (await val('#serial')) === '', r);
  check('no keyboard offer while typing', !/Keyboard/.test(r), r);
  r = await say('one three three four five nine two C, I, S, D, three');
  check('serial read back', /I heard 1334-592C-ISD3/.test(r), r);
  r = await say('no');
  check('a "no" asks again and keeps nothing', /try again/.test(r) && (await val('#serial')) === '', r);
  r = await say('one three three four five nine two C, L as in Lima, S, D, three');
  check('"L as in Lima" read back', /I heard 1334-592C-LSD3/.test(r), r);
  await say('yes');
  check('serial typed in after the yes', (await val('#serial')) === '1334592CLSD3');
  await answer('E24');
  check('error code E24 selected', (await val('#code')) === 'E24');
  await say('Marcus Hall');
  await say('yes');
  await say('marcus at example dot com');
  await say('yes');
  await answer('it shows E24 and there is water at the bottom');
  check('description typed in', (await val('#what')) === 'it shows E24 and there is water at the bottom');
  r = await say('yes');
  check('hand-back: press Request visit yourself', /press Request visit yourself/.test(r), r);
});

await scene('pricing', '/pricing/quote', async ({ page, say, answer, val }) => {
  await answer('Prana Yoga Studio');
  check('business name typed in', (await val('#biz')) === 'Prana Yoga Studio');
  await say('Sofia Marin');
  await say('yes');
  await say('sofia at example dot com');
  await say('yes');
  let r = await say('Growth');
  check('the plan is read back before it is checked', /^Growth, is that right\?$/.test(r) && !(await page.isChecked('#p2')), r);
  await say('yes');
  check('Growth plan checked', await page.isChecked('#p2'));
  // Back two questions to fix the email, then on with the question that was open.
  r = await say('go back');
  check('"go back" steps back to the plan and says what it holds', /^Sure, going back\. I have the plan as Growth\./.test(r), r);
  r = await say('go back');
  check('"go back" again steps back to the email', /^Sure, going back\. I have the email as sofia@example\.com\./i.test(r), r);
  await say('sofia dot marin at example dot com');
  r = await say('yes');
  check('email fixed, plan kept, back to the budget question', (await val('#email')) === 'sofia.marin@example.com' && await page.isChecked('#p2')
    && /^Thanks, that's fixed\. .*budget/i.test(r), r);
  await answer('around three thousand');
  check('budget $1,000 to $3,000', (await val('#budget')) === '1to3k');
  r = await answer('a website with online class booking');
  check('review card', /Here's what I have/.test(r) && /plan: Growth/.test(r), r);
  r = await say('change the budget');
  check('"change the budget" re-asks only the budget', /^Sure\. Roughly what budget/.test(r), r);
  r = await answer('about five thousand');
  check('budget changed, back to the card', (await val('#budget')) === '3to7k' && /Here's what I have/.test(r), r);
  r = await say('yes');
  check('hand-back: press Request a quote yourself', /press Request a quote yourself/.test(r), r);
  check('every field filled', (await val('#contact')) === 'Sofia Marin' && (await val('#email')) === 'sofia.marin@example.com' && (await val('#needs')) === 'a website with online class booking');
});

await scene('itdesk', '/itdesk/new', async ({ page, say, answer, val }) => {
  await answer("it's a network problem");
  check('category Network', (await val('#cat')) === 'net');
  await answer('the VPN');
  check('service VPN', (await val('#svc')) === 'vpn');
  let r = await say('my laptop is 4419');
  check("the page's own pattern rejects a bad asset tag, and the copilot asks again", /page didn't accept that/.test(r) && (await val('#asset')) === '', r);
  await answer('CF-4419');
  check('asset tag typed in', (await val('#asset')) === 'CF-4419');
  await answer('just me');
  check('impact: just me', await page.isChecked('#i1'));
  await answer('high, I have a client call at two');
  check('urgency High', (await val('#urg')) === 'high');
  r = await say('can you order me lunch while we wait?');
  check('off-topic request is turned down and nothing is typed', /only help you fill in this form/.test(r) && (await val('#desc')) === '', r);
  await answer('VPN fails to connect since 9 AM, client call at 2 PM');
  check('description typed in', (await val('#desc')) === 'VPN fails to connect since 9 AM, client call at 2 PM');
  await say('daniel at example dot com');
  r = await say('yes');
  r = await say('yes');
  check('hand-back: press Submit ticket yourself', /press Submit ticket yourself/.test(r), r);
});

await scene('pension', '/pension/forms/r17', async ({ page, say, answer, val }) => {
  await answer('SPF-204118.');
  check('member number typed in, despite the full stop dictation adds', (await val('#member')) === 'SPF-204118');
  await say('Michael');
  await say('yes');
  await say('Reyes');
  await say('yes');
  check('beneficiary name typed in', (await val('#bfirst')) === 'Michael' && (await val('#blast')) === 'Reyes');
  let r = await say('what is a payee code');
  check('payee code explained from the R-17 guide, page 3, then back to the form',
    /\(page 3\)/.test(r) && /related to you/.test(r) && /Back to the form: How is this person related to you/.test(r), r);
  r = await say('How long does processing take if I send it online?');
  check('processing time answered with page 4', /\(page 4\)/.test(r) && /5 working days/.test(r), r);
  r = await say("What is the fund's phone number?");
  check('not in the guide: "I don\'t know"', /^I don't know/.test(r), r);
  await answer('my son');
  check('"my son" picks payee code C', (await val('#code')) === 'C');
  await answer('100');
  check('share 100', (await val('#share')) === '100');
  r = await answer('primary');
  check('primary checked and review card shown', await page.isChecked('#t1') && /Here's what I have/.test(r), r);
  r = await say('yes');
  check('hand-back names the button and the box to tick', /press Submit form R-17 yourself/.test(r) && /I agree this form replaces/.test(r), r);
  check('consent box left for the person', !(await page.isChecked('#replace')));
});

// Voice call: the browser's speech services are replaced by stubs. The fake microphone "hears" queued sentences,
// and the fake speaker records what the copilot says. The widget, engine and backend are the real ones.
if (!only.length || only.includes('voice')) {
  current = 'voice';
  console.log('\n== voice /clinic/book');
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const w = window as any;
    w.__heard = [] as string[]; w.__spoken = [] as string[]; w.__listening = 0;
    class FakeSR {
      onresult: any; onend: any; onerror: any; lang = ''; interimResults = false; continuous = false; maxAlternatives = 1; done = false;
      start() {
        w.__listening++;
        const tick = () => {
          if (this.done) return;
          const t = w.__heard.shift();
          if (t === undefined) { setTimeout(tick, 50); return; }
          this.done = true; w.__listening--;
          // An array is one utterance that the recogniser finalises more than once, as iOS WebKit does.
          const finals = (Array.isArray(t) ? t : [t]).map((x: string) => Object.assign([{ transcript: x }], { isFinal: true }));
          finals.forEach((_r: unknown, i: number) => this.onresult?.({ resultIndex: i, results: finals.slice(0, i + 1) }));
          this.onend?.();
        };
        setTimeout(tick, 50);
      }
      abort() { if (!this.done) { this.done = true; w.__listening--; } }
      stop() { this.abort(); }
    }
    w.SpeechRecognition = FakeSR; w.webkitSpeechRecognition = FakeSR;
    Object.defineProperty(w, 'speechSynthesis', { value: { cancel() {}, speak(u: any) { w.__spoken.push(u.text); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 10); } } });
  });
  await page.goto(`${srv.url}/clinic/book?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
  const spoken = () => page.evaluate(() => (window as any).__spoken.length as number);
  const talk = async (t: string | string[]) => {
    const n = await spoken();
    await page.waitForFunction(() => (window as any).__listening > 0, null, { timeout: 30_000 });
    await page.evaluate(t => (window as any).__heard.push(t), t);
    await page.waitForFunction(n => (window as any).__spoken.length > n && (window as any).__listening > 0, n, { timeout: 60_000 });
    const r = await page.evaluate(() => (window as any).__spoken.at(-1) as string);
    console.log(`      > (spoken) ${[t].flat().join(' | ')}\n      < (spoken) ${r.slice(0, 200)}`);
    return r;
  };
  await page.click(T('call-start'));
  await page.waitForFunction(() => (window as any).__spoken.length > 0);
  const hello = await page.evaluate(() => (window as any).__spoken[0] as string);
  check('the call opens by speaking the first question', /child's full name/.test(hello), hello);
  check('in a call the text box is hidden', await page.locator(T('call-input')).isHidden());
  let r = await talk(['Pooja Bajracharya.', 'PUJANBAJRACHARYA']);
  check('a name the recogniser finalises twice is heard once and read back', /^I heard Pooja Bajracharya\. Is that right\?$/.test(r), r);
  r = await talk('yes');
  check('spoken name typed in once', (await page.$eval('#child', e => (e as HTMLInputElement).value)) === 'Pooja Bajracharya', r);
  r = await talk('a checkup please');
  check('spoken choice is read back for a yes', /^Well-child checkup, is that right\?$/.test(r), r);
  r = await talk('yes');
  check('spoken "checkup" picks Well-child checkup, then the read-back is spoken', (await page.$eval('#visit', e => (e as HTMLSelectElement).value)) === 'wellchild' && /Here's what I have/.test(r), r);
  r = await talk('yes');
  check('spoken hand-back: press Next yourself', /press Next yourself/.test(r), r);
  check('the call never pressed Next', await page.locator('fieldset[data-step]').first().isVisible());
  await page.click(T('call-end'));
  check('ending the call closes the panel', await page.locator(T('call-panel')).isHidden());

  // A serial by voice: spaced and short, then too short, then spoken letter names.
  console.log('\n== voice /appliance/support');
  await page.goto(`${srv.url}/appliance/support?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
  await page.evaluate(() => { (window as any).__spoken.length = 0; });
  await page.click(T('call-start'));
  await page.waitForFunction(() => (window as any).__spoken.length > 0);
  const ask = await page.evaluate(() => (window as any).__spoken[0] as string);
  check('the appliance call asks for the serial first', /serial number/.test(ask), ask);
  r = await talk('LS 5734SSTD');
  check('spoken short serial: what was heard and what is wrong, no keyboard offer yet',
    r.startsWith("I heard LS57-34SS-TD, that's 10 characters; the serial has 12, like 1334-592C-LSD3. Read it in groups of four.") && !/Keyboard/.test(r), r);
  r = await talk('one three three four');
  check('second miss offers the keyboard', /that's 4 characters/.test(r) && /You can also type it with Keyboard\./.test(r), r);
  r = await talk('one three three four five nine two see el ess dee three');
  check('spoken letter names ("see el ess dee") are letters', /^I heard 1334-592C-LSD3\. Is that right\?$/.test(r), r);
  r = await talk('yes');
  check('serial typed in after the yes', (await page.$eval('#serial', e => (e as HTMLInputElement).value)) === '1334592CLSD3', r);
  await page.click(T('call-end'));
  await page.close();
}

// Phone layout. A call is a compact bar at the bottom: in a voice call it covers at most a fifth of the screen, the
// page above stays in view and scrolls, and the field being asked is highlighted above the bar. The handle or the
// caption opens the whole conversation, and the handle closes it again. Typing adds only the text box and Send, and
// every call control stays fully on screen on short phones. Same on desktop, as a small corner window.
if (!only.length || only.includes('layout')) {
  current = 'layout';
  console.log('\n== layout');
  const onScreen = (page: Page, ids: string[]) => page.evaluate(ids => ids.filter(id => {
    const e = document.querySelector(`[data-testid="${id}"]`);
    if (!e) return true;
    const r = e.getBoundingClientRect();
    return r.top < 0 || r.left < 0 || r.bottom > innerHeight + 0.5 || r.right > innerWidth + 0.5 || r.height < 1;
  }), ids);
  const panelBox = (page: Page) => page.$eval(T('call-panel'), e => { const r = e.getBoundingClientRect(); return { top: r.top, h: r.height, w: r.width, vh: innerHeight, vw: innerWidth }; });
  // A microphone that never hears anything, so a voice call just listens.
  const quietMic = () => {
    const w = window as any;
    class QuietSR { onresult: any; onend: any; onerror: any; lang = ''; interimResults = false; continuous = false; maxAlternatives = 1; start() {} stop() {} abort() {} }
    w.SpeechRecognition = QuietSR; w.webkitSpeechRecognition = QuietSR;
    Object.defineProperty(w, 'speechSynthesis', { value: { cancel() {}, speak(u: any) { setTimeout(() => { u.onstart?.(); u.onend?.(); }, 10); } } });
  };
  for (const [w, h] of [[390, 664], [375, 560], [360, 640]]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true });
    await ctx.addInitScript(quietMic);
    for (const url of ['/clinic/book', '/appliance/support', '/pricing/quote', '/itdesk/new', '/pension/forms/r17']) {
      const page = await ctx.newPage();
      await page.goto(`${srv.url}${url}?guest=1`);
      await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
      const wide = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      await page.click(T('call-type'));
      await settle(page, 0);
      const off = await onScreen(page, ['call-input', 'call-send', 'call-mic', 'call-keyboard', 'call-end']);
      const typing = await panelBox(page);
      check(`${w}x${h} ${url}: typing: no sideways scroll, every call control on screen, bar under a third of the screen`,
        wide <= 0 && off.length === 0 && typing.h <= typing.vh * 0.32, { wide, off, typing });
      await page.close();
    }
    // Voice call on the clinic form: the compact bar, the highlighted field above it, and expand/collapse.
    const page = await ctx.newPage();
    await page.goto(`${srv.url}/clinic/book?guest=1`);
    await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
    await page.click(T('call-start'));
    await settle(page, 0);
    await page.waitForTimeout(700); // the smooth scroll to the field
    const bar = await panelBox(page);
    const field = await page.$eval('[data-copilot-active]', e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, id: e.id }; }).catch(() => null);
    const caption = (await page.textContent(T('call-caption'))) ?? '';
    check(`${w}x${h} voice: compact bar covers at most a fifth of the screen`, bar.h <= bar.vh * 0.2 + 1 && bar.w <= bar.vw, bar);
    check(`${w}x${h} voice: the caption shows the copilot's question`, /child's full name/.test(caption), caption);
    check(`${w}x${h} voice: the field being asked is highlighted and above the bar`, !!field && field.id === 'child' && field.top >= 0 && field.bottom <= bar.top, field);
    check(`${w}x${h} voice: Mute, Keyboard and End are on screen`, (await onScreen(page, ['call-mic', 'call-keyboard', 'call-end'])).length === 0);
    const y0 = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    check(`${w}x${h} voice: the page still scrolls behind the bar`, (await page.evaluate(() => scrollY)) !== y0);
    await page.click(T('call-caption'));
    const open = await panelBox(page);
    check(`${w}x${h} voice: tapping the caption opens the conversation`, (await page.getAttribute(T('call-panel'), 'data-expanded')) === 'true'
      && await page.locator(BOT).first().isVisible() && open.h > bar.h && open.h <= open.vh * 0.75, open);
    const hb = await page.$eval(T('call-expand'), e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(hb.x, hb.y); await page.mouse.down(); await page.mouse.move(hb.x, hb.y + 80, { steps: 6 }); await page.mouse.up();
    check(`${w}x${h} voice: dragging the handle down closes it again`, (await page.getAttribute(T('call-panel'), 'data-expanded')) === 'false');
    const hc = await page.$eval(T('call-expand'), e => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.move(hc.x, hc.y); await page.mouse.down(); await page.mouse.move(hc.x, hc.y - 80, { steps: 6 }); await page.mouse.up();
    check(`${w}x${h} voice: dragging the handle up opens it`, (await page.getAttribute(T('call-panel'), 'data-expanded')) === 'true');
    await page.close();
    await ctx.close();
  }
  // Desktop: a small corner window that opens to the full conversation.
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(quietMic);
  const page = await ctx.newPage();
  await page.goto(`${srv.url}/clinic/book?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
  await page.click(T('call-start'));
  await settle(page, 0);
  const d = await panelBox(page);
  check('desktop: compact corner window', d.w <= 400 && d.h <= 200 && d.top > d.vh / 2, d);
  await page.click(T('call-expand'));
  const de = await panelBox(page);
  check('desktop: the handle opens the conversation', de.h > d.h && await page.locator(BOT).first().isVisible(), de);
  await ctx.close();
}

// The call timer, the warm-up ping at call start, and the wait line while a slow model call runs. The model is made slow
// on purpose here (each /api/understand held 1.5 s), and the warm-up is held until the first answer, so it is cold.
if (!only.length || only.includes('wait')) {
  current = 'wait';
  console.log('\n== wait /pricing/quote');
  const page = await browser.newPage();
  const warms: number[] = [];
  let releaseWarm = () => {};
  const warmHeld = new Promise<void>(r => { releaseWarm = r; });
  await page.route('**/api/warm', async route => { warms.push(Date.now()); await warmHeld; await route.continue(); });
  await page.route('**/api/understand', async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue(); });
  await page.goto(`${srv.url}/pricing/quote?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 15_000 });
  await page.click(T('call-type'));
  await settle(page, 0);
  check('the call start sends one warm-up ping', warms.length === 1, warms.length);
  const t0 = (await page.textContent(T('call-timer'))) ?? '';
  await page.waitForTimeout(2200);
  const t1 = (await page.textContent(T('call-timer'))) ?? '';
  check('the call timer shows m:ss and ticks', /^0:0[0-1]$/.test(t0) && /^0:0[2-3]$/.test(t1), [t0, t1]);
  // The first answer goes to the model while it is still loading.
  let n = await bots(page);
  await page.fill(T('call-input'), 'Prana Yoga Studio');
  await page.click(T('call-send'));
  const cold = await page.waitForSelector(T('call-wait'), { timeout: 3000 }).then(e => e.textContent()).catch(() => null);
  check('a slow first answer shows "Warming up the assistant… about 2 s"', /^Warming up the assistant… about [12] s$/.test(cold ?? ''), cold);
  await settle(page, n);
  check('the wait line goes away with the answer', await page.locator(T('call-wait')).count() === 0 && /Prana Yoga Studio/.test(await lastBot(page)), await lastBot(page));
  releaseWarm();
  await page.waitForTimeout(300);
  // Answers the copilot reads back (name, email) and choices never go to the model, so they show no wait line.
  const send = async (t: string) => { const n = await bots(page); await page.fill(T('call-input'), t); await page.click(T('call-send')); await settle(page, n); };
  for (const t of ['yes', 'Sofia Marin', 'yes', 'sofia at example dot com', 'yes', 'Growth', 'yes', 'around three thousand', 'yes']) await send(t);
  check('quick answers show no wait line', await page.locator(T('call-wait')).count() === 0);
  // Once warm, a slow answer says "Thinking…" with the warm estimate.
  n = await bots(page);
  await page.fill(T('call-input'), 'a website with online class booking');
  await page.click(T('call-send'));
  const warm = await page.waitForSelector(T('call-wait'), { timeout: 3000 }).then(e => e.textContent()).catch(() => null);
  check('a slow answer once warm shows "Thinking… about 3 s"', /^Thinking… about [23] s$/.test(warm ?? ''), warm);
  await settle(page, n);
  await page.close();
}

await browser.close();
await srv.close();
const pass = results.filter(r => r.ok).length;
const byScene = [...new Set(results.map(r => r.scene))].map(s => `${s} ${results.filter(r => r.scene === s && r.ok).length}/${results.filter(r => r.scene === s).length}`);
fs.appendFileSync(path.join(here, '../../../copilot-engine/ledger.jsonl'),
  results.map(r => JSON.stringify({ ts: new Date().toISOString(), set: 'live-site', backend: offline ? 'offline' : 'live', scenario: `${r.scene}: ${r.name}`, pass: r.ok })).join('\n') + '\n');
console.log(`\nlive-site (${offline ? 'offline' : 'live'}): ${pass}/${results.length}  [${byScene.join(', ')}]`);
process.exit(pass === results.length ? 0 : 1);
