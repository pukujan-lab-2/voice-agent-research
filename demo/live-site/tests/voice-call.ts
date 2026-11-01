// A voice call with real audio, end to end: the page's microphone is a stream we play recorded clips into (macOS `say`,
// one with background noise), so every turn goes through LiveKit, Silero VAD and the turn detector, Parakeet, the
// copilot engine and Pocket TTS, as a caller's would. Nothing is typed or injected as text.
//
// Checks: the microphone is asked for before any audio; the spoken intro is one short line (under 4 s); "can you hear
// me" and its variants get a quick reply and never search; a real question is answered from the library; talking over
// the voice stops it (barge-in); each turn's first audio after the end of the caller's speech; and the call record the
// page sends to Phoenix (#17): every turn with what was heard and its timings, and the call with its outcome. The agent's
// own spans (end-of-turn wait, first audio, barge-ins) go straight to Octo from speech/telemetry.py.
//
// Needs the voice stack running (livekit-server --dev, speech/server.py, speech/agent.py); server.ts starts what it can.
// Run: node --no-warnings tests/voice-call.ts
// Against a deployed site instead of a local one: SITE_URL=https://copilot.design-bakery.com node --no-warnings tests/voice-call.ts
// (the site's own voice agent answers; the Mac needs only `say` and Chrome for Testing). With DEPLOY_SHA set, the result
// is also recorded in Phoenix as an eval span on that deploy (POST /api/score, call id deploy-<sha>).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { start } from '../server.ts';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-call-'));
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

