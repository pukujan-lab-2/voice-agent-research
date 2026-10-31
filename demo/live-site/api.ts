// The demo backend: the only place the keys live. It runs unchanged in Node (server.ts, locally or on the MacBook Pro)
// and as a Cloudflare Pages Function (functions/api/[[path]].ts). It lends the in-page engine three narrow things:
//   POST /api/understand  Jev's on-topic gate for one free-text answer (inner model: rules, or a local LFM at LLAMA_URL)
//   POST /api/search      Octo RAG search inside one allow-listed demo manual; every passage comes back signed
//   POST /api/judge       Jev picks which signed passage answers the question (or none)
//   POST /api/log         an error from the widget in a visitor's browser, written to the server log
//   POST /api/sentences   Jev picks the answering sentences of a signed passage
//   POST /api/warm        wakes the local LFM (it sleeps when idle) while the call's greeting plays; never calls Jev
//   GET  /api/library/…   the tax library, all from Octo: search, docs (the list), doc?doc= (one source: its sections, or
//                         the article body of a web-page source), pdf?doc= (a publication's printed PDF), faq
// Nothing here decides what the copilot does; it only answers those questions. Requests are size- and rate-limited, and
// Jev calls have a daily cap, so the open demo can't be used as a free model relay.
import { JevJudge, KeywordRetriever, OctoRetriever, OverlapJudge, type Judge, type Passage, type Retriever } from '../../copilot-engine/src/guide.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import type { Field, FieldKind, Flow, Model } from '../../copilot-engine/src/types.ts';

export type ApiEnv = {
  OPENROUTER_JEV_KEY?: string; OCTO_KEY?: string; OCTO_WORKSPACE?: string; JEV_URL?: string; OCTO_BASE?: string; OCTO_TIMEOUT_MS?: string;
  SIGNING_SECRET?: string; LLAMA_URL?: string; OFFLINE?: string; JEV_DAILY_CAP?: string; RATE_PER_MIN?: string;
};

// Only the fictional demo manuals and the IRS library (public-domain IRS.gov pages, data/irs.passages.json) can be searched.
export const MANUALS: Record<string, string> = { 'demo-hdw500': 'manual:demo-hdw500 ', 'demo-r17': 'manual:demo-r17 ', irs: 'irs/' };
// The tax library's search prefixes: IRS pages, publications and forms (irs/, irs/forms/), the Internal Revenue Code
// (irc/), Treasury regulations (cfr/), the Internal Revenue Manual (irm/) and Internal Revenue Bulletin items (irb/).
const LIBRARY = ['irs/', 'irc/', 'cfr/', 'irm/', 'irb/'];
// The library list's order: the firm's everyday sources first, then the law; sections in number order (§ 2 before § 11).
const ORDER = ['publications', 'instructions', 'taxtopics', 'forms', 'code', 'regulations', 'irm', 'bulletins'];
const CATEGORIES: Record<string, string> = { publications: 'IRS publications', instructions: 'Form instructions', taxtopics: 'Tax Topics', faqs: 'IRS FAQ pages',
  forms: 'IRS forms and instructions (PDF)', code: 'Internal Revenue Code (Title 26)', regulations: 'Treasury regulations (26 CFR)',
  irm: 'Internal Revenue Manual', bulletins: 'Internal Revenue Bulletins' };
type LibraryPassage = Passage & { source?: string; section?: string; url?: string; faq?: string };
const KINDS: FieldKind[] = ['text', 'name', 'serial', 'choice', 'email', 'phone'];
const JEV_URL = 'https://openrouter.ai/api/alpha/decisions';

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// offlinePassages: the same passages as in Octo, for running with no keys (keyword search + word-overlap judge).
// One line per problem, to stdout (the systemd journal on gravebuster). Never keys, never what a visitor typed.
const log = (msg: string) => console.error(`${new Date().toISOString()} ${msg.replace(/\s+/g, ' ')}`);

const WARM_FIELD: Field = { name: 'warm', label: 'warm-up', question: 'Say hello.', kind: 'text' };

