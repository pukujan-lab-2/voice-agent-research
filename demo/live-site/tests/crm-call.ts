// A staff member's call in the Brindlewick practice app (/staff), at desktop and phone width, with no clicks after
// "Continue as Priya" and "start call": "open the Garcia household" (asks which one when there are several),
// "show returns waiting on documents", "which notices are due this week", then "start a new engagement for the Garcia
// household" fills the new-engagement form with read-backs to the end, and the copilot never presses Create.
// The staff member's words go in through copilot.send, as the browser's speech recognition would deliver them.
// Run: node tests/crm-call.ts [outdir]   (default build/crm-shots)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { start } from '../server.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? path.join(here, '../build/crm-shots');
fs.mkdirSync(out, { recursive: true });
const srv = await start({ port: 0 });
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const cached = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])[0];
const browser = await chromium.launch({ executablePath: `${cache}/${cached}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` });

let pass = 0, fail = 0;
const check = (ok: unknown, what: string, detail = '') => {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${what}${!ok && detail ? `\n      ${detail}` : ''}`);
};
const T = (id: string) => `[data-testid="${id}"]`;
const snap = (page: Page) => page.evaluate(() => {
  const s = (window as any).copilot.getSnapshot();
  return { open: s.open, busy: s.busy, startedAt: s.startedAt, mode: s.mode, bots: s.messages.filter((m: any) => m.who === 'bot').length,
    last: s.messages.filter((m: any) => m.who === 'bot').at(-1)?.text ?? '' };
});
async function say(page: Page, text: string) {
  const n = (await snap(page)).bots;
  await page.evaluate(t => (window as any).copilot.send(t), text);
  await page.waitForFunction(n => { const s = (window as any).copilot?.getSnapshot(); return s && !s.busy && s.messages.filter((m: any) => m.who === 'bot').length > n; }, n, { timeout: 90_000 });
  await page.waitForTimeout(600);
  return (await snap(page)).last;
}
const where = (page: Page) => { const u = new URL(page.url()); return u.pathname + u.search; };
const value = (page: Page, id: string) => page.evaluate(i => (document.getElementById(i) as HTMLInputElement | null)?.value ?? null, id);

for (const [name, vp] of ([['desktop', { width: 1366, height: 860 }], ['phone', { width: 390, height: 844 }]] as const).filter(([n]) => !process.env.ONLY || n === process.env.ONLY)) {
  console.log(`\n== ${name}`);
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, ...(name === 'phone' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  let clicks = 0, submitted = false;
  await page.exposeFunction('countClick', () => { clicks++; });
  await page.exposeFunction('formSubmitted', () => { submitted = true; });
  await page.addInitScript(() => {
    document.addEventListener('click', e => { if (e.isTrusted) (window as any).countClick(); }, true);
    document.addEventListener('submit', () => (window as any).formSubmitted(), true);
  });
  const posts: string[] = [];
  page.on('request', r => { if (r.method() === 'POST' && /\/api\/staff\/(engagement|task|stage|message|doc-request)/.test(r.url())) posts.push(r.url()); });
  const shot = (step: string) => page.screenshot({ path: path.join(out, `${name}-${step}.png`) });

  await page.goto(`${srv.url}/staff`);
  await page.click(T('staff-login'));
  await page.waitForSelector(T('staff-dashboard'), { timeout: 30_000 });
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
  check(true, 'signed in as Priya; the dashboard is up');
  await shot('1-dashboard');
  await page.click(T('call-type'));
  await page.waitForFunction(() => { const s = (window as any).copilot.getSnapshot(); return s.open && !s.busy && s.messages.length; });
  const started = (await snap(page)).startedAt;
  clicks = 0;

  let r = await say(page, 'open the Garcia household');
  if (/which one/i.test(r)) {
    check(/garcia/i.test(r), 'several Garcia households: it asks which one, naming them', r);
    r = await say(page, 'the first one');
  }
  await page.waitForSelector(T('staff-client-detail'), { timeout: 20_000 }).catch(() => null);
  check(/^\/staff\/clients\/HH-\d{5}/.test(where(page)) && /garcia/i.test(await page.locator(T('staff-client-detail')).innerText().catch(() => '')), '"open the Garcia household" opens a Garcia household', `${where(page)} | ${r}`);
  await shot('2-garcia');

  r = await say(page, 'show returns waiting on documents');
  check(where(page).startsWith('/staff/engagements') && new URL(page.url()).searchParams.get('stage') === 'docs_in', '"show returns waiting on documents" filters engagements to docs in', `${where(page)} | ${r}`);
  check(/\d[\d,]* .*waiting on documents/i.test(r), 'and says how many', r);
  await shot('3-waiting-docs');

  r = await say(page, 'which notices are due this week');
  check(where(page).startsWith('/staff/notices') && new URL(page.url()).searchParams.get('due_within') === '7', '"which notices are due this week" opens notices due within 7 days', `${where(page)} | ${r}`);
  check(/\d|no notices/i.test(r), 'and says how many', r);
  await shot('4-notices');

  r = await say(page, 'start a new engagement for the Garcia household');
  if (/which one/i.test(r)) r = await say(page, 'the first one');
  await page.waitForSelector(T('staff-engagement-form'), { timeout: 20_000 }).catch(() => null);
  check(where(page).startsWith('/staff/engagements/new'), '"start a new engagement for the Garcia household" opens the form', `${where(page)} | ${r}`);
  await page.waitForTimeout(800);
  check(/garcia/i.test(String(await value(page, 'eng_client'))) && /^HH-\d{5}$/.test(String(await value(page, 'eng_client_ref'))), 'the client is already picked', `${await value(page, 'eng_client')} ${await value(page, 'eng_client_ref')}`);
  check((await snap(page)).mode === 'form', 'the copilot starts on the form');
  const answers = ['individual return', '1040', 'last year', 'Priya', 'none', '425', 'client prefers email'];
  const readbacks: string[] = [];
  for (const t of answers) {
    r = await say(page, t);
    for (let i = 0; i < 3 && /is that right\?$/i.test(r); i++) { readbacks.push(r); r = await say(page, 'yes'); }
  }
  check(readbacks.length >= 3, `answers are read back (${readbacks.length})`, readbacks.join(' | '));
  const got = Object.fromEntries(await Promise.all(['eng_kind', 'eng_form', 'eng_year', 'eng_preparer', 'eng_reviewer', 'eng_fee', 'eng_notes'].map(async id => [id, await value(page, id)])));
  check(got.eng_kind === 'Individual return' && got.eng_form === '1040' && got.eng_year === '2025' && got.eng_preparer === 'st-pra' && got.eng_reviewer === '' && /^425(\.00)?$/.test(got.eng_fee ?? '') && /email/i.test(got.eng_notes ?? ''),
    'every field is filled as said', JSON.stringify(got));
  check(/due date|create|button|yourself|check/i.test(r), 'at the end it hands over (the due date and Create are the person\'s)', r);
  await shot('5-engagement-filled');
  fs.writeFileSync(path.join(out, `${name}-transcript.json`), JSON.stringify(await page.evaluate(() => (window as any).copilot.getSnapshot().messages.map((m: any) => `${m.who}: ${m.text}`)), null, 1));
  check(!submitted && !posts.length && !(await page.locator(T('staff-saved')).count()), 'the copilot never pressed Create (no submit, no POST)', posts.join(', '));
  check(clicks === 0, `no clicks after starting the call (${clicks})`);
  check((await snap(page)).startedAt === started && (await snap(page)).open, 'the same call stayed on throughout');
  await ctx.close();
}

await browser.close();
await srv.close();
console.log(`\ncrm call: ${pass}/${pass + fail}  (screenshots in ${out})`);
process.exit(fail ? 1 : 0);
