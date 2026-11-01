// Retrieval on the live IRS library, the way the site searches it: Octo hybrid search with the reranker, over the
// library's title prefixes. Replays the gold-labelled casual questions the main eval already generated
// (eval/out/irs/results.jsonl) one at a time and records the top 10 hits and the time each took, in the same format
// eval/retrieval.py reads:  node eval/size/irs-live.ts [--n 60]  then  eval/.venv/bin/python eval/retrieval.py --corpus irs-live
import fs from 'node:fs';
import path from 'node:path';
import { OctoRetriever } from '../../copilot-engine/src/guide.ts';
import { octoBase } from '../lib/corpus.ts';
import { key } from '../lib/env.ts';

const root = path.resolve(import.meta.dirname, '..');
const n = Number(process.argv[process.argv.indexOf('--n') + 1]) || 60;
const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config/irs.json'), 'utf8'));
const src = fs.readFileSync(path.join(root, 'out/irs/results.jsonl'), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
  .filter(r => r.suite === 'single' && r.type === 'casual' && r.gold);
const pick = src.filter((_, i) => i % Math.max(1, Math.floor(src.length / n)) === 0).slice(0, n);
const octo = new OctoRetriever({ base: octoBase(), key: key('OCTO_KEY', 'octo_db_chatbots')!, workspaceId: key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace')!,
  titlePrefix: cfg.target.retriever.prefixes, timeoutMs: 150000 });
const count = await fetch(`${octoBase()}/workspaces/${key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace')}/query`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key('OCTO_KEY', 'octo_db_chatbots')}` },
  body: JSON.stringify({ sql: 'select count(*) filter (where indexed) as indexed from irs_passages' }) }).then(r => r.json()).then(j => Number(j.rows?.[0]?.indexed));
const out: string[] = [];
const ms: number[] = [];
for (const r of pick) {
  const q: string = r.turns[0].q;
  const t = Date.now();
  const hits = await octo.search(q, 10);
  ms.push(Date.now() - t);
  out.push(JSON.stringify({ key: r.key, suite: 'single', type: 'casual', id: r.id, gold: r.gold, turns: [{ q, hits: hits.map(h => String(h.title ?? h.id)) }] }));
  process.stdout.write(`\r${ms.length}/${pick.length}`);
}
ms.sort((a, b) => a - b);
const q = (p: number) => ms[Math.min(ms.length - 1, Math.floor(p * ms.length))];
const dir = path.join(root, 'out/irs-live');
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'results.jsonl'), out.join('\n') + '\n');
const summary = { at: new Date().toISOString(), indexedPassages: count, queries: ms.length, searchMs: { p50: q(0.5), p90: q(0.9), max: ms[ms.length - 1] }, reranker: true };
fs.writeFileSync(path.join(dir, 'latency.json'), JSON.stringify(summary, null, 1));
console.log('\n' + JSON.stringify(summary));
