// The demo backend: the only place the keys live. It runs unchanged in Node (server.ts, locally or on the MacBook Pro)
// and as a Cloudflare Pages Function (functions/api/[[path]].ts). It lends the in-page engine three narrow things:
//   POST /api/understand  Jev's on-topic gate for one free-text answer (inner model: rules, or a local LFM at LLAMA_URL)
//   POST /api/search      Octo RAG search inside one allow-listed demo manual; every passage comes back signed
//   POST /api/judge       Jev picks which signed passage answers the question (or none)
//   POST /api/sentences   Jev picks the answering sentences of a signed passage
// Nothing here decides what the copilot does; it only answers those questions. Requests are size- and rate-limited, and
// Jev calls have a daily cap, so the open demo can't be used as a free model relay.
import { JevJudge, KeywordRetriever, OctoRetriever, OverlapJudge, type Judge, type Passage, type Retriever } from '../../copilot-engine/src/guide.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import type { Field, FieldKind, Flow, Model } from '../../copilot-engine/src/types.ts';

export type ApiEnv = {
  OPENROUTER_JEV_KEY?: string; OCTO_KEY?: string; OCTO_WORKSPACE?: string; JEV_URL?: string; OCTO_BASE?: string;
  SIGNING_SECRET?: string; LLAMA_URL?: string; OFFLINE?: string; JEV_DAILY_CAP?: string; RATE_PER_MIN?: string;
};

// Only the fictional demo manuals can be searched.
export const MANUALS: Record<string, string> = { 'demo-hdw500': 'manual:demo-hdw500 ', 'demo-r17': 'manual:demo-r17 ' };
const KINDS: FieldKind[] = ['text', 'name', 'serial', 'choice', 'email', 'phone'];
const JEV_URL = 'https://openrouter.ai/api/alpha/decisions';

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// offlinePassages: the same passages as in Octo, for running with no keys (keyword search + word-overlap judge).
export function createApi(env: ApiEnv, opts: { offlinePassages?: Record<string, Passage[]> } = {}) {
  const offline = env.OFFLINE === '1';
  if (!offline && !(env.OPENROUTER_JEV_KEY && env.OCTO_KEY && env.OCTO_WORKSPACE)) throw new Error('missing OPENROUTER_JEV_KEY, OCTO_KEY or OCTO_WORKSPACE (or set OFFLINE=1)');
  const jevUrl = env.JEV_URL || JEV_URL;
  const inner: Model = env.LLAMA_URL ? new LlamaModel(env.LLAMA_URL, 'lfm') : new RuleModel();
  const gate = offline ? null : new JevGate(inner, { key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  const judge: Judge = offline ? new OverlapJudge() : new JevJudge({ key: env.OPENROUTER_JEV_KEY, url: jevUrl });
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

  async function route(path: string, b: any): Promise<Response> {
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
    return json({ error: 'not found' }, 404);
  }

  return {
    mode: offline ? 'offline (keyword search, word-overlap judge, rules)' : `live (Octo RAG, Jev ${env.LLAMA_URL ? '+ local LFM' : '+ rules'})`,
    async handle(req: Request, ip = ''): Promise<Response> {
      const path = new URL(req.url).pathname;
      if (path === '/api/health') return json({ ok: true, mode: offline ? 'offline' : 'live' });
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      if (limited(ip || req.headers.get('cf-connecting-ip') || 'local')) return json({ error: 'slow down' }, 429);
      const raw = await req.text();
      if (raw.length > 32_000) return json({ error: 'too large' }, 413);
      let b: any;
      try { b = JSON.parse(raw); } catch { return json({ error: 'bad json' }, 400); }
      try { return await route(path, b); } catch { return json({ error: 'backend error' }, 502); }
    },
  };
}
