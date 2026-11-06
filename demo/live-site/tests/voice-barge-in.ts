// A call keeps hearing the caller after a barge-in, on every voice stack in agent/voice/stacks (#67). The shape that went
// wrong on lfm3-audio: the caller talks, talks over the voice, and then talks again; that third turn must be heard and
// answered within a few seconds. The microphone is a stream we play recorded clips into (macOS `say`), as in
// tests/voice-call.ts, so everything goes through LiveKit, the voice activity detector, the stack's speech models and the
// copilot engine. Nothing is typed.
//
// Per stack: 1. a long reply starts (small talk: "what can you help me with") and the caller talks over it;
//            2. the voice stops; the talk-over ("Wait, stop.") is itself a turn and is answered;
//            3. the caller asks "Can you hear me?" and the reply must start within HEAR_WITHIN_MS;
//            4. once more, to catch a call that hears one turn after a barge-in and then goes deaf.
//
// Needs the voice stack (LiveKit, speech/server.py, speech/agent.py) either local (server.ts starts what it can) or the
// public site with --site. A stack swap loads the stack's models on the speech machine (up to a minute), one stack at a
// time; on a live site that is the owner's machine, so pick --stacks on purpose.
// Run: node --no-warnings tests/voice-barge-in.ts [--site https://copilot.design-bakery.com] [--stacks lfm3-audio,multilingual]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page } from 'playwright-core';
import { loadVoice } from '../voice-config.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const opt = (name: string) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
const conf = loadVoice();
const stacks = opt('stacks')?.split(',') ?? Object.keys(conf.stacks);
for (const s of stacks) if (!conf.stacks[s]) throw new Error(`no stack ${s} in agent/voice/stacks`);
const HEAR_WITHIN_MS = Number(process.env.HEAR_WITHIN_MS ?? 8000);
const STOP_WITHIN_MS = 1500;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-barge-'));
let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
}
function clip(text: string): string {
  const f = path.join(tmp, `${text.replace(/\W+/g, '-').slice(0, 40)}.wav`);
  execFileSync('say', ['-o', f, '--data-format=LEI16@24000', text]);
  return fs.readFileSync(f).toString('base64');
}

let site = opt('site') ?? '';
let local: { url: string; close: () => Promise<void> } | undefined;
if (!site) {
  const { start } = await import('../server.ts');
  local = await start({ port: 0 });
  site = local.url;
  // The agent worker loads its models first, then registers.
  for (let i = 0; i < 120 && !(await fetch('http://127.0.0.1:8081/').then(() => true, () => false)); i++) await new Promise(r => setTimeout(r, 1000));
}
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const c = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().at(-1);
const browser = await chromium.launch({
  executablePath: `${cache}/${c}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});

type Ev = { t: number; status: string; n: number };
async function oneStack(stack: string) {
  console.log(`\n== ${stack}`);
  const page: Page = await browser.newPage();
  page.on('pageerror', e => console.log('PAGEERR', e.message));
  await page.addInitScript(() => {
    const w = window as any;
    w.__log = [];
    const ctx = new AudioContext({ sampleRate: 48000 });
    const dest = ctx.createMediaStreamDestination();
    navigator.mediaDevices.getUserMedia = async () => { await ctx.resume(); return new MediaStream([dest.stream.getAudioTracks()[0].clone()]); };
    w.__play = async (b64: string) => {
      await ctx.resume();
      const buf = await ctx.decodeAudioData(Uint8Array.from(atob(b64), ch => ch.charCodeAt(0)).buffer);
      const src = ctx.createBufferSource();
      src.buffer = buf; src.connect(dest);
      const start = performance.now();
      src.start();
      await new Promise(r => { src.onended = r; });
      return { start, end: performance.now() };
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
  const log = (): Promise<Ev[]> => page.evaluate(() => (window as any).__log);
  const now = (): Promise<number> => page.evaluate(() => performance.now());
  const bots = (): Promise<string[]> => page.evaluate(() => (window as any).copilot.getSnapshot().messages.filter((m: any) => m.who === 'bot').map((m: any) => m.text));
  async function waitStatus(s: string, after: number, ms: number): Promise<number> {
    const until = Date.now() + ms;
    while (Date.now() < until) {
      const hit = (await log()).find(e => e.t > after && e.status === s);
      if (hit) return hit.t;
      await page.waitForTimeout(50);
    }
    return -1;
  }
  const play = (text: string): Promise<{ start: number; end: number }> => page.evaluate(b => (window as any).__play(b), clip(text));

  await page.goto(`${site}/tax?guest=1`);
  await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
  await page.waitForFunction(() => (window as any).copilot.getSnapshot().voiceStacks.length > 0, null, { timeout: 30_000 });
  if (await page.$('[data-testid="call-stack"]')) await page.selectOption('[data-testid="call-stack"]', stack);
  const picked = await page.evaluate(() => (window as any).copilot.getSnapshot().stack);
  if (picked !== stack) { check(`${stack}: the page offers the stack`, false, `the page runs ${picked}`); await page.close(); return; }
  const tap = await now();
  await page.click('[data-testid="call-start"]');

  // The stack's models load before the greeting (up to a minute on the speech machine).
  const intro = await waitStatus('speaking', tap, 150_000);
  check(`${stack}: the call answers with its intro`, intro > 0);
  if (intro < 0) { await page.close(); return; }
  await waitStatus('listening', intro, 30_000);

  // 1. A long reply, and the caller talks over it.
  const ask = await play('What can you help me with?');
  const answering = await waitStatus('speaking', ask.end, 40_000);
  check(`${stack}: a reply starts`, answering > 0);
  await page.waitForTimeout(600);
  const speakingNow = (await page.evaluate(() => (window as any).copilot.getSnapshot().status)) === 'speaking';
  check(`${stack}: the reply is still playing when the caller talks over it`, speakingNow);
  const barge = page.evaluate(b => (window as any).__play(b), clip('Wait, stop.'));
  const bargeAt = await now();
  const stopped = await waitStatus('listening', bargeAt, STOP_WITHIN_MS + 4000);
  const bargeClip = await barge;
  check(`${stack}: talking over the voice stops it`, stopped > 0 && stopped - bargeAt < STOP_WITHIN_MS + 1500, `${Math.round(stopped - bargeAt)} ms`);

  // 2-4. The talk-over is a turn, and the caller keeps talking: every later turn must be heard and answered.
  await waitStatus('speaking', bargeClip.end, 20_000); // "Sure, take your time."
  await waitStatus('listening', bargeClip.end + 500, 20_000);
  for (const line of ['Can you hear me?', 'Hello? Are you there?']) {
    const before = (await bots()).length;
    const said = await play(line);
    const spoke = await waitStatus('speaking', said.end, HEAR_WITHIN_MS);
    const after = await bots();
    check(`${stack}: after the barge-in, "${line}" is heard and answered within ${HEAR_WITHIN_MS / 1000} s`,
      spoke > 0 && after.length > before, `${spoke < 0 ? 'no reply' : `${Math.round(spoke - said.end)} ms`}; last reply: ${after.at(-1)?.slice(0, 80) ?? '(none)'}`);
    if (spoke < 0) break; // a deaf call stays deaf: the next turn would only repeat the failure
    await waitStatus('listening', spoke, 40_000);
  }
  await page.evaluate(() => (window as any).copilot.end());
  await page.close();
}

for (const s of stacks) await oneStack(s);
await browser.close();
await local?.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nvoice barge-in: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
