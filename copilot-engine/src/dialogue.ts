// The conversation around a document answer on a question desk (the tax site's /tax). The desk model decides that
// something should be looked up; this code decides what a good agent does around that, from plain rules:
//   - a vague question is asked back, one question at a time, before anything is quoted (clarify);
//   - "yeah" and "is it gonna take long?" refer to the last topic or ask what is meant, and never start a flow nobody
//     offered (before);
//   - an answer is worded the way a person would say it, with one follow-up, and when the visitor wants to DO the thing
//     it offers the site's matching form (phrase);
//   - the same passage for a different question is said to be the same one.
// Nothing here states a tax fact: every fact still comes from a quoted passage. State is per call.

import type { Passage } from './guide.ts';

export type Offer = { when: string; href: string; label: string; say: string };
type DialogueConfig = { offers?: Offer[]; book?: { text: string; href: string } };
// What the visitor's words turned into. reply: say this. go: also open this page. ask: look this up as the question.
type Turn = { reply?: string; go?: string; ask?: string };
type Said = { src: string; where: string; quote: string; found: boolean; repeated: boolean; question: string; closest?: boolean };

const norm = (s: string) => s.toLowerCase().replace(/[’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();

const YES = /^((yeah|yes|yep|yup|yea|sure|ok|okay|alright|all right|right|uh huh|mm hmm|mhm|correct|please|go ahead|do it|sounds good)( (please|sure|thanks|go ahead|go for it|do it|let's do it|lets do it|that works|that'd be great|i do))?|let's do it|lets do it|sure thing)$/;
const NO = /^(no|nope|nah|not now|no thanks|no thank you|not really|never mind|nevermind|maybe later)$/;

// A question that already names what it is about: a form, line, section, amount, year or a specific tax thing.
const ANCHOR = /\b(form|schedule|pub(lication)?|line|section|notice|irc|irs|w-?2|w-?4|1099\S*|1040\S*|8\d{3}|\d{3,}|\$\d+|\d+%|20\d\d|19\d\d|refund|status|extension|amend\w*|estimated|quarterly|deadline|due|penalty|interest|audit|lien|levy|deduct\w*|credit|dependents?|filing status|standard deduction|file|filing|filed|return|returns|e-?file)\b/;
const DANGLING = /\b(it|that|those|these|this|they|them|there)\b/;
const TIME = /\b(how long|take long|taking long|how fast|how soon|how quickly|long will|long does|long is|long would)\b/;
const COST = /\b(how much|cost|price|fee|expensive|charge|pay for)\b/;
const ASKING = /\?\s*$|^\s*(what|where|which|how|why|when|can|could|should|is|are|do|does|will|would)\b/i;
const DOING = /\b(file|filing|fill|start|apply|submit|sign up|prepare|do my|pay|set up|request|change|send|get my|amend|register|enroll)\b/;

// Tax questions that look specific but are not: asked back with the readings a person would give. Each ask is one
// question. `options` are the words that, in the visitor's answer, turn it into a question the library can answer.
type Vague = { when: RegExp; ask: string; options: { has: RegExp; q: string }[] };
const VAGUE: Vague[] = [
  { when: /\b(find|get|see|check|know|look up|locate|figure out|pull up|access)\b.*\b(my )?(taxes|tax info|tax information|tax stuff|tax records?)\b/,
    ask: 'Do you mean your own tax return, what you owe, or a particular form? Tell me which and I\'ll look it up.',
    options: [
      { has: /\b(owe|balance|bill|pay|payment|amount)\b/, q: 'How do I find the amount I owe the IRS?' },
      { has: /\b(form|forms|publication)\b/, q: 'How do I find the right tax form?' },
      { has: /\b(return|filed|last year|records?|copy|transcript|own|my)\b/, q: 'How do I get a copy of my tax return or tax records?' },
    ] },
  { when: /^(what('s| is)|what are|tell me about|explain) (the |my )?(limit|limits|deadline|deadlines|rate|rates|rules?|credit|credits|deduction|deductions|penalty|penalties|amount|form|forms|requirements?|number|figure|total)\??$/,
    ask: 'Which one do you mean? Give me the tax topic, like home office, retirement or a particular form, and I\'ll look it up.', options: [] },
  { when: /\bmy (number|figure|total|situation|case|stuff|info|information|status|balance|bill)\b/,
    ask: 'Which number do you mean? Tell me the form or the part of your return and I\'ll look it up.', options: [] },
];

export class Dialogue {
  private offers: Offer[];
  private book?: { text: string; href: string };
  private pending: { kind: 'offer'; offer: Offer } | { kind: 'cover' } | { kind: 'split'; question: string; labels: [string, string] } | { kind: 'confirm'; ask: string } | { kind: 'clarify'; question: string; vague: Vague } | null = null;
  private skipClarify = false; // this turn's lookup is the answer to a question already asked back
  topic = ''; // the last question looked up, without its question words ("file my tax return")
  lastQuestion = '';
  private lastAsked = ''; // the last question looked up, answered or not: what a fragment is attached to
  private refused = 0; // refusals in a row
  private lastRefusal = '';
  private lastWait = '';
  shown: { src: string; quote: string; question: string }[] = []; // what was quoted so far, for a recap
  private n = 0;

  constructor(cfg: DialogueConfig = {}) {
    this.offers = cfg.offers ?? [];
    this.book = cfg.book;
  }

  // ---- before the model: filler, short answers to an offer or a question, "is it gonna take long?" ----
  before(said: string): Turn | null {
    const t = norm(said);
    const p = this.pending;
    this.skipClarify = false;
    // "Hmm." or "uh…" on its own is someone thinking, not a turn
    if (t && !stripFillers(said)) return { reply: '' };
    if (p) {
      this.pending = null;
      if (p.kind === 'offer') {
        if (YES.test(t)) return { reply: this.recapBeforeForm(p.offer), go: p.offer.href };
        if (NO.test(t)) return { reply: 'No problem. What else can I help with?' };
      } else if (p.kind === 'cover') {
        if (YES.test(t)) return { reply: 'Good. Anything else you want to know?' };
        if (NO.test(t)) return { reply: 'Which part should I look at? Tell me a bit more about what you need.' };
      } else if (p.kind === 'confirm') {
        if (YES.test(t)) { this.skipClarify = true; return { ask: p.ask }; }
        if (NO.test(t)) return { reply: 'Okay, tell me what you meant and I\'ll look into it.' };
      } else if (p.kind === 'split') {
        if (YES.test(t)) { this.pending = p; return { reply: 'Which of those two do you mean?' }; }
        const fresh = ASKING.test(said.trim()) && t.split(' ').length > 5;
        if (!fresh) {
          this.skipClarify = true;
          const pick = /\b(first|1st|former|one)\b/.test(t) && !/\bsecond\b/.test(t) ? 0 : /\b(second|2nd|latter|two|other)\b/.test(t) ? 1 : overlap(t, p.labels);
          return { ask: pick === undefined || pick < 0 ? `${p.question.replace(/\?$/, '')}: ${said.trim()}` : `${p.question.replace(/\?$/, '')}: ${p.labels[pick]}` };
        }
      } else if (p.kind === 'clarify') {
        // "yeah" to an either-or question: ask which, and keep waiting
        if (YES.test(t)) { this.pending = p; return { reply: 'Which of those do you mean?' }; }
        // a new question is not an answer to ours: it gets its own turn (a short one that names an option is an answer)
        const opt = p.vague.options.find(o => o.has.test(t));
        const fresh = !NO.test(t) && ASKING.test(said.trim()) && !(opt && t.split(' ').length <= 6);
        if (!fresh) {
          this.skipClarify = true;
          if (opt) return { ask: opt.q };
          if (NO.test(t)) return { reply: 'Okay. Tell me a bit more about what you need and I\'ll look it up.' };
          return { ask: `${p.question.replace(/\?$/, '')}: ${said.trim()}` };
        }
      }
    }
    if (YES.test(t) || NO.test(t)) return { reply: this.afterFiller(YES.test(t)) };
    // a short fragment after a question ("for each year") belongs to that question; it is never searched alone
    const bare = stripFillers(said);
    if (this.lastAsked && isFragment(bare)) return { ask: this.join(bare) };
    // "is it gonna take long?": a time or cost question with nothing in it to look up, about the last topic
    if (this.topic && DANGLING.test(t) && t.split(' ').length <= 8 && (TIME.test(t) || COST.test(t))) return this.followUp(t);
    if (/\b(sum|recap|summar\w+|where are we|what did we (find|cover)|what have we)\b/.test(t) && this.shown.length) return { reply: this.recap() };
    return null;
  }

  // "Yeah." with no offer open: it points at the last topic or asks what is meant. It starts nothing.
  private afterFiller(yes: boolean): string {
    if (!this.topic) return yes ? 'Sure. What would you like to know?' : 'No problem. What would you like to know?';
    return yes ? `Okay. Do you want to know more about how to ${this.topic}, or is it something else?` : `Okay. Is there something else about how to ${this.topic} you want to know, or something different?`;
  }

  private followUp(t: string): Turn {
    const vp = this.topic;
    if (TIME.test(t)) { this.pending = { kind: 'confirm', ask: `How long does it take to ${vp}?` }; return { reply: `Do you mean how long it takes to ${vp}? Say yes and I'll look it up in the tax guides.` }; }
    if (COST.test(t)) { this.pending = { kind: 'confirm', ask: `How much does it cost to ${vp}?` }; return { reply: `Do you mean how much it costs to ${vp}? Say yes and I'll look it up in the tax guides.` }; }
    return { reply: `Do you mean ${vp}? Tell me a bit more about what you want to know.` };
  }

  // The question the model chose to look up, with a fragment attached to the question before it ("For each year?" is
  // "What is the best month to file taxes for each year?"). Every lookup question goes through here.
  resolve(q: string): string {
    const bare = stripFillers(q);
    const out = this.lastAsked && isFragment(bare.replace(/\?$/, '')) ? this.join(bare) : q;
    this.lastAsked = out;
    return out;
  }

  private join(fragment: string): string {
    const f = fragment.replace(/[?.!]+$/, '').trim();
    const out = `${this.lastAsked.replace(/\?$/, '')} ${f.charAt(0).toLowerCase()}${f.slice(1)}?`;
    this.lastAsked = out;
    return out;
  }

  // ---- on the model's decision to look something up: ask back when it is too vague to quote ----
  clarify(q: string): string | null {
    if (this.skipClarify) return null;
    const t = norm(q);
    const words = t.split(' ').filter(Boolean);
    let vague = words.length <= 9 ? VAGUE.find(v => v.when.test(t)) : undefined;
    // a question with nothing to look up: three words or fewer, or a pronoun for something never named
    if (!vague && !ANCHOR.test(t) && (words.length <= SHORT || (DANGLING.test(t) && words.length <= 8 && !this.topic))) {
      vague = { when: /./, ask: 'Can you tell me a bit more? For example which form, which year, or what you\'re trying to do.', options: [] };
    }
    if (!vague || (vague === VAGUE[0] && ANCHOR_FOR_FIND.test(t))) return null;
    this.pending = { kind: 'clarify', question: q, vague };
    return vague.ask;
  }

  // The question the judge's split asks, or null when the question is clear enough to answer.
  splitAsk(q: string, split: { a: Passage; b: Passage }): string | null {
    if (this.skipClarify) return null;
    const t = norm(q);
    if (t.split(' ').length > SHORT + 2 || ANCHOR.test(t)) return null;
    const labels: [string, string] = [label(split.a), label(split.b)];
    if (!labels[0] || !labels[1] || norm(labels[0]) === norm(labels[1])) return null;
    this.pending = { kind: 'split', question: q, labels };
    return `That could mean two things. Are you asking about ${labels[0]}, or ${labels[1]}?`;
  }

  // ---- after a lookup: the words said, and the one follow-up ----
  note(question: string, src: string, quote: string) {
    this.lastQuestion = question;
    this.topic = topicOf(question);
    this.shown.push({ src, quote, question });
  }

  phrase(a: Said): string {
    this.n++;
    const where = a.where ? `, ${a.where}` : '';
    const source = `${a.src}${where}`;
    const offer = this.offerFor(a.question);
    let say: string;
    if (a.repeated) {
      say = `That's the same part of ${a.src} I showed you before, so I don't have anything more specific in the guides.`;
    } else if (!a.found) {
      say = `${source} says: ${a.quote} I couldn't pick out the exact line on the page.`;
    } else if (a.closest) {
      say = `The closest I have to that is ${source}: ${a.quote} It may not answer exactly what you asked. It's highlighted on the page.`;
    } else {
      const lead = [`${source} says:`, `According to ${source}:`, `Here's what ${source} says:`][this.n % 3];
      say = `${lead} ${a.quote} It's highlighted on the page.`;
    }
    this.refused = 0;
    if (offer) { this.pending = { kind: 'offer', offer }; return `${say} ${offer.say}`; }
    this.pending = { kind: 'cover' };
    return `${say} Does that cover it, or should I look at a different part?`;
  }

  // What to say when nothing answers. The first time it is the plain "I don't know" (null: the caller's own line); after
  // that never the same sentence twice in a row: the closest passage, one question back, or a preparer.
  refusal(question: string, nearest?: { src: string; quote: string }): string | null {
    this.refused++;
    if (this.refused === 1) { this.lastRefusal = ''; return null; }
    const options: string[] = [];
    if (nearest) options.push(`The closest thing in the guides is ${nearest.src}: ${nearest.quote} It may not be what you asked, though.`);
    options.push(`Let me try that another way. Can you tell me the form, the year, or what you're trying to get done?`);
    if (this.book) options.push(`I'm not finding that in the guides. A preparer can look into it with you. Want me to open the booking form?`);
    const pick = options[(this.refused - 2) % options.length] !== this.lastRefusal ? options[(this.refused - 2) % options.length] : options[(this.refused - 1) % options.length];
    this.lastRefusal = pick;
    if (this.book && pick === options.at(-1) && this.book) this.pending = { kind: 'offer', offer: { when: '', href: this.book.href, label: this.book.text, say: '' } };
    this.lastAsked = question;
    return pick;
  }

  // What the copilot says while a search is still running past the first moment: a short line, not the one before it, and
  // when the question's topic is a known one, a line that names it. Code picks it; it only says what is true (it is looking).
  waitLine(question: string): string {
    const q = norm(question);
    const topic = WAIT_TOPICS.find(([re]) => re.test(q))?.[1];
    const pool = [...WAIT_LINES, ...(topic ? [topic, topic] : [])].filter(l => l !== this.lastWait);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.lastWait = pick;
    return pick;
  }

  private offerFor(question: string): Offer | null {
    const q = norm(question);
    const hit = this.offers.find(o => new RegExp(o.when, 'i').test(q));
    if (hit) return hit;
    if (DOING.test(q) && this.book) return { when: '', href: this.book.href, label: this.book.text, say: 'I can\'t do that for you from here, but a preparer can. Want me to open the booking form and fill it in with you?' };
    return null;
  }

  private recapBeforeForm(o: Offer): string {
    const s = this.shown;
    const lead = s.length >= 2 ? `Quick recap: I showed you ${s.length} passages, from ${[...new Set(s.map(x => x.src))].join(' and ')}. ` : '';
    return `${lead}Okay, opening ${o.label}. I'll take you through it one question at a time.`;
  }

  recap(): string {
    const s = this.shown.at(-1)!;
    const sources = [...new Set(this.shown.map(x => x.src))];
    return `So far I've shown you ${this.shown.length === 1 ? 'one passage' : `${this.shown.length} passages`}, from ${sources.join(' and ')}. The last one, for "${s.question.replace(/\?$/, '')}", says: ${s.quote}`;
  }
}

// ---- after a lookup, on a short question: the judge found two different passages nearly equally likely ----
// The question can mean two things, so ask which, naming both by their sections in the library.
const SHORT = 7;
const label = (p: Passage): string => {
  const sec = p.cite?.title.includes(', ') ? p.cite.title.slice(p.cite.title.indexOf(', ') + 2) : '';
  const text = (sec || p.text.split(/(?<=[.!?])\s/)[0]).replace(/^\d+[.)]\s*/, '').replace(/\s+/g, ' ');
  return text.length > 70 ? `${text.slice(0, 67).replace(/\s+\S*$/, '')}…` : text;
};
const overlap = (t: string, labels: string[]): number | undefined => {
  const w = (x: string) => new Set(norm(x).split(' ').filter(y => y.length > 3));
  const score = labels.map(l => [...w(l)].filter(y => w(t).has(y)).length);
  return score[0] === score[1] ? undefined : score[0] > score[1] ? 0 : 1;
};

// ---- thinking out loud, and pieces of one question ----
const FILLER = /^(?:(?:hmm+|hm+|uh+|um+|umm+|er+|erm|ah+|oh|well|like|so|okay so|you know|i mean)(?=[\s,.…-]|$)[\s,.…-]*)+/i;
// The words with their leading "hmm", "uh", "like" taken off.
export const stripFillers = (said: string): string => said.trim().replace(FILLER, '').trim();
// A piece of a question, not a question: under four words with no question word and no verb ("for each year").
const WH = /^(what|when|where|which|who|why|how)\b/i;
const VERB = /\b(is|are|was|were|do|does|did|can|could|should|would|will|have|has|need|want|file|pay|get|find|know|tell|show|send|open|help|mean|say|take|go|use|make|give|check|start|fill|apply|call|book|report|claim|deduct)\b/i;
export const isFragment = (bare: string): boolean => {
  const t = bare.replace(/[?.!,]+$/, '').trim();
  return !!t && t.split(/\s+/).length < 4 && !WH.test(t) && !VERB.test(t) && !YES.test(norm(t)) && !NO.test(norm(t));
};
// Of everything said in one breath, the question to look up when the model's own rewrite found nothing: the last question
// with at least four words ("what's the deadline?"), else all of it; never an aside like "what happens?".
export function ownQuestion(said: string): string {
  const qs = (stripFillers(said).match(/[^.?!]*\?/g) ?? []).map(x => stripFillers(x.trim())).filter(x => x.split(/\s+/).length >= 4);
  const out = qs.at(-1) ?? stripFillers(said);
  return isFragment(out.replace(/\?$/, '')) ? '' : out; // a fragment is never searched alone
}

const WAIT_LINES = ['One sec.', 'Let me look that up.', 'Checking on that.', 'Okay, looking into it.'];
const WAIT_TOPICS: [RegExp, string][] = [
  [/payment plan|installment|pay over time/, 'Let me pull up the payment plan rules.'],
  [/deadline|due date|last day|what month|when to file|when do i file|when should i file/, 'Let me look up the filing deadline.'],
  [/refund/, 'Let me look into refunds.'],
  [/extension/, 'Let me check on extensions.'],
  [/estimated|quarterly/, 'Let me check the estimated tax rules.'],
  [/amend|1040-?x/, 'Let me look up amended returns.'],
  [/notice|letter from the irs/, 'Let me look up IRS notices.'],
  [/deduct/, 'Let me look up that deduction.'],
  [/credit/, 'Let me look up that credit.'],
  [/file|filing|return/, 'Let me look up filing.'],
];
// Every line waitLine can say: the voice server makes them ahead of time so the first sound is fast.
export const WAIT_SET: string[] = [...WAIT_LINES, ...WAIT_TOPICS.map(t => t[1])];

// "find my taxes" with a reason is not vague: "find my taxes for 2023" names a year, "find my tax refund" a refund.
const ANCHOR_FOR_FIND = /\b(refund|status|20\d\d|19\d\d|owe|balance|form|forms|transcript|copy|return|returns|filed)\b/;

// The question without its question words: "How do I file my tax return?" -> "file my tax return".
export function topicOf(q: string): string {
  return q.replace(/\?+$/, '').trim()
    .replace(/^(so |but |and |okay |ok |well |like )+/i, '')
    .replace(/^(how (do|can|should|would|could) (i|we|you)|how to|can (i|we|you)|could (i|we)|what (do|should|must) (i|we)( need to)?|where (do|can) (i|we)|do (i|we) need to|i want to|i need to|i'd like to) /i, '')
    .replace(/\bfrom here\b/i, '').replace(/\s+/g, ' ').trim()
    .toLowerCase().replace(/\bmy\b/g, 'your').replace(/\bmine\b/g, 'yours').replace(/\bi\b/g, 'you');
}
