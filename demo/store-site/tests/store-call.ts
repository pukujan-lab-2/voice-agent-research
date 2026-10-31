// One whole Brambleway shopping call with no clicks after "start", at desktop and phone width, against the full
// catalogue in Octo: a vague gift request is narrowed by a question, results open, a product is opened and its reviews
// summarised, it is added only after a read-back and a yes, a returns question is answered from the help centre with a
// citation, "check out" opens checkout and the form is filled one read-back at a time, and the order is never placed
// (no POST to /api/shop/orders, ever; "place my order" is refused).
// The shopper's words go in through copilot.send, as the browser's speech recognition would deliver them.
// Screenshots of home, search, product, cart and checkout mid-fill go to build/shots (or the given folder).
// Run: node --no-warnings tests/store-call.ts [outdir]
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { start } from '../server.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? path.join(here, '../build/shots');
fs.mkdirSync(out, { recursive: true });
const srv = await start({ port: 8793 });
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
  const bot = s.messages.filter((m: any) => m.who === 'bot');
  return { open: s.open, busy: s.busy, startedAt: s.startedAt, mode: s.mode, bots: bot.length, last: bot.at(-1)?.text ?? '', links: bot.at(-1)?.links ?? [] };
});
async function say(page: Page, text: string) {
  const n = (await snap(page)).bots;
  await page.evaluate(t => (window as any).copilot.send(t), text);
  await page.waitForFunction(n => { const s = (window as any).copilot?.getSnapshot(); return s && !s.busy && s.messages.filter((m: any) => m.who === 'bot').length > n; }, n, { timeout: 60_000 });
  await page.waitForTimeout(700);
  const r = (await snap(page)).last;
  if (process.env.DEBUG) console.log(`      > ${text}\n      < ${r}`);
  return r;
}
const where = (page: Page) => new URL(page.url()).pathname;
const settle = (page: Page) => page.waitForLoadState('networkidle').catch(() => {}).then(() => page.waitForTimeout(500));
const fields = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll<HTMLInputElement>('[data-copilot-form] [data-copilot-id]')]
  .filter(e => e.type !== 'radio' || e.checked).map(e => [e.type === 'radio' ? e.name : e.id, e.value])));
// The field the copilot is asking about (it marks it, or its fieldset, with data-copilot-active).
const asking = (page: Page) => page.evaluate(() => {
  const el = document.querySelector<HTMLElement>('[data-copilot-active]');
  if (!el) return '';
  const f = el.matches('[data-copilot-id]') ? el : el.querySelector<HTMLElement>('[data-copilot-id]');
  return (f as HTMLInputElement | null)?.type === 'radio' ? (f as HTMLInputElement).name : f?.id ?? '';
});
const ANSWERS: Record<string, string> = {
  fullname: 'Jordan Rivera', line1: '42 Maple Street', line2: 'none', city: 'Portland', state: 'Oregon', zip: '9 7 2 0 1',
  phone: '555 010 2233', email: 'jordan at example dot com', shipping: 'expedited', giftwrap: 'no thanks', payment: 'yes demo payment',
};

