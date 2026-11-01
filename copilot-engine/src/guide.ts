// Manual-guidance mode: walk a person through a manual one step at a time.
// Code decides navigation (next, back, repeat, stop). Side questions are answered only by quoting the manual:
// a retriever finds passages, a judge (Jev, or a stand-in) says whether a passage answers the question, and the
// copilot reads that passage back with its page. If no passage answers, it says it doesn't know. It never writes
// an answer of its own, so it cannot make one up.
import { isFiller } from './guard.ts';

export const NO_ANSWER = "I don't know. The manual doesn't cover that, and I only answer from the manual.";

export interface Step { n: number; text: string; page?: number }
// unknown: what to say when nothing answers (default: the manual doesn't cover that).
export interface Manual { id: string; title: string; business: string; steps: Step[]; passages: Passage[]; unknown?: string }
// cite: where a passage comes from, for a library of many documents ("IRS Pub 17, Filing Requirements" and its link).
// title: the passage's document title in the retriever's store.
// section, pageType, language, lastModified: set by the site retriever (a business's own pages); see site-search.ts.
export interface Passage { id: string; text: string; page?: number; cite?: { title: string; url: string; doc?: string; anchor?: string }; title?: string; section?: string; pageType?: string; language?: string; lastModified?: string }

// Narrows a search to part of a site. Each part is optional; a retriever that cannot filter ignores it.
export interface SearchFilter { section?: string; pageType?: string; language?: string }
export interface Retriever { search(query: string, k: number, filter?: SearchFilter): Promise<Passage[]> }
// Returns the id of the passage that answers the question, or '' when none does.
export interface Judge {
  pick(question: string, passages: Passage[]): Promise<string>;
  // Optional: which sentences of the chosen passage answer the question (indices). Without it, shortQuote decides.
  sentences?(question: string, sentences: string[]): Promise<number[]>;
  // Optional: Jev's probabilities for the passages of the last pick ("p0", "p1"… and "none"), when the judge has them.
  lastProbs?: Record<string, number>;
  // Optional: the rule that kept the last pick ('sure', 'ahead' or 'closest'), when the judge reports one.
  lastRule?: string;
}

const NEXT = /^\s*(next|done|ok(ay)?,? (done|next)|finished|got it|did it|i did( it| that)?|that'?s done|ready|go on|continue|what'?s next|and then\??)\W*$/i;
const BACK = /\b(go back|previous step|last step|step before|back one)\b|^\s*back\W*$/i;
const REPEAT = /\b(repeat|say (that|it) again|again\?|one more time|what was (that|the step))\b|^\s*(sorry|pardon|what)\??\s*$/i;
const STOP = /\b(stop|quit|cancel|end (this|it)|that'?s all|i'?m done with this)\b/i;
const QUESTION = /\?\s*$|^\s*(what|where|which|how|why|when|can|could|should|is|are|do|does|will|would)\b/i;

export class Guide {
  idx = 0;
  done = false;
  log: { who: 'user' | 'copilot'; text: string }[] = [];
  last?: Passage; // the passage the last lookup quoted (none when it didn't know), for its citation link
  lastQuote: string[] = []; // the sentences of that passage it quoted, word for word
  // Set when the judge found two different passages nearly equally likely to answer: a sign the question can mean two things.
  lastSplit?: { a: Passage; b: Passage; pa: number; pb: number };
  // The visitor's own words for this turn, searched alongside the rewritten question: the rewrite can lose the very word
  // that finds the passage ("what's the deadline" became "the filing deadline for my return" and found the refund limit).
  also = '';
  lastHits: Passage[] = []; // what the last lookup's search(es) returned, merged
  lastNearest?: Passage; // the best search hit of the last lookup, even when none answered, for "the closest I have"
  lastClosest = false; // the last answer is the closest passage the guides have, not one Jev found to answer it
  lastRepeat = false; // the last lookup could only quote a passage this guide already quoted earlier
  seen = new Set<string>(); // ids of the passages quoted so far, so the same one is not passed off as a new answer
  private manual: Manual;
  private retriever: Retriever;
  private judge: Judge;
  constructor(manual: Manual, retriever: Retriever, judge: Judge) {
    this.manual = manual;
    this.retriever = retriever;
    this.judge = judge;
  }

  start(): string {
    return this.say(`I'll walk you through "${this.manual.title}" one step at a time. Say "next" when you're ready to move on, "repeat" or "go back" any time, or ask me a question. ${this.step()}`);
  }

  async turn(said: string): Promise<string> {
    this.log.push({ who: 'user', text: said });
    return this.say(await this.handle(said));
  }

