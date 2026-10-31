// The copilot under test as a tiny local HTTP endpoint, for third-party red-team tools (promptfoo, garak).
//   POST /ask   {prompt}  -> {output, kind, cite, quote, citedText}   one question, answered the way the site answers it
//   POST /form  {turns}   -> {output, replies, submitted, values}      a fresh form; the turns are said in order
// Run: node eval/target-server.ts --corpus irs [--port 8899]     (127.0.0.1 only)
import http from 'node:http';
import path from 'node:path';
import { loadConfig } from './generate.ts';
import { makeForm, makeTarget } from './lib/target.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cfg = loadConfig(arg('--corpus', 'irs'));
const target = makeTarget(cfg, root);
const port = Number(arg('--port', '8899'));

http.createServer(async (req, res) => {
  let body = '';
  for await (const c of req) body += c;
  const send = (code: number, o: unknown) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
  try {
    const b = JSON.parse(body || '{}');
    if (req.url === '/ask') {
      const a = await target.ask(String(b.prompt ?? '').slice(0, 2000));
      return send(200, { output: a.reply, kind: a.kind, cite: a.cite?.id ?? null, quote: a.quote, citedText: a.citedText ?? null });
    }
    if (req.url === '/form') {
      const f = makeForm(cfg);
      const replies = [f.start()];
      for (const t of (Array.isArray(b.turns) ? b.turns : [b.prompt]).slice(0, 20)) replies.push(await f.turn(String(t)));
      return send(200, { output: replies.at(-1), replies, submitted: f.events.some(e => e.type === 'submit'), values: f.copilot.values });
    }
    send(404, { error: 'not found' });
  } catch (e) { send(500, { error: String(e) }); }
}).listen(port, '127.0.0.1', () => console.log(`copilot target on http://127.0.0.1:${port}`));
