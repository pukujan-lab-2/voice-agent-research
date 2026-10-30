// Table test: IRS Publication 17 (2025), PDF pages 9-11 and 95-98, loaded into Octo two ways and asked the same questions.
// Questions written 2026-10-30 before either load was run. Most answers sit in table rows (filing thresholds, standard deduction).
// Answers must quote the manual with the right number, or say "I don't know". Never a made-up answer.
// Run: node tests/guide-irs.ts plain|docling   (needs OPENROUTER_JEV_KEY, JEV_URL, OCTO_KEY, OCTO_WORKSPACE)
import fs from 'node:fs';
import { Guide, JevJudge, OctoRetriever, type Manual } from '../src/guide.ts';

const set = process.argv[2] === 'docling' ? 'docling' : 'plain';
const M: Manual = {
  id: `irs-pub17-${set}`, title: 'IRS Publication 17 (2025): filing and standard deduction', business: 'the IRS tax guide',
  steps: [{ n: 1, page: 9, text: 'Check whether you must file a return.' }, { n: 2, page: 97, text: 'Find your standard deduction.' }],
  passages: [],
};
const judge = new JevJudge();
// Both loads share one workspace and Octo search has no filter, so fetch deeper than usual before dropping the other load.
const retriever = new OctoRetriever({ key: process.env.OCTO_KEY!, workspaceId: process.env.OCTO_WORKSPACE!, titlePrefix: `manual:irs-pub17-${set} `, overfetch: 10 });
type Case = { say: string; want: RegExp | 'dont_know'; table: boolean };
const cases: Case[] = [
  { say: "I'm single and under 65. How much do I have to earn before I must file?", want: /15,750/, table: true },
  { say: "I'm single and 67. What income means I have to file?", want: /17,750/, table: true },
  { say: "We're married filing jointly and both over 65. When do we have to file?", want: /34,700/, table: true },
  { say: "What's the filing threshold for married filing separately?", want: /\$5\b/, table: true },
  { say: "I'm head of household and over 65. What's my filing threshold?", want: /25,625/, table: true },
  { say: "I'm a qualifying surviving spouse under 65. When must I file?", want: /31,500/, table: true },
  { say: "What's the standard deduction for head of household?", want: /23,625/, table: true },
  { say: 'Married filing jointly, one of us was born before 1961. What is our standard deduction?', want: /33,100/, table: true },
  { say: 'Married filing jointly, we were both born before 1961 and we are both blind. Standard deduction?', want: /37,900/, table: true },
  { say: "I'm single, blind, and born in 1958. What's my standard deduction?", want: /19,750/, table: true },
  { say: 'Married filing separately with 3 boxes checked: what standard deduction?', want: /20,550/, table: true },
  { say: 'If someone can claim me as a dependent, what is the minimum standard deduction?', want: /1,350/, table: true },
  { say: 'When am I considered 65?', want: /day before your 65th birthday/i, table: false },
  { say: 'My spouse files separately and itemizes. Can I take the standard deduction?', want: /can'?t take the standard deduction/i, table: false },
  { say: 'Which states are community property states?', want: /Arizona/, table: false },
  { say: 'How do I file my California state taxes?', want: 'dont_know', table: false },
  { say: 'What is the tax rate on long-term capital gains?', want: 'dont_know', table: false },
  { say: 'Can you recommend a good tax preparer?', want: 'dont_know', table: false },
];

let pass = 0, tablePass = 0;
const t0 = Date.now();
for (const c of cases) {
  const g = new Guide(M, retriever, judge);
  g.start();
  const r = await g.turn(c.say);
  const ok = c.want === 'dont_know' ? /^I don't know/.test(r) : /^The manual says/.test(r) && c.want.test(r);
  pass += ok ? 1 : 0;
  tablePass += ok && c.table ? 1 : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.say}${ok ? '' : `\n      -> "${r.slice(0, 220)}"`}`);
  fs.appendFileSync(new URL('../ledger.jsonl', import.meta.url), JSON.stringify({ ts: new Date().toISOString(), set: 'guide-irs', load: set, judge: 'jev', retriever: 'octo', scenario: c.say, pass: ok }) + '\n');
}
const tables = cases.filter(c => c.table).length;
console.log(`\nguide-irs (${set}): ${pass}/${cases.length}, table questions ${tablePass}/${tables}, ${((Date.now() - t0) / cases.length / 1000).toFixed(1)} s per question, Jev ${judge.calls} calls $${judge.cost.toFixed(5)}`);
