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
export interface Passage { id: string; text: string; page?: number; cite?: { title: string; url: string; doc?: string; anchor?: string }; title?: string }

export interface Retriever { search(query: string, k: number): Promise<Passage[]> }
// Returns the id of the passage that answers the question, or '' when none does.
export interface Judge {
  pick(question: string, passages: Passage[]): Promise<string>;
  // Optional: which sentences of the chosen passage answer the question (indices). Without it, shortQuote decides.
  sentences?(question: string, sentences: string[]): Promise<number[]>;
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
  async lookup(q: string): Promise<string> {
    const hits = await this.retriever.search(q, 4);
    const id = hits.length ? await this.judge.pick(q, hits) : '';
    const p = hits.find(h => h.id === id);
    this.last = p;
    this.lastQuote = [];
    if (!p) return this.manual.unknown ?? NO_ANSWER;
    if (p.cite) return `${p.cite.title} says: "${await this.quote(p.text, q)}"`;
    return `The manual says${p.page ? ` (page ${p.page})` : ''}: "${await this.quote(p.text, q)}"`;
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

// Jev decides whether one of the passages answers the question. Locked to Jev models like JevGate.
export class JevJudge implements Judge {
  calls = 0;
  cost = 0;
  // Why the last call got no answer from Jev (HTTP status, timeout); empty when Jev answered. Lets a caller tell
  // "no passage answers" apart from "Jev was down" and fall back.
  lastError = '';
  private key?: string;
  private url: string;
  constructor(opts: { key?: string; url?: string } = {}) {
    this.key = opts.key ?? process.env.OPENROUTER_JEV_KEY;
    this.url = opts.url ?? process.env.JEV_URL ?? 'https://openrouter.ai/api/alpha/decisions';
  }
  async pick(question: string, passages: Passage[]): Promise<string> {
    if (!this.key || !passages.length) return '';
    const criteria: Record<string, string> = { none: 'None of the passages answers the question' };
    passages.forEach((p, i) => { criteria[`p${i}`] = `This passage answers the question: "${p.text}"`; });
    try {
      const j = await this.decide({
        model: 'typesafe/jev-1.14',
        state: { question },
        questions: { source: { type: 'choice', criteria, instructions: 'Pick the passage that directly answers the question. Pick none if no passage does; a passage on the same topic that does not answer it is none.' } },
      });
      if (!j) return '';
      this.calls++; this.cost += j.usage?.cost ?? 0;
      const a = j.answers?.source;
      const i = typeof a?.choice === 'string' && a.choice.startsWith('p') ? +a.choice.slice(1) : -1;
      // Two passages can both answer, which splits Jev's confidence between them; what matters is how sure it is
      // that SOME passage answers, so the gate is the probability of "none".
      const none = a?.probabilities?.none ?? 1;
      return i >= 0 && none <= 0.25 ? passages[i]?.id ?? '' : '';
    } catch { return ''; }
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
