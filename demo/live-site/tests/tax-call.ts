// One whole Brindlewick call with no clicks after "start call", at desktop and phone width: a tax question opens its
// source with the quoted line highlighted, spoken requests change page (the call stays on), an unknown page gets close
// matches, "go back to the form" brings back the half-filled form, and the form is filled to the end and never sent.
// Then the caller asks about their return, is verified by voice (name, birth date, last four, zip, each read back and
// confirmed) and sees their sample return card, with no birth date, last four or zip ever shown on the page.
// The caller's words go in through copilot.send, as the browser's speech recognition would deliver them.
// Run: node tests/tax-call.ts [--offline] [outdir]   (default build/call-shots)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { loadEnv, start } from '../server.ts';
import { formatDate } from '../../../copilot-engine/src/guard.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? path.join(here, '../build/call-shots');
fs.mkdirSync(out, { recursive: true });
const srv = await start({ offline: process.argv.includes('--offline'), port: 8792 });
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const cached = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])[0];
const browser = await chromium.launch({ executablePath: `${cache}/${cached}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` });

// Two fictional sample clients (one per width), read from the Octo client list; in --offline runs the step is skipped.
const env = loadEnv();
const sample: { full_name: string; dob: string; ssn4: string; zip: string }[] = process.argv.includes('--offline') ? [] : ((await (await fetch(`${env.OCTO_BASE || 'https://octodb.design-bakery.com/api'}/workspaces/${env.OCTO_WORKSPACE}/query`, {
  method: 'POST', headers: { Authorization: `Bearer ${env.OCTO_KEY}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ sql: "select full_name, dob::text, ssn4, zip from bw_clients where id in ('BW-10042', 'BW-10317') order by id" }) })).json()).rows ?? []);

let pass = 0, fail = 0;
const check = (ok: unknown, what: string, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${!ok && detail ? `\n      ${detail}` : ''}`);
};
const T = (id: string) => `[data-testid="${id}"]`;
const snap = (page: Page) => page.evaluate(() => {
  const s = (window as any).copilot.getSnapshot();
  return { open: s.open, busy: s.busy, startedAt: s.startedAt, mode: s.mode, source: s.source, bots: s.messages.filter((m: any) => m.who === 'bot').length,
    last: s.messages.filter((m: any) => m.who === 'bot').at(-1)?.text ?? '' };
});
// Waits for the copilot's reply to what was said (and any page change it made) to finish.
async function say(page: Page, text: string) {
  const n = (await snap(page)).bots;
  await page.evaluate(t => (window as any).copilot.send(t), text);
  await page.waitForFunction(n => { const s = (window as any).copilot?.getSnapshot(); return s && !s.busy && s.messages.filter((m: any) => m.who === 'bot').length > n; }, n, { timeout: 90_000 });
  await page.waitForTimeout(700); // smooth scrolling and the viewer's slide-in
  return (await snap(page)).last;
}
const highlighted = (page: Page) => page.evaluate(() => {
  const h = (CSS as any).highlights?.get('copilot-quote');
  return h ? [...h].map((r: Range) => r.toString()).join(' ') : '';
});
const fields = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLInputElement>('[data-copilot-id]')]
  .filter(e => e.type !== 'radio' || e.checked).map(e => [e.id || e.dataset.copilotId, e.type === 'radio' ? e.dataset.copilotOption : e.value])));

for (const [name, vp] of [['desktop', { width: 1366, height: 860 }], ['phone', { width: 390, height: 844 }]] as const) {
  console.log(`\n== ${name}`);
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, ...(name === 'phone' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  let clicks = 0;
  await page.exposeFunction('countClick', () => { clicks++; });
  await page.addInitScript(() => document.addEventListener('click', e => { if (e.isTrusted) (window as any).countClick(); }, true));
  let submitted = false;
  await page.exposeFunction('formSubmitted', () => { submitted = true; });
  await page.addInitScript(() => document.addEventListener('submit', () => (window as any).formSubmitted(), true));
  const shot = (step: string) => page.screenshot({ path: path.join(out, `${name}-${step}.png`) });

  await page.goto(`${srv.url}/tax?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
  check(await page.locator(T('tax-disclaimer')).first().isVisible(), 'the demo bar is on the page');
  await page.click(T('call-type'));
  await page.waitForFunction(() => { const s = (window as any).copilot.getSnapshot(); return s.open && !s.busy && s.messages.length; });
  const started = (await snap(page)).startedAt;
  check(/demo site, so no real details please/.test((await snap(page)).last), 'the greeting carries the demo note');
  await shot('1-greeting');

  // the firm's site: spoken requests open its pages (content from the practice API), and three of its forms are
  // filled to the end by voice with every answer read back; none is ever sent
  const tour: [string, string, string][] = [
    ['show me the team', '/tax/team', 'team-member'], ['where are your offices', '/tax/locations', 'location-card'],
    ['open the tax calendar', '/tax/tools/calendar', 'deadline-row'], ['show the mileage calculator', '/tax/tools/mileage', 'calc-result'],
    ['take me to careers', '/tax/careers', 'job-card'], ['show me the reviews', '/tax/reviews', 'review-card'],
    ['open the articles', '/tax/blog', 'article-card'], ['show the rideshare page', '/tax/industries/rideshare-gig', 'industry-page'],
  ];
  for (const [said, to, hook] of tour) {
    const r = await say(page, said);
    await page.locator(T(hook)).first().waitFor({ timeout: 15_000 }).catch(() => {});
    check(new URL(page.url()).pathname === to && await page.locator(T(hook)).count() > 0, `"${said}" opens ${to} with its content`, `${page.url()} | ${r}`);
  }
  await shot('0a-site-page');
  const fill = async (said: string, to: string, formId: string, answers: string[], expect: Record<string, string>) => {
    let r = await say(page, said);
    // the page change says "Here's the … page" first; the form's first question follows once the form is read
    await page.waitForFunction(() => { const s = (window as any).copilot.getSnapshot(); return !s.busy && s.mode === 'form' && /\?$/.test(s.messages.filter((m: any) => m.who === 'bot').at(-1)?.text ?? ''); }, null, { timeout: 15_000 }).catch(() => {});
    r = (await snap(page)).last;
    check(new URL(page.url()).pathname === to && /\?$/.test(r), `"${said}" opens ${to} and starts the form`, `${page.url()} | ${r}`);
    let readbacks = 0;
    for (const t of answers) {
      r = await say(page, t);
      for (let i = 0; i < 3 && /is that right\?$/i.test(r); i++) { readbacks++; r = await say(page, 'yes'); }
    }
    if (/is that all correct\?/i.test(r)) r = await say(page, 'yes');
    const got: Record<string, string> = await page.evaluate(ids => Object.fromEntries(ids.map(id => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      const radio = document.querySelector<HTMLInputElement>(`input[type=radio][id^="${id}_"]:checked`);
      return [id, el ? el.value : radio ? radio.value : ''];
    })), Object.keys(expect));
    const wrong = Object.entries(expect).filter(([k, v]) => !(got[k] ?? '').toLowerCase().includes(v.toLowerCase()));
    check(!wrong.length, `${formId}: every answer is in its box`, JSON.stringify(wrong.map(([k]) => [k, got[k]])));
    check(readbacks >= answers.length - 3, `${formId}: answers read back (${readbacks})`);
    check(/yourself/i.test(r) && !submitted && !(await page.locator(T('form-confirmation')).count()), `${formId}: handed back, never sent`, r);
    return r;
  };
  await fill('refer a friend', '/tax/refer', 'referral-form',
    ['Jordan Example', 'jordan at example dot com', 'Sam Rivera', 'none', '555 010 0142', 'a friend', 'payroll', 'none'],
    { rf_your_name: 'Jordan Example', rf_your_email: 'jordan@example.com', rf_friend_name: 'Sam Rivera', rf_friend_phone: '0142', rf_relationship: 'friend', rf_service: 'payroll' });
  await shot('0b-referral-filled');
  await fill('I need a payment plan', '/tax/payment-plan', 'plan-form',
    ['Jordan Example', 'jordan at example dot com', '555 010 0199', '2023 and 2024', '8400', '350', 'long term', 'yes', 'no', 'none'],
    { pp_name: 'Jordan Example', pp_email: 'jordan@example.com', pp_years: '2023', pp_owed: '8', pp_monthly: '350', pp_plan: 'long', pp_notice: 'yes', pp_debit: 'no' });
  await fill('I need a copy of my old return', '/tax/prior-year', 'prior-form',
    ['Jordan Example', 'jordan at example dot com', '555 010 0199', '2023', 'both', 'the portal', 'a mortgage', 'none'],
    { tr_name: 'Jordan Example', tr_year: '2023', tr_what: 'both', tr_delivery: 'portal', tr_purpose: 'mortgage' });
  await shot('0c-prior-year-filled');
  if (process.env.TOUR_ONLY) { check(clicks === 1, `one click in the whole call (start call): ${clicks}`); await ctx.close(); continue; }
  const home = await say(page, 'take me to the home page');
  check(new URL(page.url()).pathname === '/tax', '"take me to the home page" goes back home', home);

  // a question: the answer's source opens by itself with the quoted words highlighted
  let r = await say(page, 'What is the standard deduction for a single filer?');
  const s = await snap(page);
  check(s.source && (await page.locator(T('source-viewer')).isVisible()), 'the source viewer opened by itself', r);
  const hl = await highlighted(page);
  check(s.source?.found === true && hl.length > 20 && /^I've opened /.test(r), 'the quoted line is highlighted and the copilot says so', `${r} | found=${s.source?.found} | ${hl}`);
  // letters and digits only, as the highlighter matches them (a PDF's text layer drops "$" and splits words over lines)
  const loose = (t: string) => t.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');
  check(!!s.source && loose(s.source.quote.join(' ')).includes(loose(hl.split(' ').slice(0, 4).join(' '))), 'the highlight is the quoted text', hl);
  check(await page.locator(T('call-source-chip')).count() > 0, 'the answer has a citation chip');
  await shot('2-source');
  r = await say(page, 'close that');
  check(!(await snap(page)).source && !(await page.locator(T('source-viewer')).isVisible().catch(() => false)), '"close that" closes the viewer', r);
  r = await say(page, 'where did you get that');
  check((await snap(page)).source && (await highlighted(page)).length > 20, '"where did you get that" opens it again, highlighted', r);

  // spoken navigation; the call stays on across pages
  r = await say(page, 'take me to pricing');
  check(new URL(page.url()).pathname === '/tax/pricing' && !(await snap(page)).source, '"take me to pricing" goes to the pricing page', r);
  await shot('3-pricing');
  r = await say(page, 'take me to the booking form');
  check(new URL(page.url()).pathname === '/tax/book' && (await snap(page)).mode === 'form', 'goes to the booking form, which the copilot starts on', r);
  for (const t of ['Maria Okafor', '555 010 4477']) { r = await say(page, t); if (/is that right\?$/i.test(r)) r = await say(page, 'yes'); }
  const half = await fields(page);
  check(half.fullname && half.tel, 'two answers are filled in', JSON.stringify(half));
  await shot('4-half-filled');
  r = await say(page, 'show the payroll services page');
  check(new URL(page.url()).pathname === '/tax/services/payroll', '"show the payroll services page" goes there', r);
  r = await say(page, 'take me to the parking garage page');
  check(/couldn't find/i.test(r) && /closest are/i.test(r), 'an unknown page gets "I couldn\'t find that" and close matches', r);
  r = await say(page, 'open the guide about filing status');
  check(new URL(page.url()).pathname.startsWith('/tax/guides/'), '"open the guide about filing status" opens a guide', r);
  await shot('5-guide');
  r = await say(page, 'go back to the form');
  await page.waitForTimeout(800);
  const back = await fields(page);
  check(new URL(page.url()).pathname === '/tax/book' && back.fullname === half.fullname && back.tel === half.tel, '"go back to the form" restores the answers', `${r} | ${JSON.stringify(back)}`);
  check(/email/i.test(r), 'and carries on from the open question', r);
  check((await snap(page)).startedAt === started && (await snap(page)).open, 'the same call stayed on throughout');

  // the rest of the form, to the end; it is never sent
  for (const t of ['maria at example dot com', 'married filing jointly', '2024 and 2025', 'IRS notice help', 'yes I got one', 'C P two thousand', 'Tuesday', 'morning', 'no notes']) {
    r = await say(page, t);
    // "Tuesday" with two Tuesdays offered: the copilot asks which one; pick the first it names
    const which = /^Which one: (.+?)(?:, (?=[A-Z][a-z]+day)| or )/.exec(r);
    if (which) { check(true, `"${t}" matched two days, so it asked which: ${r}`); r = await say(page, which[1]); }
    for (let i = 0; i < 2 && /is that right\?$|did I get that right\?$/i.test(r); i++) r = await say(page, 'yes');
    if (/check the form|press|look right|anything to change/i.test(r)) break;
  }
  for (let i = 0; i < 4 && !/press .*yourself|handed the form back/i.test(r); i++) r = await say(page, /anything to change|look right/i.test(r) ? 'no that all looks right' : 'yes');
  const done = await fields(page);
  check(Object.values(done).filter(Boolean).length >= 9, 'the form is filled in', JSON.stringify(done));
  check(!submitted && new URL(page.url()).pathname === '/tax/book', 'the copilot never submits', r);
  await shot('6-filled');

  // caller verification: "check on my return", four answers each read back, then the sample return card
  const who = sample[name === 'desktop' ? 0 : 1];
  if (who) {
    const forms = [who.dob, formatDate(who.dob), who.ssn4, [...who.ssn4].join(', '), who.zip, [...who.zip].join(', ')];
    const seen = async () => { const t = await page.evaluate(() => document.body.innerText + '\n' + JSON.stringify((window as any).copilot.getSnapshot().messages)); return forms.filter(f => t.includes(f)); };
    const before = await seen();
    r = await say(page, 'take me to pricing');
    r = await say(page, 'Can you check on my return?');
    check(/full name/i.test(r) && /can't read out anything/i.test(r), 'asking about "my return" starts verification', r);
    for (const t of [who.full_name, formatDate(who.dob), [...who.ssn4].join(' '), who.zip.split('').join(' ')]) {
      r = await say(page, t);
      check(/I heard .+ Is that right\?$/.test(r), `read back before it is used (${t === who.full_name ? 'name' : 'secret value'})`, r);
      r = await say(page, 'yes');
    }
    check(/you're verified/i.test(r), 'verified after four confirmed answers', r);
    await page.locator(T('return-card')).waitFor({ timeout: 10_000 }).catch(() => {});
    check(await page.locator(T('return-card')).isVisible() && await page.locator(T('return-card-sample')).isVisible(), 'the return card shows, labelled as sample data');
    const leaked = (await seen()).filter(f => !before.includes(f));
    check(!leaked.length, 'no birth date, last four or zip on the page or in the transcript', `${leaked.length} value(s) visible`);
    await shot('7-verified');
    // the verified call opens this caller's portal: no password, no demo login, the call stays on
    r = await say(page, 'open my client portal');
    await page.locator(T('portal-dashboard')).waitFor({ timeout: 20_000 }).catch(() => {});
    const home = await page.locator(T('portal-dashboard')).innerText().catch(() => '');
    check(new URL(page.url()).pathname.startsWith('/tax/portal') && home.includes(who.full_name.split(' ')[0]), 'the verified call opens the caller\'s own portal', `${page.url()} | ${r} | ${home.slice(0, 80)}`);
    check(await page.locator(T('portal-return-status')).isVisible(), 'the portal shows the return status');
    const shown = (await seen()).filter(f => !before.includes(f));
    check(!shown.length, 'the portal shows no birth date, last four or zip', await page.evaluate(fs => fs.map(f => { const t = document.body.innerText; const i = t.indexOf(f); return i < 0 ? `${f.length} chars: in the transcript` : `…${t.slice(Math.max(0, i - 40), i).replace(/\d/g, '#')}[value]…`; }).join(' | '), shown));
    await shot('8-portal');
  }
  check(clicks === 1, `one click in the whole call (start call): ${clicks}`);
  if (process.env.DEBUG) console.log(await page.evaluate(() => (window as any).copilot.getSnapshot().messages.map((m: any) => `${m.who}: ${m.text}`).join('\n')));
  await ctx.close();
}
await browser.close();
await srv.close();
console.log(`\ntax call: ${pass}/${pass + fail}  (screenshots in ${out})`);
process.exit(fail ? 1 : 0);
