// Every voice stack in agent/voice/stacks, scored the same way (#82, PROJECT.md rule 8): one stack at a time, so the speech
// server swaps its models in and the others out (docs/decisions/0014), never all of them loaded at once.
//
// Per stack and per language it claims:
//   hears    word error rate on people reading aloud, against transcripts written by people (Google FLEURS and
//            Multilingual LibriSpeech, both CC-BY-4.0); character error rate for Chinese. POST /stt?stack=&lang=
//   speaks   the stack's voice saying the same sentences (POST /tts), heard back by Whisper on the judge stack: how much of
//            it can be understood, and the time to its first sound
//   tools    tests/voice-tools.ts on the stack (English): the model's structured calls and the form's outcomes
// Every case is a Phoenix trace through Octo under one session per run, with the audio it heard and the audio it spoke
// stored in Octo files and linked from the span (audio.in.file_id, audio.out.file_id), so a failure can be listened to.
// The report is printed and stored in Octo too; there is no local copy (PROJECT.md rule 6).
//
// Run: node --no-warnings tests/voice-matrix.ts [--stacks a,b] [--langs en,es] [--clips 5] [--llama-host mac-pro|windows]
//                                               [--no-tools] [--no-upload]
// Needs speech/server.py (SPEECH_URL, default http://127.0.0.1:8799). --llama-host reaches that machine's LFM3 over an SSH
// tunnel (the aliases in ~/.ssh/config.d/work-mesh.conf), for the tools part; LLAMA_URL works too. Clips are cached in
// ~/.cache/acs/deps/chatbots-speech/datasets/.
import { type ChildProcess, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadEnv } from '../server.ts';
import { createTracer, type SpanSpec } from '../tracing.ts';
import { loadVoice } from '../voice-config.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i < 0 ? undefined : args[i + 1]; };
const flag = (name: string) => args.includes(`--${name}`);
const SPEECH = (process.env.SPEECH_URL || 'http://127.0.0.1:8799').replace(/\/$/, '');
const conf = loadVoice();
const stacks = opt('stacks')?.split(',') ?? Object.keys(conf.stacks);
const langs = opt('langs')?.split(',');
const CLIPS = Number(opt('clips') ?? 5);
// The judge hears every stack's voice; Whisper covers every language a stack claims.
const JUDGE = process.env.JUDGE_STACK || 'multilingual';
for (const s of [...stacks, JUDGE]) if (!conf.stacks[s]) throw new Error(`no stack ${s} in agent/voice/stacks`);

// --- the clips: people reading, with transcripts written by people ---------------------------------------------------
// Google FLEURS (CC-BY-4.0) where Hugging Face's row API can serve it, Multilingual LibriSpeech (CC-BY-4.0) for Spanish
// and Italian, whose FLEURS sets are too big for it. Not MINDS-14: its transcripts are machine-made and often wrong.
const SOURCES: Record<string, { dataset: string; config: string; split: string; text: string }> = {
  en: { dataset: 'google/fleurs', config: 'en_us', split: 'validation', text: 'transcription' },
  fr: { dataset: 'google/fleurs', config: 'fr_fr', split: 'validation', text: 'transcription' },
  pt: { dataset: 'google/fleurs', config: 'pt_br', split: 'validation', text: 'transcription' },
  zh: { dataset: 'google/fleurs', config: 'cmn_hans_cn', split: 'validation', text: 'transcription' },
  hi: { dataset: 'google/fleurs', config: 'hi_in', split: 'validation', text: 'transcription' },
  es: { dataset: 'facebook/multilingual_librispeech', config: 'spanish', split: 'dev', text: 'transcript' },
  it: { dataset: 'facebook/multilingual_librispeech', config: 'italian', split: 'dev', text: 'transcript' },
};
const CACHE = path.join(process.env.ACS_CACHE_DIR || path.join(os.homedir(), '.cache/acs'), 'deps/chatbots-speech/datasets');
type Clip = { lang: string; id: string; text: string; audio: Buffer; mime: string; source: string };