  private async handle(said: string): Promise<string> {
    if (this.done) return 'We finished this guide. Start again any time.';
    const t = said.trim();
    if (STOP.test(t)) { this.done = true; return `Okay, stopping here at step ${this.idx + 1}. You can pick up from this step later.`; }
    if (BACK.test(t)) { this.idx = Math.max(0, this.idx - 1); return this.step(); }
    if (REPEAT.test(t)) return this.step();
    if (NEXT.test(t)) {
      if (this.idx + 1 >= this.manual.steps.length) { this.done = true; return "That was the last step. You're all done."; }
      this.idx += 1;
      return this.step();
    }
    if (!t || isFiller(t)) return `Take your time. Say "next" when you've done it.`;
    if (QUESTION.test(t)) return this.answer(t);
    return `Say "next" when you've done this step, or ask me a question. ${this.step()}`;
  }

  private step(): string {
    const s = this.manual.steps[this.idx];
    return `Step ${s.n} of ${this.manual.steps.length}: ${s.text}`;
  }

  private async answer(q: string): Promise<string> {
    return `${await this.lookup(q)} When you're ready, we're still on step ${this.manual.steps[this.idx].n}.`;
  }

  // Answers one question from the manual, or says it doesn't know. Also used outside a walk-through (a form's side question).
  async lookup(q: string, filter?: SearchFilter): Promise<string> {
    const found = await this.search(q, filter);
    this.lastHits = found;
    // A guide for a narrow audience (US possessions, citizens abroad) is not a general answer: the judge sees the
    // other passages first, and the narrow ones only when none of those answers (or the question names that audience).
    const hits = withoutNiche(found, q);
    this.lastNearest = hits[0];
    let picked = await this.pick(q, hits);
    let p = picked.p;
    this.lastSplit = p ? splitOf(hits, this.judge.lastProbs, p) : undefined;
    if (!p && hits.length < found.length) { picked = await this.pick(q, found); p = picked.p; }
    this.lastRepeat = false;
    if (p && this.seen.has(p.id)) {
      // The same passage again: see whether the search found another that answers before repeating it.
      const rest = found.filter(h => !this.seen.has(h.id) && hits.includes(h));
      const other = rest.length ? await this.pick(q, rest) : undefined;
      if (other?.p) { p = other.p; picked = other; } else this.lastRepeat = true;
    }
    this.last = p;
    this.lastClosest = !!p && picked.closest;
    this.lastQuote = [];
    if (!p) return this.manual.unknown ?? NO_ANSWER;
    this.seen.add(p.id);
    if (p.cite) return `${p.cite.title} says: "${await this.quote(p.text, q)}"`;
    return `The manual says${p.page ? ` (page ${p.page})` : ''}: "${await this.quote(p.text, q)}"`;
  }

  // The search for a question: the question with date words spelled out, and the visitor's own words too when they differ,
  // merged and de-duplicated. When nothing comes back at all, the plain question once more.
  private async search(q: string, filter?: SearchFilter): Promise<Passage[]> {
    const asks = [expandDates(q)];
    const own = tidy(this.also);
    if (own && own.toLowerCase() !== tidy(q).toLowerCase()) asks.push(expandDates(own));
    const lists = await Promise.all(asks.map(a => this.retriever.search(a, 4, filter)));
    let merged = mergeHits(lists, asks.length > 1 ? 6 : 4);
    if (!merged.length && asks[0] !== q) merged = await this.retriever.search(q, 4, filter);
    return merged;
  }

  private async pick(q: string, hits: Passage[]): Promise<{ p?: Passage; closest: boolean }> {
    const id = hits.length ? await this.judge.pick(q, hits) : '';
    const p = hits.find(h => h.id === id);
    return { p, closest: !!p && this.judge.lastRule === 'closest' };
  }

  private async quote(text: string, q: string): Promise<string> {
    const sents = splitSentences(text);
    const idx = text.length <= 260 || sents.length < 2 || !this.judge.sentences ? [] : await this.judge.sentences(q, sents);
    const said = idx.length ? idx.sort((a, b) => a - b).map(i => sents[i]).join(' ') : shortQuote(text, q);
    // the quoted sentences, each exactly as in the passage (for a viewer that highlights them in the source)
    this.lastQuote = idx.length ? idx.map(i => sents[i]) : sents.filter(s => said.includes(s));
    if (!this.lastQuote.length) this.lastQuote = [said];
    return said;
  }

  private say(text: string): string {
    this.log.push({ who: 'copilot', text });
    return text;
  }
}

// Passages can be long; read back only the sentences that best match the question (in their original order),
// so a spoken answer stays short. Still the manual's own words, never a rewrite.
export const splitSentences = (text: string): string[] => text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/);

