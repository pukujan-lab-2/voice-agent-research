// Manual-guidance checks: navigation is code, and side questions are answered only by quoting the manual.
// Run: node tests/guide.ts [--jev] [--octo]   (--jev: Jev judges passages, key OPENROUTER_JEV_KEY;
// --octo: search Octo RAG, key OCTO_KEY + OCTO_WORKSPACE, with the demo passages loaded there)
import fs from 'node:fs';
import { Guide, JevJudge, KeywordRetriever, OctoRetriever, OverlapJudge } from '../src/guide.ts';
import { halvorsenFilter as M } from '../src/manuals/halvorsen-filter.ts';

const jev = process.argv.includes('--jev');
const judge = jev ? new JevJudge() : new OverlapJudge();
const octo = process.argv.includes('--octo');
const retriever = octo ? new OctoRetriever({ key: process.env.OCTO_KEY!, workspaceId: process.env.OCTO_WORKSPACE! }) : new KeywordRetriever(M.passages);
const make = () => new Guide(M, retriever, judge);

type Case = { name: string; setup: string[]; say: string; ok: (g: Guide, r: string) => boolean };
const at = (n: number) => (g: Guide) => g.idx === n - 1;
const quotes = (id: string) => (_g: Guide, r: string) => r.includes(M.passages.find(p => p.id === id)!.text);
const dontKnow = (_g: Guide, r: string) => /^I don't know/.test(r);
const cases: Case[] = [
  // navigation (code)
  { name: 'next moves on', setup: [], say: 'done', ok: at(2) },
  { name: '"ok, done" moves on', setup: [], say: 'ok, done', ok: at(2) },
  { name: 'back goes back', setup: ['next', 'next'], say: 'go back', ok: at(2) },
  { name: 'back at step 1 stays', setup: [], say: 'back', ok: at(1) },
  { name: 'repeat stays', setup: ['next'], say: 'can you repeat that', ok: (g, r) => g.idx === 1 && r.includes('Step 2') },
  { name: 'filler waits', setup: ['next'], say: 'one second', ok: (g, r) => g.idx === 1 && /take your time/i.test(r) },
  { name: 'last step finishes', setup: ['next', 'next', 'next', 'next', 'next', 'next'], say: 'done', ok: (g, r) => g.done && /all done/.test(r) },
  { name: 'stop ends', setup: ['next'], say: 'stop', ok: (g, r) => g.done && /step 2/.test(r) },
  { name: 'statement is not a step', setup: [], say: 'my kitchen is small', ok: at(1) },
  // side questions answered from the manual
  { name: 'how often', setup: [], say: 'how often should I clean the filter?', ok: quotes('p1') },
  { name: 'wire brush', setup: ['next', 'next', 'next', 'next'], say: 'can I use a wire brush?', ok: quotes('p2') },
  { name: 'does not click', setup: ['next', 'next', 'next', 'next', 'next'], say: "what if the filter doesn't click?", ok: quotes('p3') },
  { name: 'E24', setup: [], say: 'what does error E24 mean?', ok: quotes('p4') },
  { name: 'where is the switch', setup: [], say: 'where is the wall switch?', ok: quotes('p7') },
  { name: 'question keeps the step', setup: ['next', 'next'], say: 'how often should I clean the filter?', ok: (g, r) => g.idx === 2 && /still on step 3/.test(r) },
  // questions the manual does not answer: must say "I don't know", never guess
  { name: 'price of a new filter', setup: [], say: 'how much does a new filter cost?', ok: dontKnow },
  { name: 'oven question', setup: [], say: 'how do I clean my oven?', ok: dontKnow },
  { name: 'filter brand', setup: [], say: 'which brand of filter is best?', ok: dontKnow },
  { name: 'warranty length is answerable', setup: [], say: 'how long is the warranty?', ok: quotes('p6') },
  { name: 'dish soap', setup: [], say: 'can I use washing-up liquid?', ok: quotes('p5') },
  { name: 'unrelated', setup: [], say: 'what is the capital of France?', ok: dontKnow },
];

let pass = 0;
for (const t of cases) {
  const g = make();
  g.start();
  for (const s of t.setup) await g.turn(s);
  const r = await g.turn(t.say);
  const ok = t.ok(g, r);
  pass += ok ? 1 : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name}${ok ? '' : `\n      said "${t.say}" -> "${r.slice(0, 130)}"`}`);
  fs.appendFileSync(new URL('../ledger.jsonl', import.meta.url), JSON.stringify({ ts: new Date().toISOString(), set: 'guide', judge: jev ? 'jev' : 'overlap', retriever: octo ? 'octo' : 'keyword', scenario: t.name, pass: ok }) + '\n');
}
console.log(`\nguide: ${pass}/${cases.length} (judge: ${jev ? 'jev' : 'overlap'}, retriever: ${octo ? 'octo' : 'keyword'})${judge instanceof JevJudge ? `, Jev ${judge.calls} calls $${judge.cost.toFixed(5)}` : ''}`);
