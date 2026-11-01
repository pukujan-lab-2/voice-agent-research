// Flag the suspect turns in recent real calls. Reads the newest spans from the chatbots workspace (through Octo),
// applies the plain-code rules in lib/rules.ts, stores the flags in Octo's `flagged_turns` table and prints them.
// Run: node eval/mine.ts [--limit 300] [--call <id prefix>] [--no-store]
// --no-store prints without writing (a dry run); there is no local copy of the table either way.
import { buildCalls, fetchSpans } from './lib/spans.ts';
import { flagCall } from './lib/rules.ts';
import { storeFlags } from './lib/flags.ts';

const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const calls = buildCalls(await fetchSpans(Number(arg('--limit', '300')))).filter(c => c.id.startsWith(arg('--call')));
const flags = calls.flatMap(c => flagCall(c).map(flag => ({ flag, callAt: c.at })));

console.log(`${calls.length} calls, ${calls.reduce((n, c) => n + c.turns.length, 0)} turns, ${flags.length} flags\n`);
console.log('call      turn rule                      text');
for (const { flag: f } of flags) console.log(`${f.call.slice(0, 8)}  ${String(f.n ?? '-').padEnd(4)} ${f.rule.padEnd(24)} ${f.text}\n${' '.repeat(39)}${f.evidence}`);
if (process.argv.includes('--no-store')) console.log('\n(dry run: nothing stored)');
else { await storeFlags(flags); console.log(`\nstored ${flags.length} flags in Octo (flagged_turns)`); }
