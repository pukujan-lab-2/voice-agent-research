// How often the shipped answer path asks back, on questions that are vague and on questions that are not. Code checks only:
// "asked back" is a reply of kind clarify (one question, no quote). Vague set: eval/out/<corpus>/sets.json "vague"; clear
// sets: "casual" and "chain" first turns (answerable, specific). The unanswerable set shows what asking back does there.
// Run: node eval/clarify-rate.ts [--corpus irs] [--limit 100]. Writes eval/out/<corpus>/clarify-rate.json.
import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './generate.ts';
import { pool } from './lib/pool.ts';
import { makeTarget } from './lib/target.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const corpus = arg('--corpus', 'irs'), limit = Number(arg('--limit', '100'));
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const sets = JSON.parse(fs.readFileSync(path.join(root, 'eval/out', corpus, 'sets.json'), 'utf8')).sets;
const target = makeTarget(loadConfig(corpus) as any, root);

const out: Record<string, { n: number; asked: number; askedOnce: number; quoted: number; unknown: number; examples: string[] }> = {};
for (const kind of ['vague', 'casual', 'chain', 'unanswerable']) {
  const qs: string[] = sets[kind].slice(0, limit).map((x: any) => x.turns[0]);
  const as = await pool(qs, 4, q => target.ask(q));
  const asked = as.filter(a => a.kind === 'clarify');
  out[kind] = { n: qs.length, asked: asked.length, askedOnce: asked.filter(a => (a.reply.match(/\?/g) ?? []).length === 1).length,
    quoted: as.filter(a => a.kind === 'answer').length, unknown: as.filter(a => a.kind === 'unknown').length,
    examples: as.map((a, i) => [a, i] as const).filter(([a]) => a.kind === 'clarify').slice(0, 8).map(([a, i]) => `"${qs[i]}" -> ${a.reply}`) };
  console.log(kind.padEnd(13), `asked back ${asked.length}/${qs.length}, exactly one question ${out[kind].askedOnce}, quoted ${out[kind].quoted}, "don't know" ${out[kind].unknown}`);
}
fs.writeFileSync(path.join(root, 'eval/out', corpus, 'clarify-rate.json'), JSON.stringify({ when: new Date().toISOString(), ...out }, null, 1));
