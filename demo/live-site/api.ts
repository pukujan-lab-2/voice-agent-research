// The demo backend: the only place the keys live. It runs unchanged in Node (server.ts, locally or on the MacBook Pro)
// and as a Cloudflare Pages Function (functions/api/[[path]].ts). It lends the in-page engine three narrow things:
//   POST /api/understand  Jev's on-topic gate for one free-text answer (inner model: rules, or a local LFM at LLAMA_URL)
//   POST /api/desk        one turn of the v2 desk's model: LFM3 at LLAMA_URL, with only the desk's own tools (decision 0009)
//   POST /api/search      Octo RAG search inside one allow-listed demo manual; every passage comes back signed
//   POST /api/judge       Jev picks which signed passage answers the question (or none)
//   POST /api/log         an error from the widget in a visitor's browser, written to the server log
//   POST /api/sentences   Jev picks the answering sentences of a signed passage
//   POST /api/trace      what the widget recorded (the call, each turn with its tool calls, confirmations, failures), to Phoenix
//   POST /api/score      an automated eval's score for a call or one of its turns (docs/decisions/0005), to Phoenix
//   POST /api/warm        wakes the local LFM (it sleeps when idle) while the call's greeting plays; never calls Jev
//   POST /api/verify      caller verification: the caller's confirmed name, date of birth, last four and zip are compared
//                         here with the fictional client list in Octo; the answer is only match / no_match / need_more /
//                         locked. Nothing on file is ever sent back, and 3 failed tries lock verification for that call.
//   POST /api/account/status  the verified caller's (fictional) return status card
//   GET  /api/library/…   the tax library, all from Octo: search, docs (the list), doc?doc= (one source: its sections, or
//                         the article body of a web-page source), pdf?doc= (a publication's printed PDF), faq
// Nothing here decides what the copilot does; it only answers those questions. Requests are size- and rate-limited, and
// Jev calls have a daily cap, so the open demo can't be used as a free model relay.
import { createPractice } from './practice-api.ts';
import type { EvalScore, ExportTrace, SpanKind, SpanSpec } from './tracing.ts';
import { lfm3AudioChat, OpenAIChat, type ChatMsg } from '../../copilot-engine/src/desk.ts';
import { JevJudge, KeywordRetriever, OctoRetriever, OverlapJudge, type Judge, type Passage, type Retriever } from '../../copilot-engine/src/guide.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import type { Field, FieldKind, Flow, Model } from '../../copilot-engine/src/types.ts';
import { maskPII } from '../../copilot-engine/src/guard.ts';