async function clipsFor(lang: string): Promise<Clip[]> {
  const src = SOURCES[lang];
  if (!src) throw new Error(`no reference speech for ${lang}`);
  const dir = path.join(CACHE, src.dataset.replace('/', '-'), src.config);
  fs.mkdirSync(dir, { recursive: true });
  const index = path.join(dir, 'index.json');
  let rows: { id: string; text: string; file: string }[] = fs.existsSync(index) ? JSON.parse(fs.readFileSync(index, 'utf8')) : [];
  if (rows.length < CLIPS) {
    // The same first rows every run, so runs compare. The audio links expire, so a clip is fetched once and kept.
    const u = `https://datasets-server.huggingface.co/rows?dataset=${src.dataset}&config=${src.config}&split=${src.split}&offset=0&length=${Math.max(CLIPS, 10)}`;
    const d = await (await fetch(u, { headers: { 'user-agent': 'chatbots-eval/0.1' }, signal: AbortSignal.timeout(60_000) })).json() as any;
    if (!d.rows) throw new Error(`${src.dataset} ${src.config}: ${d.error ?? 'no rows'}`);
    rows = [];
    for (const [i, r] of d.rows.entries()) {
      const url = String(r.row.audio[0].src);
      const file = `${i}.${/\.opus\?/.test(url) ? 'opus' : 'wav'}`;
      if (!fs.existsSync(path.join(dir, file))) fs.writeFileSync(path.join(dir, file), Buffer.from(await (await fetch(url, { signal: AbortSignal.timeout(60_000) })).arrayBuffer()));
      rows.push({ id: `${src.config}-${i}`, text: String(r.row[src.text]), file });
    }
    fs.writeFileSync(index, JSON.stringify(rows));
  }
  return rows.slice(0, CLIPS).map(r => ({ lang, id: r.id, text: r.text, audio: fs.readFileSync(path.join(dir, r.file)),
    mime: r.file.endsWith('.opus') ? 'audio/ogg' : 'audio/wav', source: `${src.dataset} ${src.config}` }));
}

// --- scoring -------------------------------------------------------------------------------------------------------------
const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/g, ' ').trim();
// Word error rate (character error rate for Chinese): edits to turn what was heard into what was said, over what was said.
function errorRate(ref: string, hyp: string, lang: string): number {
  const split = (s: string) => lang === 'zh' ? [...norm(s).replace(/ /g, '')] : norm(s).split(' ').filter(Boolean);
  const r = split(ref), h = split(hyp);
  if (!r.length) return h.length ? 1 : 0;
  let prev = Array.from({ length: h.length + 1 }, (_, j) => j);
  for (let i = 1; i <= r.length; i++) {
    const cur = [i];
    for (let j = 1; j <= h.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1));
    prev = cur;
  }
  return Math.min(1, prev[h.length] / r.length);
}
const wav16 = (pcm: Buffer, rate: number) => {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
};

async function hear(stack: string, lang: string, audio: Buffer, mime = 'audio/wav') {
  const t = Date.now();
  const r = await fetch(`${SPEECH}/stt?stack=${stack}&lang=${lang}`, { method: 'POST', headers: { 'content-type': mime }, body: new Uint8Array(audio), signal: AbortSignal.timeout(600_000) });
  if (!r.ok) throw new Error(`/stt ${stack} ${r.status}`);
  const j = await r.json() as { text: string; language: string; ms: number };
  return { text: String(j.text ?? '').trim(), language: j.language, ms: j.ms, wall: Date.now() - t };
}
async function speak(stack: string, lang: string, text: string) {
  const t = Date.now();
  const r = await fetch(`${SPEECH}/tts`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, stack, lang }), signal: AbortSignal.timeout(600_000) });
  if (!r.ok || !r.body) throw new Error(`/tts ${stack} ${r.status}`);
  const rate = Number(r.headers.get('x-sample-rate') || 24000);
  const parts: Buffer[] = [];
  let first = -1;
  for await (const chunk of r.body as unknown as AsyncIterable<Uint8Array>) { if (first < 0) first = Date.now() - t; parts.push(Buffer.from(chunk)); }
  const pcm = Buffer.concat(parts);
  return { wav: wav16(pcm, rate), firstMs: first, seconds: pcm.length / 2 / rate, wall: Date.now() - t };
}

