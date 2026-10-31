// The demo backend: the only place the keys live. It runs unchanged in Node (server.ts, locally or on the MacBook Pro)
// and as a Cloudflare Pages Function (functions/api/[[path]].ts). It lends the in-page engine three narrow things:
//   POST /api/understand  Jev's on-topic gate for one free-text answer (inner model: rules, or a local LFM at LLAMA_URL)
//   POST /api/search      Octo RAG search inside one allow-listed demo manual; every passage comes back signed
//   POST /api/judge       Jev picks which signed passage answers the question (or none)
//   POST /api/log         an error from the widget in a visitor's browser, written to the server log
//   POST /api/sentences   Jev picks the answering sentences of a signed passage
//   POST /api/trace      timings the widget measured (speech to text, voice, turn, call end), sent on to Phoenix
//   POST /api/warm        wakes the local LFM (it sleeps when idle) while the call's greeting plays; never calls Jev
// Nothing here decides what the copilot does; it only answers those questions. Requests are size- and rate-limited, and
// Jev calls have a daily cap, so the open demo can't be used as a free model relay.
import type { ExportTrace, SpanSpec } from './tracing.ts';
import { JevJudge, KeywordRetriever, OctoRetriever, OverlapJudge, type Judge, type Passage, type Retriever } from '../../copilot-engine/src/guide.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import type { Field, FieldKind, Flow, Model } from '../../copilot-engine/src/types.ts';

export type ApiEnv = {
  OPENROUTER_JEV_KEY?: string; OCTO_KEY?: string; OCTO_WORKSPACE?: string; JEV_URL?: string; OCTO_BASE?: string; OCTO_TRACES?: string;
  SIGNING_SECRET?: string; LLAMA_URL?: string; OFFLINE?: string; JEV_DAILY_CAP?: string; RATE_PER_MIN?: string;
};

// Only the fictional demo manuals can be searched.
export const MANUALS: Record<string, string> = { 'demo-hdw500': 'manual:demo-hdw500 ', 'demo-r17': 'manual:demo-r17 ' };
const KINDS: FieldKind[] = ['text', 'name', 'serial', 'choice', 'email', 'phone'];
const JEV_URL = 'https://openrouter.ai/api/alpha/decisions';

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// offlinePassages: the same passages as in Octo, for running with no keys (keyword search + word-overlap judge).
// One line per problem, to stdout (the systemd journal on gravebuster). Never keys, never what a visitor typed.
const log = (msg: string) => console.error(`${new Date().toISOString()} ${msg.replace(/\s+/g, ' ')}`);

const WARM_FIELD: Field = { name: 'warm', label: 'warm-up', question: 'Say hello.', kind: 'text' };

