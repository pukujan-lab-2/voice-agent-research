// Does a judge rule keep the held-out numbers? Runs the real search and Jev once per question, keeps Jev's raw
// probabilities, and scores two rules over the same results: the original gate (a pick stands when "none" <= 0.25) and
// the shipped `pickRule`. Nothing here asks a model to grade; the gold passage ids come from eval/out/<corpus>/sets.json.
//   answerable (casual + chain first turns): the pick is the gold passage (right), another passage (wrong), or none (missed)
//   unanswerable: any pick is a made-up answer; none is correct
// Run: node eval/judge-rule.ts [--corpus irs] [--limit 100]. Writes eval/out/<corpus>/judge-rule.json (resumable).
import fs from 'node:fs';
import path from 'node:path';
import { JevJudge, OctoRetriever, pickRule, withoutNiche, NONE_MAX, type Passage } from '../copilot-engine/src/guide.ts';
import { key } from './lib/env.ts';
import { pool } from './lib/pool.ts';
import { loadConfig } from './generate.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const corpus = arg('--corpus', 'irs'), limit = Number(arg('--limit', '100'));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const out = path.join(root, 'eval/out', corpus, 'judge-rule.json');
const cfg = loadConfig(corpus) as any;
const sets = JSON.parse(fs.readFileSync(path.join(root, 'eval/out', corpus, 'sets.json'), 'utf8')).sets;

type Item = { kind: 'casual' | 'chain' | 'unanswerable' | 'vague'; q: string; gold: string | null };
const items: Item[] = [
  ...sets.casual.slice(0, limit).map((x: any) => ({ kind: 'casual', q: x.turns[0], gold: x.gold })),
  ...sets.chain.slice(0, limit).map((x: any) => ({ kind: 'chain', q: x.turns[0], gold: x.gold })),
  ...sets.unanswerable.slice(0, limit).map((x: any) => ({ kind: 'unanswerable', q: x.turns[0], gold: null })),
  ...sets.vague.slice(0, limit).map((x: any) => ({ kind: 'vague', q: x.turns[0], gold: null })), // kept for the clarify analysis; not scored here
];

type Row = Item & { hits: { id: string; title: string }[]; probs: Record<string, number>; choice: string; error: string; niche: string[] };
const done: Row[] = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')).rows : [];
const have = new Map(done.map(r => [`${r.kind}|${r.q}`, r]));

const octo = new OctoRetriever({ key: key('OCTO_KEY', 'octo_db_chatbots')!, workspaceId: key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace')!,
  titlePrefix: cfg.target.retriever.prefixes, rerank: cfg.target.retriever.rerank, timeoutMs: 150000 });
const jev = new JevJudge({ key: key('OPENROUTER_JEV_KEY', 'openrouter_jev_only') });

// Jev's raw answer, so both rules see the same probabilities
const choose = async (q: string, ps: Passage[]) => {
  const orig = jev.choose.bind(jev);
  const r = await orig(q, ps);
  return r;
};

const rows: Row[] = await pool(items, 4, async (it) => {
  const old = have.get(`${it.kind}|${it.q}`);
  if (old) return old;
  const found = await octo.search(it.q, 4);
  const ps = withoutNiche(found, it.q);
  const r = await choose(it.q, ps);
  const choice = Object.entries(r.probs).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
  return { ...it, hits: ps.map(p => ({ id: p.id, title: String(p.title ?? '') })), probs: r.probs, choice, error: r.error,
    niche: found.filter(f => !ps.includes(f)).map(f => String(f.title ?? '')) };
});
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), rows }, null, 1));

// Rule outcome: which passage title it picks (or '' for none)
const idx = (r: Row) => (r.choice.startsWith('p') ? +r.choice.slice(1) : -1);
const oldPick = (r: Row) => (idx(r) >= 0 && (r.probs.none ?? 1) <= NONE_MAX ? r.hits[idx(r)]?.title ?? '' : '');
const newPick = (r: Row) => (pickRule(r.probs, idx(r)) !== 'none' ? r.hits[idx(r)]?.title ?? '' : '');

const score = (name: string, pick: (r: Row) => string) => {
  const g = (k: Item['kind'][]) => rows.filter(r => !r.error && (k as string[]).includes(r.kind));
  const ans = g(['casual', 'chain']), un = g(['unanswerable']);
  const right = ans.filter(r => pick(r) && pick(r) === r.gold).length, wrong = ans.filter(r => pick(r) && pick(r) !== r.gold).length;
  const missed = ans.length - right - wrong, made = un.filter(r => pick(r)).length;
  console.log(`${name.padEnd(10)} answerable ${ans.length}: right ${right}, other passage ${wrong}, "don't know" ${missed} | unanswerable ${un.length}: made-up answer ${made}, said "don't know" ${un.length - made}`);
  return { right, wrong, missed, madeUp: made, answerable: ans.length, unanswerable: un.length };
};
const a = score('original', oldPick), b = score('shipped', newPick);
const changed = rows.filter(r => !r.error && oldPick(r) !== newPick(r));
console.log(`\nthe rules differ on ${changed.length} questions:`);
for (const r of changed) console.log(`  [${r.kind}] "${r.q.slice(0, 70)}" -> ${newPick(r) || 'none'}${r.gold ? (newPick(r) === r.gold ? ' (gold)' : ` (gold was ${r.gold})`) : ''} probs ${JSON.stringify(Object.fromEntries(Object.entries(r.probs).map(([k, v]) => [k, +v.toFixed(2)])))}`);
console.log(`\nerrors: ${rows.filter(r => r.error).length}; niche passages dropped before judging: ${rows.filter(r => r.niche.length).length} questions`);
fs.writeFileSync(out, JSON.stringify({ when: new Date().toISOString(), original: a, shipped: b, rows }, null, 1));