// --- Octo: audio files and the Phoenix trace ------------------------------------------------------------------------------
const env = loadEnv();
const upload = !flag('no-upload') && env.OCTO_KEY && env.OCTO_WORKSPACE;
const octoBase = (env.OCTO_BASE || 'https://octodb.design-bakery.com/api').replace(/\/$/, '');
const RUN = `voice-matrix-${new Date().toISOString().replace(/[:.]/g, '-')}`;
async function store(name: string, mimeType: string, data: Buffer, metadata: Record<string, unknown>): Promise<string> {
  if (!upload) return '';
  const r = await fetch(`${octoBase}/files/upload`, { method: 'POST', headers: { authorization: `Bearer ${env.OCTO_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ workspaceId: env.OCTO_WORKSPACE, name, mimeType, data: data.toString('base64'), dataEncoding: 'base64', metadata: { run: RUN, ...metadata } }) }).catch(() => null);
  if (!r?.ok) { console.error(`  octo upload ${name}: ${r?.status ?? 'unreachable'}`); return ''; }
  return String((await r.json() as { id: string }).id);
}
const tracer = upload ? createTracer(env) : undefined;

// --- the text model for the tools part, over an SSH tunnel to another machine ---------------------------------------------
const LLAMA_PORTS: Record<string, number> = { 'mac-pro': 8099, windows: 8080 };
let tunnel: ChildProcess | undefined;
async function llamaUrl(): Promise<string | undefined> {
  const host = opt('llama-host');
  if (!host) return env.LLAMA_URL;
  if (!LLAMA_PORTS[host]) throw new Error(`--llama-host ${host}: known hosts are ${Object.keys(LLAMA_PORTS).join(', ')}`);
  const local = 18000 + Math.floor(Math.random() * 900);
  tunnel = spawn('ssh', ['-N', '-o', 'ExitOnForwardFailure=yes', '-o', 'BatchMode=yes', '-L', `${local}:127.0.0.1:${LLAMA_PORTS[host]}`, host], { stdio: 'ignore' });
  const url = `http://127.0.0.1:${local}`;
  for (let i = 0; i < 30; i++) {
    if (await fetch(`${url}/v1/models`, { signal: AbortSignal.timeout(2000) }).then(r => r.ok, () => false)) return url;
    await new Promise(r => setTimeout(r, 1000));
  }
  throw new Error(`no LFM3 at ${host}:${LLAMA_PORTS[host]} through the tunnel`);
}
function tools(stack: string, llama: string | undefined): Promise<{ tools: string; outcomes: string; ok: boolean; log: string }> {
  return new Promise(resolve => {
    const p = spawn(process.execPath, ['--no-warnings', path.join(here, 'voice-tools.ts'), stack], { env: { ...process.env, ...(llama ? { LLAMA_URL: llama } : {}), SPEECH_URL: SPEECH } });
    let log = '';
    p.stdout.on('data', d => { log += d; }); p.stderr.on('data', d => { log += d; });
    p.on('close', code => {
      const m = /tool calls (\d+\/\d+), outcomes (\d+\/\d+)/.exec(log);
      resolve({ tools: m?.[1] ?? 'did not finish', outcomes: m?.[2] ?? 'did not finish', ok: code === 0, log });
    });
  });
}

// --- the run --------------------------------------------------------------------------------------------------------------
if (!(await fetch(`${SPEECH}/health`).then(r => r.ok, () => false))) throw new Error(`no speech server at ${SPEECH}`);
const llama = flag('no-tools') ? undefined : await llamaUrl();
type Row = { stack: string; lang: string; hearWer: number; hearMs: number; speakWer: number; firstMs: number; clips: number };
const rows: Row[] = [], toolRows: { stack: string; tools: string; outcomes: string }[] = [], spoken: { stack: string; lang: string; text: string; wav: Buffer; span: SpanSpec; fileId: string }[] = [];
const root: SpanSpec = { name: 'voice.matrix', kind: 'CHAIN', start: Date.now(), end: 0, attributes: { 'run.id': RUN, 'matrix.stacks': stacks.join(','), 'matrix.judge': JUDGE }, children: [] };
const clips: Record<string, Clip[]> = {};
const skipped: Record<string, string> = {};

console.log(`== voice matrix ${RUN}: ${stacks.join(', ')}; judge ${JUDGE}; ${CLIPS} clips per language${upload ? '; audio and traces to Octo' : ''}`);
for (const stack of stacks) {
  const s = conf.stacks[stack];
  const span: SpanSpec = { name: `voice.matrix.stack`, kind: 'CHAIN', start: Date.now(), end: 0, attributes: { 'voice.stack': stack, 'voice.stt': s.listens, 'voice.tts': s.speaks, 'voice.thinks': s.thinks }, children: [] };
  root.children!.push(span);
  console.log(`\n-- ${stack} (${s.label})`);
  for (const lang of s.languages.filter(l => !langs || langs.includes(l))) {
    // A dataset that won't load (Hugging Face's row service errors now and then) skips that language, and the report says so.
    if (!clips[lang] && !skipped[lang]) {
      for (let attempt = 1; attempt <= 3 && !clips[lang] && !skipped[lang]; attempt++) {
        try { clips[lang] = await clipsFor(lang); }
        catch (e) { if (attempt === 3) skipped[lang] = (e as Error).message; else await new Promise(r => setTimeout(r, 5000 * attempt)); }
      }
    }
    if (skipped[lang]) { console.log(`  skipping ${lang}: ${skipped[lang]}`); continue; }
    const row: Row = { stack, lang, hearWer: 0, hearMs: 0, speakWer: NaN, firstMs: 0, clips: clips[lang].length };
    for (const c of clips[lang]) {
      const start = Date.now();
      const h = await hear(stack, lang, c.audio, c.mime).catch(e => ({ text: `ERROR ${(e as Error).message}`, language: '', ms: -1, wall: -1 }));
      const wer = errorRate(c.text, h.text, lang);
      row.hearWer += wer / row.clips; row.hearMs += h.ms / row.clips;
      const inId = await store(`${RUN}-${c.id}.${c.mime === 'audio/ogg' ? 'opus' : 'wav'}`, c.mime, c.audio, { kind: 'heard', stack, lang, source: c.source, text: c.text });
      span.children!.push({ name: 'voice.matrix.hears', kind: 'EVALUATOR', start, end: Date.now(), error: h.ms < 0, attributes: {
        'voice.stack': stack, 'voice.language': lang, 'clip.id': c.id, 'clip.source': c.source, 'input.value': c.text, 'output.value': h.text,
        'eval.wer': Math.round(wer * 1000) / 1000, 'voice.stt_ms': h.ms, 'voice.language_heard': h.language, 'audio.in.file_id': inId } });
      console.log(`  hears ${lang} ${c.id.slice(0, 18).padEnd(18)} wer ${wer.toFixed(2)}  ${h.ms} ms  "${h.text.slice(0, 70)}"`);
    }
    // Its voice, on the first two sentences of the same set: kept for the judge, which runs after every stack.
    let first = 0;
    for (const c of clips[lang].slice(0, 2)) {
      const start = Date.now();
      const out = await speak(stack, lang, c.text).catch(e => { console.log(`  speaks ${lang} ERROR ${(e as Error).message}`); return null; });
      if (!out) continue;
      first += out.firstMs / 2;
      const fileId = await store(`${RUN}-${stack}-${lang}-${c.id}.wav`, 'audio/wav', out.wav, { kind: 'spoke', stack, lang, text: c.text });
      const sp: SpanSpec = { name: 'voice.matrix.speaks', kind: 'EVALUATOR', start, end: Date.now(), attributes: {
        'voice.stack': stack, 'voice.language': lang, 'input.value': c.text, 'voice.tts_first_ms': out.firstMs, 'audio.seconds': Math.round(out.seconds * 10) / 10, 'audio.out.file_id': fileId } };
      span.children!.push(sp);
      spoken.push({ stack, lang, text: c.text, wav: out.wav, span: sp, fileId });
      console.log(`  speaks ${lang} first sound ${out.firstMs} ms, ${out.seconds.toFixed(1)} s of audio`);
    }
    row.firstMs = first;
    rows.push(row);
  }
  if (!flag('no-tools')) {
    const start = Date.now();
    const t = await tools(stack, llama);
    toolRows.push({ stack, tools: t.tools, outcomes: t.outcomes });
    span.children!.push({ name: 'voice.matrix.tools', kind: 'EVALUATOR', start, end: Date.now(), error: !t.ok, attributes: { 'voice.stack': stack, 'eval.tool_calls': t.tools, 'eval.outcomes': t.outcomes, 'output.value': t.log.slice(-8000) } });
    console.log(`  tools: tool calls ${t.tools}, outcomes ${t.outcomes}`);
  }
  span.end = Date.now();
}

// The judge: every stack's voice heard back by Whisper, after the stacks ran, so the judge's models load once.
console.log(`\n-- judge (${JUDGE}) hears every voice`);
for (const sp of spoken) {
  const h = await hear(JUDGE, sp.lang, sp.wav).catch(() => ({ text: '', language: '', ms: -1, wall: -1 }));
  const wer = errorRate(sp.text, h.text, sp.lang);
  Object.assign(sp.span.attributes!, { 'output.value': h.text, 'eval.wer': Math.round(wer * 1000) / 1000, 'eval.judge': JUDGE });
  const row = rows.find(r => r.stack === sp.stack && r.lang === sp.lang)!;
  row.speakWer = (Number.isNaN(row.speakWer) ? 0 : row.speakWer) + wer / spoken.filter(x => x.stack === sp.stack && x.lang === sp.lang).length;
  console.log(`  ${sp.stack} ${sp.lang} wer ${wer.toFixed(2)}  "${h.text.slice(0, 70)}"`);
}
root.end = Date.now();
tunnel?.kill();

// --- the report -------------------------------------------------------------------------------------------------------------
const pct = (x: number) => Number.isNaN(x) ? '–' : `${Math.round(x * 100)}%`;
const md = [`# Voice matrix ${RUN}`, '', `Stacks: ${stacks.join(', ')}. Judge for the voice: ${JUDGE}. ${CLIPS} clips per language; hearing on people reading aloud (Google FLEURS; Multilingual LibriSpeech for Spanish and Italian; both CC-BY-4.0). Error rates are words wrong (characters for Chinese); lower is better.`, '',
  '| Stack | Language | Hears: error rate | Hears: ms per clip | Speaks: error rate heard back | Speaks: first sound ms |', '|---|---|---|---|---|---|',
  ...rows.map(r => `| ${r.stack} | ${conf.languages[r.lang]?.name ?? r.lang} | ${pct(r.hearWer)} | ${Math.round(r.hearMs)} | ${pct(r.speakWer)} | ${Math.round(r.firstMs)} |`)];
if (toolRows.length) md.push('', '| Stack | Tool calls right | Form outcomes right |', '|---|---|---|', ...toolRows.map(t => `| ${t.stack} | ${t.tools} | ${t.outcomes} |`));
if (Object.keys(skipped).length) md.push('', `Not scored, because the reference speech would not load: ${Object.entries(skipped).map(([l, why]) => `${conf.languages[l]?.name ?? l} (${why})`).join('; ')}.`);
const report = md.join('\n');
const reportId = await store(`${RUN}-report.md`, 'text/markdown', Buffer.from(report), { kind: 'report' });
root.attributes!['report.file_id'] = reportId;
root.attributes!['output.value'] = report;
if (tracer) { tracer.trace(root, RUN); await tracer.flush(); }
console.log(`\n${report}\n`);
if (upload) console.log(`Phoenix session ${RUN}; report and audio in Octo files (report ${reportId || 'not stored'}).`);
