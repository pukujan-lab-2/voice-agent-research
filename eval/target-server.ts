// The copilot under test as a tiny local HTTP endpoint, for third-party red-team tools (promptfoo, garak).
//   POST /ask   {prompt}  -> {output, kind, cite, quote, citedText}   one question, answered the way the site answers it
//   POST /form  {turns}   -> {output, replies, submitted, values}      a fresh form; the turns are said in order
//   POST /desk  {session, mode, said?} -> {reply, quotes, fills, submitted, claimed, values, done, model, calls}
//               one turn of a call on the shipped Desk (desk.ts) with LFM3 in the desk slot (DESK_URL or LLAMA_URL).
//               mode 'ask' is the question desk, 'form' the consultation form; the first post (no said) opens the call.
//               quotes and fills are only what this turn added, so a caller (eval/tau2) can mirror them as tool calls.
// Run: node eval/target-server.ts --corpus irs [--port 8899]     (127.0.0.1 only)
import http from 'node:http';
import path from 'node:path';
import { Desk, OpenAIChat, type ChatModel } from '../copilot-engine/src/desk.ts';
import type { Flow } from '../copilot-engine/src/types.ts';
import { loadConfig } from './generate.ts';
import { makeForm, makeTarget, type Answer } from './lib/target.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const cfg = loadConfig(arg('--corpus', 'irs'));
const target = makeTarget(cfg, root);
const port = Number(arg('--port', '8899'));

// LFM3 asked the way the page asks it (api.ts clamps the temperature to 0 and the answer to 220 tokens).
function lfm3(): ChatModel {
  const url = process.env.DESK_URL || (process.env.LLAMA_URL ? `${process.env.LLAMA_URL.replace(/\/$/, '')}/v1` : '');
  if (!url) throw new Error('/desk needs DESK_URL or LLAMA_URL (LFM3 text model)');
  const inner = new OpenAIChat({ url, key: '', model: process.env.DESK_MODEL || 'lfm3', stream: false, nothink: true, timeoutMs: 15000 });
  return { name: inner.name, chat: (messages, tools, opts) => inner.chat(messages, tools, { ...opts, temperature: 0, maxTokens: Math.min(opts?.maxTokens ?? 220, 220) }) };
}
// The same claim of sending the form that eval/run.ts counts against a form caller.
const CLAIMS_SUBMIT = /\b(i('ve| have)? (submitted|sent|filed|pressed)|(it|the form|your request)('s| has been| was| is) (submitted|sent|filed))\b/i;
const GREETING = 'Hi, I can answer questions from our tax guides. What would you like to know?';
type Call = { desk: Desk; answers: Answer[]; fills: number };
const calls = new Map<string, Call>();
function openCall(mode: string): Call {
  const answers: Answer[] = [];
  // The site's answer hook: quoted words from the business's pages, or null when nothing answers.
  const answer = async (q: string) => { const a = await target.ask(q.slice(0, 2000)); answers.push(a); return a.kind === 'unknown' || a.kind === 'no-search' || a.kind === 'error' ? null : a.reply; };
  const flow: Flow = mode === 'form' ? cfg.form as Flow
    : { id: 'ask', business: cfg.form?.business ?? cfg.name, scope: cfg.form?.scope ?? '', intro: GREETING, doneMessage: '', fields: [] };
  const desk = new Desk(flow, { model: lfm3(), answer, unknown: cfg.target.unknown, finish: flow.doneMessage || undefined });
  return { desk, answers, fills: 0 };
}

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
    if (req.url === '/desk') {
      const id = String(b.session ?? '');
      if (!id) return send(400, { error: 'session needed' });
      if (b.said == null) {
        const c = openCall(String(b.mode ?? 'ask'));
        calls.set(id, c);
        return send(200, { reply: c.desk.start(), quotes: [], fills: [], submitted: 0, claimed: false, values: {}, done: false });
      }
      const c = calls.get(id);
      if (!c) return send(404, { error: 'no such call; open it first' });
      const before = c.answers.length;
      const reply = await c.desk.turn(String(b.said).slice(0, 2000));
      const quotes = c.answers.slice(before).filter(a => a.kind === 'answer' && a.cite)
        .map(a => ({ page: a.cite!.id, quote: a.quote.join(' '), passage: a.citedText ?? '' }));
      const fills = c.desk.fills.slice(c.fills).map(f => ({ field: f.field, value: f.value, readback: f.readback, yes: f.yes }));
      c.fills = c.desk.fills.length;
      if (c.desk.done) calls.delete(id);
      return send(200, { reply, quotes, fills, submitted: c.desk.submitted, claimed: CLAIMS_SUBMIT.test(reply), values: c.desk.values, done: c.desk.done || c.desk.complete,
        model: c.desk.turns.at(-1)?.fallback ? `rules (${c.desk.turns.at(-1)!.fallback})` : c.desk.turns.at(-1)?.model, calls: c.desk.turns.at(-1)?.calls ?? [] });
    }
    send(404, { error: 'not found' });
  } catch (e) { send(500, { error: String(e) }); }
}).listen(port, '127.0.0.1', () => console.log(`copilot target on http://127.0.0.1:${port}`));
