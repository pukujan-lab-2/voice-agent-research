// Replay the stored cases through the shipped answer path and print pass or fail for each.
// Run: node eval/replay.ts [--live] [--site <url>] [--case <id prefix>]
//   default  library cases on the recorded search results (no keys); desk cases are skipped
//   --live   library cases on a real Octo search and the real judge
//   --site   desk cases against a running site's /api/desk, e.g. https://copilot.design-bakery.com
import path from 'node:path';
import { loadCases } from './lib/cases.ts';
import { runDesk, runGuide, type Result } from './lib/replay.ts';
import { makeTarget } from './lib/target.ts';
import { loadConfig } from './generate.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const target = process.argv.includes('--live') ? makeTarget(loadConfig('irs') as any, root) : undefined;
const live = target && (async (q: string) => { const a = await target.ask(q); return { reply: a.reply, citedId: a.citedId, quoted: a.kind === 'answer' }; });

const results: Result[] = [];
for (const c of (await loadCases()).filter(c => c.id.startsWith(arg('--case')))) results.push(c.path === 'guide' ? await runGuide(c, live) : await runDesk(c, arg('--site') || undefined));

const tag = (r: Result) => (r.verdict === null ? 'SKIP' : r.verdict.pass ? 'PASS' : 'FAIL');
for (const r of results) console.log(`${tag(r)}  ${r.case.status.padEnd(7)} ${r.case.rule.padEnd(24)} "${r.case.said.slice(0, 56)}" ${r.verdict?.why ?? r.skipped}`);
const n = (t: string) => results.filter(r => tag(r) === t).length;
console.log(`\n${results.length} cases: ${n('PASS')} pass, ${n('FAIL')} fail, ${n('SKIP')} skipped`);
