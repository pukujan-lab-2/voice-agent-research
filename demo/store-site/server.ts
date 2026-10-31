// Host for Brambleway: serves dist/ (the store app and the copilot) and the /api backend on one origin.
// Keys come from the environment, or from ~/Documents/projects/.env (this Mac) / ~/.hack_env (the Pro). Values are never printed.
// Run: node server.ts     (PORT=8790, HOST=127.0.0.1 by default)
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { createApi, type ApiEnv } from './api.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const MAP: Record<string, keyof ApiEnv> = { openrouter_jev_only: 'OPENROUTER_JEV_KEY', octo_db_chatbots: 'OCTO_KEY', octo_db_chatbots_workspace: 'OCTO_WORKSPACE' };
const PASS = ['OPENROUTER_JEV_KEY', 'OCTO_KEY', 'OCTO_WORKSPACE', 'JEV_URL', 'OCTO_BASE', 'LLAMA_URL', 'JEV_DAILY_CAP', 'RATE_PER_MIN'] as const;

export function loadEnv(): ApiEnv {
  const env: ApiEnv = {};
  for (const file of [path.join(os.homedir(), 'Documents/projects/.env'), path.join(os.homedir(), '.hack_env')]) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)$/);
      if (!m) continue;
      const name = MAP[m[1]] ?? ((PASS as readonly string[]).includes(m[1]) ? m[1] as keyof ApiEnv : undefined);
      if (name && !env[name]) env[name] = m[2].trim().replace(/^['"]|['"]$/g, '');
    }
  }
  for (const k of PASS) if (process.env[k]) env[k] = process.env[k];
  return env;
}

const HEADERS = { 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff', 'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()' };
const TYPES: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };

function visitor(req: http.IncomingMessage): string {
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');
  const cf = req.headers['cf-connecting-ip'];
  return local && typeof cf === 'string' ? cf : req.socket.remoteAddress ?? '';
}

export async function start(opts: { port?: number; host?: string } = {}) {
  const api = createApi(loadEnv());
  api.warm().catch(() => {});
  const dist = path.join(here, 'dist');
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
    if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/img/')) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const headers: Record<string, string> = { 'content-type': 'application/json' };
      if (typeof req.headers['x-shopper'] === 'string') headers['x-shopper'] = req.headers['x-shopper'];
      const r = await api.handle(new Request(`http://local${url.pathname}${url.search}`, { method: req.method, headers,
        body: ['POST', 'DELETE'].includes(req.method ?? '') && chunks.length ? Buffer.concat(chunks) : undefined }), visitor(req));
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
      return;
    }
    let file = path.normalize(path.join(dist, decodeURIComponent(url.pathname)));
    if (!file.startsWith(dist)) { res.writeHead(403); res.end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    // The app routes in the browser: a page address with no file behind it gets index.html.
    if (!fs.existsSync(file) && !path.extname(url.pathname)) file = path.join(dist, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('Not found'); return; }
    const cache = url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': fs.statSync(file).size, 'Cache-Control': cache });
    if (req.method === 'HEAD') { res.end(); return; }
    fs.createReadStream(file).pipe(res);
  });
  await new Promise<void>(r => server.listen(opts.port ?? 0, opts.host ?? '127.0.0.1', r));
  const url = `http://${opts.host ?? '127.0.0.1'}:${(server.address() as { port: number }).port}`;
  return { url, mode: api.mode, close: () => new Promise<void>(r => { server.closeAllConnections(); server.close(() => r()); }) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = await start({ port: Number(process.env.PORT) || 8790, host: process.env.HOST || '127.0.0.1' });
  console.log(`Brambleway demo store at ${s.url}  (backend: ${s.mode})`);
}