export function shortQuote(text: string, question: string, maxChars = 260): string {
  const sents = splitSentences(text);
  if (text.length <= maxChars || sents.length < 2) return text;
  const q = new Set(words(question));
  const ranked = sents.map((s, i) => ({ s, i, score: words(s).filter(w => q.has(w)).length })).sort((a, b) => b.score - a.score || a.i - b.i);
  const keep: typeof ranked = [];
  for (const r of ranked) {
    if (keep.length && (r.score === 0 || keep.reduce((n, k) => n + k.s.length, 0) + r.s.length > maxChars)) break;
    keep.push(r);
    if (keep.length === 2) break;
  }
  return keep.sort((a, b) => a.i - b.i).map(k => k.s).join(' ');
}

// The two passages Jev rates highest, when the runner-up is a real contender (a short question that two passages answer
// differently is often a question that can mean two things).
const SPLIT_MIN = 0.2;
function splitOf(hits: Passage[], probs: Record<string, number> | undefined, picked: Passage): Guide['lastSplit'] {
  if (!probs) return undefined;
  const ranked = hits.map((h, i) => ({ h, p: probs[`p${i}`] ?? 0 })).sort((x, y) => y.p - x.p);
  const [a, b] = ranked;
  return a && b && a.h.id === picked.id && b.p >= SPLIT_MIN ? { a: a.h, b: b.h, pa: a.p, pb: b.p } : undefined;
}

// Publications written for a narrow audience. "How do I file my return?" is not answered by the guide for people with
// income from US possessions, however well one of its lines matches the words.
const NICHE_DOC = /\bpublications-p(54|515|519|570|597|901)\b|^IRS Pub (54|515|519|570|597|901)\b/;
const NICHE_ASKED = /\b(possessions?|puerto rico|guam|virgin islands|samoa|mariana|abroad|overseas|expat\w*|foreign|nonresident|non-resident|alien|treat(y|ies)|canad\w*|bona fide)\b/i;
export const isNiche = (p: Passage): boolean => NICHE_DOC.test(`${p.title ?? ''}`) || NICHE_DOC.test(p.cite?.title ?? '');
export function withoutNiche(hits: Passage[], question: string): Passage[] {
  if (NICHE_ASKED.test(question)) return hits;
  const general = hits.filter(h => !isNiche(h));
  return general.length ? general : hits;
}

