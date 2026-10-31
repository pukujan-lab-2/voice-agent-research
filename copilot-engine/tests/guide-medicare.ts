// Real-manual holdout: questions about Medicare & You 2027 pages 15-19, written before the first run.
// Answers must quote the manual (checked by a key phrase) or say "I don't know". Never a made-up answer.
// Run: node tests/guide-medicare.ts   (needs OPENROUTER_JEV_KEY, JEV_URL, OCTO_KEY, OCTO_WORKSPACE)
import fs from 'node:fs';
import { Guide, JevJudge, OctoRetriever } from '../src/guide.ts';
import { medicareSignup as M, medicareReviewed } from '../src/manuals/medicare-signup.ts';

const judge = new JevJudge();
const retriever = new OctoRetriever({ key: process.env.OCTO_KEY!, workspaceId: process.env.OCTO_WORKSPACE!, titlePrefix: 'manual:medicare-signup' });
type Case = { say: string; want: RegExp | 'dont_know' };
const cases: Case[] = [
  { say: 'when does my initial enrollment period start?', want: /3 months before|7-month/i },
  { say: 'what is the general enrollment period?', want: /January 1.March 31/i },
  { say: "what's the phone number for the railroad retirement board?", want: /1-877-772-5772/ },
  { say: 'does COBRA count as coverage from current employment?', want: /COBRA/ },
  { say: 'if I already get Social Security, do I have to sign up?', want: /automatically/i },
  { say: "what happens if I don't sign up for Part B when I'm first eligible?", want: /penalty|delay/i },
  { say: 'I have ALS. When does my Medicare start?', want: /ALS/ },
  { say: 'do I need Part B to keep TRICARE if I am on active duty?', want: /TRICARE/ },
  { say: 'how far back can my Part A coverage go?', want: /6 months/i },
  { say: 'where do I apply online?', want: /SSA\.gov\/medicare\/sign-up/i },
  { say: 'I live in Puerto Rico, do I get Part B automatically?', want: /Puerto Rico/ },
  { say: 'how much is the Part B premium this year?', want: 'dont_know' },
  { say: 'which Medigap plan is best for me?', want: 'dont_know' },
  { say: 'how do I clean my dishwasher filter?', want: 'dont_know' },
  { say: "what's the weather in Boston?", want: 'dont_know' },
  { say: 'can you recommend a good doctor near me?', want: 'dont_know' },
];

let pass = 0;
const t0 = Date.now();
for (const c of cases) {
  const g = new Guide(M, retriever, judge);
  g.start();
  const r = await g.turn(c.say);
  const ok = c.want === 'dont_know' ? /^I don't know/.test(r) : c.want.test(r) && /^The manual says/.test(r);
  pass += ok ? 1 : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.say}${ok ? '' : `\n      -> "${r.slice(0, 160)}"`}`);
  fs.appendFileSync(new URL('../ledger.jsonl', import.meta.url), JSON.stringify({ ts: new Date().toISOString(), set: 'guide-medicare', judge: 'jev', retriever: 'octo', scenario: c.say, pass: ok }) + '\n');
}
console.log(`\nguide-medicare: ${pass}/${cases.length}, ${((Date.now() - t0) / cases.length / 1000).toFixed(1)} s per question, Jev ${judge.calls} calls $${judge.cost.toFixed(5)}; steps reviewed by owner: ${medicareReviewed}`);
