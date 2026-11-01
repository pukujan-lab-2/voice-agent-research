// What a replay case expects of an answer, as plain checks over its text. Nothing here asks a model.
import { isUnknown, OFFERS } from './rules.ts';

export type Expect =
  | { kind: 'answers-from'; ids: string[] }   // does not say "I don't know" when these passages hold the answer; cites one of them
  | { kind: 'not-passage'; id: string }       // does not quote this passage again
  | { kind: 'clarifies' }                     // asks exactly one clarifying question instead of quoting or refusing
  | { kind: 'no-offer' };                     // offers nothing the copilot was not told it can do

// What one replay produced: the reply, and for the library path the passage it cited.
export type Outcome = { reply: string; cited?: string; quoted: boolean };
export type Verdict = { pass: boolean; why: string };

export function check(e: Expect, o: Outcome): Verdict {
  switch (e.kind) {
    case 'answers-from':
      if (isUnknown(o.reply)) return { pass: false, why: 'said "I don\'t know" although the search results hold the answer' };
      return e.ids.includes(o.cited ?? '') ? { pass: true, why: 'answered from a passage that holds the answer' } : { pass: false, why: `cited ${o.cited ?? 'nothing'}, not one of the passages that hold the answer` };
    case 'not-passage':
      return o.cited === e.id ? { pass: false, why: 'quoted the same passage again' } : { pass: true, why: 'did not repeat the passage' };
    case 'clarifies': {
      const questions = (o.reply.match(/\?/g) ?? []).length;
      if (o.quoted) return { pass: false, why: 'quoted a passage instead of asking' };
      if (isUnknown(o.reply)) return { pass: false, why: 'said "I don\'t know" instead of asking' };
      return questions === 1 ? { pass: true, why: 'asked one question' } : { pass: false, why: `asked ${questions} questions, not one` };
    }
    case 'no-offer': {
      const m = OFFERS.map(r => o.reply.match(r)).find(Boolean);
      return m ? { pass: false, why: `offered "${m[0]}"` } : { pass: true, why: 'offered nothing' };
    }
  }
}
