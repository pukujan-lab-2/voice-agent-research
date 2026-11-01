// Voice stacks and the caller's language, end to end with real audio (docs/decisions/0012): the page's microphone is a
// stream we play recorded clips into (macOS `say`, a Spanish and a French voice), so every turn goes through LiveKit,
// the turn detector, Whisper or Parakeet, the copilot engine with LFM3, and Kokoro or Pocket TTS, as a caller's would.
//
// Checks: the default call is English on english-fast and reports 'en' from the recogniser; picking Spanish by the call
// button moves the call to the multilingual stack; a Spanish caller is heard as Spanish and answered in Spanish; switching
// to French mid-call from the picker makes the next turn French.
//
// Needs the voice stack running (LiveKit, speech/server.py, speech/agent.py) and LFM3 at LLAMA_URL; server.ts starts
// what it can. Run: node --no-warnings tests/voice-languages.ts
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { start } from '../server.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const speechLog = process.env.SPEECH_LOG || path.join(here, '../speech/speech.log');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-languages-'));
let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
}
function clip(text: string, voice: string): string {
  const f = path.join(tmp, `${voice}-${text.replace(/\W+/g, '-').slice(0, 40)}.wav`);
  execFileSync('say', ['-v', voice, '-o', f, '--data-format=LEI16@24000', text]);
  return fs.readFileSync(f).toString('base64');
}
// What the speech server heard and said since `from` (its log: "stt … s audio, es: …", "tts first … audio: …").
const logSince = (from: number) => fs.existsSync(speechLog) ? fs.readFileSync(speechLog).subarray(from).toString('utf8') : '';
const logSize = () => fs.existsSync(speechLog) ? fs.statSync(speechLog).size : 0;

