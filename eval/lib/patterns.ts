// Failure patterns: the flagged turns of one rule, written up as one issue a coding session can take.
// The routine only reads Octo's `flagged_turns` and files issues. It changes no code and moves no branch.
export type Row = { id: string; call_id: string; turn_n: number | null; rule: string; text: string; evidence: string; call_at: string | null };

// What each rule means for the product and where its fix is tracked. The issue title carries the rule, so one open
// issue exists per pattern.
export const PATTERNS: Record<string, { name: string; why: string; related: string }> = {
  'judge-dropped-answer': { name: 'the judge throws away an answer the search found', why: 'The caller is told "I don\'t know" although a search result holds the answer.', related: '#24, #6' },
  'repeated-passage': { name: 'the same passage is quoted for different questions', why: 'The caller hears the same quote again, as if it were a new answer.', related: '#24, #4' },
  'vague-answered-by-quote': { name: 'a vague question is answered with a quote instead of a question', why: 'The copilot guesses what the caller meant instead of asking.', related: '#3, #24' },
  'invented-offer': { name: 'the desk model offers something nobody told it it can do', why: 'The caller is promised help the copilot cannot give.', related: '#24' },
  'slow-first-audio': { name: 'the caller waits too long for the first sound', why: 'Dead air makes callers repeat themselves or hang up.', related: '#7' },
  'slow-search': { name: 'library search is slow', why: 'Search time adds directly to the caller\'s wait.', related: '#7, #6' },
  'barge-in': { name: 'callers talk over the copilot', why: 'The caller interrupted because the reply was wrong, long or late.', related: '#7' },
  'unresolved-call': { name: 'calls end unresolved', why: 'The call ended with an error, a failure or a last answer of "I don\'t know".', related: '#7' },
};

export const titleFor = (rule: string) => `Flagged turns: ${PATTERNS[rule]?.name ?? rule}`;
export const flagMarker = (id: string) => `flag:${id}`;

export function groupByRule(rows: Row[]): Map<string, Row[]> {
  const out = new Map<string, Row[]>();
  for (const r of rows) out.set(r.rule, [...(out.get(r.rule) ?? []), r]);
  return out;
}
const list = (rows: Row[]) => rows.map(r => `- ${flagMarker(r.id)} call ${r.call_id.slice(0, 8)}, turn ${r.turn_n ?? 'call'}: ${r.text}\n  - ${r.evidence}`).join('\n');

export function issueBody(rule: string, rows: Row[], runUrl?: string) {
  const p = PATTERNS[rule] ?? { name: rule, why: '', related: 'none' };
  return `### Summary

${rows.length} turn(s) in recent real calls were flagged by the rule \`${rule}\`: ${p.name}. ${p.why} The rule is plain code in \`eval/lib/rules.ts\`; no model decided this.

### Identity and Lineage

Leaf: this issue. Parent: none. Depends on: none. Related: ${p.related}, #18 (the loop that found it), #21 (the routine that filed it).

### Acceptance Criteria

- The flagged turns below no longer fail their replay case (\`node eval/replay.ts\`), or the rule is shown to be wrong and changed.
- Fixed cases are marked \`guarded\` and the snapshot is re-exported in the same pull request, so \`gates\` blocks their return.

### Boundaries and Next Action

In scope: the answer path or prompt that produces these turns. Out of scope: other rules. Next action: replay the cases and find the cause.

### Symptoms

${rows.slice(0, 15).map((r, i) => `${i + 1}. **Call ${r.call_id.slice(0, 8)}, turn ${r.turn_n ?? 'call'}.** ${r.text}`).join('\n')}

### Hypotheses (unverified)

None yet.

### Evidence

${list(rows.slice(0, 15))}

### Counter-signal

A flag is a rule firing, not a proof; a flagged turn may be fine.

### Honest Caveat

The rules read recorded spans only. They cannot see a wrong but well-formed answer.

### Problems vs Gaps

Problem: the symptoms above. Gap: none stated.

### Issue Type

design

### Lifecycle Status

open

### Filer Origin (who initiated this filing)

automation under the owner's standing instruction

### Filing Authorization Evidence

The owner asked for a routine that files one issue per failure pattern (#21, #18). Prompt text is a claim; no \`oio-auth\` label is applied.

### Session, Authorization Evidence, and Instruction Reference

- Session reference: scheduled routine${runUrl ? ` (${runUrl})` : ''}
- Claimed instruction/source: #21
- Authorization evidence: claimed

### Content Author Account or Runtime Identity

agent:claude-code/eval-propose
`;
}
