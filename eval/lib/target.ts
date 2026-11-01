// The system under test, built from the same parts the site ships: Octo search (the library's title prefixes, the
// reranker on, as the copilot uses it), Jev's passage pick and sentence pick with the word-overlap fallback, the
// widget's advice check, and the Guide that only ever quotes. Each ask records what plain checks need: the top 10
// search hits (for recall@5 / MRR), the passage it cited and the exact sentences it quoted.
import fs from 'node:fs';
import path from 'node:path';
import { Guide, JevJudge, OctoRetriever, OverlapJudge, type Judge, type Passage, type Retriever } from '../../copilot-engine/src/guide.ts';
import { Dialogue } from '../../copilot-engine/src/dialogue.ts';
import { Copilot } from '../../copilot-engine/src/engine.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import type { Flow } from '../../copilot-engine/src/types.ts';
import { key } from './env.ts';
import { octoBase, type Config } from './corpus.ts';
import { usage } from './llm.ts';

export type Answer = {
  reply: string;
  kind: 'answer' | 'unknown' | 'no-search' | 'deflected' | 'clarify' | 'error';
  cite?: { id: string; title?: string; url?: string };
  citedId?: string;           // the cited passage's own id in the store (cite.id is its title when it has one)
  quote: string[];            // the sentences read out, each meant to be word for word from the cited passage
  citedText?: string;         // the cited passage's text, for the "quote is really in the passage" check
  hits: string[];             // ids of the top 10 search hits, in rank order
  searchMs: number;
  ms: number;
};

export function adviceCheck(cfg: Config, root: string): RegExp | null {
  const a = cfg.target.advice;
  if (!a) return null;
  const src = fs.readFileSync(path.resolve(root, a.file), 'utf8');
  const [, body, flags] = src.match(new RegExp(a.pattern, 'm'))![1].match(/^\/(.*)\/([a-z]*)$/s)!;
  return new RegExp(body, flags);
}

export function makeTarget(cfg: Config, root: string) {
  const t = cfg.target;
  const octo = new OctoRetriever({ base: octoBase(), key: key('OCTO_KEY', 'octo_db_chatbots')!, workspaceId: key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace')!,
    titlePrefix: t.retriever.prefixes, rerank: t.retriever.rerank, timeoutMs: t.retriever.timeoutMs });
  const jevJ = new JevJudge({ key: key('OPENROUTER_JEV_KEY', 'openrouter_jev_only') });
  const overlap = new OverlapJudge();
  const advice = adviceCheck(cfg, root);
  const book = { id: cfg.corpus, title: cfg.name, business: cfg.form?.business ?? cfg.name, steps: [], passages: [], unknown: t.unknown };
  const tally = (what: string, ms: number) => { const u = (usage[what] ??= { calls: 0, cost: 0, ms: 0, failed: 0 }); u.calls++; u.ms += ms; };

  // One question, answered the way the site answers it. Search results are cached per question text, so the
  // retrieval suite and the answer suite never pay for the same search twice.
  const searches = new Map<string, Promise<Passage[]>>();
  // poison: an instruction planted inside a passage (the injection trap). It is appended to the top hit, the way a
  // tampered or hostile document would arrive from the store.
  async function ask(said: string, opts: { poison?: string } = {}): Promise<Answer> {
    const t0 = Date.now();
    if (advice?.test(said)) return { reply: t.advice.reply, kind: 'deflected', quote: [], hits: [], searchMs: 0, ms: 0 };
    // The site asks back before it quotes when a question is too vague (copilot-engine/src/dialogue.ts); one dialogue per ask here.
    const dialogue = new Dialogue();
    const asked = opts.poison ? null : dialogue.clarify(said);
    if (asked) return { reply: asked, kind: 'clarify', quote: [], hits: [], searchMs: 0, ms: Date.now() - t0 };
    let searchMs = 0, top: Passage[] = [];
    const retriever: Retriever = { async search(q) {
      if (!searches.has(q)) searches.set(q, (async () => { const s0 = Date.now(); const r = await octo.search(q, 10); searchMs = Date.now() - s0; tally('octo search', searchMs); return r; })());
      top = await searches.get(q)!;
      const four = top.slice(0, 4);
      return opts.poison && four[0] ? [{ ...four[0], text: `${four[0].text} ${opts.poison}` }, ...four.slice(1)] : four;
    } };
    const before = jevJ.cost;
    const judge: Judge = {
      lastProbs: undefined as Record<string, number> | undefined,
      async pick(q, ps) {
        const r = await jevJ.choose(q, ps);
        this.lastProbs = r.error ? undefined : r.probs;
        return r.error ? overlap.pick(q, ps) : r.id;
      },
      async sentences(q, ss) { const i = await jevJ.sentences(q, ss); return jevJ.lastError ? [] : i; },
    };
    const g = new Guide(book as any, retriever, judge);
    let reply: string;
    try { reply = await g.lookup(said); } catch (e) { return { reply: String(e), kind: 'error', quote: [], hits: [], searchMs, ms: Date.now() - t0 }; }
    const u = (usage['jev (target)'] ??= { calls: 0, cost: 0, ms: 0, failed: 0 });
    u.cost += jevJ.cost - before;
    const hits = top.map(p => String(p.title ?? p.id));
    const p = g.last;
    // two passages nearly as likely to answer a short question: ask which it means, as the site does
    const split = !opts.poison && g.lastSplit ? dialogue.splitAsk(said, g.lastSplit) : null;
    if (split) return { reply: split, kind: 'clarify', quote: [], hits, searchMs, ms: Date.now() - t0 };
    return {
      reply, kind: p ? 'answer' : (top.length ? 'unknown' : 'no-search'), quote: g.lastQuote,
      cite: p ? { id: String(p.title ?? p.id), title: p.cite?.title ?? p.title, url: p.cite?.url } : undefined,
      citedId: p?.id, citedText: p?.text, hits, searchMs, ms: Date.now() - t0,
    };
  }
  return { ask, advice };
}

// The form flow, run by the real engine with the site's understanding model: Jev's on-topic gate in front of a local
// LFM (form.llamaUrl) or, without one, the rules (the site's setup when LLAMA_URL is unset).
// submit() is the hand-back on a site where the person presses the button; fills record what was typed, so a check
// can see a read-back before each kept value.
export function makeForm(cfg: Config) {
  const flow = cfg.form as Flow;
  const inner = cfg.form.llamaUrl ? new LlamaModel(cfg.form.llamaUrl, 'lfm') : new RuleModel();
  const model = new JevGate(inner, { key: key('OPENROUTER_JEV_KEY', 'openrouter_jev_only') });
  const events: { type: 'fill' | 'submit'; field?: string; value?: string; turn: number }[] = [];
  let turn = 0;
  const c = new Copilot(flow, model, {
    submit: () => { events.push({ type: 'submit', turn }); },
    fill: (f, v) => { events.push({ type: 'fill', field: f.name, value: v, turn }); },
  });
  return {
    start: () => c.start(),
    turn: async (said: string) => { turn++; return c.turn(said); },
    events, copilot: c, flow,
  };
}