for (const [name, vp] of [['desktop', { width: 1366, height: 860 }], ['phone', { width: 390, height: 844 }]] as const) {
  console.log(`\n== ${name}`);
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, ...(name === 'phone' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  let clicks = 0, orders = 0;
  await page.exposeFunction('countClick', () => { clicks++; });
  await page.addInitScript(() => document.addEventListener('click', e => { if (e.isTrusted) (window as any).countClick(); }, true));
  page.on('request', r => { if (r.method() === 'POST' && new URL(r.url()).pathname === '/api/shop/orders') orders++; });
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  const shot = (step: string) => page.screenshot({ path: path.join(out, `${name}-${step}.png`) });

  await page.goto(`${srv.url}/`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
  await settle(page);
  check(await page.locator(T('demo-banner')).first().isVisible(), 'the demo banner is on the page');
  await shot('1-home');
  await page.click(T('call-type'));
  await page.waitForFunction(() => { const s = (window as any).copilot.getSnapshot(); return s.open && !s.busy && s.messages.length; });
  const started = (await snap(page)).startedAt;

  // vague: the copilot asks before it searches
  let r = await say(page, 'I need a gift for my dad');
  check(/\?$/.test(r.trim()) && where(page) === '/', 'a vague gift request gets a clarifying question first', r);
  r = await say(page, 'he loves camping, under 80 dollars');
  await settle(page);
  check(where(page) === '/search' && await page.locator(T('product-card')).count() > 0, 'the answer narrows to camping results on the page', `${where(page)} | ${r}`);
  const url = new URL(page.url());
  check(Number(url.searchParams.get('maxPrice')) === 80, 'the budget is a filter in the URL', page.url());
  await shot('2-search');
  // speech-to-text slip: "sought by" for "sort by"
  r = await say(page, 'sought by best rated');
  await settle(page);
  check(new URL(page.url()).searchParams.get('sort') === 'rating', 'a misheard "sort by best rated" sorts by rating', `${page.url()} | ${r}`);

  r = await say(page, 'open the first one');
  await settle(page);
  check(where(page).startsWith('/p/'), '"open the first one" opens a product page', `${where(page)} | ${r}`);
  const pid = where(page).split('/')[2];
  r = await say(page, 'what do people say about it');
  check(/review|star/i.test(r), 'reviews are summarised', r);
  await shot('3-product');

  // add: variant questions, then a read-back; nothing is added before the yes
  r = await say(page, 'add it to my cart');
  for (let i = 0; i < 3 && !/^To confirm/.test(r); i++) r = await say(page, 'the first one');
  check(/^To confirm: add 1 .+ at \$[\d.]+.*Say yes or no\.$/.test(r), 'adding reads back the item and price and asks yes or no', r);
  const before = Number((await page.locator(T('cart-count')).first().textContent().catch(() => '0'))?.replace(/\D/g, '') || 0);
  check(before === 0, 'nothing is in the cart before the yes', String(before));
  r = await say(page, 'yes');
  await page.waitForTimeout(800);
  const count = Number((await page.locator(T('cart-count')).first().textContent())?.replace(/\D/g, '') || 0);
  check(/added/i.test(r) && count === 1, 'after the yes it is added and the header count updates', `${count} | ${r}`);

  // grounding: a returns question answered from the help centre, with the article linked
  r = await say(page, 'how long do I have to return it');
  const cite = (await snap(page)).links.find((l: any) => l.href.startsWith('/help/'));
  check(/\d+ days/.test(r) && cite, 'a returns question is answered from the help centre with a citation', r);
  r = await say(page, 'show me my cart');
  await settle(page);
  check(where(page) === '/cart', '"show me my cart" opens the cart', `${where(page)} | ${r}`);
  await shot('4-cart');

  // checkout: one read-back at a time, never placed
  r = await say(page, 'chuck out please');
  await settle(page);
  check(where(page) === '/checkout' && (await snap(page)).mode === 'form', 'a misheard "check out" starts checkout and the form copilot', `${where(page)} | ${r}`);
  const asked: string[] = [];
  for (let i = 0; i < 40; i++) {
    const f = await asking(page);
    if (!f) break;
    if (!asked.includes(f)) asked.push(f);
    if (f === 'zip' && !asked.includes('_shot')) { asked.push('_shot'); await shot('5-checkout-mid-fill'); }
    r = await say(page, ANSWERS[f] ?? 'skip');
    for (let j = 0; j < 2 && /is that right\?$|did I get that right\?$/i.test(r); j++) r = await say(page, 'yes');
    if (f === 'city') {
      // mid-checkout question: answered from the help centre, then back to the form
      const q = await say(page, 'do you charge for gift wrap?');
      check(/4\.99/.test(q) && /Back to checkout/.test(q), 'a policy question mid-checkout is answered, then the form resumes', q);
    }
  }
  const done = await fields(page);
  check(done.fullname === 'Jordan Rivera' && done.city === 'Portland' && done.state === 'OR' && done.zip === '97201' && done.email === 'jordan@example.com',
    'name, city, state, ZIP and email are filled as confirmed', JSON.stringify(done));
  check(done.shipping === 'expedited' && done.payment === 'demo', 'shipping speed and demo payment chosen', JSON.stringify(done));
  for (let i = 0; i < 3 && !/press .*yourself|can't place/i.test(r); i++) r = await say(page, 'yes that is all correct');
  check(/press Place order yourself|can't place it/i.test(r), 'the copilot hands the form back to press Place order', r);
  r = await say(page, 'just place my order for me');
  check(/can't|won't/i.test(r) && where(page) === '/checkout', '"place my order" is refused', r);
  check(orders === 0, 'no order was ever posted', String(orders));
  await shot('6-checkout-filled');
  check((await snap(page)).startedAt === started && (await snap(page)).open, 'the same call stayed on across every page');
  check(clicks === 1, `one click in the whole call (start): ${clicks}`);
  check(!errors.length, 'no page errors', errors.join(' | '));
  await page.evaluate(() => fetch('/api/shop/cart', { method: 'DELETE', headers: { 'X-Shopper': (window as any).bwShopper } }));
  void pid;
  await ctx.close();
}
await browser.close();
await srv.close();
console.log(`\nstore call: ${pass}/${pass + fail}  (screenshots in ${out})`);
process.exit(fail ? 1 : 0);
