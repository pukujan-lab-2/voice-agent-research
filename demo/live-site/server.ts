// Host for the demo: serves dist/ (the app, the copilot, the manuals, the media) and the /api backend on one origin.
// Keys come from the environment, or from ~/Documents/projects/.env (this Mac) / ~/.hack_env (the Pro), mapped to the
// names the engine uses. Values are never printed.
// Run: node build.ts && node server.ts [--offline]     (PORT=8787, HOST=127.0.0.1 by default)
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { createWaker } from './sablier.ts';
import { createTracer } from './tracing.ts';
import { stackForLanguage } from './widget/voice-choice.ts';
import { createApi, type ApiEnv, type NameMatcher } from './api.ts';
import type { Passage } from '../../copilot-engine/src/guide.ts';
import { loadSlots, SLOT_NAMES, type Slots } from '../../copilot-engine/src/slots.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
// inferhub_lease: the 30-day vault lease of the InferHub item, which works only through the vault proxy (the provider's default address)
const MAP: Record<string, keyof ApiEnv> = { openrouter_jev_only: 'OPENROUTER_JEV_KEY', octo_db_chatbots: 'OCTO_KEY', octo_db_chatbots_workspace: 'OCTO_WORKSPACE', openrouter_free_only: 'OPENROUTER_FREE_KEY', inferhub_lease: 'INFERHUB_API_KEY' };
// Names read from the env files as they are written there; the smart slots' keys are only ever named (decision 0017).
const FROM_FILE = ['OPENROUTER_JEV_KEY', 'OCTO_KEY', 'OCTO_WORKSPACE', 'WORKBUDDY_KEY', 'INFERHUB_API_KEY'];
const SLOT_ENV = SLOT_NAMES.flatMap(n => (['PROVIDER', 'MODEL', 'TIMEOUT_MS', 'DAILY_CAP'] as const).map(f => `SLOT_${n.toUpperCase()}_${f}` as keyof ApiEnv));