export function createApi(env: ApiEnv, opts: { offlinePassages?: Record<string, Passage[]>; trace?: ExportTrace } = {}) {
  const offline = env.OFFLINE === '1';
  if (!offline && !(env.OPENROUTER_JEV_KEY && env.OCTO_KEY && env.OCTO_WORKSPACE)) throw new Error('missing OPENROUTER_JEV_KEY, OCTO_KEY or OCTO_WORKSPACE (or set OFFLINE=1)');
  const jevUrl = env.JEV_URL || JEV_URL;
  const inner: Model = env.LLAMA_URL ? new LlamaModel(env.LLAMA_URL, 'lfm') : new RuleModel();
  const gate = offline ? null : new JevGate(inner, { key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  const jev = offline ? null : new JevJudge({ key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  const overlap = new OverlapJudge();
  // When Jev is overloaded or down, the word-overlap judge stands in, so a covered question isn't answered "I don't know".
  const judge: Judge = !jev ? overlap : {
    async pick(q, ps) {
      const id = await jev.pick(q, ps);
      if (!jev.lastError) return id;
      log(`judge: ${jev.lastError}, using word overlap`);
      return overlap.pick(q, ps);
    },
    async sentences(q, ss) {
      const idx = await jev.sentences(q, ss);
      if (!jev.lastError) return idx;
      log(`sentences: ${jev.lastError}, using word overlap`);
      return overlap.sentences ? overlap.sentences(q, ss) : [];
    },
  };
  const retrievers = new Map<string, Retriever>();
  const retriever = (label: string): Retriever => {
    let r = retrievers.get(label);
    if (!r) {
      r = offline ? new KeywordRetriever(opts.offlinePassages?.[label] ?? [])
        : new OctoRetriever({ base: env.OCTO_BASE, key: env.OCTO_KEY!, workspaceId: env.OCTO_WORKSPACE!, titlePrefix: MANUALS[label], overfetch: 10 });
      retrievers.set(label, r);
    }
    return r;
  };

  // Passages are signed when handed out and checked when they come back, so Jev only ever judges real manual text.
  const keyP = crypto.subtle.importKey('raw', env.SIGNING_SECRET ? new TextEncoder().encode(env.SIGNING_SECRET) : crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sign = async (p: Passage) => {
    const mac = await crypto.subtle.sign('HMAC', await keyP, new TextEncoder().encode(`${p.id}\n${p.page ?? ''}\n${p.text}`));
    return Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, '0')).join('');
  };
  const genuine = async (p: any): Promise<Passage | null> => {
    if (!p || typeof p.text !== 'string' || typeof p.id !== 'string' || typeof p.sig !== 'string') return null;
    const q: Passage = { id: p.id, text: p.text, page: typeof p.page === 'number' ? p.page : undefined };
    return (await sign(q)) === p.sig ? q : null;
  };

  // Per-visitor rate limit and a daily cap on Jev calls (judge + gate), counted per running instance.
  const hits = new Map<string, number[]>();
  const perMin = Number(env.RATE_PER_MIN) || 40;
  const cap = Number(env.JEV_DAILY_CAP) || 2000;
  let day = '', jevToday = 0;
  let warming: Promise<void> | null = null;
  const jevAllowed = () => {
    const d = new Date().toISOString().slice(0, 10);
    if (d !== day) { day = d; jevToday = 0; }
    return jevToday++ < cap;
  };
  const limited = (ip: string) => {
    const now = Date.now();
    const h = (hits.get(ip) ?? []).filter(t => now - t < 60_000);
    h.push(now);
    hits.set(ip, h);
    if (hits.size > 5000) hits.clear();
    return h.length > perMin;
  };

  async function route(path: string, b: any, session: string | null = null): Promise<Response> {
    if (path === '/api/understand') {
      const said = clip(b.said, 500);
      const kind = KINDS.includes(b.field?.kind) ? b.field.kind : 'text';
      const field: Field = { name: clip(b.field?.name, 40) || 'f', label: clip(b.field?.label, 120), question: clip(b.field?.question, 300), kind };
      const flow: Flow = { id: 'remote', business: clip(b.flow?.business, 80), scope: clip(b.flow?.scope, 200), intro: '', doneMessage: '', fields: [field] };
      const values: Record<string, string> = {};
      for (const k of Object.keys(b.values ?? {}).slice(0, 30)) values[clip(k, 40)] = clip(b.values[k], 200);
      const m = gate && jevAllowed() ? gate : inner;
      return json(await m.understand({ flow, field, said, values }));
    }
    if (path === '/api/search') {
      const label = clip(b.manual, 40);
      if (!MANUALS[label]) return json({ error: 'unknown manual' }, 400);
      const ps = await retriever(label).search(clip(b.query, 300), Math.min(Math.max(Number(b.k) || 4, 1), 6));
      return json({ passages: await Promise.all(ps.map(async p => ({ ...p, sig: await sign(p) }))) });
    }
    if (path === '/api/judge') {
      const ps = (await Promise.all((Array.isArray(b.passages) ? b.passages.slice(0, 6) : []).map(genuine))).filter(Boolean) as Passage[];
      if (!ps.length || (!offline && !jevAllowed())) return json({ id: '' });
      return json({ id: await judge.pick(clip(b.question, 300), ps) });
    }
    if (path === '/api/sentences') {
      const p = await genuine(b.passage);
      const sents: string[] = Array.isArray(b.sentences) ? b.sentences.slice(0, 20).map((s: unknown) => clip(s, 600)) : [];
      // Only sentences of that signed passage may be sent on.
      if (!p || !judge.sentences || !sents.length || !sents.every(s => s && p.text.includes(s)) || !jevAllowed()) return json({ idx: [] });
      return json({ idx: await judge.sentences(clip(b.question, 300), sents) });
    }
    if (path === '/api/warm') {
      // One tiny call to the local model so it loads now, not on the visitor's first answer. At most one at a time.
      if (offline || !env.LLAMA_URL) return json({ ok: true, model: 'rules' });
      warming ??= inner.understand({
        flow: { id: 'warm', business: 'warm-up', scope: '', intro: '', doneMessage: '', fields: [WARM_FIELD] },
        field: WARM_FIELD, said: 'hello', values: {},
      }).then(() => undefined, () => undefined).finally(() => { warming = null; });
      await warming;
      return json({ ok: true, model: 'lfm' });
    }
    if (path === '/api/trace') {
      // Spans the widget timed itself; times must be within the last 10 minutes.
      const now = Date.now();
      for (const sp of Array.isArray(b.spans) ? b.spans.slice(0, 10) : []) {
        const start = Number(sp?.start), end = Number(sp?.end);
        if (!(start > now - 600_000 && end >= start && end <= now + 60_000)) continue;
        const attributes: Record<string, string | number> = { 'input.value': clip(sp.input, 2000), 'output.value': clip(sp.output, 2000) };
        for (const [k, v] of Object.entries(sp.attrs ?? {}).slice(0, 10)) if (typeof v === 'string' || typeof v === 'number') attributes[clip(k, 40)] = typeof v === 'string' ? clip(v, 300) : v;
        opts.trace?.({ name: clip(sp.name, 40) || 'widget', kind: 'CHAIN', start, end, error: !!sp.error, attributes }, session);
      }
      return json({ ok: true });
    }
    if (path === '/api/log') {
      // Errors the widget hit in a visitor's browser (speech, page errors), so real failures show up in the journal.
      log(`client ${clip(b.where, 40)}: ${clip(b.message, 300)} | ${clip(b.page, 80)} | ${clip(b.ua, 160)}`);
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }

  // One trace per backend call, after it answered, so tracing never slows a reply.
  async function traceCall(path: string, b: any, r: Response, start: number, session: string | null) {
    const kind: SpanSpec['kind'] = path === '/api/search' ? 'RETRIEVER' : 'LLM';
    const out = await r.text();
    let o: any = {};
    try { o = JSON.parse(out); } catch { /* not json */ }
    const attributes: Record<string, string | number> = {
      'input.value': path === '/api/understand' ? `${clip(b.field?.label, 120)}: ${clip(b.said, 500)}` : clip(b.query ?? b.question, 500),
      'output.value': out.slice(0, 2000),
      'http.status_code': r.status,
    };
    if (path === '/api/search') (o.passages ?? []).slice(0, 6).forEach((p: any, i: number) => {
      attributes[`retrieval.documents.${i}.document.id`] = clip(p.id, 200);
      attributes[`retrieval.documents.${i}.document.content`] = clip(p.text, 1000);
    });
    opts.trace!({ name: path.slice(5), kind, start, end: Date.now(), error: r.status >= 400, attributes }, session);
  }

  return {
    mode: offline ? 'offline (keyword search, word-overlap judge, rules)' : `live (Octo RAG, Jev ${env.LLAMA_URL ? '+ local LFM' : '+ rules'})`,
    async handle(req: Request, ip = ''): Promise<Response> {
      const path = new URL(req.url).pathname;
      if (path === '/api/health') return json({ ok: true, mode: offline ? 'offline' : 'live' });
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      // The warm-up is free (no Jev, one at a time), so it does not use up the visitor's answers; so is /api/trace.
      if (path !== '/api/warm' && path !== '/api/trace' && limited(ip || req.headers.get('cf-connecting-ip') || 'local')) { log(`${path} 429 rate limit`); return json({ error: 'slow down' }, 429); }
      const raw = await req.text();
      if (raw.length > 32_000) { log(`${path} 413`); return json({ error: 'too large' }, 413); }
      let b: any;
      try { b = JSON.parse(raw); } catch { log(`${path} 400 bad json`); return json({ error: 'bad json' }, 400); }
      const sid = req.headers.get('x-session-id');
      const session = sid && /^[\w-]{8,64}$/.test(sid) ? sid : null;
      const started = Date.now();
      try {
        const r = await route(path, b, session);
        if (r.status >= 400) log(`${path} ${r.status}`);
        if (opts.trace && ['/api/understand', '/api/search', '/api/judge', '/api/sentences'].includes(path)) void traceCall(path, b, r.clone(), started, session).catch(() => {});
        return r;
      } catch (e) {
        log(`${path} failed: ${(e as Error).stack ?? e}`);
        return json({ error: 'backend error' }, 502);
      }
    },
  };
}
