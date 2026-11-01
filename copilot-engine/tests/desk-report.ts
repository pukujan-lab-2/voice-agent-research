// Side-by-side table of desk simulator runs: node tests/desk-report.ts tests/desk-a.json tests/desk-b.json
import fs from 'node:fs';

const runs = process.argv.slice(2).map(p => JSON.parse(fs.readFileSync(p, 'utf8')).summary);
const pct = (c?: { ok: number; n: number }) => (c && c.n ? `${((100 * c.ok) / c.n).toFixed(1)}% (${c.ok}/${c.n})` : '-');
const rows: [string, (s: any) => string][] = [
  ['agent model', s => s.agent + (s.heavy && s.heavy !== 'none' ? ` + ${s.heavy} (hybrid)` : '')],
  ['conversations', s => String(s.conversations)],
  ['values exact (all fields right)', s => pct(s.checks.values_exact)],
  ['completed', s => pct(s.checks.completed)],
  ['every fill had read-back + clear yes', s => pct(s.checks.readback_then_yes)],
  ['values changed only by a confirmed fill', s => pct(s.checks.values_change_only_by_fill)],
  ['never submitted', s => pct(s.checks.never_submitted)],
  ['corrections applied', s => pct(s.checks.correction_applied)],
  ['go back two fields applied', s => pct(s.checks.go_back_applied)],
  ['misheard name fixed', s => pct(s.checks.misheard_name_fixed)],
  ['doc question answered from docs', s => pct(s.checks.doc_question_answered)],
  ['off-topic handled', s => pct(s.checks.offtopic_handled)],
  ['judge: sounds like a receptionist (1-5)', s => `${s.judge.receptionist} (n=${s.judge.n})`],
  ['judge: handled the customer well (1-5)', s => `${s.judge.handled}`],
  ['latency per turn p50 / p95', s => `${(s.latency_ms.p50 / 1000).toFixed(2)} s / ${(s.latency_ms.p95 / 1000).toFixed(2)} s`],
  ['user turns per conversation (mean / max)', s => `${s.user_turns.mean} / ${s.user_turns.max}`],
  ['agent reply chars (mean / p95)', s => `${s.reply_chars.mean} / ${s.reply_chars.p95}`],
  ['turns on fallback rules / code nets', s => `${s.fallback_turns} / ${s.net_actions}`],
  ['turns sent to the hosted model (hybrid)', s => (s.heavy_turns !== undefined ? `${s.heavy_turns}/${s.total_turns}` : '-')],
];
console.log(`| | ${runs.map(r => r.tag).join(' | ')} |\n|---|${runs.map(() => '---').join('|')}|`);
for (const [k, f] of rows) console.log(`| ${k} | ${runs.map(f).join(' | ')} |`);
