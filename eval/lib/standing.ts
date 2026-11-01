// The standing results issue: each live replay posts a comment carrying its per-rule counts as a hidden marker, and the
// next run reads the last marker to see which rule's failure count rose. GitHub is the only record; nothing local.
export type Counts = Record<string, { pass: number; fail: number; skip: number }>;
export type Run = { at: string; site: string | null; perRule: Counts; failures: { id: string; rule: string; status: string; said: string; why?: string }[] };

const MARK = /<!-- replay-counts (\{.*\}) -->/;
export const marker = (c: Counts) => `<!-- replay-counts ${JSON.stringify(Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.fail])))} -->`;
export function lastCounts(comments: string[]): Record<string, number> | null {
  for (const body of [...comments].reverse()) { const m = body.match(MARK); if (m) return JSON.parse(m[1]); }
  return null;
}
// Rules whose failure count is higher than at the last run. A rule that is new this run counts from zero.
export function rises(prev: Record<string, number> | null, cur: Counts) {
  if (!prev) return [];
  return Object.entries(cur).filter(([rule, v]) => v.fail > (prev[rule] ?? 0)).map(([rule, v]) => ({ rule, from: prev[rule] ?? 0, to: v.fail }));
}
export function comment(run: Run, rose: { rule: string; from: number; to: number }[], issueLinks: string[]) {
  const rows = Object.entries(run.perRule).map(([rule, v]) => `| ${rule} | ${v.pass} | ${v.fail} | ${v.skip} |`).join('\n');
  const fails = run.failures.map(f => `- \`${f.status}\` ${f.rule}: "${f.said.slice(0, 80)}" ${f.why ?? ''}`).join('\n');
  return `Live replay of ${run.site ?? 'the recorded results'} at ${run.at}.\n\n| Rule | Pass | Fail | Skipped |\n|---|---|---|---|\n${rows}\n\n${rose.length ? `Failures rose for ${rose.map(r => `${r.rule} (${r.from} to ${r.to})`).join(', ')}: ${issueLinks.join(', ')}\n\n` : ''}<details><summary>Failing cases</summary>\n\n${fails || 'none'}\n\n</details>\n\n${marker(run.perRule)}`;
}
