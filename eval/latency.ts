// Latency of the shipped answer path, measured on its own (no grading): N questions from the generated sets, asked one
// at a time. Search time and the whole answer (search + passage and sentence pick) per question; p50 / p90 / max.
// Run: node eval/latency.ts [--corpus irs] [--n 40]   Writes eval/out/<corpus>/latency.json.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './generate.ts';
import { makeTarget } from './lib/target.ts';
import { totalCost } from './lib/llm.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const corpus = arg('--corpus', 'irs');
const cfg = loadConfig(corpus) as any;
const dir = path.join(root, 'eval/out', corpus);
const n = Number(arg('--n', '40'));
const sets = JSON.parse(fs.readFileSync(path.join(dir, 'sets.json'), 'utf8')).sets;
// spread over the question types, the same picks every run
const types = Object.keys(sets).filter(t => Array.isArray(sets[t]) && sets[t].length);
const qs: string[] = [];
for (let i = 0; qs.length < n; i++) { const t = types[i % types.length]; const it = sets[t][Math.floor(i / types.length) * 7 % sets[t].length]; const q = it?.turns?.[0]?.q ?? it?.turns?.[0]; if (typeof q === 'string') qs.push(q); if (i > n * 10) break; }
const target = makeTarget(cfg, root);
const search: number[] = [], whole: number[] = [];
let timedOut = 0;
for (const q of qs) {
  const t = performance.now();
  const a = await target.ask(q);
  whole.push(performance.now() - t);
  if (a.searchMs > 0) search.push(a.searchMs);
  if (a.searchMs >= cfg.target.retriever.shippedTimeoutMs) timedOut++;
  process.stdout.write('.');
}
const p = (xs: number[], f: number) => { const s = [...xs].sort((a, b) => a - b); return s.length ? +(s[Math.min(s.length - 1, Math.floor(f * s.length))] / 1000).toFixed(2) : null; };
const out = { at: new Date().toISOString(), n: qs.length, shippedTimeoutS: cfg.target.retriever.shippedTimeoutMs / 1000, overTimeout: timedOut,
  searchS: { p50: p(search, 0.5), p90: p(search, 0.9), max: p(search, 1) }, answerS: { p50: p(whole, 0.5), p90: p(whole, 0.9), max: p(whole, 1) }, cost: totalCost() };
fs.writeFileSync(path.join(dir, 'latency.json'), JSON.stringify(out, null, 1));
console.log('\n' + JSON.stringify(out));
