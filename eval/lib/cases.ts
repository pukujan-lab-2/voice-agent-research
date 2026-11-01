// Replay cases: a flagged real turn made re-runnable. A case holds what the caller said, the history before it, what the
// live system returned at the time (search results, judge picks, the desk model's messages) and a code-checkable
// expectation. They live in Octo's `replay_cases` table (decision 0004).
//   path 'guide': the library answer (search, judge, quote), replayed through the shipped Guide on the recorded results.
//   path 'desk':  the desk model's own reply, replayed by sending its recorded messages to a running site's /api/desk.
// status 'open': known bad, not gating. 'guarded': fixed, a failure is a regression.
import { createHash } from 'node:crypto';
import { octoSql } from './corpus.ts';
import { content, type Flag } from './rules.ts';
import type { Expect } from './expect.ts';
import type { Call, Turn } from './spans.ts';

export type Passage = { id: string; text: string };
export type Case = {
  id: string; call: string; turn: string; rule: string; status: 'open' | 'guarded'; path: 'guide' | 'desk';
  said: string; input: string;
  history: { role: 'user' | 'assistant'; text: string }[];
  expect: Expect;
  recorded: { searches: { q: string; passages: Passage[] }[]; judges: { q: string; id: string }[]; sentences: { q: string; idx: number[] }[]; deskMessages?: unknown[] };
  note: string;
};

const DDL = `create table if not exists replay_cases (
  id text primary key, call_id text not null, turn_id text, rule text not null, status text not null default 'open', path text not null,
  said text not null, body jsonb not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
)`;
export const caseId = (f: Pick<Flag, 'call' | 'turn' | 'rule'>) => createHash('sha1').update(`case|${f.call}|${f.turn ?? ''}|${f.rule}`).digest('hex').slice(0, 20);

export async function saveCases(cases: Case[]) {
  await octoSql(DDL);
  for (const c of cases) {
    // a re-run refreshes what was recorded but keeps the status someone has earned
    await octoSql(`insert into replay_cases (id, call_id, turn_id, rule, status, path, said, body) values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
      on conflict (id) do update set body = excluded.body, updated_at = now()`, [c.id, c.call, c.turn, c.rule, c.status, c.path, c.said, JSON.stringify(c)]);
  }
}
export async function loadCases(): Promise<Case[]> {
  await octoSql(DDL);
  return (await octoSql(`select status, body from replay_cases order by created_at, id`)).map(r => ({ ...(typeof r.body === 'string' ? JSON.parse(r.body) : r.body), status: r.status }));
}
export async function setStatus(id: string, status: Case['status']) {
  await octoSql(`update replay_cases set status = $2, updated_at = now() where id = $1`, [id, status]);
}

const history = (call: Call, t: Turn) => call.turns.filter(p => p.n < t.n).flatMap(p => [{ role: 'user' as const, text: p.input }, { role: 'assistant' as const, text: p.reply }]);
const parse = (s: string): unknown[] | undefined => { try { const v = JSON.parse(s); return Array.isArray(v) ? v : undefined; } catch { return undefined; } };

// The case a flag asks for, or null when the flag is about timing or the call as a whole (nothing to replay by content).
export function caseFromFlag(call: Call, f: Flag): Case | null {
  const t = call.turns.find(x => x.id === f.turn);
  if (!t) return null;
  const search = t.searches[0], base = { id: caseId(f), call: call.id, turn: t.id, rule: f.rule, status: 'open' as const, said: t.input, history: history(call, t),
    recorded: { searches: t.searches.map(s => ({ q: s.q, passages: s.ids.map((id, i) => ({ id, text: s.texts[i] })) })), judges: t.judges, sentences: t.sentences, deskMessages: parse(t.deskMessages) } };
  const guide = { ...base, path: 'guide' as const, input: search?.q ?? t.input };
  switch (f.rule) {
    case 'judge-dropped-answer': {
      // the passages among the top three that share the question's words: the ones that hold the answer
      const q = content(guide.input), ids = search.ids.slice(0, 3).filter((_, i) => { const p = new Set(content(search.texts[i])); const n = q.filter(w => p.has(w)).length; return n >= 2 && n >= q.length / 2; });
      return { ...guide, expect: { kind: 'answers-from', ids }, note: 'Search found the answer, the judge threw it away, the caller was told "I don\'t know".' };
    }
    case 'repeated-passage': {
      const earlier = call.turns.filter(p => p.n < t.n && p.href === t.href).at(-1);
      const id = t.judges.find(j => j.id)?.id ?? earlier?.judges.find(j => j.id)?.id;
      return id ? { ...guide, expect: { kind: 'not-passage', id }, note: `The same passage was quoted for turn ${earlier?.n} and this one.` } : null;
    }
    case 'vague-answered-by-quote':
      return { ...guide, expect: { kind: 'clarifies' }, note: 'A vague question got a quote; it should get one clarifying question.' };
    case 'invented-offer':
      return base.recorded.deskMessages ? { ...base, path: 'desk', input: t.input, expect: { kind: 'no-offer' }, note: 'The desk model offered something nobody told it it can do.' } : null;
    default:
      return null;
  }
}