const srv = await start({ port: 0 });
for (let i = 0; i < 120 && !(await fetch(`${process.env.SPEECH_URL || 'http://127.0.0.1:8799'}/health`).then(r => r.ok, () => false)); i++) await new Promise(r => setTimeout(r, 1000));
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const c = fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort().at(-1);
const browser = await chromium.launch({
  executablePath: `${cache}/${c}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream'],
});
const page = await browser.newPage();
page.on('pageerror', e => console.log('PAGEERR', e.message));

// The microphone: an audio graph the test plays clips into. Every status change is recorded with its time.
await page.addInitScript(() => {
  const w = window as any;
  w.__log = [];
  const ctx = new AudioContext({ sampleRate: 48000 });
  const dest = ctx.createMediaStreamDestination();
  navigator.mediaDevices.getUserMedia = async () => { await ctx.resume(); return new MediaStream([dest.stream.getAudioTracks()[0].clone()]); };
  w.__play = async (b64: string) => {
    await ctx.resume();
    const bytes = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    const src = ctx.createBufferSource();
    src.buffer = await ctx.decodeAudioData(bytes.buffer);
    src.connect(dest);
    src.start();
    await new Promise(r => { src.onended = r; });
    return performance.now();
  };
  const watch = () => {
    if (!w.copilot?.subscribe) { setTimeout(watch, 50); return; }
    let last = '';
    w.copilot.subscribe(() => {
      const s = w.copilot.getSnapshot();
      if (s.status !== last) { last = s.status; w.__log.push({ t: performance.now(), status: s.status }); }
    });
  };
  watch();
});

const snap = (): Promise<any> => page.evaluate(() => (window as any).copilot.getSnapshot());
async function waitStatus(s: string, after: number, ms = 240_000): Promise<number> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const hit = ((await page.evaluate(() => (window as any).__log)) as { t: number; status: string }[]).find(e => e.t > after && e.status === s);
    if (hit) return hit.t;
    await page.waitForTimeout(50);
  }
  return -1;
}
// Plays a clip as the caller and waits for the reply to be spoken through; returns the turn's text and timing.
async function caller(text: string, voice: string) {
  const n = (await snap()).messages.length;
  const from = logSize();
  const end: number = await page.evaluate(b => (window as any).__play(b), clip(text, voice));
  const spoke = await waitStatus('speaking', end);
  await waitStatus('listening', Math.max(spoke, end));
  const said: string[] = (await snap()).messages.slice(n).map((m: any) => `${m.who}: ${m.text}`);
  return { said, firstAudio: spoke < 0 ? -1 : Math.round(spoke - end), log: logSince(from) };
}
const spokenLines = (log: string) => [...log.matchAll(/tts first \d+ ms.*?audio: (.*)/g)].map(m => m[1]);
const heardAs = (log: string) => [...log.matchAll(/stt \d+ ms, [\d.]+ s audio, (\w*):/g)].map(m => m[1]);
// Words that only show up in a Spanish or French reply (the replies are LFM3's, so no exact text is expected).
const SPANISH = /\b(hola|usted|cita|para|puedo|nombre|gracias|qué|cómo|su|el|la|de|en|por)\b|[¿¡ñáéíóú]/i;
const FRENCH = /\b(bonjour|vous|votre|rendez-vous|je|pour|merci|quel|nom|le|la|de|est)\b|[àâçéèêëîïôûù]/i;

// 1. The default: English on english-fast, the language from the recogniser.
await page.goto(`${srv.url}/clinic/book?guest=1`);
await page.waitForFunction(() => (window as any).copilot?.getSnapshot().voiceStacks?.length > 0, null, { timeout: 30_000 });
let s = await snap();
check('the picker offers both stacks and their languages', s.voiceStacks.length === 2 && s.languages.some((l: any) => l.code === 'es') && s.stack === 'english-fast',
  JSON.stringify({ stacks: s.voiceStacks.map((x: any) => x.id), stack: s.stack, languages: s.languages.map((l: any) => l.code) }));
let t = await page.evaluate(() => performance.now());
await page.click('[data-testid="call-start"]');
await waitStatus('listening', await waitStatus('speaking', t));
let r = await caller('Hi, I would like to book a visit for my daughter.', 'Samantha');
check('an English call is heard as English on english-fast (Parakeet)', heardAs(r.log).at(-1) === 'en' && r.said.some(x => x.startsWith('bot:')), `${heardAs(r.log)} | ${r.said.join(' | ')}`);
console.log(`      ${r.said.join(' | ').slice(0, 160)}; first audio ${r.firstAudio} ms`);
await page.click('[data-testid="call-end"]');

// 2. Spanish, picked by the call button: the call moves to the multilingual stack, hears Spanish, answers in Spanish.
await page.reload();
await page.waitForFunction(() => (window as any).copilot?.getSnapshot().voiceStacks?.length > 0, null, { timeout: 30_000 });
await page.selectOption('[data-testid="call-language"]', 'es');
s = await snap();
check('picking Spanish by the call button moves the call to the multilingual stack', s.language === 'es' && s.stack === 'multilingual', `${s.language} ${s.stack}`);
const from = logSize();
t = await page.evaluate(() => performance.now());
await page.click('[data-testid="call-start"]');
const greet = await waitStatus('speaking', t, 180_000);
await waitStatus('listening', greet, 60_000);
const greeting = spokenLines(logSince(from)).join(' ');
check('the greeting is spoken in Spanish', SPANISH.test(greeting) && !/\bassistant\b/i.test(greeting), greeting);
console.log(`      greeting: ${greeting.slice(0, 120)}; ${Math.round(greet - t)} ms from the tap`);
r = await caller('Hola, quiero pedir una cita para mi hija, por favor.', 'Mónica');
const es = await snap();
check('a Spanish caller is heard as Spanish by Whisper', heardAs(r.log).at(-1) === 'es' && es.spokenLanguage === 'es' && /cita/i.test(r.said.join(' ')), `${heardAs(r.log)} ${es.spokenLanguage} | ${r.said.join(' | ')}`);
const esReply = spokenLines(r.log).join(' ');
check('the reply is spoken in Spanish', SPANISH.test(esReply) && r.firstAudio > 0, esReply);
console.log(`      heard ${r.said.find(x => x.startsWith('user:'))}; said "${esReply.slice(0, 140)}"; first audio ${r.firstAudio} ms`);

// 3. Switching to French during the call, from the picker.
await page.selectOption('[data-testid="call-language"]', 'fr');
await page.waitForTimeout(500);
r = await caller('Bonjour, je préfère parler français. Ma fille s’appelle Léa.', 'Thomas');
const frReply = spokenLines(r.log).join(' ');
check('after switching to French mid-call, the caller is heard as French', heardAs(r.log).at(-1) === 'fr', `${heardAs(r.log)} | ${r.said.join(' | ')}`);
check('and the reply is spoken in French', FRENCH.test(frReply) && r.firstAudio > 0, frReply);
console.log(`      heard ${r.said.find(x => x.startsWith('user:'))}; said "${frReply.slice(0, 140)}"; first audio ${r.firstAudio} ms`);

await page.click('[data-testid="call-end"]').catch(() => page.evaluate(() => (window as any).copilot.end()));
await browser.close();
await srv.close();
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\nvoice languages: ${pass}/${pass + fail}`);
process.exit(fail ? 1 : 0);
