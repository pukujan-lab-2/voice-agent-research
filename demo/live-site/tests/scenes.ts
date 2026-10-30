// End to end, one scene per fictional site: a real browser enters as a guest, opens the copilot widget, talks to it,
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

type Ctx = { page: Page; say: (t: string) => Promise<string>; val: (sel: string) => Promise<string>; sent: string[] };

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
  await page.goto(`${srv.url}/`);
  await page.click('#guest');
  await page.goto(`${srv.url}${url}`);
  allowLeave = false;
  check('page carries the fictional-company banner and noindex', /Demo, fictional company/.test(await page.textContent('.demo-banner') ?? '')
    && (await page.getAttribute('meta[name=robots]', 'content'))?.includes('noindex') === true);
  const bots = () => page.locator('#copilot-widget .msg.bot').count();
  const lastBot = async () => (await page.locator('#copilot-widget .msg.bot').last().textContent()) ?? '';
  const settle = (n: number) => page.waitForFunction(n => {
    const h = document.getElementById('copilot-widget')!;
    return !h.dataset.busy && h.shadowRoot!.querySelectorAll('.msg.bot').length > n;
  }, n, { timeout: 60_000 });
  const say = async (t: string) => {
    const n = await bots();
    await page.fill('#copilot-widget #copilot-input', t);
    await page.press('#copilot-widget #copilot-input', 'Enter');
    await settle(n);
    const r = await lastBot();
    console.log(`      > ${t}\n      < ${r.slice(0, 200)}`);
    return r;
  };
  const val = (sel: string) => page.$eval(sel, el => (el as HTMLInputElement).value);
  await page.click('#copilot-widget .type');
  await settle(0);
  console.log(`      < ${(await lastBot()).slice(0, 200)}`);
  await run({ page, say, val, sent });
  check('copilot sent nothing and never left the page', sent.length === 0, sent);
  // The person presses the button themself: the fake endpoint keeps everything in the browser.
  allowLeave = true;
  for (const box of await page.$$('input[type=checkbox][required]')) await box.check(); // ticks are the person's job
  await page.click('[data-copilot-submit]');
  await page.waitForURL(/\/sent\.html/);
  check('pressing the button shows "Demo: nothing was sent", and no POST left the browser',
    (await page.textContent('#sent')) === 'Demo: nothing was sent' && sent.length === 0, sent);
  await page.close();
}

const nextStep = async (page: Page, say0: string) => {
  // the person presses Next; the copilot picks up the new step by itself
  const n = await page.locator('#copilot-widget .msg.bot').count();
  await page.click('fieldset[data-step]:not([hidden]) [data-copilot-submit]');
  await page.waitForFunction(n => document.getElementById('copilot-widget')!.shadowRoot!.querySelectorAll('.msg.bot').length > n, n);
  const r = (await page.locator('#copilot-widget .msg.bot').last().textContent()) ?? '';
  console.log(`      [person presses Next]\n      < ${r}`);
  check(`next step starts by itself: ${say0}`, /On to the next part/.test(r) && r.includes(say0), r);
};

