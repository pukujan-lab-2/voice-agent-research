// Replays a caller's turns on a running site in a real browser, as typed chat, and prints the dialogue. Run it after a
// deploy to see what the site does now; the call's id is the Phoenix session that holds its spans.
// Run: node demo/live-site/tests/live-replay.ts [--site https://copilot.design-bakery.com] [--page /tax] [--turns demo/live-site/tests/replays/call-7d689fcd.json]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const site = arg('--site', 'https://copilot.design-bakery.com').replace(/\/$/, ''), page0 = arg('--page', '/tax');
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../..');
const turns: string[] = JSON.parse(fs.readFileSync(path.resolve(root, arg('--turns', 'demo/live-site/tests/replays/call-7d689fcd.json')), 'utf8'));

const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const cached = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])[0];
const browser = await chromium.launch({ executablePath: `${cache}/${cached}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` });
const page = await (await browser.newContext({ viewport: { width: 1366, height: 860 } })).newPage();
await page.goto(`${site}${page0}?guest=1`);
await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted, null, { timeout: 60_000 });
await page.click('[data-testid="call-type"]');
await page.waitForFunction(() => { const s = (window as any).copilot.getSnapshot(); return s.open && !s.busy && s.messages.length; }, null, { timeout: 60_000 });

const bots = () => page.evaluate(() => (window as any).copilot.getSnapshot().messages.filter((m: any) => m.who === 'bot').length);
const log: { said: string; reply: string; path: string }[] = [];
for (const said of turns) {
  const n = await bots();
  const before = page.url();
  await page.evaluate(t => (window as any).copilot.send(t), said);
  await page.waitForFunction(n => { const s = (window as any).copilot.getSnapshot(); return !s.busy; }, n, { timeout: 120_000 });
  await page.waitForTimeout(1500);
  const reply = await page.evaluate(n => { const m = (window as any).copilot.getSnapshot().messages.filter((m: any) => m.who === 'bot'); return m.slice(n).map((x: any) => x.text).join(' | '); }, n);
  log.push({ said, reply, path: new URL(page.url()).pathname + (page.url() === before ? '' : ' (page changed)') });
  console.log(`Visitor: ${said}\nCopilot: ${reply || '(nothing said)'}\n         [${log.at(-1)!.path}]\n`);
}
const callId = await page.evaluate(() => (window as any).copilot.getSnapshot().callId ?? '');
console.log('call id (Phoenix session):', callId || '(not in the snapshot)');
await browser.close();
