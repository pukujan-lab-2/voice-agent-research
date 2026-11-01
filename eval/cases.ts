// Turn flagged turns into replay cases and store them in Octo's `replay_cases` table (a re-run refreshes the recorded
// results and keeps each case's status). Reads the same spans eval/mine.ts reads.
// Run: node eval/cases.ts [--limit 300] [--call <id prefix>] [--no-store]
import { caseFromFlag, saveCases, type Case } from './lib/cases.ts';
import { flagCall } from './lib/rules.ts';
import { buildCalls, fetchSpans } from './lib/spans.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const calls = buildCalls(await fetchSpans(Number(arg('--limit', '300')))).filter(c => c.id.startsWith(arg('--call')));
const cases = calls.flatMap(c => flagCall(c).map(f => caseFromFlag(c, f))).filter((c): c is Case => !!c);

console.log(`${cases.length} cases from ${calls.length} calls\n`);
for (const c of cases) console.log(`${c.id}  ${c.call.slice(0, 8)}  ${c.path.padEnd(5)} ${c.rule.padEnd(24)} ${c.expect.kind.padEnd(12)} "${c.said.slice(0, 60)}"`);
if (process.argv.includes('--no-store')) console.log('\n(dry run: nothing stored)');
else { await saveCases(cases); console.log(`\nstored ${cases.length} cases in Octo (replay_cases)`); }
