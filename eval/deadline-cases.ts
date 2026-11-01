// Date questions on the real search and the real judge: each must return the calendar-year due-date passage ("generally
// April 15") among the top 4 hits and be answered from a due-date passage (not "I don't know", not the refund time limit).
// The first two phrasings are what the owner's call (session 75aeb0b4) produced; the rest are the ways a caller says it.
// Run: node eval/deadline-cases.ts [--corpus irs]. Exits 1 when a case fails.
import path from 'node:path';
import { Guide, JevJudge, OctoRetriever, type Passage } from '../copilot-engine/src/guide.ts';
import { loadConfig } from './generate.ts';
import { key } from './lib/env.ts';

const corpus = process.argv.includes('--corpus') ? process.argv[process.argv.indexOf('--corpus') + 1] : 'irs';
const cfg = loadConfig(corpus) as any;
const octo = new OctoRetriever({ key: key('OCTO_KEY', 'octo_db_chatbots')!, workspaceId: key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace')!,
  titlePrefix: cfg.target.retriever.prefixes, rerank: cfg.target.retriever.rerank, timeoutMs: 150000 });
const jev = new JevJudge({ key: key('OPENROUTER_JEV_KEY', 'openrouter_jev_only') });
const book = { id: corpus, title: cfg.name, business: 'Brindlewick', steps: [], passages: [], unknown: cfg.target.unknown };
const isDue = (p: Passage) => /\b(April 15|15th day of the 4th month|due date)\b/i.test(p.text) && /\b(file|filing|return)\b/i.test(p.text) && !/\brefund\b/i.test(p.text.slice(0, 120));

// [what the caller said, what the desk model rewrote it to]
const cases: [string, string][] = [
  ["What month do I file taxes up to? What's the deadline?", 'What is the filing deadline for my return?'],
  ["Hmm. Uh can you consult on Filing taxes, what happens? Like, what's the best month to file taxes?", 'What is the best month to file taxes?'],
  ['What month do I have to file my taxes by?', 'What month do I have to file my taxes by?'],
  ["What's the deadline?", 'What is the deadline to file my tax return?'],
  ['When is the tax deadline?', 'When is the tax deadline?'],
];
let fails = 0;
for (const [said, q] of cases) {
  const g = new Guide(book as any, { async search(x, k) { return octo.search(x, k); } }, jev as any);
  g.also = said.replace(/^.*?(?=What|When)/i, '');
  const reply = await g.lookup(q);
  const inTop = g.lastHits.slice(0, 4).some(isDue);
  const answered = !!g.last && isDue(g.last);
  if (!inTop || !answered) fails++;
  console.log(`${inTop && answered ? 'PASS' : 'FAIL'}  "${q}"  the due date is in the top 4: ${inTop}; answered from a due-date passage: ${answered}${g.lastClosest ? ' (as the closest)' : ''}\n      ${reply.slice(0, 140).replace(/\n/g, ' ')}`);
}
console.log(`\n${cases.length - fails} of ${cases.length} pass`);
process.exit(fails ? 1 : 0);