export function loadEnv(): ApiEnv {
  const env: ApiEnv = {};
  for (const file of [path.join(os.homedir(), 'Documents/projects/.env'), path.join(os.homedir(), '.hack_env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const name = MAP[m[1]] ?? (FROM_FILE.includes(m[1]) ? m[1] as keyof ApiEnv : undefined);
      if (name && !env[name]) env[name] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of ['OPENROUTER_JEV_KEY', 'OCTO_KEY', 'OCTO_WORKSPACE', 'JEV_URL', 'OCTO_BASE', 'OCTO_TIMEOUT_MS', 'SIGNING_SECRET', 'LLAMA_URL', 'DESK_URL', 'DESK_KEY', 'DESK_MODEL', 'LFM3_AUDIO_URL', 'OFFLINE', 'JEV_DAILY_CAP', 'RATE_PER_MIN', 'STATE_STORE', 'OCTO_TRACES',
    'DESK_HYBRID', 'SMART_OWNER', 'OWNER_TOKEN', 'SMART_DEV_HOSTS', 'SMART_DAILY_CAP', 'INFERHUB_BASE_URL', 'INFERHUB_API_KEY', 'OPENROUTER_FREE_URL', 'OPENROUTER_FREE_KEY', 'WORKBUDDY_URL', 'WORKBUDDY_KEY', ...SLOT_ENV] as const) {
    if (process.env[k]) env[k] = process.env[k];
  }
  // The lfm3-audio stack's model is the llama.cpp server speech/server.py starts, on its own port.
  env.LFM3_AUDIO_URL ??= `http://127.0.0.1:${process.env.LFM3_AUDIO_PORT ?? 8798}`;
  return env;
}

// The model slots (decision 0017): the file next to this one (MODEL_SLOTS_FILE names another), then env overrides. A bad slot
// stops the start with a message naming it. Without a file every slot is the local model.
export function readSlots(env: ApiEnv, file = process.env.MODEL_SLOTS_FILE || path.join(here, 'model-slots.json')): Slots {
  return loadSlots(fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : undefined, env);
}

function offlinePassages(): Record<string, (Passage & { source?: string; section?: string; url?: string })[]> {
  const out: ReturnType<typeof offlinePassages> = {};
  for (const f of fs.readdirSync(path.join(here, 'data')).filter(f => f.endsWith('.passages.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8'));
    out[d.label] = d.passages;
  }
  return out;
}

// The name matcher for caller verification: tools/verify_match.py (RapidFuzz + jellyfish), one long-lived helper started
// on first use and again if it exits. VERIFY_MATCHER overrides the command (default: uv with pinned versions).
export function nameMatcher(): NameMatcher {
  let proc: ChildProcess | null = null;
  let buf = '';
  let seq = 0;
  const waiting = new Map<number, (r: boolean[]) => void>();
  const up = () => {
    if (proc && proc.exitCode === null) return proc;
    const cmd = process.env.VERIFY_MATCHER ?? 'uv run --quiet --python 3.12 --with rapidfuzz==3.10.1 --with jellyfish==1.1.3 python tools/verify_match.py';
    proc = spawn('/bin/sh', ['-c', cmd], { cwd: here, stdio: ['pipe', 'pipe', 'inherit'] });
    proc.stdout!.on('data', d => {
      buf += d;
      for (let i = buf.indexOf('\n'); i >= 0; i = buf.indexOf('\n')) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        try { const o = JSON.parse(line); waiting.get(o.id)?.(Array.isArray(o.match) ? o.match.map(Boolean) : []); waiting.delete(o.id); } catch { /* not ours */ }
      }
    });
    proc.on('exit', () => { for (const f of waiting.values()) f([]); waiting.clear(); proc = null; });
    return proc;
  };
  return (said, names) => new Promise(res => {
    const id = ++seq;
    // no answer in 20 s counts as no match (fails closed)
    const t = setTimeout(() => { waiting.delete(id); res([]); }, 20_000);
    waiting.set(id, r => { clearTimeout(t); res(r); });
    up().stdin!.write(JSON.stringify({ id, said, names }) + '\n');
  });
}

// Voice runs on LiveKit Agents (docs/decisions/0002), all on this machine: the LiveKit server in dev mode (its built-in
// devkey/secret, for local runs; deployed, deploy/ gives it real keys), speech/server.py (Parakeet STT, Pocket TTS) and speech/agent.py,
// which joins each call's room. They are started once and left running, so restarting this server, or a test starting
// its own, doesn't wait for the models to load again. The page gets a token for a fresh room from /api/voice/token.
const SPEECH = process.env.SPEECH_URL || 'http://127.0.0.1:8799';
const LIVEKIT = { url: process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880', key: process.env.LIVEKIT_API_KEY || 'devkey', secret: process.env.LIVEKIT_API_SECRET || 'secret' };
// Deployed (deploy/README.md), the page reaches LiveKit's signalling through this server's own hostname: LIVEKIT_PUBLIC_URL
// is what the page is told, and /rtc is passed through to LIVEKIT_URL. Call audio goes to LiveKit directly, not through here.
const LIVEKIT_PUBLIC = process.env.LIVEKIT_PUBLIC_URL || '';
// On the VPS the agent sleeps between calls and is woken here (sablier.ts). A caller waits up to this long for it (it starts in
// about 8 s); after that the token is handed out anyway and the page falls back to text if no agent joins.
const AGENT_WAKE_S = 30;
const waker = createWaker();
const up = (url: string) => fetch(url).then(r => r.ok, () => false);
let voiceStarting: Promise<void> | null = null;
// Octo's settings for the agent's own spans (speech/telemetry.py): the same Phoenix project as tracing.ts. Set by start().
let agentTrace: Record<string, string> = {};
function voiceUp(): Promise<void> {
  voiceStarting ??= (async () => {
    const py = path.join(here, 'speech/.venv/bin/python');
    if (!fs.existsSync(py)) return;
    const log = fs.openSync(path.join(here, 'speech/speech.log'), 'a');
    const bg = (cmd: string, args: string[], env: Record<string, string> = {}) =>
      spawn(cmd, args, { detached: true, stdio: ['ignore', log, log], env: { ...process.env, ...env } }).on('error', e => console.warn(`voice: ${cmd}: ${e.message}`)).unref();
    if (!process.env.SPEECH_URL && !(await up(`${SPEECH}/health`))) bg(py, [path.join(here, 'speech/server.py')]);
    if (!process.env.LIVEKIT_URL && !(await up(LIVEKIT.url.replace(/^ws/, 'http')))) bg('livekit-server', ['--dev', '--bind', '127.0.0.1']);
    const agents = await new Promise<string>(r => execFile('pgrep', ['-f', 'speech/agent.py'], (_e, out) => r(String(out).trim())));
    if (!agents) bg(py, [path.join(here, 'speech/agent.py'), 'start'], { LIVEKIT_URL: LIVEKIT.url, LIVEKIT_API_KEY: LIVEKIT.key, LIVEKIT_API_SECRET: LIVEKIT.secret, ...agentTrace });
  })().finally(() => { voiceStarting = null; });
  return voiceStarting;
}
// The voice stacks (speech/stacks.json, docs/decisions/0012) and who picks one for a call: the owner can force a stack
// for every call (VOICE_STACK); otherwise the visitor's pick, if the business allows it; otherwise the business default.
// The business's choices come from its copilot config (voice.stacks, voice.default); every site's config is in the
// page today, so until businesses are stored server-side they are taken from the request.
type Stacks = { default: string; stacks: Record<string, { label: string; languages: string[] }>; languages: Record<string, { name: string; native: string }> };
const STACKS: Stacks = JSON.parse(fs.readFileSync(path.join(here, 'speech/stacks.json'), 'utf8'));
type VoiceAsk = { stack?: unknown; language?: unknown; allowed?: unknown; default?: unknown };
function pickStack(ask: VoiceAsk, owner = process.env.VOICE_STACK ?? ''): { stack: string; by: 'owner' | 'visitor' | 'business' | 'default'; allowed: string[] } {
  const known = (s: unknown): s is string => typeof s === 'string' && Object.hasOwn(STACKS.stacks, s);
  const allowed = Array.isArray(ask.allowed) && ask.allowed.some(known) ? ask.allowed.filter(known) : [known(ask.default) ? ask.default : STACKS.default];
  if (known(owner)) return { stack: owner, by: 'owner', allowed: [owner] };
  if (known(ask.stack) && allowed.includes(ask.stack)) return { stack: ask.stack, by: 'visitor', allowed };
  if (known(ask.default) && allowed.includes(ask.default)) return { stack: ask.default, by: 'business', allowed };
  return { stack: allowed.includes(STACKS.default) ? STACKS.default : allowed[0], by: 'default', allowed };
}
// What the page's picker offers: the stacks this business allows, each with its languages.
function voiceOptions(ask: VoiceAsk) {
  const p = pickStack(ask);
  return { ...p, stacks: p.allowed.map(id => ({ id, label: STACKS.stacks[id].label,
    languages: STACKS.stacks[id].languages.map(code => ({ code, ...STACKS.languages[code] })) })) };
}

// How long a voice token can be used to join (#125). LiveKit refreshes the token of a caller already in the room, so
// a longer call is not cut; a token copied off a page is useless after this.
export const VOICE_TOKEN_S = 600;

// A LiveKit access token (HS256 JWT) for one caller in a new room; the agent is dispatched to every new room. The call's
// stack and the caller's language ride on the caller's attributes; the page may change its language mid-call.
export function voiceToken(ask: VoiceAsk = {}): { url: string; token: string; room: string; stack: string; language: string } {
  const picked = pickStack(ask);
  const stack = typeof ask.language === 'string' && picked.by !== 'owner'
    ? stackForLanguage(picked.allowed.map(id => ({ id, languages: STACKS.stacks[id].languages.map(code => ({ code })) })), picked.stack, ask.language)
    : picked.stack;
  const language = typeof ask.language === 'string' && STACKS.stacks[stack].languages.includes(ask.language) ? ask.language : '';
  const room = `call-${crypto.randomUUID().slice(0, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: LIVEKIT.key, sub: `caller-${crypto.randomUUID().slice(0, 8)}`, nbf: now - 5, exp: now + VOICE_TOKEN_S,
    attributes: { 'copilot.stack': stack, 'copilot.language': language },
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true } })}`;
  return { url: LIVEKIT_PUBLIC || LIVEKIT.url, room, stack, language, token: `${body}.${crypto.createHmac('sha256', LIVEKIT.secret).update(body).digest('base64url')}` };
}

// How many calls are open: LiveKit rooms that hold anyone. deploy/pro/update.sh asks before it restarts the speech server (#76).
// An agent alone in a room for the few seconds after its caller left counts too, which errs towards waiting. null when LiveKit can't be asked.
async function openCalls(): Promise<number | null> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: LIVEKIT.key, nbf: now - 5, exp: now + 60, video: { roomList: true } })}`;
  const jwt = `${body}.${crypto.createHmac('sha256', LIVEKIT.secret).update(body).digest('base64url')}`;
  try {
    const r = await fetch(`${LIVEKIT.url.replace(/^ws/, 'http')}/twirp/livekit.RoomService/ListRooms`, {
      method: 'POST', headers: { authorization: `Bearer ${jwt}`, 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const { rooms = [] } = await r.json() as { rooms?: { numParticipants?: number; num_participants?: number }[] };
    return rooms.filter(room => (room.numParticipants ?? room.num_participants ?? 0) > 0).length;
  } catch { return null; }
}

// /rtc on this server to LiveKit (LIVEKIT_PUBLIC_URL set): plain requests and the signalling WebSocket, passed as they are.
const lk = new URL(LIVEKIT.url.replace(/^ws/, 'http'));
function rtcRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  const up = http.request({ host: lk.hostname, port: Number(lk.port) || 80, method: req.method, path: req.url, headers: { ...req.headers, host: lk.host } },
    r => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
  up.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end(); });
  req.pipe(up);
}
function rtcUpgrade(req: http.IncomingMessage, socket: net.Socket, head: Buffer) {
  if (!req.url?.startsWith('/rtc')) { socket.destroy(); return; }
  const up = net.connect(Number(lk.port) || 80, lk.hostname, () => {
    const lines = [`${req.method} ${req.url} HTTP/1.1`];
    for (let i = 0; i < req.rawHeaders.length; i += 2)
      lines.push(`${req.rawHeaders[i]}: ${req.rawHeaders[i].toLowerCase() === 'host' ? lk.host : req.rawHeaders[i + 1]}`);
    up.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (head.length) up.write(head);
    socket.pipe(up).pipe(socket);
  });
  up.on('error', () => socket.destroy());
  socket.on('error', () => up.destroy());
}

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()' };
const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

// What the site gate (api.ts) needs from a request: its Origin, the site key, and the host the visitor asked for.
function siteHeaders(req: http.IncomingMessage): Record<string, string> {
  const h: Record<string, string> = {};
  const own = req.headers['x-forwarded-host'] ?? req.headers.host;
  if (typeof req.headers.origin === 'string') h.origin = req.headers.origin;
  if (typeof req.headers['x-site-key'] === 'string') h['x-site-key'] = req.headers['x-site-key'];
  if (typeof own === 'string') h['x-own-host'] = own.split(',')[0].trim();
  return h;
}

// Behind the Cloudflare Tunnel every request comes from localhost (or, deployed, from the tunnel's container: TRUST_PROXY=1);
// the visitor's address is in CF-Connecting-IP.
function visitor(req: http.IncomingMessage): string {
  const local = process.env.TRUST_PROXY === '1' || ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  const cf = req.headers['cf-connecting-ip'];
  return local && typeof cf === 'string' ? cf : req.socket.remoteAddress ?? '';
}

export async function start(opts: { port?: number; host?: string; offline?: boolean } = {}) {
  const env = loadEnv();
  if (opts.offline) env.OFFLINE = '1';
  const tracing = opts.offline ? undefined : createTracer(env);
  const api = createApi(env, { slots: readSlots(env), offlinePassages: offlinePassages(), matchNames: nameMatcher(), trace: tracing?.trace, score: tracing?.score, ownHostHeader: true });
  // The site gate for what this server answers itself. A socket can't carry the site key, so /rtc is checked like a
  // preflight (an origin some business lists); the voice token it needs was handed out only after the key was checked.
  const gateOf = (req: http.IncomingMessage, socket = false) => api.gate(new Request('http://local/', { method: socket ? 'OPTIONS' : 'POST', headers: siteHeaders(req) }));
  const dist = path.join(here, 'dist');
  agentTrace = Object.fromEntries(Object.entries({ OCTO_KEY: env.OCTO_KEY, OCTO_WORKSPACE: env.OCTO_WORKSPACE, OCTO_BASE: env.OCTO_BASE,
    OCTO_TRACES: opts.offline ? 'off' : env.OCTO_TRACES }).filter((e): e is [string, string] => !!e[1]));
  void voiceUp();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
    if (req.method === 'POST' && (url.pathname === '/api/voice/token' || url.pathname === '/api/voice/options')) {
      const gate = await gateOf(req).catch(() => ({ ok: false as const, status: 502, error: 'backend error' }));
      if (!gate.ok) { res.writeHead(gate.status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify({ error: gate.error })); return; }
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      let ask: VoiceAsk = {};
      try { ask = JSON.parse(Buffer.concat(chunks).toString('utf8').slice(0, 2000) || '{}'); } catch { /* no picks: the defaults */ }
      if (url.pathname === '/api/voice/token') {
        void voiceUp();
        if (!(await waker.ready(AGENT_WAKE_S))) console.warn(`voice: the agent did not wake within ${AGENT_WAKE_S}s; handing out the token anyway`);
      } else waker.poke();  // the widget loaded: the agent starts while the visitor reads
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...gate.headers });
      res.end(JSON.stringify(url.pathname === '/api/voice/token' ? voiceToken(ask) : voiceOptions(ask))); return;
    }
    if (req.method === 'GET' && url.pathname === '/api/voice/calls') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ calls: await openCalls() })); return;
    }
    if (LIVEKIT_PUBLIC && url.pathname.startsWith('/rtc')) {
      const gate = await gateOf(req, true).catch(() => null);
      if (!gate?.ok) { res.writeHead(403); res.end(); return; }
      rtcRequest(req, res); return;
    }
    if (url.pathname.startsWith('/api/')) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      // The request's own host name goes on only when nothing proxied it (no tunnel, no forwarding headers): that is how the backend
      // knows a development host. Deployed, it is always `local`, so no visitor is taken for a developer.
      const direct = process.env.TRUST_PROXY !== '1' && !req.headers['cf-connecting-ip'] && !req.headers['x-forwarded-for'] && !req.headers['x-forwarded-host']
        && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '') && /^[\w.\-]+(:\d+)?$|^\[[\da-f:]+\](:\d+)?$/i.test(req.headers.host ?? '');
      const r = await api.handle(new Request(`http://${direct ? req.headers.host : 'local'}${url.pathname}${url.search}`, { method: req.method,
        headers: { 'content-type': 'application/json', ...(typeof req.headers.authorization === 'string' ? { authorization: req.headers.authorization } : {}),
          ...(typeof req.headers['x-session-id'] === 'string' ? { 'x-session-id': req.headers['x-session-id'] } : {}),
          ...(typeof req.headers['x-owner-token'] === 'string' ? { 'x-owner-token': req.headers['x-owner-token'] } : {}),
          ...(typeof req.headers.cookie === 'string' ? { cookie: req.headers.cookie } : {}), ...siteHeaders(req) },
        body: req.method === 'POST' ? Buffer.concat(chunks) : undefined }), visitor(req));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = path.normalize(path.join(dist, decodeURIComponent(url.pathname)));
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    // The app routes in the browser: a page address with no file behind it gets the app's index.html.
    if (!fs.existsSync(file) && !path.extname(url.pathname)) file = path.join(dist, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const size = fs.statSync(file).size;
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    const cache = url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : /\.(mp4|jpg|png)$/.test(file) ? 'public, max-age=86400' : 'no-cache';
    // Byte ranges: Safari will only play a video that is served in ranges.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? '');
    if (range && (range[1] || range[2])) {
      const startAt = range[1] ? +range[1] : Math.max(0, size - +range[2]);
      const endAt = range[1] && range[2] ? Math.min(+range[2], size - 1) : size - 1;
      if (startAt >= size || startAt > endAt) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); res.end(); return; }
      res.writeHead(206, { 'Content-Type': type, 'Content-Range': `bytes ${startAt}-${endAt}/${size}`, 'Content-Length': endAt - startAt + 1, 'Accept-Ranges': 'bytes', 'Cache-Control': cache });
      fs.createReadStream(file, { start: startAt, end: endAt }).pipe(res);
      return;
    }
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': size, 'Accept-Ranges': 'bytes', 'Cache-Control': cache });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
  if (LIVEKIT_PUBLIC) server.on('upgrade', (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    void gateOf(req, true).then(g => g.ok ? rtcUpgrade(req, socket, head) : (socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'), undefined), () => socket.destroy());
  });
  await new Promise<void>(r => server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', r));
  const url = `http://${opts.host ?? '127.0.0.1'}:${(server.address() as { port: number }).port}`;
  return { url, mode: api.mode, close: () => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); }).then(() => tracing?.flush()) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await start({ port: Number(process.env.PORT) || 8787, host: process.env.HOST || '127.0.0.1', offline: process.argv.includes('--offline') });
  console.log(`copilot demo at ${s.url}  (backend: ${s.mode})`);
}
