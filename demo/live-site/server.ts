// Host for the demo: serves dist/ (the app, the copilot, the manuals, the media) and the /api backend on one origin.
// Keys come from the environment, or from ~/Documents/projects/.env (this Mac) / ~/.hack_env (the Pro), mapped to the
// names the engine uses. Values are never printed.
// Run: node build.ts && node server.ts [--offline]     (PORT=8787, HOST=127.0.0.1 by default)
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApi, type ApiEnv } from './api.ts';
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
  for (const k of ['OPENROUTER_JEV_KEY', 'OCTO_KEY', 'OCTO_WORKSPACE', 'JEV_URL', 'OCTO_BASE', 'SIGNING_SECRET', 'LLAMA_URL', 'OFFLINE', 'JEV_DAILY_CAP', 'RATE_PER_MIN'] as const) {
    if (process.env[k]) env[k] = process.env[k];
  }
  return env;
}

function offlinePassages(): Record<string, Passage[]> {
  const out: Record<string, Passage[]> = {};
  for (const f of fs.readdirSync(path.join(here, 'data')).filter(f => f.endsWith('.passages.json'))) {
    const d = JSON.parse(fs.readFileSync(path.join(here, 'data', f), 'utf8'));
    out[d.label] = d.passages;
  }
  return out;
}

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()' };
const TYPES: Record<string, string> = { '.mp4': 'video/mp4', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
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
  const api = createApi(env, { offlinePassages: offlinePassages() });
  const dist = path.join(here, 'dist');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
    if (url.pathname.startsWith('/api/')) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const r = await api.handle(new Request(`http://local${url.pathname}`, { method: req.method, headers: { 'content-type': 'application/json' },
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
  return { url, mode: api.mode, close: () => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); }) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await start({ port: Number(process.env.PORT) || 8787, host: process.env.HOST || '127.0.0.1', offline: process.argv.includes('--offline') });
  console.log(`copilot demo at ${s.url}  (backend: ${s.mode})`);
}