await scene('clinic', '/clinic/book/', async ({ page, say, val }) => {
  const first = (await page.locator('#copilot-widget .msg.bot').first().textContent()) ?? '';
  check('opens on the booking form and asks for the child', /fill in this booking form/.test(first) && /child's full name/.test(first), first);
  await say('Leo Rahman');
  check('child name typed in', (await val('#child')) === 'Leo Rahman');
  let r = await say('a checkup please');
  check('"checkup" picks Well-child checkup', (await val('#visit')) === 'wellchild' && /Here's what I have/.test(r), r);
  r = await say('yes');
  check('hands step 1 back: press Next yourself', /press Next yourself/.test(r), r);
  await nextStep(page, 'Mornings or afternoons');
  await say('mornings if possible');
  check('morning radio checked', await page.isChecked('#tod_am'));
  await say('Tuesday');
  check('Tuesday slot selected', (await val('#slot')) === 'tue0940');
  await say('yes');
  await nextStep(page, 'parent or guardian');
  await say('Aisha Rahman');
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

await scene('appliance', '/appliance/support/', async ({ page, say, val }) => {
  await page.click('#copilot-widget .tabs button[data-mode=guide]');
  await page.waitForFunction(() => /Step 1 of 6/.test(document.getElementById('copilot-widget')!.shadowRoot!.querySelector('.msg.bot:last-child')?.textContent ?? ''));
  check('walk-through starts at step 1 of the E24 fix', true);
  let r = await say('What does E24 mean?');
  check('E24 answered from the manual with a page', /^The manual says \(page [67]\)/.test(r) && /drain/i.test(r), r);
  check('the citation links to that page of the manual',
    /\/docs\/hdw500-manual\.html#page-[67]$/.test(await page.locator('#copilot-widget .msg.bot a').last().getAttribute('href') ?? ''));
  r = await say('next');
  check('"next" moves to step 2', /^Step 2 of 6/.test(r), r);
  r = await say('How long is the warranty?');
  check('warranty answered with page 8', /\(page 8\)/.test(r) && /2-year/.test(r), r);
  r = await say('Can you recommend a good plumber?');
  check('outside the manual: "I don\'t know"', /^I don't know/.test(r), r);
  await page.click('#copilot-widget .tabs button[data-mode=form]');
  r = await say('Where do I find the serial number?');
  check('side question during the form is answered from the manual, then the form goes on',
    /\(page 1\)/.test(r) && /sticker/.test(r) && /Back to the form: Can you read me the serial number/.test(r), r);
  r = await say('one three three four five nine two C, I, S, D, three');
  check('serial read back', /I heard 1334-592C-ISD3/.test(r), r);
  r = await say('no');
  check('a "no" asks again and keeps nothing', /try again/.test(r) && (await val('#serial')) === '', r);
  r = await say('one three three four five nine two C, L as in Lima, S, D, three');
  check('"L as in Lima" read back', /I heard 1334-592C-LSD3/.test(r), r);
  await say('yes');
  check('serial typed in after the yes', (await val('#serial')) === '1334592CLSD3');
  await say('E24');
  check('error code E24 selected', (await val('#code')) === 'E24');
  await say('Marcus Hall');
  await say('marcus at example dot com');
  await say('yes');
  await say('it shows E24 and there is water at the bottom');
  check('description typed in', (await val('#what')) === 'it shows E24 and there is water at the bottom');
  r = await say('yes');
  check('hand-back: press Request visit yourself', /press Request visit yourself/.test(r), r);
});

await scene('pricing', '/pricing/quote/', async ({ page, say, val }) => {
  await say('Prana Yoga Studio');
  check('business name typed in', (await val('#biz')) === 'Prana Yoga Studio');
  await say('Sofia Marin');
  await say('sofia at example dot com');
  await say('yes');
  await say('Growth');
  check('Growth plan checked', await page.isChecked('#p2'));
  await say('around three thousand');
  check('budget $1,000 to $3,000', (await val('#budget')) === '1to3k');
  let r = await say('a website with online class booking');
  check('review card', /Here's what I have/.test(r) && /plan: Growth/.test(r), r);
  r = await say('change the budget');
  check('"change the budget" re-asks only the budget', /^Sure\. Roughly what budget/.test(r), r);
  r = await say('about five thousand');
  check('budget changed, back to the card', (await val('#budget')) === '3to7k' && /Here's what I have/.test(r), r);
  r = await say('yes');
  check('hand-back: press Request a quote yourself', /press Request a quote yourself/.test(r), r);
  check('every field filled', (await val('#contact')) === 'Sofia Marin' && (await val('#email')) === 'sofia@example.com' && (await val('#needs')) === 'a website with online class booking');
});

await scene('itdesk', '/itdesk/new/', async ({ page, say, val }) => {
  await say("it's a network problem");
  check('category Network', (await val('#cat')) === 'net');
  await say('the VPN');
  check('service VPN', (await val('#svc')) === 'vpn');
  let r = await say('my laptop is 4419');
  check("the page's own pattern rejects a bad asset tag, and the copilot asks again", /page didn't accept that/.test(r) && (await val('#asset')) === '', r);
  await say('CF-4419');
  check('asset tag typed in', (await val('#asset')) === 'CF-4419');
  await say('just me');
  check('impact: just me', await page.isChecked('#i1'));
  await say('high, I have a client call at two');
  check('urgency High', (await val('#urg')) === 'high');
  r = await say('can you order me lunch while we wait?');
  check('off-topic request is turned down and nothing is typed', /only help you fill in this form/.test(r) && (await val('#desc')) === '', r);
  await say('VPN fails to connect since 9 AM, client call at 2 PM');
  check('description typed in', (await val('#desc')) === 'VPN fails to connect since 9 AM, client call at 2 PM');
  await say('daniel at example dot com');
  r = await say('yes');
  r = await say('yes');
  check('hand-back: press Submit ticket yourself', /press Submit ticket yourself/.test(r), r);
});

await scene('pension', '/pension/forms/r17/', async ({ page, say, val }) => {
  await say('SPF-204118.');
  check('member number typed in, despite the full stop dictation adds', (await val('#member')) === 'SPF-204118');
  await say('Michael');
  await say('Reyes');
  check('beneficiary name typed in', (await val('#bfirst')) === 'Michael' && (await val('#blast')) === 'Reyes');
  let r = await say('what is a payee code');
  check('payee code explained from the R-17 guide, page 3, then back to the form',
    /\(page 3\)/.test(r) && /related to you/.test(r) && /Back to the form: How is this person related to you/.test(r), r);
  r = await say('How long does processing take if I send it online?');
  check('processing time answered with page 4', /\(page 4\)/.test(r) && /5 working days/.test(r), r);
  r = await say("What is the fund's phone number?");
  check('not in the guide: "I don\'t know"', /^I don't know/.test(r), r);
  await say('my son');
  check('"my son" picks payee code C', (await val('#code')) === 'C');
  await say('100');
  check('share 100', (await val('#share')) === '100');
  r = await say('primary');
  check('primary checked and review card shown', await page.isChecked('#t1') && /Here's what I have/.test(r), r);
  r = await say('yes');
  check('hand-back names the button and the box to tick', /press Submit form R-17 yourself/.test(r) && /I agree this form replaces/.test(r), r);
  check('consent box left for the person', !(await page.isChecked('#replace')));
});

// Voice call: the browser's speech services are replaced by stubs. The fake microphone "hears" queued sentences,
// and the fake speaker records what the copilot says. The widget, engine and backend are the real ones.
if (!only.length || only.includes('voice')) {
  current = 'voice';
  console.log('\n== voice /clinic/book/');
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
          this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true })] });
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
  await page.goto(`${srv.url}/clinic/book/?guest=1`);
  const spoken = () => page.evaluate(() => (window as any).__spoken.length as number);
  const talk = async (t: string) => {
    const n = await spoken();
    await page.waitForFunction(() => (window as any).__listening > 0, null, { timeout: 30_000 });
    await page.evaluate(t => (window as any).__heard.push(t), t);
    await page.waitForFunction(n => (window as any).__spoken.length > n && (window as any).__listening > 0, n, { timeout: 60_000 });
    const r = await page.evaluate(() => (window as any).__spoken.at(-1) as string);
    console.log(`      > (spoken) ${t}\n      < (spoken) ${r.slice(0, 200)}`);
    return r;
  };
  await page.click('#copilot-widget .call');
  await page.waitForFunction(() => (window as any).__spoken.length > 0);
  const hello = await page.evaluate(() => (window as any).__spoken[0] as string);
  check('the call opens by speaking the first question', /child's full name/.test(hello), hello);
  check('in a call the text box is hidden', await page.locator('#copilot-widget .text').isHidden());
  await talk('Leo Rahman.');
  check('spoken name typed in', (await page.$eval('#child', e => (e as HTMLInputElement).value)) === 'Leo Rahman');
  let r = await talk('a checkup please');
  check('spoken "checkup" picks Well-child checkup, then the read-back is spoken', (await page.$eval('#visit', e => (e as HTMLSelectElement).value)) === 'wellchild' && /Here's what I have/.test(r), r);
  r = await talk('yes');
  check('spoken hand-back: press Next yourself', /press Next yourself/.test(r), r);
  check('the call never pressed Next', await page.locator('fieldset[data-step]').first().isVisible());
  await page.click('#copilot-widget .end');
  check('ending the call closes the panel', await page.locator('#copilot-widget .panel').isHidden());
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