const siteUrl = process.env.SITE_URL?.replace(/\/$/, '');
const srv = siteUrl ? { url: siteUrl, close: async () => {} } : await start({ port: 0 });
// The agent worker loads its models first (the turn detector takes up to about 30 s on a busy laptop), then registers.
for (let i = 0; !siteUrl && i < 120 && !(await fetch('http://127.0.0.1:8081/').then(() => true, () => false)); i++) await new Promise(r => setTimeout(r, 1000));
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const c = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().at(-1);
const browser = await chromium.launch({
  executablePath: `${cache}/${c}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERR', e.message));
const searches: number[] = [];
page.on('request', r => { if (r.url().includes('/api/search')) searches.push(Date.now()); });
// What the page records for Phoenix (POST /api/trace), span by span.
const spans: { name: string; output?: string; attrs: Record<string, unknown> }[] = [];
page.on('request', r => { if (r.url().includes('/api/trace')) spans.push(...(JSON.parse(r.postData() ?? '{}').spans ?? [])); });

// The microphone: an audio graph the test plays clips into. Every status change is recorded with its time.
await page.addInitScript(() => {
  const w = window as any;
  w.__gum = [];
  w.__log = [];
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  navigator.mediaDevices.getUserMedia = async () => { w.__gum.push(performance.now()); await ctx.resume(); return new MediaStream([dest.stream.getAudioTracks()[0].clone()]); };
  w.__play = async (b64: string, noise: number) => {
    await ctx.resume();
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const buf = await ctx.decodeAudioData(bytes.buffer);
    if (noise) { const d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] += (Math.random() * 2 - 1) * noise; }
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(dest);
    const t0 = performance.now();
    src.start();
    await new Promise(r => { src.onended = r; });
    return { start: t0, end: performance.now() };
  };
  const watch = () => {
    if (!w.copilot?.subscribe) { setTimeout(watch, 50); return; }
    let last = '';
    w.copilot.subscribe(() => {
      const s = w.copilot.getSnapshot();
      const key = `${s.status}|${s.heard}|${s.messages.length}`;
      if (key !== last) { last = key; w.__log.push({ t: performance.now(), status: s.status, heard: s.heard, n: s.messages.length }); }
    });
  };
  watch();
});

type Ev = { t: number; status: string; heard: string; n: number };
const log = (): Promise<Ev[]> => page.evaluate(() => (window as any).__log);
const now = (): Promise<number> => page.evaluate(() => performance.now());
const lastBot = (): Promise<string> => page.evaluate(() => [...(window as any).copilot.getSnapshot().messages].reverse().find((m: any) => m.who === 'bot')?.text ?? '');
const status = (): Promise<string> => page.evaluate(() => (window as any).copilot.getSnapshot().status);
async function waitStatus(s: string, after: number, ms = 60_000): Promise<number> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = (await log()).find(e => e.t > after && e.status === s);
    if (hit) return hit.t;
    await page.waitForTimeout(50);
  }
  return -1;
}
// Plays a clip as the caller, then waits for the reply to be spoken through.
async function caller(text: string, noise = 0) {
  const n = (await page.evaluate(() => (window as any).copilot.getSnapshot().messages.length)) as number;
  const s0 = searches.length;
  const { start: t0, end } = await page.evaluate(([b, z]) => (window as any).__play(b, z), [clip(text), noise] as const);
  const spoke = await waitStatus('speaking', end, 90_000);
  await waitStatus('listening', Math.max(spoke, end), 90_000);
  const said: string[] = await page.evaluate(n => (window as any).copilot.getSnapshot().messages.slice(n).map((m: any) => `${m.who}: ${m.text}`), n);
  return { said, firstAudio: spoke < 0 ? -1 : Math.round(spoke - end), searched: searches.length - s0, t0, end };
}

await page.goto(`${srv.url}/tax?guest=1`);
await page.waitForFunction(() => (window as any).copilot?.getSnapshot().mounted);
const tap = await now();
await page.click('[data-testid="call-start"]');

// 1. Microphone first, then a short intro.
const introSpeak = await waitStatus('speaking', tap, 60_000);
const gum: number[] = await page.evaluate(() => (window as any).__gum);
check('the microphone is asked for before any audio', gum.length > 0 && introSpeak > 0 && gum[0] < introSpeak, `gum ${gum[0]} speaking ${introSpeak}`);
const introDone = await waitStatus('listening', introSpeak, 30_000);
const introMs = introDone - introSpeak;
check('the spoken intro is one short line, under 4 s', introSpeak > 0 && introDone > 0 && introMs < 4000, `${introMs} ms`);
console.log(`      tap -> intro audio ${Math.round(introSpeak - tap)} ms, intro ${Math.round(introMs)} ms; on screen: ${(await lastBot()).slice(0, 90)}…`);

// 2. Small talk: answered at once, never searched.
const smallMs: number[] = [];
for (const [text, noise] of [['Can you hear me?', 0], ['Hello? Are you there?', 0.02], ['Can you hear me now?', 0]] as const) {
  const r = await caller(text, noise);
  const reply = r.said.filter(s => s.startsWith('bot:')).join(' ');
  check(`"${text}"${noise ? ' (with noise)' : ''} gets a quick reply and no search`, /Yes, I can hear you|I'm here/.test(reply) && r.searched === 0 && r.firstAudio > 0,
    `${r.said.join(' | ')} | searched ${r.searched} | first audio ${r.firstAudio} ms`);
  smallMs.push(r.firstAudio);
  console.log(`      heard ${r.said.find(s => s.startsWith('user:')) ?? '(nothing)'}; first audio ${r.firstAudio} ms after the caller stopped`);
}

// 3. A real question goes to the library, and the caller talks over the answer: the voice stops (barge-in).
const n0 = (await page.evaluate(() => (window as any).copilot.getSnapshot().messages.length)) as number;
const s0 = searches.length;
const q = await page.evaluate(b => (window as any).__play(b, 0), clip('How do I set up a payment plan with the I R S?'));
const filler = await waitStatus('speaking', q.end, 30_000);
console.log(`      "Let me check the tax guides." ${Math.round(filler - q.end)} ms after the caller stopped`);
await page.waitForFunction(n => (window as any).copilot.getSnapshot().messages.slice(n).some((m: any) => m.who === 'bot'), n0, { timeout: 120_000 }).catch(() => {});
const replied = await now();
const answering = await waitStatus('speaking', replied - 2000, 60_000);
const answer: string[] = await page.evaluate(n => (window as any).copilot.getSnapshot().messages.slice(n).map((m: any) => `${m.who}: ${m.text}`), n0);
check('a real question is searched and answered', answering > 0 && searches.length > s0 && answer.some(a => a.startsWith('bot:')), answer.join(' | '));
console.log(`      ${answer.join(' | ').slice(0, 200)}`);
console.log(`      first audio ${Math.round(answering - q.end)} ms after the caller stopped (includes the library search)`);
await page.waitForTimeout(1200);
if ((await status()) === 'speaking') {
  const b = page.evaluate(b => (window as any).__play(b, 0), clip('Wait, stop.'));
  const bargeStart = await now();
  const stopped = await (async () => {
    const until = Date.now() + 5000;
    while (Date.now() < until) {
      const hit = (await log()).find(e => e.t > bargeStart && e.status !== 'speaking');
      if (hit) return hit.t;
      await page.waitForTimeout(20);
    }
    return -1;
  })();
  await b;
  check('talking over the voice stops it within about 300 ms of speech', stopped > 0 && stopped - bargeStart < 600, `${Math.round(stopped - bargeStart)} ms`);
  console.log(`      voice stopped ${Math.round(stopped - bargeStart)} ms after the caller started talking`);
} else check('the answer was still being spoken when the caller talked over it', false, `status ${await status()}`);

// 4. The call record: every turn with what was heard, the agent's turn id and speech-to-text time, and the decision.
await page.waitForTimeout(3000);
const turns = spans.filter(sp => sp.name === 'turn');
check('every turn is recorded with what was heard, the decision and its timings', turns.length >= 4
  && turns.every(t => t.attrs['voice.turn'] && 'voice.stt_ms' in t.attrs && 'turn.decide_ms' in t.attrs && t.attrs['turn.decision']), JSON.stringify(turns.map(t => t.attrs)));
for (const t of turns) console.log(`      ${String(t.attrs['turn.decision']).padEnd(10)} stt ${t.attrs['voice.stt_ms']} ms · confidence ${t.attrs['voice.confidence'] ?? 'n/a'} · decide ${t.attrs['turn.decide_ms']} ms`);
check('small talk: under about 1.5 s from end of speech to first audio', smallMs.length > 0 && smallMs.every(ms => ms > 0 && ms < 1600), smallMs.join(', '));

await page.click('[data-testid="call-end"]').catch(() => page.evaluate(() => (window as any).copilot.end()));
await page.waitForTimeout(1000);
const call = spans.find(sp => sp.name === 'call');
check('the call is recorded once it ends, with its voice stack and outcome', !!call && call.attrs['call.channel'] === 'voice' && !!call.attrs['voice.stt'] && !!call.attrs['call.outcome'],
  JSON.stringify(call?.attrs));
console.log(`      call ${call?.attrs['call.id']}: ${call?.attrs['call.outcome']}, ${call?.attrs['call.turns']} turns`);
await browser.close();
await srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nvoice call: ${pass}/${pass + fail}`);
if (process.env.DEPLOY_SHA) {
  const r = await fetch(`${srv.url}/api/score`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
    call: `deploy-${process.env.DEPLOY_SHA.slice(0, 12)}`, name: 'deploy.voice-call', score: pass / (pass + fail), label: fail ? 'fail' : 'pass', explanation: `voice call test on ${srv.url}: ${pass}/${pass + fail}` }) }).catch(() => null);
  console.log(`recorded on the deploy in Phoenix: ${r?.ok ? 'yes' : 'no'}`);
}
process.exit(fail ? 1 : 0);