export type ApiEnv = {
  OPENROUTER_JEV_KEY?: string; OCTO_KEY?: string; OCTO_WORKSPACE?: string; JEV_URL?: string; OCTO_BASE?: string; OCTO_TIMEOUT_MS?: string; OCTO_TRACES?: string;
  SIGNING_SECRET?: string; LLAMA_URL?: string; DESK_URL?: string; DESK_MODEL?: string; LFM3_AUDIO_URL?: string; OFFLINE?: string; JEV_DAILY_CAP?: string; RATE_PER_MIN?: string;
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
// Caller verification: tries per call, and failed tries per visitor per hour (so a new call can't reset the count).
const VERIFY_TRIES = 3, VERIFY_IP_FAILS = 6, CALL_TTL = 30 * 60_000;
// Names said by a caller vs names on file: true where it is the same person's name (fuzzy, sound-alike). server.ts lends
// tools/verify_match.py (RapidFuzz + jellyfish).
export type NameMatcher = (said: string, names: string[]) => Promise<boolean[]>;
const JEV_URL = 'https://openrouter.ai/api/alpha/decisions';

const clip = (s: unknown, n: number) => (typeof s === 'string' ? s.slice(0, n) : '');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

// offlinePassages: the same passages as in Octo, for running with no keys (keyword search + word-overlap judge).
// One line per problem, to stdout (the systemd journal on gravebuster). Never keys, never what a visitor typed.
// Every line goes through maskPII, so a date of birth, an SSN or a last four can't reach the log even by mistake.
const log = (msg: string) => console.error(`${new Date().toISOString()} ${maskPII(msg).replace(/\s+/g, ' ')}`);

// The desk's tools: a desk request may offer the model these and nothing else.
const DESK_TOOLS = new Set(['propose_value', 'confirm_pending', 'reject_pending', 'go_to_field', 'answer_question', 'end_call']);
const ROLES = new Set(['system', 'user', 'assistant', 'tool']);
// A desk request's conversation, rebuilt from plain strings: at most 40 messages, each one clipped, tool calls only to
// the desk's tools. Anything else in the body is dropped, so /api/desk can't be used as a general model relay.
function deskMessages(raw: unknown): ChatMsg[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out: ChatMsg[] = [];
  for (const m of raw.slice(-40)) {
    if (!m || !ROLES.has(m.role)) return null;
    const msg: ChatMsg = { role: m.role, content: m.content == null ? null : clip(m.content, 6000) };
    if (m.role === 'assistant' && Array.isArray(m.tool_calls)) {
      msg.tool_calls = m.tool_calls.slice(0, 6).filter((c: any) => DESK_TOOLS.has(c?.function?.name))
        .map((c: any) => ({ id: clip(c.id, 64), type: 'function', function: { name: c.function.name, arguments: clip(c.function.arguments, 800) } }));
    }
    if (m.role === 'tool') msg.tool_call_id = clip(m.tool_call_id, 64);
    out.push(msg);
  }
  return out[0].role === 'system' ? out : null;
}
function deskTools(raw: unknown): unknown[] | null {
  if (!Array.isArray(raw) || raw.length > 6) return null;
  const tools = raw.filter((t: any) => t?.type === 'function' && DESK_TOOLS.has(t.function?.name));
  return tools.length === raw.length && JSON.stringify(tools).length < 8000 ? tools : null;
}

const WARM_FIELD: Field = { name: 'warm', label: 'warm-up', question: 'Say hello.', kind: 'text' };

export function createApi(env: ApiEnv, opts: { offlinePassages?: Record<string, LibraryPassage[]>; matchNames?: NameMatcher; trace?: ExportTrace; score?: (s: EvalScore) => Promise<'annotation' | 'span'> } = {}) {
  const offline = env.OFFLINE === '1';
  if (!offline && !(env.OPENROUTER_JEV_KEY && env.OCTO_KEY && env.OCTO_WORKSPACE)) throw new Error('missing OPENROUTER_JEV_KEY, OCTO_KEY or OCTO_WORKSPACE (or set OFFLINE=1)');
  const jevUrl = env.JEV_URL || JEV_URL;
  const inner: Model = env.LLAMA_URL ? new LlamaModel(env.LLAMA_URL, 'lfm') : new RuleModel();
  const gate = offline ? null : new JevGate(inner, { key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  const jev = offline ? null : new JevJudge({ key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  // The v2 desk's model: LFM3 on our GPU, the same server as LLAMA_URL unless DESK_URL names another. Offline, none:
  // the desk then runs each turn on its code rules.
  const deskModel = offline || !(env.DESK_URL || env.LLAMA_URL) ? null
    : new OpenAIChat({ url: env.DESK_URL || `${env.LLAMA_URL!.replace(/\/$/, '')}/v1`, key: '', model: env.DESK_MODEL || 'lfm3', stream: false, nothink: true, timeoutMs: 15000 });
  // The lfm3-audio voice stack (docs/decisions/0012) is one model: its desk turns go to LFM3-Audio on llama.cpp (the
  // server speech/server.py starts), not to the text model. The desk's code lock is the same either way.
  const audioDeskModel = offline || !env.LFM3_AUDIO_URL ? null : lfm3AudioChat(env.LFM3_AUDIO_URL);
  const overlap = new OverlapJudge();
  // When Jev is overloaded or down, the word-overlap judge stands in, so a covered question isn't answered "I don't know".
  // choose: the same pick with what Jev said (its probabilities, the rule that kept or dropped the pick, or the error),
  // for the judge span in the trace. A failed Jev call is an error there, never a quiet "none".
  const choose = async (q: string, ps: Passage[]): Promise<{ id: string; rule: string; probs: Record<string, number>; error: string; fallback: boolean }> => {
    if (!jev) return { id: await overlap.pick(q, ps), rule: 'overlap', probs: {}, error: '', fallback: false };
    const r = await jev.choose(q, ps);
    if (!r.error) return { ...r, fallback: false };
    log(`judge: ${r.error}, using word overlap`);
    return { ...r, id: await overlap.pick(q, ps), fallback: true };
  };
  const judge: Judge = !jev ? overlap : {
    async pick(q, ps) { return (await choose(q, ps)).id; },
    async sentences(q, ss) {
      const idx = await jev.sentences(q, ss);
      if (!jev.lastError) return idx;
      log(`sentences: ${jev.lastError}, using the short quote`);
      return [];
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

  // ---- Caller verification. The server compares, never a model; the browser only ever hears the result.
  type Call = { tries: number; locked: boolean; client: string; at: number };
  const calls = new Map<string, Call>();
  const fails = new Map<string, number[]>();
  const newCall = (): [string, Call] => {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const c: Call = { tries: 0, locked: false, client: '', at: Date.now() };
    if (calls.size > 5000) for (const [k, v] of calls) if (Date.now() - v.at > CALL_TTL) calls.delete(k);
    calls.set(id, c);
    return [id, c];
  };
  const callOf = (id: unknown): [string, Call] | null => {
    const c = typeof id === 'string' ? calls.get(id) : undefined;
    return c && Date.now() - c.at < CALL_TTL ? [id as string, c] : null;
  };
  async function verify(b: any, ip: string): Promise<Response> {
    if (offline || !opts.matchNames) return json({ error: 'verification needs the live backend' }, 503);
    const [call, c] = callOf(b.call) ?? newCall();
    const recent = (fails.get(ip) ?? []).filter(t => Date.now() - t < 3600_000);
    const out = (result: string, extra: Record<string, unknown> = {}) => json({ result, call, triesLeft: Math.max(0, VERIFY_TRIES - c.tries), ...extra });
    if (c.locked || recent.length >= VERIFY_IP_FAILS) { c.locked = true; return out('locked'); }
    if (c.client) return out('match');
    const name = clip(b.name, 80).trim(), dob = clip(b.dob, 10), ssn4 = clip(b.ssn4, 4), zip = clip(b.zip, 5);
    // What is still needed. The zip is always asked last and always the same way, so "need more" says nothing about
    // whether the first three answers match anyone.
    if (!name) return out('need_more', { ask: 'name' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return out('need_more', { ask: 'dob' });
    if (!/^\d{4}$/.test(ssn4)) return out('need_more', { ask: 'ssn4' });
    if (!/^\d{5}$/.test(zip)) return out('need_more', { ask: 'zip' });
    // Date of birth, last four and zip must match exactly (in the database); then the name, fuzzy, among those few.
    const rows = await sql(`select id, full_name from bw_clients where dob = $1::date and ssn4 = $2 and zip = $3 limit 10`, [dob, ssn4, zip]);
    const same = rows.length ? await opts.matchNames(name, rows.map(r => r.full_name)) : [];
    const hit = rows.filter((_, i) => same[i]);
    if (hit.length === 1) { c.client = hit[0].id; log('verify: match'); return out('match'); }
    c.tries++;
    recent.push(Date.now()); fails.set(ip, recent);
    if (fails.size > 5000) fails.clear();
    if (c.tries >= VERIFY_TRIES) c.locked = true;
    log(`verify: no match (try ${c.tries} of ${VERIFY_TRIES}${hit.length > 1 ? ', ambiguous' : ''})`);
    return out(c.locked ? 'locked' : 'no_match');
  }
  async function accountStatus(b: any): Promise<Response> {
    const found = callOf(b.call);
    if (!found || !found[1].client) return json({ error: 'not verified' }, 403);
    const r = (await sql(`select tax_year, status, updated::text, next_step, preparer, amount from bw_returns where client_id = $1`, [found[1].client]))[0];
    if (!r) return json({ error: 'not found' }, 404);
    return json({ card: { taxYear: r.tax_year, status: r.status, updated: r.updated, nextStep: r.next_step, preparer: r.preparer, amount: r.amount, sample: true } });
  }

  async function route(path: string, b: any, ip = '', session: string | null = null): Promise<Response> {
    if (path === '/api/verify') return verify(b, ip);
    if (path === '/api/account/status') return accountStatus(b);
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
    if (path === '/api/desk') {
      const model = clip(b.stack, 40) === 'lfm3-audio' ? audioDeskModel : deskModel;
      if (!model) return json({ error: 'no desk model' }, 503);
      const messages = deskMessages(b.messages), tools = deskTools(b.tools ?? []);
      if (!messages || !tools) return json({ error: 'bad desk request' }, 400);
      const r = await model.chat(messages, tools, { maxTokens: Math.min(Math.max(Number(b.max_tokens) || 220, 1), 220), temperature: Math.min(Math.max(Number(b.temperature) || 0, 0), 1) });
      return json({ content: r.content, calls: r.calls.filter(c => DESK_TOOLS.has(c.name)), model: r.model });
    }
    if (path === '/api/search') {
      const label = clip(b.manual, 40);
      if (!MANUALS[label]) return json({ error: 'unknown manual' }, 400);
      const ps = await retriever(label).search(clip(b.query, 300), Math.min(Math.max(Number(b.k) || 4, 1), 6));
      return json({ passages: await Promise.all(ps.map(async p => ({ ...p, sig: await sign(p) }))) });
    }
    if (path === '/api/judge') {
      const ps = (await Promise.all((Array.isArray(b.passages) ? b.passages.slice(0, 6) : []).map(genuine))).filter(Boolean) as Passage[];
      if (!ps.length) return json({ id: '', rule: 'skipped', probs: {} });
      if (!offline && !jevAllowed()) return json({ id: '', rule: 'skipped', probs: {}, error: 'jev cap reached', fallback: false });
      const r = await choose(clip(b.question, 300), ps);
      return json({ id: r.id, rule: r.rule, probs: r.probs, ...(r.error ? { error: r.error, fallback: r.fallback } : {}) });
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
      // Spans the widget recorded, in full (#17: nothing is masked); times must be within the last hour, as a long call
      // is sent when it ends. Each span may carry one level of children (a turn's tool calls, confirmations, failures).
      const now = Date.now();
      const spec = (sp: any, kids: boolean): SpanSpec | null => {
        const start = Number(sp?.start), end = Number(sp?.end);
        if (!(start > now - 3_600_000 && end >= start && end <= now + 60_000)) return null;
        const attributes: Record<string, string | number | boolean> = {};
        if (sp.input) attributes['input.value'] = clip(sp.input, 8000);
        if (sp.output) attributes['output.value'] = clip(sp.output, 8000);
        for (const [k, v] of Object.entries(sp.attrs ?? {}).slice(0, 80)) {
          if (typeof v === 'string') attributes[clip(k, 60)] = clip(v, 4000);
          else if (typeof v === 'number' && Number.isFinite(v)) attributes[clip(k, 60)] = v;
          else if (typeof v === 'boolean') attributes[clip(k, 60)] = v;
        }
        const kind: SpanKind = (['CHAIN', 'LLM', 'TOOL', 'RETRIEVER'] as const).find(k => k === sp.kind) ?? 'CHAIN';
        const children = kids && Array.isArray(sp.children) ? sp.children.slice(0, 40).map((c: unknown) => spec(c, false)).filter(Boolean) as SpanSpec[] : [];
        return { name: clip(sp.name, 60) || 'widget', kind, start, end, error: !!sp.error, attributes, children };
      };
      for (const sp of Array.isArray(b.spans) ? b.spans.slice(0, 10) : []) { const s = spec(sp, true); if (s) opts.trace?.(s, session); }
      return json({ ok: true });
    }
    if (path === '/api/score') {
      // { call, turn?, name, score?, label?, explanation? }: the eval's result lands in the call's Phoenix session.
      const call = clip(b.call, 64), name = clip(b.name, 60);
      if (!/^[\w-]{8,64}$/.test(call) || !name) return json({ error: 'call and name are required' }, 400);
      if (!opts.score) return json({ error: 'tracing is off' }, 503);
      const as = await opts.score({ call, name, turn: clip(b.turn, 64) || undefined, score: Number.isFinite(b.score) ? Number(b.score) : undefined,
        label: clip(b.label, 120) || undefined, explanation: clip(b.explanation, 4000) || undefined });
      return json({ ok: true, as });
    }
    if (path === '/api/log') {
      // Errors the widget hit in a visitor's browser (speech, page errors), so real failures show up in the journal.
      log(`client ${clip(b.where, 40)}: ${clip(b.message, 300)} | ${clip(b.page, 80)} | ${clip(b.ua, 160)}`); // masked by log()
      return json({ ok: true });
    }
    return json({ error: 'not found' }, 404);
  }

  // The practice backend (public site content and forms, client portal, staff CRM): practice-api.ts, same Octo.
  const practice = offline ? null : createPractice({
    sql, log,
    upload: async (name, mimeType, data, metadata) => (await (await octo('/files/upload', { workspaceId: env.OCTO_WORKSPACE, name, mimeType, data: data.toString('base64'), dataEncoding: 'base64', metadata })).json()).id,
    download: async fileId => (await octo(`/files/content?workspaceId=${env.OCTO_WORKSPACE}&fileId=${fileId}`)).arrayBuffer(),
    verifiedClient: call => calls.get(call)?.client ?? '',
  });

  // One trace per backend call, after it answered, so tracing never slows a reply.
  async function traceCall(path: string, b: any, r: Response, start: number, session: string | null) {
    const kind: SpanSpec['kind'] = path === '/api/search' ? 'RETRIEVER' : 'LLM';
    const out = await r.text();
    let o: any = {};
    try { o = JSON.parse(out); } catch { /* not json */ }
    const attributes: Record<string, string | number> = {
      'input.value': path === '/api/understand' ? `${clip(b.field?.label, 120)}: ${clip(b.said, 500)}`
        : path === '/api/desk' ? JSON.stringify(b.messages ?? []).slice(-16_000) : clip(b.query ?? b.question, 500),
      'output.value': out.slice(0, 8000),
      'http.status_code': r.status,
    };
    if (path === '/api/desk') { attributes['llm.model_name'] = clip(o.model, 120); attributes['llm.tools'] = (b.tools ?? []).length; }
    if (path === '/api/judge') {
      attributes['judge.rule'] = clip(o.rule, 20);
      attributes['judge.probabilities'] = JSON.stringify(o.probs ?? {});
      attributes['judge.picked'] = clip(o.id, 80);
      if (o.error) { attributes['judge.error'] = clip(o.error, 80); attributes['judge.fallback'] = o.fallback ? 'word overlap' : 'none'; }
    }
    if (path === '/api/search') (o.passages ?? []).slice(0, 6).forEach((p: any, i: number) => {
      attributes[`retrieval.documents.${i}.document.id`] = clip(p.id, 200);
      attributes[`retrieval.documents.${i}.document.content`] = clip(p.text, 1000);
    });
    opts.trace!({ name: path.slice(5), kind, start, end: Date.now(), error: r.status >= 400, attributes }, session);
  }

  return {
    // For tests only (never over HTTP): which client a call was verified as.
    verifiedAs: (call: string) => calls.get(call)?.client ?? '',
    mode: offline ? 'offline (keyword search, word-overlap judge, rules)' : `live (Octo RAG, Jev ${env.LLAMA_URL ? '+ local LFM' : '+ rules'})`,
    async handle(req: Request, ip = ''): Promise<Response> {
      const path = new URL(req.url).pathname;
      if (path === '/api/health') return json({ ok: true, mode: offline ? 'offline' : 'live' });
      if (/^\/api\/(site|forms|slots|portal|staff|files|newsletter)(\/|$)/.test(path)) {
        if (!practice) return json({ error: 'the practice backend needs Octo (live mode)' }, 503);
        return practice.handle(req, ip || req.headers.get('cf-connecting-ip') || 'local');
      }
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
      // The warm-up is free (no Jev, one at a time), so it does not use up the visitor's answers; so are /api/trace and /api/score.
      if (path !== '/api/warm' && path !== '/api/trace' && path !== '/api/score' && limited(ip || req.headers.get('cf-connecting-ip') || 'local')) { log(`${path} 429 rate limit`); return json({ error: 'slow down' }, 429); }
      const raw = await req.text();
      if (raw.length > (path === '/api/desk' ? 64_000 : 32_000)) { log(`${path} 413`); return json({ error: 'too large' }, 413); }
      let b: any;
      try { b = JSON.parse(raw); } catch { log(`${path} 400 bad json`); return json({ error: 'bad json' }, 400); }
      const sid = req.headers.get('x-session-id');
      const session = sid && /^[\w-]{8,64}$/.test(sid) ? sid : null;
      const started = Date.now();
      try {
        const r = await route(path, b, ip || req.headers.get('cf-connecting-ip') || 'local', session);
        if (r.status >= 400) log(`${path} ${r.status}`);
        if (opts.trace && ['/api/understand', '/api/desk', '/api/search', '/api/judge', '/api/sentences'].includes(path)) void traceCall(path, b, r.clone(), started, session).catch(() => {});
        return r;
      } catch (e) {
        log(`${path} failed: ${(e as Error).stack ?? e}`);
        return json({ error: 'backend error' }, 502);
      }
    },
  };
}
