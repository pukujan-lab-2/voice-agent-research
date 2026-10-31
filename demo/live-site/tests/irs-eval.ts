// Brindlewick eval: 100 IRS FAQ questions, asked word for word, answered the way the site answers them (the widget's
// advice check, then /api/search over the irs/ library in Octo, Jev's judge and sentence pick, a cited quote), and graded
// by Jev against the IRS's own answer to that question (the gold).
// Two runs: "held-out" hides the question's own FAQ entry from search (can the guides answer it?), "as deployed" doesn't.
// Run: node tests/irs-eval.ts [--n 100] [--mode held-out|deployed|both]   (keys from ~/Documents/projects/.env)
import fs from 'node:fs';
import path from 'node:path';
import { Guide, type Judge, type Passage, type Retriever } from '../../../copilot-engine/src/guide.ts';
import { createApi } from '../api.ts';
import { loadEnv } from '../server.ts';

const here = path.dirname(new URL(import.meta.url).pathname);
const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = Number(arg('--n', '100'));
const modes = arg('--mode', 'both') === 'both' ? ['held-out', 'deployed'] : [arg('--mode', 'both')];

const env = loadEnv();
env.RATE_PER_MIN = '100000';
const corpus = JSON.parse(fs.readFileSync(path.join(here, '../data/irs.passages.json'), 'utf8')).passages;
const api = createApi(env, { offlinePassages: { irs: corpus } });
const call = async (p: string, body: unknown) => (await api.handle(new Request(`http://local${p}`, { method: 'POST', body: JSON.stringify(body) }))).json();

// The widget's own advice check, read from its source so the eval tests what ships.
const sdk = fs.readFileSync(path.join(here, '../widget/sdk.ts'), 'utf8');
const [, src, flags] = sdk.match(/^const ADVICE = \/(.*)\/([a-z]*);/m)!;
const ADVICE = new RegExp(src, flags);

// 100 questions spread over the FAQ categories (round robin, in file order), so no one topic dominates.
type Faq = { id: string; question: string; answer: string; category: string; url: string };
const faqs: Faq[] = JSON.parse(fs.readFileSync(path.join(here, '../data/irs.faq.json'), 'utf8'));
const byCat = new Map<string, Faq[]>();
for (const f of faqs) byCat.set(f.category, [...(byCat.get(f.category) ?? []), f]);
const sample: Faq[] = [];
for (let i = 0; sample.length < N && i < 500; i++) for (const list of byCat.values()) if (list[i] && sample.length < N) sample.push(list[i]);

// Jev as the grader: does the copilot's reply give the IRS's answer?
const JEV = env.JEV_URL || 'https://openrouter.ai/api/alpha/decisions';
let graderCost = 0;
async function grade(f: Faq, reply: string): Promise<{ verdict: string; p: number }> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(JEV, {
        method: 'POST', signal: AbortSignal.timeout(30000),
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENROUTER_JEV_KEY}`, 'User-Agent': 'copilot-engine/0.1' },
        body: JSON.stringify({
          model: 'typesafe/jev-1.14',
          state: { question: f.question, irs_answer: f.answer.slice(0, 2000), reply },
          questions: { grade: { type: 'choice', instructions: 'Compare the reply with the IRS answer to the question. The reply is a short quote, so it may leave out detail.', criteria: {
            correct: 'The reply answers the question and agrees with the IRS answer on the main point',
            partial: 'The reply is on the right topic and does not contradict the IRS answer, but misses its main point',
            wrong: 'The reply does not answer the question, or it contradicts the IRS answer',
          } } },
        }),
      });
      if (!r.ok) throw new Error(`jev ${r.status}`);
      const j = await r.json();
      graderCost += j.usage?.cost ?? 0;
      const a = j.answers?.grade;
      return { verdict: a?.choice ?? 'error', p: a?.probabilities?.[a?.choice] ?? 0 };
    } catch { await new Promise(res => setTimeout(res, 1500 * (attempt + 1))); }
  }
  return { verdict: 'error', p: 0 };
}

const LIB = { id: 'irs', title: 'IRS tax guides', business: 'Brindlewick', steps: [], passages: [],
  unknown: "I don't know. I couldn't find that in the IRS guides I answer from." };
const out: any[] = [];
const summary: Record<string, Record<string, number>> = {};
for (const mode of modes) {
  const t0 = Date.now();
  const tally: Record<string, number> = { correct: 0, partial: 0, wrong: 0, dont_know: 0, deflected: 0, error: 0 };
  let jevCalls = 0;
  for (const [i, f] of sample.entries()) {
    // the API hands out text and citation, not the corpus id, so the question's own FAQ entry is known by its text
    const own = new Set(corpus.filter((c: any) => c.faq === f.id).map((c: any) => c.text));
    // the same round trips the widget makes, through the real API handler (signed passages and all)
    const retriever: Retriever = { async search(q, k) {
      const { passages } = await call('/api/search', { manual: 'irs', query: q, k: 6 });
      return (passages as (Passage & { sig: string })[]).filter(p => mode !== 'held-out' || !own.has(p.text)).slice(0, k);
    } };
    let picked: Passage[] = [];
    const judge: Judge = {
      async pick(q, ps) { jevCalls++; picked = ps; return (await call('/api/judge', { question: q, passages: ps })).id; },
      async sentences(q, ss) { jevCalls++; const p = picked.find(x => ss.every(s => x.text.includes(s))); return (await call('/api/sentences', { question: q, passage: p, sentences: ss })).idx; },
    };
    const g = new Guide(LIB as any, retriever, judge);
    let reply: string, verdict: string, p = 1;
    if (ADVICE.test(f.question)) { reply = '(advice: offered a consultation)'; verdict = 'deflected'; }
    else {
      reply = await g.lookup(f.question);
      if (/^I don't know/.test(reply)) verdict = 'dont_know';
      else ({ verdict, p } = await grade(f, reply));
    }
    tally[verdict] = (tally[verdict] ?? 0) + 1;
    out.push({ mode, id: f.id, category: f.category, question: f.question, reply, cite: g.last?.cite?.url ?? '', verdict, p: +p.toFixed(2) });
    console.log(`${String(i + 1).padStart(3)} ${verdict.padEnd(9)} ${f.question.slice(0, 90)}`);
  }
  const s = (Date.now() - t0) / sample.length / 1000;
  summary[mode] = { ...tally, seconds_per_question: +s.toFixed(1), jev_calls: jevCalls };
  console.log(`\n${mode}: ${tally.correct} correct, ${tally.partial} partly, ${tally.wrong} wrong, ${tally.dont_know} "I don't know", ${tally.deflected} offered a consultation (of ${sample.length}); ${s.toFixed(1)} s per question\n`);
}
console.log(JSON.stringify(summary, null, 1), `\ngrader cost $${graderCost.toFixed(4)}`);
const dest = process.env.EVAL_OUT ?? path.join(here, '../build/irs/eval.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify({ when: new Date().toISOString(), n: sample.length, summary, graderCost, results: out }, null, 1));
console.log(`results: ${dest}`);
