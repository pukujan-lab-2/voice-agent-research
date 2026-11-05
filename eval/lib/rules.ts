// The rules that flag a suspect turn. Plain code over a call's spans: no model judges anything (decision 0005).
// Each rule returns the turns it flags with the evidence a reader needs. Limits sit at the top so they are easy to move.
import type { Call, Turn } from './spans.ts';
import { OFFERS } from '../../copilot-engine/src/guard.ts';

export const LIMITS = {
  firstAudioMs: 4000,   // the caller waited longer than this for the first sound
  searchMs: 3000,       // library search took longer than this
  repeatWindow: 4,      // the same passage for a different question within this many turns
};

export type Flag = {
  call: string;
  turn: string | null;  // null: the flag is about the whole call
  n: number | null;
  rule: string;
  text: string;         // what the caller said and what the copilot answered, short
  evidence: string;
};
type Rule = (call: Call) => Flag[];

const STOP = new Set(('a an and are as at be but by can could do does did for from gonna got had has have how i if in is it its just like my me no of on or our so that the their them then there these this those to up was we what when where which who will with would you your yeah yes okay ok please here there about into out').split(' '));
export const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(Boolean);
// A crude stem so "taxes" meets "tax" and "filing" meets "file".
const stem = (w: string) => w.replace(/(ing|es|ed|s)$/, '').replace(/e$/, '');
export const content = (s: string) => [...new Set(words(s).filter(w => !STOP.has(w)).map(stem))];

const clip = (s: string, n = 110) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const flag = (t: Turn, rule: string, evidence: string): Flag => ({ call: t.call, turn: t.id, n: t.n, rule, text: `"${clip(t.input, 90)}" → "${clip(t.reply, 110)}"`, evidence });

const UNKNOWN = /\bI don't know\b|couldn't find that in the/i;
export const isUnknown = (reply: string) => UNKNOWN.test(reply);

// 1. The judge threw the answer away. Search returned a passage that covers the question's own words, the judge picked
// nothing, and the caller was told "I don't know". A question the library really can't answer shares no words with its
// hits, so it is not flagged.
export const judgeDroppedAnswer: Rule = call => call.turns.flatMap(t => {
  if (!isUnknown(t.reply)) return [];
  for (const j of t.judges.filter(j => !j.id)) {
    const s = t.searches.find(s => s.q === j.q) ?? t.searches[0];
    if (!s?.texts.length) continue;
    const q = content(j.q);
    for (let i = 0; i < Math.min(3, s.texts.length); i++) {
      const p = new Set(content(s.texts[i]));
      const shared = q.filter(w => p.has(w));
      if (shared.length >= 2 && shared.length >= q.length / 2) return [flag(t, 'judge-dropped-answer',
        `Judge returned no id for "${clip(j.q, 70)}" although search hit ${i + 1} (${s.ids[i].slice(0, 8)}) shares ${shared.join(', ')}: "${clip(s.texts[i], 140)}"`)];
    }
  }
  return [];
});

// 2. The same passage read out for two different questions close together.
export const repeatedPassage: Rule = call => {
  const out: Flag[] = [];
  const quoted = call.turns.filter(t => t.href);
  quoted.forEach((t, i) => {
    const earlier = quoted.slice(0, i).reverse().find(p => p.href === t.href && t.n - p.n <= LIMITS.repeatWindow && !sameAsk(p.input, t.input));
    if (earlier) out.push(flag(t, 'repeated-passage', `Same passage (${t.href.split('/').pop()}) as turn ${earlier.n}, asked as "${clip(earlier.input, 70)}"`));
  });
  return out;
};
function sameAsk(a: string, b: string) {
  const x = new Set(content(a)), y = content(b);
  return y.length > 0 && y.filter(w => x.has(w)).length / Math.max(x.size, y.length) >= 0.8;
}

// 3. A vague input answered with a quote. Vague: an affirmation, a bare pronoun, or too few content words with
// nothing specific in them (a number, a capitalised name).
const AFFIRM = /^(yeah|yes|yep|yup|ok|okay|sure|right|alright|uh huh|mm hmm|mhm|no|nope|nah)\b[\s.,!?]*$/i;
export function isVague(input: string) {
  const s = input.trim();
  if (AFFIRM.test(s)) return true;
  const w = content(s);
  if (/\d/.test(s) || /(?<!^)\b[A-Z][a-z]+/.test(s.replace(/^.*?[.!?]\s+/, ''))) return false;   // a form number or a name makes it specific
  return w.length < 3 || /\b(it|that|this|them)\??$/i.test(s.replace(/[.!]$/, ''));
}
export const vagueAnsweredByQuote: Rule = call => call.turns
  .filter(t => t.quote && isVague(t.input))
  .map(t => flag(t, 'vague-answered-by-quote', `Vague input (${content(t.input).join(' ') || 'no content words'}) answered with a quote from ${t.href.split('#')[0].split('/').pop()}, not a question`));

// 4. A reply in the model's own words (no tool call, no quote) that offers something nobody told it it can do.
// The list lives with the desk's guard (copilot-engine/src/guard.ts), so what is flagged is what the desk drops.
export { OFFERS };
export const inventedOffer: Rule = call => call.turns
  .filter(t => !t.desk && !t.quote && !isUnknown(t.reply))
  .flatMap(t => { const m = OFFERS.map(r => t.reply.match(r)).find(Boolean); return m ? [flag(t, 'invented-offer', `Offers "${m[0]}", which the copilot was not told it can do`)] : []; });

// 5. Slow: first sound or search over the limit (voice calls only, where the agent measures both).
export const slow: Rule = call => call.turns.flatMap(t => {
  const out: Flag[] = [];
  if (t.firstAudioMs !== undefined && t.firstAudioMs > LIMITS.firstAudioMs) out.push(flag(t, 'slow-first-audio', `First sound after ${t.firstAudioMs} ms (limit ${LIMITS.firstAudioMs})`));
  const search = t.searchMs ?? Math.max(0, ...t.searches.map(s => s.ms));
  if (search > LIMITS.searchMs) out.push(flag(t, 'slow-search', `Search took ${search} ms (limit ${LIMITS.searchMs})`));
  return out;
});

// 6. The caller talked over the copilot.
export const bargeIn: Rule = call => call.turns.filter(t => t.bargeIns > 0).map(t => flag(t, 'barge-in', `Caller interrupted ${t.bargeIns} time(s)`));

// 7. The call did not end well: the widget wrote an outcome other than finished, it recorded failures, or the last
// thing the caller heard was "I don't know".
export const unresolvedCall: Rule = call => {
  const last = call.turns.at(-1);
  const why: string[] = [];
  if (call.outcome && call.outcome !== 'finished') why.push(`outcome "${call.outcome}"`);
  if (call.failures > 0) why.push(`${call.failures} failure(s)`);
  if (call.failureSpans.length) why.push(`failure spans: ${[...new Set(call.failureSpans)].join(', ')}`);
  if (last && isUnknown(last.reply)) why.push('the last answer was "I don\'t know"');
  if (!why.length) return [];
  return [{ ...(last ? flag(last, 'unresolved-call', why.join('; ')) : { call: call.id, turn: null, n: null, rule: 'unresolved-call', text: '', evidence: why.join('; ') }), evidence: why.join('; ') }];
};

export const RULES: Rule[] = [judgeDroppedAnswer, repeatedPassage, vagueAnsweredByQuote, inventedOffer, slow, bargeIn, unresolvedCall];
export const flagCall = (call: Call): Flag[] => RULES.flatMap(r => r(call));
