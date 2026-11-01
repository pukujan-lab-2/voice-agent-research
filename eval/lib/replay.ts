// Run one replay case through the shipped answer path and check it.
//   recorded: the library path (copilot-engine's Guide) on the search, judge and sentence results the live system
//             returned, so it needs no keys and gives the same answer every time. It tests our code around the models.
//   live:     the same Guide on a real Octo search and the real judge (needs keys).
//   site:     the desk path, by sending a case's recorded messages to a running site's /api/desk.
import fs from 'node:fs';
import { Guide, type Judge, type Retriever } from '../../copilot-engine/src/guide.ts';
import { check, type Verdict } from './expect.ts';
import type { Case } from './cases.ts';

const unknown: string = JSON.parse(fs.readFileSync(new URL('../config/irs.json', import.meta.url), 'utf8')).target.unknown;
const book = { id: 'irs', title: 'the tax guides', business: 'Brindlewick Tax & Accounting', steps: [], passages: [], unknown };

export type Result = { case: Case; verdict: Verdict | null; reply: string; skipped?: string };

export async function runGuide(c: Case, live?: (q: string) => Promise<{ reply: string; citedId?: string; quoted: boolean }>): Promise<Result> {
  if (live) { const a = await live(c.input); return { case: c, reply: a.reply, verdict: check(c.expect, { reply: a.reply, cited: a.citedId, quoted: a.quoted }) }; }
  const retriever: Retriever = { async search(q) { return c.recorded.searches.find(s => s.q === q)?.passages ?? []; } };
  const judge: Judge = {
    async pick(q) { return c.recorded.judges.find(j => j.q === q)?.id ?? ''; },
    async sentences(q) { return c.recorded.sentences.find(s => s.q === q)?.idx ?? []; },
  };
  const g = new Guide(book, retriever, judge);
  const reply = await g.lookup(c.input);
  return { case: c, reply, verdict: check(c.expect, { reply, cited: g.last?.id, quoted: !!g.last }) };
}

const ASK_TOOLS = [
  { type: 'function', function: { name: 'answer_question', description: 'Look up the answer to a question about Brindlewick Tax & Accounting in its own documents.', parameters: { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] } } },
  { type: 'function', function: { name: 'end_call', description: 'The customer says goodbye or wants to stop.', parameters: { type: 'object', properties: { reason: { type: 'string' } }, required: [] } } },
];
export async function runDesk(c: Case, site?: string): Promise<Result> {
  if (!site) return { case: c, reply: '', verdict: null, skipped: 'needs a running site (--site <url>) for the desk model' };
  const r = await fetch(`${site.replace(/\/$/, '')}/api/desk`, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: AbortSignal.timeout(60000),
    body: JSON.stringify({ messages: c.recorded.deskMessages, tools: ASK_TOOLS, temperature: 0 }) });
  if (!r.ok) return { case: c, reply: '', verdict: null, skipped: `/api/desk answered ${r.status}` };
  const j = await r.json() as { content: string; calls: { name: string }[] };
  // a model that calls answer_question says nothing itself: its words are checked only when it speaks
  return { case: c, reply: j.content, verdict: check(c.expect, { reply: j.content, quoted: false }) };
}
