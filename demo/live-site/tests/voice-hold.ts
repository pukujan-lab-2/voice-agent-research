// Holds one voice call open on a site and keeps talking, so a deploy that lands in the middle shows whether the call survives it
// (#76). Every HOLD_EVERY_S seconds the caller asks something (macOS `say` into the page's microphone, as in tests/voice-call.ts);
// each turn prints one line with the time and whether the reply started within REPLY_WITHIN_MS. A call that a deploy cut shows as
// the first turn with no reply. Run it, then trigger the deploy (a merge to main, or `git push origin main:production`); the
// deploy log on the VPS (deploy/deploy.log) shows what it waited for.
// Run: node --no-warnings tests/voice-hold.ts [--site https://copilot.design-bakery.com] [--seconds 1080] [--every 30]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';

const opt = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const site = (opt('site') ?? 'https://copilot.design-bakery.com').replace(/\/$/, '');
const HOLD_S = Number(opt('seconds') ?? 1080), EVERY_S = Number(opt('every') ?? 30);
const REPLY_WITHIN_MS = Number(process.env.REPLY_WITHIN_MS ?? 12000);
const LINES = ['Can you hear me?', 'What can you help me with?', 'Are you still there?', 'Tell me about filing a tax return.', 'Hello? Can you hear me now?'];

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-hold-'));
const clip = (text: string): string => {
  const f = path.join(tmp, `${text.replace(/\W+/g, '-').slice(0, 40)}.wav`);
  execFileSync('say', ['-o', f, '--data-format=LEI16@24000', text]);
  return fs.readFileSync(f).toString('base64');
};
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const c = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().at(-1);
const browser = await chromium.launch({
  executablePath: `${cache}/${c}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERR', e.message));
await page.addInitScript(() => {
  const w = window as any;
  w.__log = [];
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  // A faint noise floor, as any real microphone has. Exact digital silence between clips makes livekit-client read the
  // publisher as "connection quality lost" and do a full reconnect (#93, #95); the page now rides that out, but the driver should not cause it.
  const noise = ctx.createBufferSource();
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.002;
  noise.buffer = nb; noise.loop = true; noise.connect(dest); noise.start();
  navigator.mediaDevices.getUserMedia = async () => { await ctx.resume(); return new MediaStream([dest.stream.getAudioTracks()[0].clone()]); };
  w.__play = async (b64: string) => {
    await ctx.resume();
    const buf = await ctx.decodeAudioData(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)).buffer);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(dest);
    src.start();
    await new Promise(r => { src.onended = r; });
    return performance.now();
  };
  const watch = () => {
    if (!w.copilot?.subscribe) { setTimeout(watch, 50); return; }
    let last = '';
    w.copilot.subscribe(() => {
      const s = w.copilot.getSnapshot();
      const key = `${s.status}|${s.messages.length}`;
      if (key !== last) { last = key; w.__log.push({ t: performance.now(), status: s.status, n: s.messages.length }); }
    });
  };
  watch();
});
const log = (): Promise<{ t: number; status: string; n: number }[]> => page.evaluate(() => (window as any).__log);
async function waitStatus(s: string, after: number, ms: number): Promise<number> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = (await log()).find(e => e.t > after && e.status === s);
    if (hit) return hit.t;
    await page.waitForTimeout(100);
  }
  return -1;
}
const stamp = () => new Date().toISOString().slice(11, 19);

await page.goto(`${site}/tax?guest=1`);
await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
await page.waitForFunction(() => (window as any).copilot.getSnapshot().voiceStacks.length > 0, null, { timeout: 30_000 });
const stack = await page.evaluate(() => (window as any).copilot.getSnapshot().stack);
const tap = await page.evaluate(() => performance.now());
await page.click('[data-testid="call-start"]');
const intro = await waitStatus('speaking', tap, 150_000);
console.log(`${stamp()} call started on ${site} (stack ${stack}); intro ${intro > 0 ? 'heard' : 'MISSING'}`);
if (intro < 0) process.exit(1);
await waitStatus('listening', intro, 30_000);

const end = Date.now() + HOLD_S * 1000;
let turn = 0, answered = 0;
while (Date.now() < end) {
  const started = Date.now();
  const line = LINES[turn % LINES.length];
  const done = await page.evaluate(b => (window as any).__play(b), clip(line));
  const spoke = await waitStatus('speaking', done, REPLY_WITHIN_MS);
  turn++;
  if (spoke > 0) answered++;
  console.log(`${stamp()} turn ${turn} "${line}": ${spoke > 0 ? `reply after ${Math.round(spoke - done)} ms` : 'NO REPLY'}`);
  if (spoke > 0) await waitStatus('listening', spoke, 40_000);
  await page.waitForTimeout(Math.max(0, EVERY_S * 1000 - (Date.now() - started)));
}
await page.evaluate(() => (window as any).copilot.end());
await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${stamp()} call ended: ${answered}/${turn} turns answered`);
process.exit(answered === turn ? 0 : 1);
