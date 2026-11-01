// Host for the demo: serves dist/ (the app, the copilot, the manuals, the media) and the /api backend on one origin.
// Keys come from the environment, or from ~/Documents/projects/.env (this Mac) / ~/.hack_env (the Pro), mapped to the
// names the engine uses. Values are never printed.
// Run: node build.ts && node server.ts [--offline]     (PORT=8787, HOST=127.0.0.1 by default)
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createTracer } from './tracing.ts';
import { createApi, type ApiEnv, type NameMatcher } from './api.ts';
import type { Passage } from '../../copilot-engine/src/guide.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const MAP: Record<string, keyof ApiEnv> = { openrouter_jev_only: 'OPENROUTER_JEV_KEY', octo_db_chatbots: 'OCTO_KEY', octo_db_chatbots_workspace: 'OCTO_WORKSPACE' };

export function loadEnv(): ApiEnv {
  const env: ApiEnv = {};
  for (const file of [path.join(os.homedir(), 'Documents/projects/.env'), path.join(os.homedir(), '.hack_env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const name = MAP[m[1]] ?? (['OPENROUTER_JEV_KEY', 'OCTO_KEY', 'OCTO_WORKSPACE'].includes(m[1]) ? m[1] as keyof ApiEnv : undefined);
      if (name && !env[name]) env[name] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of ['OPENROUTER_JEV_KEY', 'OCTO_KEY', 'OCTO_WORKSPACE', 'JEV_URL', 'OCTO_BASE', 'OCTO_TIMEOUT_MS', 'SIGNING_SECRET', 'LLAMA_URL', 'DESK_URL', 'DESK_MODEL', 'OFFLINE', 'JEV_DAILY_CAP', 'RATE_PER_MIN', 'OCTO_TRACES'] as const) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return env;
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
// devkey/secret, local only; docs/decisions/0007), speech/server.py (Parakeet STT, Pocket TTS) and speech/agent.py,
// which joins each call's room. They are started once and left running, so restarting this server, or a test starting
// its own, doesn't wait for the models to load again. The page gets a token for a fresh room from /api/voice/token.
const SPEECH = process.env.SPEECH_URL || 'http://127.0.0.1:8799';
const LIVEKIT = { url: process.env.LIVEKIT_URL || 'ws://127.0.0.1:7880', key: process.env.LIVEKIT_API_KEY || 'devkey', secret: process.env.LIVEKIT_API_SECRET || 'secret' };
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
// A LiveKit access token (HS256 JWT) for one caller in a new room; the agent is dispatched to every new room.
function voiceToken(): { url: string; token: string; room: string } {
  const room = `call-${crypto.randomUUID().slice(0, 8)}`;
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: LIVEKIT.key, sub: `caller-${crypto.randomUUID().slice(0, 8)}`, nbf: now - 5, exp: now + 3600,
    video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true } })}`;
  return { url: LIVEKIT.url, room, token: `${body}.${crypto.createHmac('sha256', LIVEKIT.secret).update(body).digest('base64url')}` };
}

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()' };
const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png' };

// Behind the Cloudflare Tunnel every request comes from localhost; the visitor's address is in CF-Connecting-IP.
function visitor(req: http.IncomingMessage): string {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  const cf = req.headers['cf-connecting-ip'];
  return local && typeof cf === 'string' ? cf : req.socket.remoteAddress ?? '';
}

export async function start(opts: { port?: number; host?: string; offline?: boolean } = {}) {
  const env = loadEnv();
  if (opts.offline) env.OFFLINE = '1';
  const tracing = opts.offline ? undefined : createTracer(env);
  const api = createApi(env, { offlinePassages: offlinePassages(), matchNames: nameMatcher(), trace: tracing?.trace, score: tracing?.score });
  const dist = path.join(here, 'dist');
  agentTrace = Object.fromEntries(Object.entries({ OCTO_KEY: env.OCTO_KEY, OCTO_WORKSPACE: env.OCTO_WORKSPACE, OCTO_BASE: env.OCTO_BASE,
    OCTO_TRACES: opts.offline ? 'off' : env.OCTO_TRACES }).filter((e): e is [string, string] => !!e[1]));
  void voiceUp();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
    if (req.method === 'POST' && url.pathname === '/api/voice/token') {
      void voiceUp();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(voiceToken())); return;
    }
    if (url.pathname.startsWith('/api/')) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const r = await api.handle(new Request(`http://local${url.pathname}${url.search}`, { method: req.method,
        headers: { 'content-type': 'application/json', ...(typeof req.headers.authorization === 'string' ? { authorization: req.headers.authorization } : {}),
          ...(typeof req.headers['x-session-id'] === 'string' ? { 'x-session-id': req.headers['x-session-id'] } : {}) },
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
  await new Promise<void>(r => server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', r));
  const url = `http://${opts.host ?? '127.0.0.1'}:${(server.address() as { port: number }).port}`;
  return { url, mode: api.mode, close: () => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); }).then(() => tracing?.flush()) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await start({ port: Number(process.env.PORT) || 8787, host: process.env.HOST || '127.0.0.1', offline: process.argv.includes('--offline') });
  console.log(`copilot demo at ${s.url}  (backend: ${s.mode})`);
}
