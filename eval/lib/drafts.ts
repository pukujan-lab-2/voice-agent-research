// Draft expectations for replay cases, written by a smart model (decision 0017). A replay case holds a hand-written, code-checkable
// expectation (eval/lib/expect.ts). For the cases a person has not worked through yet, a model proposes one, in the same shape, so the
// loop's tests grow faster. A draft is only a proposal: it is written to its own file with its source stated on every entry, never
// into the snapshot or Octo, and a person (or a later change) promotes one. Nothing here touches the product path.
import type { Case } from './cases.ts';
import { firstJson } from './llm.ts';
import type { Expect } from './expect.ts';

export type Draft = {
  case: string; rule: string; said: string;
  source: 'model-written'; slot: 'eval'; provider: string; model: string; date: string;
  draft: Expect; reason: string;
  current: Expect; agrees: boolean; // the case's own expectation, for a person to compare; never replaced
};
export type Skipped = { case: string; why: string };

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n)}…` : s);

export function promptFor(c: Case): string {
  const passages = c.recorded.searches.flatMap(s => s.passages).filter((p, i, all) => all.findIndex(x => x.id === p.id) === i).slice(0, 6);
  const history = c.history.slice(-6).map(h => `${h.role === 'user' ? 'caller' : 'assistant'}: ${clip(h.text, 300)}`).join('\n') || '(the start of the call)';
  return `You write the expected result of one turn of a voice assistant that answers only from a business's own documents, so that plain code can check it.

What went wrong, in a reviewer's words: ${c.note}
Conversation so far:
${history}
The caller then said: "${c.said}"
${c.input !== c.said ? `The question as searched: "${c.input}"\n` : ''}Passages the search found (id, then text):
${passages.map(p => `[${p.id}] ${clip(p.text, 500)}`).join('\n') || '(none)'}

Choose exactly one expectation for a good answer to this turn:
- {"kind": "answers-from", "ids": [ids of the passages above that hold the answer]}  the assistant must answer, citing one of them, not say "I don't know"
- {"kind": "not-passage", "id": "one passage id above"}  the assistant must not quote that passage again
- {"kind": "clarifies"}  the question has more than one reading, so the assistant must ask exactly one clarifying question
- {"kind": "no-offer"}  the assistant must not offer anything it was not told it can do
Reply with JSON only: {"expect": <one of the above>, "reason": "one sentence"}`;
}

// The model's reply as a valid expectation, or why not. Ids must be passages the model was shown.
export function parseDraft(text: string, c: Case): { expect: Expect; reason: string } | string {
  const j = firstJson<{ expect?: { kind?: unknown; ids?: unknown; id?: unknown }; reason?: unknown }>(text);
  const e = j?.expect;
  if (!e || typeof e.kind !== 'string') return 'no expectation in the reply';
  const shown = new Set(c.recorded.searches.flatMap(s => s.passages.map(p => p.id)));
  const reason = typeof j!.reason === 'string' ? clip(j!.reason.trim(), 300) : '';
  switch (e.kind) {
    case 'answers-from': {
      const ids = Array.isArray(e.ids) ? e.ids.filter((i): i is string => typeof i === 'string') : [];
      if (!ids.length || !ids.every(i => shown.has(i))) return 'answers-from named no passage, or one that was not shown';
      return { expect: { kind: 'answers-from', ids }, reason };
    }
    case 'not-passage':
      return typeof e.id === 'string' && shown.has(e.id) ? { expect: { kind: 'not-passage', id: e.id }, reason } : 'not-passage named a passage that was not shown';
    case 'clarifies': return { expect: { kind: 'clarifies' }, reason };
    case 'no-offer': return { expect: { kind: 'no-offer' }, reason };
    default: return `unknown kind "${e.kind}"`;
  }
}

const same = (a: Expect, b: Expect) => a.kind === b.kind && JSON.stringify(a) === JSON.stringify(b);
const stable = (e: Expect): Expect => ('ids' in e ? { ...e, ids: [...e.ids].sort() } : e);

export async function draftAll(cases: Case[], ask: (prompt: string) => Promise<string>, who: { provider: string; model: string }, date = new Date().toISOString().slice(0, 10))
  : Promise<{ drafts: Draft[]; skipped: Skipped[] }> {
  const drafts: Draft[] = [], skipped: Skipped[] = [];
  for (const c of cases) {
    let text: string;
    try { text = await ask(promptFor(c)); } catch (e) { skipped.push({ case: c.id, why: `model call failed: ${(e as Error).message.slice(0, 120)}` }); continue; }
    const r = parseDraft(text, c);
    if (typeof r === 'string') { skipped.push({ case: c.id, why: r }); continue; }
    drafts.push({ case: c.id, rule: c.rule, said: c.said, source: 'model-written', slot: 'eval', ...who, date, draft: r.expect, reason: r.reason, current: c.expect, agrees: same(stable(r.expect), stable(c.expect)) });
  }
  return { drafts, skipped };
}
