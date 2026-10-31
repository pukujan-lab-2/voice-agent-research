// Screenshots of the Brindlewick pages at desktop and phone width, with the copilot answering a question on the home
// page and filling the intake form. Run: node tests/tax-shots.ts [--offline] [outdir]   (default build/shots)
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright-core';
import { start } from '../server.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv.slice(2).find(a => !a.startsWith('--')) ?? path.join(here, '../build/shots');
fs.mkdirSync(out, { recursive: true });
const srv = await start({ offline: process.argv.includes('--offline'), port: 8791 });
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const cached = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])[0];
const browser = await chromium.launch({ executablePath: `${cache}/${cached}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` });

const T = (id: string) => `[data-testid="${id}"]`;
const idle = (page: Page, n: number) => page.waitForFunction(n => {
  const s = (window as any).copilot?.getSnapshot();
  return s && !s.busy && s.messages.filter((m: any) => m.who === 'bot').length > n && !document.querySelector('[data-testid="call-panel"][data-busy="true"]');
}, n, { timeout: 60_000 });
const bots = (page: Page) => page.evaluate(() => (window as any).copilot.getSnapshot().messages.filter((m: any) => m.who === 'bot').length as number);
const say = async (page: Page, t: string) => {
  const n = await bots(page);
  await page.fill(T('call-input'), t);
  await page.click(T('call-send'));
  await idle(page, n);
};

for (const [name, vp] of [['desktop', { width: 1366, height: 860 }], ['phone', { width: 390, height: 844 }]] as const) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2, ...(name === 'phone' ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  for (const u of ['/tax', '/tax/services', '/tax/pricing', '/tax/team', '/tax/guides', '/tax/guides/publications-p17', '/tax/faq']) {
    await page.goto(`${srv.url}${u}?guest=1`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: path.join(out, `${name}${u.replaceAll('/', '-')}.png`), fullPage: name === 'desktop' && u !== '/tax/faq' && !u.includes('/guides/') });
  }
  // a suggested question, answered with its citation
  await page.goto(`${srv.url}/tax?guest=1`);
  await page.waitForSelector(T('tax-chip'));
  await page.locator(T('tax-chip')).first().click();
  await page.waitForFunction(() => { const s = (window as any).copilot?.getSnapshot(); return s && !s.busy && s.messages.at(-1)?.who === 'bot' && s.messages.some((m: any) => m.who === 'user'); }, null, { timeout: 60_000 });
  if (await page.locator(T('call-expand')).isVisible().catch(() => false)) await page.click(T('call-expand'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}-tax-answer.png`) });
  // the intake form, part filled, with the notice code read back
  await page.goto(`${srv.url}/tax/book?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
  await page.click(T('call-type'));
  await idle(page, 0);
  // each answer is confirmed when the copilot reads it back, as a person would; the notice code is left at its read-back
  const last = () => page.evaluate(() => (window as any).copilot.getSnapshot().messages.filter((m: any) => m.who === 'bot').at(-1).text as string);
  for (const t of ['Maria Okafor', '555 010 4477', 'maria at example dot com', 'married filing jointly', '2024 and 2025', 'IRS notice help', 'yes I got one']) {
    await say(page, t);
    if (/is that right\?$/i.test(await last())) await say(page, 'yes');
  }
  await say(page, 'C P two thousand');
  if (process.env.DEBUG) console.log(await page.evaluate(() => (window as any).copilot.getSnapshot().messages.map((m: any) => `${m.who}: ${m.text}`).join('\n')));
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(out, `${name}-tax-book.png`) });
  await ctx.close();
}
await browser.close();
await srv.close();
console.log(`screenshots in ${out}`);