// Keyword retriever for tests and small manuals: scores passages by shared words (Octo RAG replaces it in production).
const STOPWORDS = new Set('a an the is are do does i my me you your to of in on for and or it this that can how what where which when why should will with be at by from'.split(' '));
const words = (s: string) => s.toLowerCase().match(/[a-z0-9]+/g)?.filter(w => !STOPWORDS.has(w)).map(w => w.replace(/s$/, '')) ?? [];
export class KeywordRetriever implements Retriever {
  private passages: Passage[];
  constructor(passages: Passage[]) { this.passages = passages; }
  async search(query: string, k: number): Promise<Passage[]> {
    const q = new Set(words(query));
    return this.passages
      .map(p => ({ p, score: words(p.text).filter(w => q.has(w)).length }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(x => x.p);
  }
}

// Stand-in judge for tests: picks the top passage only if it shares at least two content words with the question.
export class OverlapJudge implements Judge {
  async pick(question: string, passages: Passage[]): Promise<string> {
    const q = new Set(words(question));
    const best = passages.find(p => new Set(words(p.text).filter(w => q.has(w))).size >= 2);
    return best?.id ?? '';
  }
}

// Words a visitor says about a date ("deadline", "last day", "what month") are not the words the guides use ("due date",
// "when to file"), and a search for them finds the refund time limit first. Spelling the topic out finds Tax Topic 301.
const DATE_WORDS = /\b(deadline|dead line|due date|last day (to|for)|when (do|should|must|can) (i|we) (have to )?file|what month|which month|best month|how late|by when)\b/i;
const NOT_ABOUT_RETURN_DATE = /\b(extension|estimated|quarterly|payroll|941|940|1099|w-?2|partnership|corporation|state|property|gift|estate|fbar|payment plan|installment|amend\w*|1040-?x|appeal|notice)\b/i;
export function expandDates(q: string): string {
  return DATE_WORDS.test(q) && !NOT_ABOUT_RETURN_DATE.test(q) && !/due date to file/i.test(q) ? `${q.replace(/\s+$/, '')} due date to file federal income tax return` : q;
}
const tidy = (s: string) => s.replace(/\bdead line\b/gi, 'deadline').replace(/\s+/g, ' ').trim();
// Hits from several searches, one from each in turn, without repeats.
function mergeHits(lists: Passage[][], cap: number): Passage[] {
  const out: Passage[] = [];
  for (let i = 0; out.length < cap && lists.some(l => i < l.length); i++) for (const l of lists) if (l[i] && !out.some(o => o.id === l[i].id) && out.length < cap) out.push(l[i]);
  return out;
}

// What Jev said about one passage pick, for the trace as well as the decision.
//   rule: why the pick stands or not: 'sure' (Jev thinks it unlikely that no passage answers), 'ahead' (the passage it
//   picked is clearly more likely than "none"), 'none' (Jev did not choose a passage, or is not sure enough), 'error'
//   (the call failed: see error), 'skipped' (no key or no passages).
type Pick = { id: string; rule: 'sure' | 'ahead' | 'closest' | 'none' | 'error' | 'skipped'; probs: Record<string, number>; error: string };

// Jev's confidence that SOME passage answers is 1 minus its probability for "none": two passages that both answer
// split the rest between them. So a pick stands when "none" is unlikely (the original gate), or when the picked passage
// is a clear favourite over "none" even though "none" kept more than a quarter (a question phrased in an unusual way,
// such as "can I file from here?", scored 0.70 for the right passage against 0.26 for none, and was thrown away at 0.25).
// A passage that is merely on the same topic does not get there: its own probability stays low and "none" stays high.
export const NONE_MAX = 0.25;
const AHEAD_MIN = 0.65;
const AHEAD_BY = 0.35;
const TIE_BY = 0.02; // Jev's probabilities are rounded: 0.34 against 0.35 is a tie
// A tie or better ("none" 0.35, the due-date passage 0.34 for "what is the best month to file taxes?") is not a refusal:
// the passage is quoted and said to be the closest the documents get.
export function pickRule(probs: Record<string, number>, i: number): 'sure' | 'ahead' | 'closest' | 'none' {
  if (i < 0) return 'none';
  const none = probs.none ?? 1;
  if (none <= NONE_MAX) return 'sure';
  const own = probs[`p${i}`] ?? 0;
  if (own >= AHEAD_MIN && own - none >= AHEAD_BY) return 'ahead';
  return own >= none - TIE_BY ? 'closest' : 'none';
}

// Jev decides whether one of the passages answers the question. Locked to Jev models like JevGate.
export class JevJudge implements Judge {
  calls = 0;
  cost = 0;
  // Why the last call got no answer from Jev (HTTP status, timeout); empty when Jev answered. Lets a caller tell
  // "no passage answers" apart from "Jev was down" and fall back.
  lastError = '';
  lastProbs?: Record<string, number>;
  lastRule?: string;
  private key?: string;
  private url: string;
  constructor(opts: { key?: string; url?: string } = {}) {
    this.key = opts.key ?? process.env.OPENROUTER_JEV_KEY;
    this.url = opts.url ?? process.env.JEV_URL ?? 'https://openrouter.ai/api/alpha/decisions';
  }
  async pick(question: string, passages: Passage[]): Promise<string> {
    return (await this.choose(question, passages)).id;
  }

  // The same decision with what Jev said: its probabilities and the rule that kept or dropped the pick, or the error.
  async choose(question: string, passages: Passage[]): Promise<Pick> {
    this.lastProbs = undefined; this.lastRule = undefined;
    if (!this.key || !passages.length) return { id: '', rule: 'skipped', probs: {}, error: '' };
    const criteria: Record<string, string> = { none: 'None of the passages answers the question' };
    passages.forEach((p, i) => { criteria[`p${i}`] = `This passage answers the question: "${p.text}"`; });
    try {
      const j = await this.decide({
        model: 'typesafe/jev-1.14',
        state: { question },
        questions: { source: { type: 'choice', criteria, instructions: 'Pick the passage that directly answers the question. Pick none if no passage does; a passage on the same topic that does not answer it is none.' } },
      });
      if (!j) return { id: '', rule: 'error', probs: {}, error: this.lastError };
      this.calls++; this.cost += j.usage?.cost ?? 0;
      const a = j.answers?.source;
      const probs: Record<string, number> = a?.probabilities ?? {};
      const i = typeof a?.choice === 'string' && a.choice.startsWith('p') ? +a.choice.slice(1) : -1;
      this.lastProbs = probs;
      const rule = pickRule(probs, i);
      this.lastRule = rule;
      return { id: rule === 'none' ? '' : passages[i]?.id ?? '', rule, probs, error: '' };
    } catch (e) {
      // A reply that could not be read is an error, not "no passage answers": callers fall back on lastError.
      this.lastError = `jev ${(e as Error).name}`;
      return { id: '', rule: 'error', probs: {}, error: this.lastError };
    }
  }

  async sentences(question: string, sentences: string[]): Promise<number[]> {
    const criteria: Record<string, string> = {};
    sentences.forEach((t, i) => { criteria[`s${i}`] = `This sentence answers the question: "${t}"`; });
    try {
      const j = await this.decide({ model: 'typesafe/jev-1.14', state: { question },
        questions: { sentence: { type: 'choice', criteria, instructions: 'Pick the sentence that most directly answers the question.' } } });
      if (!j) return [];
      this.calls++; this.cost += j.usage?.cost ?? 0;
      const probs: Record<string, number> = j.answers?.sentence?.probabilities ?? {};
      // the best sentence, plus a runner-up only when Jev rates it almost as high (an answer split across two sentences)
      const ranked = Object.entries(probs).sort((a, b) => b[1] - a[1]);
      const keep = ranked.filter(([, p], i) => i === 0 || (i === 1 && p >= 0.3));
      return keep.map(([k]) => +k.slice(1)).filter(i => i >= 0 && i < sentences.length);
    } catch { return []; }
  }

  // One decision call, retried once when the provider is overloaded or down; null (and lastError set) if it never answers.
  private async decide(body: unknown): Promise<any> {
    this.lastError = '';
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}`, 'User-Agent': 'copilot-engine/0.1' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(20000),
        });
        if (r.ok) { this.lastError = ''; return await r.json(); }
        this.lastError = `jev ${r.status}`;
        if (r.status < 500 && r.status !== 429) return null;
      } catch (e) { this.lastError = `jev ${(e as Error).name}`; }
      if (attempt === 0) await new Promise(res => setTimeout(res, 700));
    }
    return null;
  }
}

// Octo RAG as the retriever (hybrid search in the owner's own Octo workspace). Passage ids are Octo document ids.
export class OctoRetriever implements Retriever {
  private base: string;
  private key: string;
  private workspaceId: string;
  private prefixes: (string | undefined)[];
  private rerank?: boolean;
  private timeoutMs: number;
  // titlePrefix keeps answers to one manual or library: a workspace can hold many, and Octo filters by document title
  // inside the search, before its limit (filter.titlePrefix). A library spread over several prefixes (irs/, irc/, cfr/…)
  // is searched once, unfiltered and deeper, and the matches outside its prefixes dropped here: Octo's prefix filter is
  // the slow part of a query at library scale (about 15 s of 25 on 32,000 passages), and one query per prefix ran them
  // all at once. rerank: false skips Octo's reranker (a few seconds faster, a little less precise).
  // timeoutMs: how long one search may take before it counts as no result (an eval raises it to score answers apart
  // from latency).
  constructor(opts: { base?: string; key: string; workspaceId: string; titlePrefix?: string | string[]; rerank?: boolean; timeoutMs?: number; overfetch?: number /* no longer needed: Octo filters */ }) {
    this.base = opts.base ?? 'https://octodb.design-bakery.com/api';
    this.key = opts.key;
    this.workspaceId = opts.workspaceId;
    this.prefixes = Array.isArray(opts.titlePrefix) ? opts.titlePrefix : [opts.titlePrefix];
    this.rerank = opts.rerank;
    this.timeoutMs = opts.timeoutMs ?? 30000;
  }

  private async one(query: string, k: number, prefix?: string): Promise<any[]> {
    const r = await fetch(`${this.base}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.key}`, 'User-Agent': 'copilot-engine/0.1' },
      body: JSON.stringify({ workspaceId: this.workspaceId, query, limit: k, ...(prefix ? { filter: { titlePrefix: prefix } } : {}),
        ...(this.rerank === false ? { rerank: false } : {}) }),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!r.ok) return [];
    return ((await r.json()).matches ?? []).filter((x: any) => !prefix || String(x.title ?? '').startsWith(prefix));
  }

  async search(query: string, k: number): Promise<Passage[]> {
    try {
      const rows = this.prefixes.length > 1
        ? (await this.one(query, Math.min(50, k * 3))).filter(x => this.prefixes.some(p => String(x.title ?? '').startsWith(p ?? '')))
        : await this.one(query, k, this.prefixes[0]);
      return rows.slice(0, k).map((x, i) => {
        const text: string = x.content ?? '';
        const page = Number(text.match(/\[page (\d+)\]/)?.[1]) || undefined;
        return { id: String(x.chunkId ?? i), title: x.title, text: text.replace(/\[page \d+\]\s*/g, '').trim(), page };
      }).filter(p => p.text);
    } catch { return []; }
  }
}
