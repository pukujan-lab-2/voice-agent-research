// Replay the stored cases through the shipped answer path and print pass or fail for each.
// Run: node eval/replay.ts [--snapshot] [--site <url>] [--live] [--case <id prefix>] [--gate] [--json <file>] [--export]
//   default     library cases on the recorded search results (no keys); desk cases are skipped
//   --site      library cases through the site's own search and judge, desk cases through its /api/desk
//               (e.g. https://copilot.design-bakery.com); needs no keys
//   --live      library cases on a real Octo search and the real judge (needs keys)
//   --snapshot [file]  read cases from eval/cases/snapshot.json (or the file) instead of Octo, so a run needs no keys (CI)
//   --export    write the snapshot from Octo (needs keys); commit it with the fix that earns a case its `guarded` status
//   --gate      exit 1 when a guarded case fails
//   --json      write the results and per-rule counts to a file
// Octo's replay_cases table is the store; the snapshot is a test fixture exported from it, the way
// eval/tests/fixtures/ holds a recorded call.
import fs from 'node:fs';
import path from 'node:path';
import { loadCases, type Case } from './lib/cases.ts';
import { runDesk, runGuide, type Result } from './lib/replay.ts';
import { makeTarget } from './lib/target.ts';
import { loadConfig } from './generate.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k: string) => process.argv.includes(k);
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const snapshot = path.join(root, 'eval/cases/snapshot.json');
const fromFile = (() => { const i = process.argv.indexOf('--snapshot'); if (i < 0) return undefined; const f = process.argv[i + 1]; return f && !f.startsWith('--') ? path.resolve(f) : snapshot; })();

if (has('--export')) {
  const cases = await loadCases();
  fs.mkdirSync(path.dirname(snapshot), { recursive: true });
  fs.writeFileSync(snapshot, `${JSON.stringify(cases, null, 1)}\n`);
  console.log(`wrote ${cases.length} cases (${cases.filter(c => c.status === 'guarded').length} guarded) to eval/cases/snapshot.json`);
  process.exit(0);
}

const site = arg('--site') || undefined;
const target = has('--live') ? makeTarget(loadConfig('irs') as any, root) : undefined;
const live = target && (async (q: string) => { const a = await target.ask(q); return { reply: a.reply, citedId: a.citedId, quoted: a.kind === 'answer' }; });
const cases: Case[] = (fromFile ? JSON.parse(fs.readFileSync(fromFile, 'utf8')) : await loadCases()).filter((c: Case) => c.id.startsWith(arg('--case')));

const results: Result[] = [];
for (const c of cases) results.push(c.path === 'guide' ? await runGuide(c, live, site) : await runDesk(c, site));

const tag = (r: Result) => (r.verdict === null ? 'SKIP' : r.verdict.pass ? 'PASS' : 'FAIL');
for (const r of results) console.log(`${tag(r)}  ${r.case.status.padEnd(7)} ${r.case.rule.padEnd(24)} "${r.case.said.slice(0, 56)}" ${r.verdict?.why ?? r.skipped}`);
const n = (t: string, rs = results) => rs.filter(r => tag(r) === t).length;
console.log(`\n${results.length} cases: ${n('PASS')} pass, ${n('FAIL')} fail, ${n('SKIP')} skipped`);

const rules = [...new Set(results.map(r => r.case.rule))].sort();
const perRule = Object.fromEntries(rules.map(rule => { const rs = results.filter(r => r.case.rule === rule); return [rule, { pass: n('PASS', rs), fail: n('FAIL', rs), skip: n('SKIP', rs) }]; }));
if (arg('--json')) fs.writeFileSync(arg('--json'), JSON.stringify({ at: new Date().toISOString(), site: site ?? null, perRule,
  failures: results.filter(r => tag(r) === 'FAIL').map(r => ({ id: r.case.id, rule: r.case.rule, status: r.case.status, said: r.case.said, why: r.verdict?.why })) }, null, 1));

const regressions = results.filter(r => r.case.status === 'guarded' && tag(r) === 'FAIL');
if (regressions.length) console.log(`\n${regressions.length} guarded case(s) regressed:\n${regressions.map(r => `  ${r.case.rule}: "${r.case.said}" ${r.verdict?.why}`).join('\n')}`);
if (has('--gate')) { console.log(regressions.length ? '\ngate: FAIL' : '\ngate: ok'); process.exit(regressions.length ? 1 : 0); }