export function createApi(env: ApiEnv, opts: { offlinePassages?: Record<string, LibraryPassage[]> } = {}) {
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
  // Octo is the one store for the tax library: search (RAG), and the irs_docs / irs_passages tables in the workspace's
  // own Postgres for each passage's source, section, link and PDF page, each source's sections and article body, and
  // the PDF files (tools/irs_store.py puts them there). Offline runs (no keys) use the local manifest instead.
  const octoBase = env.OCTO_BASE || 'https://octodb.design-bakery.com/api';
  const octo = async (path: string, body?: unknown) => {
    const r = await fetch(`${octoBase}${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${env.OCTO_KEY}`, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`octo ${path.split('?')[0]} ${r.status}`);
    return r;
  };
  const sql = async (text: string, params: unknown[] = []): Promise<any[]> =>
    (await (await octo(`/workspaces/${env.OCTO_WORKSPACE}/query`, { sql: text, ...(params.length ? { params } : {}) })).json()).rows ?? [];

  // A library passage's citation ("IRS Pub 17, Filing Requirements", its irs.gov link, the PDF page) by the passage's id
  // (its Octo document title), so a citation is always the real source.
  type Row = { id: string; source: string; section: string; url: string; doc: string; anchor: string | null; page: number | null; faq: string | null };
  const citeOf = (p: Row): Passage['cite'] => {
    // the most specific heading that names a topic (not a "Note:" or "Tip" box, not the book's "Additional Material")
    let topic = (p.section ?? '').split(' › ').filter(h => !/^(Note|Tip|Caution|Example|Exception)s?:?$|^(Publication|Instructions for Form) [\w-]+ - /i.test(h)).pop();
    // "§ 61. Gross income defined" under "26 U.S.C. § 61", "Form 1040, page 3" under "Form 1040": say the number once
    if (topic?.startsWith(p.source)) topic = topic.slice(p.source.length).replace(/^[,.:\s]+/, '');
    topic = topic?.replace(/^(§\s*[\w.()-]+\.?|IRM [\d.]+)\s+/, '');
    const title = p.source === 'IRS FAQ' ? 'The IRS.gov FAQ' : topic ? `${p.source}, ${topic}` : p.source;
    return { title, url: p.url, doc: p.doc, anchor: p.faq ?? p.anchor ?? undefined };
  };
  const local = new Map<string, Row>();
  for (const p of opts.offlinePassages?.irs ?? []) {
    if (!p.url) continue;
    local.set(p.id, { id: p.id, source: p.source ?? '', section: p.section ?? '', url: p.url, doc: p.faq ? p.faq.replace(/-q\d+$/, '') : p.id.slice(4).split(' #')[0],
      anchor: p.url.split('#')[1] || null, page: null, faq: p.faq ?? null });
  }
  const rows = async (ids: string[]): Promise<Map<string, Row>> => {
    if (offline) return new Map(ids.filter(id => local.has(id)).map(id => [id, local.get(id)!]));
    const rs = await sql(`select p.id, d.source, p.section, p.url, p.doc, p.anchor, p.page, p.faq from irs_passages p join irs_docs d using (doc) where p.id = any($1)`, [ids]);
    return new Map(rs.map((r: Row) => [r.id, r]));
  };
  const retrievers = new Map<string, Retriever>();
  const retriever = (label: string): Retriever => {
    let r = retrievers.get(label);
    const lib = label === 'irs' || label === 'irs-fast';
    if (!r) {
      const base: Retriever = offline ? new KeywordRetriever(opts.offlinePassages?.[label] ?? [])
        : new OctoRetriever({ base: env.OCTO_BASE, key: env.OCTO_KEY!, workspaceId: env.OCTO_WORKSPACE!, titlePrefix: lib ? LIBRARY : MANUALS[label],
          // the site's own search box skips Octo's reranker (faster); the copilot's answers keep it (more precise)
          rerank: label === 'irs-fast' ? false : undefined, timeoutMs: Number(env.OCTO_TIMEOUT_MS) || undefined });
      r = !lib ? base : {
        async search(q, k) {
          const found = await base.search(q, k);
          const meta = await rows(found.map(p => p.title ?? p.id));
          return found.flatMap(p => {
            const r = meta.get(p.title ?? p.id);
            if (!r) return [];
            // Octo holds "<source>: <section>" as each passage's first line, for search; the quote is the text alone.
            const head = `${r.source}: ${r.section}\n`;
            return [{ id: p.id, text: p.text.startsWith(head) ? p.text.slice(head.length).trim() : p.text, page: r.page ?? undefined, cite: citeOf(r) }];
          });
        },
      };
      retrievers.set(label, r);
    }
    return r;
  };

  // Passages are signed when handed out and checked when they come back, so Jev only ever judges real manual text.
  const keyP = crypto.subtle.importKey('raw', env.SIGNING_SECRET ? new TextEncoder().encode(env.SIGNING_SECRET) : crypto.getRandomValues(new Uint8Array(32)),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sign = async (p: Passage) => {
    const mac = await crypto.subtle.sign('HMAC', await keyP, new TextEncoder().encode(`${p.id}\n${p.page ?? ''}\n${p.text}\n${p.cite?.title ?? ''}\n${p.cite?.url ?? ''}\n${p.cite?.doc ?? ''}\n${p.cite?.anchor ?? ''}`));
    return Array.from(new Uint8Array(mac), b => b.toString(16).padStart(2, '0')).join('');
  };
  const genuine = async (p: any): Promise<Passage | null> => {
    if (!p || typeof p.text !== 'string' || typeof p.id !== 'string' || typeof p.sig !== 'string') return null;
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const cite = p.cite && typeof p.cite.title === 'string' && typeof p.cite.url === 'string'
      ? { title: p.cite.title, url: p.cite.url, doc: str(p.cite.doc), anchor: str(p.cite.anchor) } : undefined;
    const q: Passage = { id: p.id, text: p.text, page: typeof p.page === 'number' ? p.page : undefined, cite };
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

  // The library's pages read from Octo. Lists and documents are cached a few minutes in memory; PDFs (a few MB each)
  // keep the last few, so paging through one guide doesn't fetch it again.
  const cache = new Map<string, { at: number; v: any }>();
  const cached = async <T>(key: string, ms: number, get: () => Promise<T>): Promise<T> => {
    const c = cache.get(key);
    if (c && Date.now() - c.at < ms) return c.v;
    const v = await get();
    cache.set(key, { at: Date.now(), v });
    if (cache.size > 400) cache.delete(cache.keys().next().value!);
    return v;
  };
  const pdfs = new Map<string, ArrayBuffer>();
  async function library(path: string, q: URLSearchParams): Promise<Response> {
    if (offline) return json({ error: 'the library needs Octo (run without --offline)' }, 503);
    const doc = clip(q.get('doc'), 120);
    if (q.has('doc') && !/^[a-z0-9][a-z0-9._-]*$/.test(doc)) return json({ error: 'bad doc' }, 400);
    const cacheFor = (r: Response, s: number) => { r.headers.set('Cache-Control', `public, max-age=${s}`); return r; };
    if (path === '/api/library/stats') {
      // Live counts while the library is still being loaded: searchable documents and passages per collection.
      const rows = await cached('stats', 30_000, () => sql(`select d.category, count(distinct p.doc)::int as docs, count(*)::int as passages
        from irs_passages p join irs_docs d using (doc) where p.indexed group by d.category`));
      const total = rows.reduce((t, r) => ({ docs: t.docs + r.docs, passages: t.passages + r.passages }), { docs: 0, passages: 0 });
      return cacheFor(json({ ...total, collections: rows.map(r => ({ ...r, name: CATEGORIES[r.category] ?? r.category })).sort((a, b) => b.docs - a.docs) }), 30);
    }
    if (path === '/api/library/docs') {
      // One page of a collection (there are tens of thousands of sources), optionally narrowed by words in the title.
      const cat = clip(q.get('category'), 40), words = clip(q.get('q'), 100).trim();
      const limit = Math.min(Math.max(Number(q.get('limit')) || 60, 1), 200), offset = Math.max(Number(q.get('offset')) || 0, 0);
      const where = [`category <> 'faqs'`, ...(cat ? [`category = $1`] : []), ...(words ? [`(title || ' ' || source) ilike $${cat ? 2 : 1}`] : [])].join(' and ');
      const params = [...(cat ? [cat] : []), ...(words ? [`%${words.replace(/[%_\\]/g, m => `\\${m}`)}%`] : [])];
      const key = `docs:${cat}:${words}:${offset}:${limit}`;
      const [docs, total] = await cached(key, 300_000, () => Promise.all([
        sql(`select doc, kind, source, title, url, category, pages from irs_docs where ${where} order by array_position($${params.length + 1}::text[], category), length(doc), doc limit ${limit} offset ${offset}`, [...params, ORDER]),
        sql(`select count(*)::int as n from irs_docs where ${where}`, params).then(r => r[0]?.n ?? 0)]));
      return cacheFor(json({ docs, total, offset, limit, categories: CATEGORIES }), 300);
    }
    if (path === '/api/library/faq') {
      const faq = await cached('faq', 600_000, () => sql(`select p.faq as id, min(p.section) as question, string_agg(p.text, ' ' order by p.seq) as answer, p.doc, d.title as category, min(p.url) as url
        from irs_passages p join irs_docs d using (doc) where p.faq is not null group by p.faq, p.doc, d.title order by p.doc, p.faq`));
      return cacheFor(json({ faq }), 600);
    }
    if (path === '/api/library/doc' && doc) {
      const d = (await cached(`doc:${doc}`, 600_000, () => sql(`select doc, kind, source, title, url, category, pages, sections, body from irs_docs where doc = $1`, [doc])))[0];
      if (!d) return json({ error: 'not found' }, 404);
      return cacheFor(json({ ...d, pdf: d.kind === 'pdf' ? `/api/library/pdf?doc=${doc}` : null }), 600);
    }
    if (path === '/api/library/pdf' && doc) {
      let bytes = pdfs.get(doc);
      if (!bytes) {
        const d = (await sql(`select file_id from irs_docs where doc = $1 and kind = 'pdf'`, [doc]))[0];
        if (!d?.file_id) return json({ error: 'not found' }, 404);
        bytes = await (await octo(`/files/content?workspaceId=${env.OCTO_WORKSPACE}&fileId=${d.file_id}`)).arrayBuffer();
        pdfs.set(doc, bytes);
        if (pdfs.size > 6) pdfs.delete(pdfs.keys().next().value!);
      }
      return new Response(bytes, { headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'public, max-age=86400', 'Content-Disposition': `inline; filename="${doc}.pdf"` } });
    }
    return json({ error: 'not found' }, 404);
  }

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
    if (path === '/api/log') {
      // Errors the widget hit in a visitor's browser (speech, page errors), so real failures show up in the journal.
      log(`client ${clip(b.where, 40)}: ${clip(b.message, 300)} | ${clip(b.page, 80)} | ${clip(b.ua, 160)}`);
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }

  return {
    mode: offline ? 'offline (keyword search, word-overlap judge, rules)' : `live (Octo RAG, Jev ${env.LLAMA_URL ? '+ local LFM' : '+ rules'})`,
    async handle(req: Request, ip = ''): Promise<Response> {
      const path = new URL(req.url).pathname;
      if (path === '/api/health') return json({ ok: true, mode: offline ? 'offline' : 'live' });
      if (path.startsWith('/api/library/') && path !== '/api/library/search' && req.method === 'GET') {
        if (limited(ip || req.headers.get('cf-connecting-ip') || 'local')) return json({ error: 'slow down' }, 429);
        try { return await library(path, new URL(req.url).searchParams); } catch (e) { log(`${path} failed: ${(e as Error).message}`); return json({ error: 'backend error' }, 502); }
      }
      if (path === '/api/library/search' && req.method === 'GET') {
        // The site's own library search (Tax Guides page): Octo search over the irs/ library, no model call.
        if (limited(ip || req.headers.get('cf-connecting-ip') || 'local')) return json({ error: 'slow down' }, 429);
        const u = new URL(req.url);
        const q = clip(u.searchParams.get('q'), 200).trim();
        if (!q) return json({ results: [] });
        const seen = new Set<string>();
        const ps = (await retriever(offline ? 'irs' : 'irs-fast').search(q, Math.min(Math.max(Number(u.searchParams.get('limit')) || 10, 1), 20)))
          .filter(p => { const k = `${p.cite!.doc}|${p.page ?? ''}|${p.cite!.title}`; return !seen.has(k) && !!seen.add(k); }); // one result per section and page
        return json({ results: ps.map(p => ({ doc: p.cite!.doc, page: p.page ?? null, anchor: p.cite!.anchor ?? null, title: p.cite!.title, href: p.cite!.url,
          snippet: p.text.length > 280 ? `${p.text.slice(0, 277).replace(/\s+\S*$/, '')}…` : p.text })) });
      }
      if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
      // The warm-up is free (no Jev, one at a time), so it does not use up the visitor's answers.
      if (path !== '/api/warm' && limited(ip || req.headers.get('cf-connecting-ip') || 'local')) { log(`${path} 429 rate limit`); return json({ error: 'slow down' }, 429); }
      const raw = await req.text();
      if (raw.length > 32_000) { log(`${path} 413`); return json({ error: 'too large' }, 413); }
      let b: any;
      try { b = JSON.parse(raw); } catch { log(`${path} 400 bad json`); return json({ error: 'bad json' }, 400); }
      try {
        const r = await route(path, b);
        if (r.status >= 400) log(`${path} ${r.status}`);
        return r;
      } catch (e) {
        log(`${path} failed: ${(e as Error).stack ?? e}`);
        return json({ error: 'backend error' }, 502);
      }
    },
  };
}
