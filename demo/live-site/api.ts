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
//   GET  /api/copilot/config?business=  a business's config (pages, voice stacks, desk), kept in Octo and loaded on demand
//   POST /api/session     a resume snapshot for a dropped call, by business and session: { op: get | set | delete, business, id,
//                         snapshot? }, kept 30 minutes in the shared store (Octo when live)
//   POST /api/account/status  the verified caller's (fictional) return status card
//   /api/access/…         the business's own people: Octo sign-in, grants, the access log, opening a raw call (access-api.ts, #131)
//   GET  /api/library/…   the tax library, all from Octo: search, docs (the list), doc?doc= (one source: its sections, or
//                         the article body of a web-page source), pdf?doc= (a publication's printed PDF), faq
// Nothing here decides what the copilot does; it only answers those questions. Requests are size- and rate-limited, and
// Jev calls have a daily cap, so the open demo can't be used as a free model relay.
import { createAccess } from './access-api.ts';
import { createPractice } from './practice-api.ts';
import type { EvalScore, ExportTrace, SpanKind, SpanSpec } from './tracing.ts';
import { lfm3AudioChat, OpenAIChat, type ChatMsg } from '../../copilot-engine/src/desk.ts';
import { JevJudge, KeywordRetriever, OctoRetriever, OverlapJudge, type Judge, type Passage, type Retriever } from '../../copilot-engine/src/guide.ts';
import { JevGate, LlamaModel, RuleModel } from '../../copilot-engine/src/models.ts';
import type { Field, FieldKind, Flow, Model } from '../../copilot-engine/src/types.ts';
import { maskPII } from '../../copilot-engine/src/guard.ts';
import { MemoryStore, SESSION_TTL_MS, type Store } from '../../copilot-engine/src/memory.ts';
import { OctoStore } from '../../copilot-engine/src/octo-store.ts';
import { CallVault, isSealed, OpenBaoKeys } from '../../copilot-engine/src/call-vault.ts';
import { CallRecords, retentionDays } from '../../copilot-engine/src/call-records.ts';
import { CallAudio, MAX_AUDIO_BYTES, recordsAudio, type Files } from '../../copilot-engine/src/call-audio.ts';
import { CALLER, CallCallers } from '../../copilot-engine/src/call-callers.ts';
import { octoSql } from '../../copilot-engine/src/octo-workspaces.ts';
import { loadSlots, SLOT_NAMES, type Slots } from '../../copilot-engine/src/slots.ts';
import { createSmart, SmartError, type Scope } from './smart.ts';
import { BUSINESS_ID, isOrigin, siteGate, type Gate, SiteConfigs, type Sites } from '../../copilot-engine/src/site-config.ts';

export type ApiEnv = {
  OPENROUTER_JEV_KEY?: string; OCTO_KEY?: string; OCTO_WORKSPACE?: string; OCTO_ACCOUNT_KEY?: string; JEV_URL?: string; OCTO_BASE?: string; OCTO_TIMEOUT_MS?: string; OCTO_TRACES?: string;
  SITE_ORIGINS?: string; SIGNING_SECRET?: string;
  // OpenBao, which keeps each business's key for its call records (#128): its address and the copilot's AppRole.
  OPENBAO_ADDR?: string; OPENBAO_ROLE_ID?: string; OPENBAO_SECRET_ID?: string;
  LLAMA_URL?: string; DESK_URL?: string; DESK_KEY?: string; DESK_MODEL?: string; LFM3_AUDIO_URL?: string; OFFLINE?: string; JEV_DAILY_CAP?: string; RATE_PER_MIN?: string; STATE_STORE?: string;
  // Smart model slots (decision 0017, deploy/README.md): DESK_HYBRID=1 lets the desk ask the `desk` slot's hosted model on a hard turn,
  // for a development host or the owner only (SMART_OWNER=1 with OWNER_TOKEN, SMART_DEV_HOSTS adds host names). Keys are named by the slot.
  DESK_HYBRID?: string; SMART_OWNER?: string; OWNER_TOKEN?: string; SMART_DEV_HOSTS?: string; SMART_DAILY_CAP?: string;
  INFERHUB_BASE_URL?: string; INFERHUB_API_KEY?: string; OPENROUTER_FREE_URL?: string; OPENROUTER_FREE_KEY?: string; WORKBUDDY_URL?: string; WORKBUDDY_KEY?: string;
} & Partial<Record<`SLOT_${Uppercase<(typeof SLOT_NAMES)[number]>}_${'PROVIDER' | 'MODEL' | 'TIMEOUT_MS' | 'DAILY_CAP'}`, string>>;

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

// Span attributes that hold a caller's words or the copilot's answer (#129); they go to the call record, never a trace.
// tracing.ts's CALL_TEXT_KEYS is the same list (that file is Node only).
const CALL_TEXT = /^(input\.value|output\.value|tool\.parameters|correction\.(before|after))$/;

const toBase64 = (b: Uint8Array) => { let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
// The voice agent's signature on a recording (speech/agent.py send_audio): HMAC-SHA256 with the site's secret over
// "call-audio", the room, the call id and the audio's SHA-256.
export async function audioSignature(secret: string, room: string, call: string, audio: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = hex(await crypto.subtle.digest('SHA-256', audio as BufferSource));
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`call-audio\n${room}\n${call}\n${digest}`)));
}
const audioSigned = async (secret: string, room: string, call: string, audio: Uint8Array, sig: string) => {
  const want = await audioSignature(secret, room, call, audio);
  let diff = want.length ^ sig.length;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ (sig.charCodeAt(i) || 0);
  return diff === 0;
};

const WARM_FIELD: Field = { name: 'warm', label: 'warm-up', question: 'Say hello.', kind: 'text' };

export function createApi(env: ApiEnv, opts: { slots?: Slots; offlinePassages?: Record<string, LibraryPassage[]>; matchNames?: NameMatcher; trace?: ExportTrace; score?: (s: EvalScore, workspace?: string) => Promise<'annotation' | 'span'>;
  // Where state lives. calls: caller verification (shared, so a restart or a second instance keeps a lock); sessions: resume
  // snapshots; limits: rate-limit counters (hot path, so per instance). Default: Octo for the first two when live, a capped
  // in-process store otherwise or when STATE_STORE=memory.
  stores?: { calls?: Store; sessions?: Store; limits?: Store };
  // Locks each call's record before it is stored (#128). Default: OpenBao when OPENBAO_ADDR is set.
  vault?: CallVault;
  // Each business's config (voice stacks allowed, pages, desk). Default: the Octo table copilot_sites when live, none offline.
  sites?: Sites;
  // ownHostHeader: the host the visitor asked for comes in x-own-host (server.ts sets it; a request from outside can't).
  ownHostHeader?: boolean } = {}) {
  const offline = env.OFFLINE === '1';
  if (!offline && !(env.OPENROUTER_JEV_KEY && env.OCTO_KEY && env.OCTO_WORKSPACE)) throw new Error('missing OPENROUTER_JEV_KEY, OCTO_KEY or OCTO_WORKSPACE (or set OFFLINE=1)');
  const jevUrl = env.JEV_URL || JEV_URL;
  const inner: Model = env.LLAMA_URL ? new LlamaModel(env.LLAMA_URL, 'lfm') : new RuleModel();
  const gate = offline ? null : new JevGate(inner, { key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  const jev = offline ? null : new JevJudge({ key: env.OPENROUTER_JEV_KEY, url: jevUrl });
  // The v2 desk's model: LFM3 on our GPU, the same server as LLAMA_URL unless DESK_URL names another. Offline, none:
  // the desk then runs each turn on its code rules.
  const deskModel = offline || !(env.DESK_URL || env.LLAMA_URL) ? null
    : new OpenAIChat({ url: env.DESK_URL || `${env.LLAMA_URL!.replace(/\/$/, '')}/v1`, key: env.DESK_KEY ?? '', model: env.DESK_MODEL || 'lfm3', stream: false, nothink: true, timeoutMs: 15000 });
  // The lfm3-audio voice stack (docs/decisions/0012) is one model: its desk turns go to LFM3-Audio on llama.cpp (the
  // server speech/server.py starts), not to the text model. The desk's code lock is the same either way.
  const audioDeskModel = offline || !env.LFM3_AUDIO_URL ? null : lfm3AudioChat(env.LFM3_AUDIO_URL);
  // Model slots: every one is the local model unless the file or env names a hosted one; checked when the server starts.
  const slots = opts.slots ?? loadSlots(undefined, env);
  const smart = createSmart(env as Record<string, string | undefined>, slots, { log });
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

  // State that outlives a request lives in Stores with a time limit and a hard size cap (MemoryStore evicts the oldest past
  // its cap; the Octo store sweeps), never in bare Maps. Rate limits stay per instance: they are on every request.
  const inOcto = !offline && env.STATE_STORE !== 'memory';
  const octoStore = () => new OctoStore(sql, { max: 200_000 });
  const limits = opts.stores?.limits ?? new MemoryStore(Date.now, { max: 20_000 });
  const callStore = opts.stores?.calls ?? (inOcto ? octoStore() : new MemoryStore(Date.now, { max: 20_000 }));
  const sessionStore = opts.stores?.sessions ?? (inOcto ? octoStore() : new MemoryStore(Date.now, { max: 20_000 }));
  // A call's raw record reaches Octo only locked by its business's key (decision 0021, #128). Without OpenBao, a server that
  // keeps sessions in Octo refuses to save them rather than store them readable.
  const vault = opts.vault ?? (env.OPENBAO_ADDR && env.OPENBAO_ROLE_ID && env.OPENBAO_SECRET_ID
    ? new CallVault(new OpenBaoKeys({ addr: env.OPENBAO_ADDR, roleId: env.OPENBAO_ROLE_ID, secretId: env.OPENBAO_SECRET_ID })) : null);
  const mustSeal = inOcto && !opts.stores?.sessions;

  // An outside business's own workspace (decision 0021, #127) is reached with the account-wide key; with none set, its
  // requests fail rather than fall back to the shared workspace. Its sessions and traces go there; demo businesses stay
  // on the shared workspace with their prefix.
  const sqlAt = (ws: string) => {
    if (!env.OCTO_ACCOUNT_KEY) throw new Error('no account-wide Octo key (OCTO_ACCOUNT_KEY) to reach a business workspace');
    return octoSql({ base: env.OCTO_BASE, key: env.OCTO_ACCOUNT_KEY }, ws);
  };
  const sites: Sites | null = opts.sites ?? (offline ? null : new SiteConfigs(sql, { workspaces: { sqlFor: sqlAt } }));
  const workspaceOf = async (business: unknown): Promise<string | undefined> =>
    sites && typeof business === 'string' && BUSINESS_ID.test(business) ? (await sites.get(business))?.workspace?.id || undefined : undefined;
  const ownStores = new Map<string, Store>();
  const sessionsAt = (ws: string | undefined): Store => {
    if (!ws) return sessionStore;
    let s = ownStores.get(ws);
    if (!s) {
      s = new OctoStore(sqlAt(ws), { max: 200_000 });
      if (ownStores.size >= 500) ownStores.delete(ownStores.keys().next().value!);
      ownStores.set(ws, s);
    }
    return s;
  };
  // The call record (#129): every turn's words, locked, in the business's workspace; traces keep only a pointer to it.
  const records = new Map<string, CallRecords>();
  const recordsAt = (ws: string | undefined): CallRecords | null => {
    if (!vault || offline) return null;
    const k = ws ?? '';
    let r = records.get(k);
    if (!r) {
      r = new CallRecords(ws ? sqlAt(ws) : sql, vault);
      if (records.size >= 500) records.delete(records.keys().next().value!);
      records.set(k, r);
    }
    return r;
  };
  // Octo's file store in one workspace: the shared one with its own key, a business's own with the account-wide key.
  const filesAt = (ws: string | undefined): Files => {
    const key = ws ? env.OCTO_ACCOUNT_KEY : env.OCTO_KEY, id = encodeURIComponent(ws ?? env.OCTO_WORKSPACE ?? '');
    const call = async (path: string, init: RequestInit = {}) => {
      if (!key) throw new Error('no account-wide Octo key (OCTO_ACCOUNT_KEY) to reach a business workspace');
      const r = await fetch(`${octoBase}${path}`, { ...init, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
      if (!r.ok) throw new Error(`octo ${path.split('?')[0].replace(/\/files\/[^/]+$/, '/files/:id')} ${r.status}`);
      return r;
    };
    return {
      upload: async (name, mimeType, data) => (await (await call('/files/upload', { method: 'POST', body: JSON.stringify({ workspaceId: decodeURIComponent(id), name, mimeType, data: toBase64(data), dataEncoding: 'base64' }) })).json()).id,
      download: async f => new Uint8Array(await (await call(`/files/content?workspaceId=${id}&fileId=${encodeURIComponent(f)}`)).arrayBuffer()),
      remove: async f => { await call(`/files/${encodeURIComponent(f)}?workspaceId=${id}`, { method: 'DELETE' }); },
    };
  };
  // Voice call recordings (#130), locked, beside the call records.
  const audios = new Map<string, CallAudio>();
  const audioAt = (ws: string | undefined): CallAudio | null => {
    if (!vault || offline) return null;
    const k = ws ?? '';
    let a = audios.get(k);
    if (!a) {
      a = new CallAudio(ws ? sqlAt(ws) : sql, filesAt(ws), vault);
      if (audios.size >= 500) audios.delete(audios.keys().next().value!);
      audios.set(k, a);
    }
    return a;
  };
  // Which calls each caller was on (#132), beside the call records.
  const callers = new Map<string, CallCallers>();
  const callersAt = (ws: string | undefined): CallCallers | null => {
    if (offline) return null;
    const k = ws ?? '';
    let c = callers.get(k);
    if (!c) {
      c = new CallCallers(ws ? sqlAt(ws) : sql);
      if (callers.size >= 500) callers.delete(callers.keys().next().value!);
      callers.set(k, c);
    }
    return c;
  };
  // Erasing one call (#132): its key goes first, so every copy stops opening, backups included; then its rows and files.
  // A failure before the key is gone throws and leaves everything in place to try again.
  const eraseCall = async (business: string, call: string, ws: string | undefined) => {
    if (!vault) throw new Error('erasing needs the key store');
    await vault.forgetCall(business, call);
    const records = await recordsAt(ws)?.forget(business, call) ?? 0, recordings = await audioAt(ws)?.forget(business, call) ?? 0;
    await sessionsAt(ws).delete(`sess:${business}:${call}`);
    await callersAt(ws)?.forget(business, { call });
    return { records, recordings };
  };
  // Span attributes that carry what a caller said or what the copilot answered. They never reach a trace: each span's
  // go into the call record as one entry, and the span keeps `call.record`, a pointer to it. Without a key store, a call
  // id or a business, the words are dropped, never sent.
  const sealSpan = async (s: SpanSpec, business: string | undefined, call: string | null | undefined, ws: string | undefined): Promise<SpanSpec> => {
    const attributes = { ...(s.attributes ?? {}) }, entry: Record<string, string> = {};
    for (const k of Object.keys(attributes)) if (CALL_TEXT.test(k)) { if (attributes[k] !== '') entry[k] = String(attributes[k]); delete attributes[k]; }
    const book = business && call && BUSINESS_ID.test(business) ? recordsAt(ws) : null;
    if (Object.keys(entry).length && book) {
      try { attributes['call.record'] = await book.add(business!, call!, { span: s.name, ...entry }); }
      catch (e) { log(`call record: could not save a ${s.name} entry for ${business}: ${(e as Error).message}`); attributes['call.record.error'] = 'not saved'; }
    }
    const children = s.children ? await Promise.all(s.children.map(c => sealSpan(c, business, call, ws))) : undefined;
    return { ...s, attributes, ...(children ? { children } : {}) };
  };
  const traceSealed = (s: SpanSpec, business: string | undefined, session: string | null, ws: string | undefined) => {
    if (opts.trace) void sealSpan(s, business, session, ws).then(t => opts.trace!(t, session, ws), e => log(`trace: ${(e as Error).message}`));
  };

  // The copilot's own origins (SITE_ORIGINS, comma-separated): always its own site, whatever host a proxy passes on.
  const ownOrigins = (env.SITE_ORIGINS ?? '').split(',').map(o => o.trim()).filter(isOrigin);

  // Per-visitor rate limit (a window of one minute from the visitor's first request) and a daily cap on Jev calls.
  const perMin = Number(env.RATE_PER_MIN) || 40;
  const cap = Number(env.JEV_DAILY_CAP) || 2000;
  let day = '', jevToday = 0;
  let warming: Promise<void> | null = null;
  const jevAllowed = () => {
    const d = new Date().toISOString().slice(0, 10);
    if (d !== day) { day = d; jevToday = 0; }
    return jevToday++ < cap;
  };
  // Wrong owner tokens: 10 an hour per visitor, on top of the general rate limit.
  const ownerTries = async (ip: string) => (await limits.incr(`own:${ip.slice(0, 64)}`, 3_600_000)) <= 10;
  const limited = async (ip: string) => (await limits.incr(`rl:${ip.slice(0, 64)}`, 60_000)) > perMin;

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
  // A call is one entry (who it was verified as, whether it is locked) plus a counter of failed tries, both gone
  // CALL_TTL after the call began. Failed tries per visitor are a counter that lives an hour from the first failure.
  type Call = { locked: boolean; client: string; at: number };
  const CALL_ID = /^[0-9a-f]{32}$/;
  const putCall = (id: string, c: Call) => callStore.set(`call:${id}`, c, Math.max(1000, CALL_TTL - (Date.now() - c.at)));
  const newCall = async (): Promise<[string, Call]> => {
    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
    const c: Call = { locked: false, client: '', at: Date.now() };
    await putCall(id, c);
    return [id, c];
  };
  const callOf = async (id: unknown): Promise<[string, Call] | null> => {
    if (typeof id !== 'string' || !CALL_ID.test(id)) return null;
    const c = (await callStore.get(`call:${id}`)) as Call | undefined;
    return c && Date.now() - c.at < CALL_TTL ? [id, c] : null;
  };
  const clientOf = async (call: unknown) => (await callOf(call))?.[1].client ?? '';
  async function verify(b: any, ip: string): Promise<Response> {
    if (offline || !opts.matchNames) return json({ error: 'verification needs the live backend' }, 503);
    const [call, c] = (await callOf(b.call)) ?? await newCall();
    const ipKey = `vf:${ip.slice(0, 64)}`;
    const triesOf = async () => Number(await callStore.get(`ct:${call}`)) || 0;
    const out = async (result: string, extra: Record<string, unknown> = {}) => json({ result, call, triesLeft: Math.max(0, VERIFY_TRIES - await triesOf()), ...extra });
    if (c.locked || (Number(await callStore.get(ipKey)) || 0) >= VERIFY_IP_FAILS || await triesOf() >= VERIFY_TRIES) { c.locked = true; await putCall(call, c); return out('locked'); }
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
    if (hit.length === 1) { c.client = hit[0].id; await putCall(call, c); log('verify: match'); return out('match'); }
    const tries = await callStore.incr(`ct:${call}`, CALL_TTL);
    await callStore.incr(ipKey, 3600_000);
    if (tries >= VERIFY_TRIES) { c.locked = true; await putCall(call, c); }
    log(`verify: no match (try ${tries} of ${VERIFY_TRIES}${hit.length > 1 ? ', ambiguous' : ''})`);
    return out(c.locked ? 'locked' : 'no_match');
  }
  async function accountStatus(b: any): Promise<Response> {
    const client = await clientOf(b.call);
    if (!client) return json({ error: 'not verified' }, 403);
    const r = (await sql(`select tax_year, status, updated::text, next_step, preparer, amount from bw_returns where client_id = $1`, [client]))[0];
    if (!r) return json({ error: 'not found' }, 404);
    return json({ card: { taxYear: r.tax_year, status: r.status, updated: r.updated, nextStep: r.next_step, preparer: r.preparer, amount: r.amount, sample: true } });
  }

  // ---- A voice call's recording, sent by the voice agent when the call ends (#130). The agent signs the room, the call id
  // and the audio's hash with the site's secret. The room's name, which the site chose and signed into the caller's token
  // (server.ts voiceToken), names the business: call-<id>.<business>. The audio is locked with the call's key, and only if
  // the business records its calls.
  const ROOM = /^call-[0-9a-f]{8}\.([a-z0-9][a-z0-9-]{0,39})$/, RECORDED_CALL = /^[\w-]{6,64}$/;
  async function callAudioApi(req: Request): Promise<Response> {
    const room = req.headers.get('x-call-room') ?? '', call = req.headers.get('x-call-id') ?? '', sig = req.headers.get('x-call-sig') ?? '';
    const business = ROOM.exec(room)?.[1];
    if (!business || !RECORDED_CALL.test(call) || !env.SIGNING_SECRET) return json({ error: 'bad recording' }, 400);
    if (Number(req.headers.get('content-length') ?? 0) > MAX_AUDIO_BYTES) return json({ error: 'recording too large' }, 413);
    const audio = new Uint8Array(await req.arrayBuffer());
    if (audio.byteLength > MAX_AUDIO_BYTES) return json({ error: 'recording too large' }, 413);
    if (!(await audioSigned(env.SIGNING_SECRET, room, call, audio, sig))) return json({ error: 'bad signature' }, 403);
    try {
      const config = sites ? await sites.get(business) : null;
      if (!config) return json({ error: 'unknown business' }, 404);
      if (!recordsAudio(config)) return json({ ok: true, kept: false });
      const store = audioAt(await workspaceOf(business));
      if (!store) return json({ error: 'call audio needs the key store' }, 503);
      const type = (req.headers.get('content-type') ?? '').split(';')[0].trim();
      const saved = await store.save(business, call, audio, /^audio\/(ogg|wav)$/.test(type) ? type : 'audio/ogg');
      return json({ ok: true, kept: true, bytes: saved.bytes });
    } catch (e) { log(`call audio for ${business}: ${(e as Error).message}`); return json({ error: 'backend error' }, 502); }
  }

  // ---- Resume snapshots (a dropped call picked up again). One key per business and session, a snapshot of at most 16 KB
  // that lives SESSION_TTL_MS; the desk's own check (flow id) decides whether a snapshot fits the form it is restored on.
  const SESSION = /^[\w-]{16,64}$/;
  async function sessionApi(b: any): Promise<Response> {
    if (!BUSINESS_ID.test(b.business ?? '') || !SESSION.test(b.id ?? '')) return json({ error: 'bad session request' }, 400);
    if (sites && !(await sites.get(b.business))) return json({ error: 'unknown business' }, 404);
    const sessionStore = sessionsAt(await workspaceOf(b.business));
    const key = `sess:${b.business}:${b.id}`;
    if (!vault && mustSeal && b.op !== 'delete') return json({ error: 'call records need the key store' }, 503);
    if (b.op === 'get') {
      const v = await sessionStore.get(key);
      if (!isSealed(v)) return json({ snapshot: v ?? null });
      if (!vault) return json({ error: 'call records need the key store' }, 503);
      try { return json({ snapshot: await vault.open(b.business, b.id, v) }); }
      catch (e) { log(`session: could not open a record of ${b.business}: ${(e as Error).message}`); return json({ snapshot: null }); }
    }
    if (b.op === 'delete') { await sessionStore.delete(key); return json({ ok: true }); }
    if (b.op !== 'set') return json({ error: 'bad session request' }, 400);
    const snap = b.snapshot;
    const strings = (o: unknown) => !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).length <= 2000 && Object.values(o).every(v => typeof v === 'string' && v.length <= 1000);
    if (!snap || snap.v !== 1 || typeof snap.flow !== 'string' || !strings(snap.values) || !Array.isArray(snap.log) || JSON.stringify(snap).length > 16_000) return json({ error: 'bad snapshot' }, 400);
    const record = { ...snap, savedAt: Date.now() };
    await sessionStore.set(key, vault ? await vault.seal(b.business, b.id, record) : record, SESSION_TTL_MS);
    return json({ ok: true });
  }

  // ws: the workspace of the business this request is for, when it has its own; its traces go there.
  async function route(path: string, b: any, ip = '', session: string | null = null, scope: Scope = null, ws?: string): Promise<Response> {
    if (path === '/api/verify') return verify(b, ip);
    if (path === '/api/session') return sessionApi(b);
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
    if (path === '/api/owner') {
      if (!await ownerTries(ip)) return json({ error: 'slow down' }, 429);
      return smart.ownerSession(b.token);
    }
    // What the Brain picker offers on this page (#97, default amended by #101): the hybrid is the default for everyone, so
    // the list reflects what is actually on. `smart` (hard turns) is offered whenever the escalation is on at all; `smart-always`
    // (every turn) still needs a development host or the owner's token. The list says model names, never keys.
    if (path === '/api/brain/options') {
      const gate = smart.check('desk', scope);
      const alwaysGate = smart.check('desk', scope, true);
      const pick = b.brain === 'smart' && gate.ok || b.brain === 'smart-always' && alwaysGate.ok ? String(b.brain) : 'local';
      return json({
        scope: scope ?? 'visitor',
        pick,
        options: [
          { id: 'local', label: 'LFM3 (local, fallback)', smart: false },
          ...(gate.ok ? [{ id: 'smart', label: `Hybrid: ${slots.desk.model} takes hard turns (default)`, smart: true }] : []),
          ...(alwaysGate.ok ? [{ id: 'smart-always', label: `Smart always: ${slots.desk.model} (every turn, capped)`, smart: true }] : []),
        ],
      });
    }
    if (path === '/api/desk') {
      // A business that sends its id may only use the voice stacks its own config allows.
      const stack = clip(b.stack, 40);
      if (sites && BUSINESS_ID.test(b.business ?? '') && stack) {
        const allowed = (await sites.get(b.business))?.voice?.stacks;
        if (allowed && !allowed.includes(stack)) return json({ error: 'stack not allowed for this business' }, 403);
      }
      const messages = deskMessages(b.messages), tools = deskTools(b.tools ?? []);
      const o = { maxTokens: Math.min(Math.max(Number(b.max_tokens) || 220, 1), 220), temperature: Math.min(Math.max(Number(b.temperature) || 0, 0), 1) };
      // The desk's escalation of a hard turn to the `desk` slot's smart model — the default for every visitor now (#101):
      // over the cap, out of lease or failing, the local model's answer, which the page already holds, stands. The slot and
      // model are on the span either way. The Brain picker's pick rides here (#97): `smart` (the hybrid default) or
      // `smart-always` (every turn, still scope-gated). A picked brain without scope or one that fails falls back to the
      // local model, which answers as it always has; the old `smart: true` escalation keeps its contract (a 409 the page
      // already handles). With no smart slot configured none of this arms.
      const pickedBrain = b.brain === 'smart' || b.brain === 'smart-always' ? (b.brain as string) : null;
      const wantSmart = b.smart === true || !!pickedBrain;
      if (wantSmart) {
        const gate = smart.check('desk', scope, pickedBrain === 'smart-always');
        const keepLocal = !!pickedBrain; // a picked brain never errors the turn: the local model answers
        if (!gate.ok) {
          if (!keepLocal) return json({ error: 'smart unavailable', reason: gate.reason, slot: 'desk', provider: slots.desk.provider }, 409);
        } else {
          if (!messages || !tools) return json({ error: 'bad desk request' }, 400);
          try {
            const r = await smart.call('desk', messages, tools, o);
            return json({ content: r.content, calls: r.calls.filter(c => DESK_TOOLS.has(c.name)), model: r.model, slot: 'desk', provider: slots.desk.provider, tried: r.tried, smart: smart.check('desk', scope).ok });
          } catch (e) {
            const se = e instanceof SmartError ? e : null;
            if (!keepLocal) return json({ error: 'smart failed', reason: se?.reason ?? 'error', slot: 'desk', provider: slots.desk.provider, model: slots.desk.model, tried: se?.tried ?? [] }, 409);
          }
        }
      }
      const model = stack === 'lfm3-audio' ? audioDeskModel : deskModel;
      if (!model) return json({ error: 'no desk model' }, 503);
      if (!messages || !tools) return json({ error: 'bad desk request' }, 400);
      const r = await model.chat(messages, tools, o);
      // `smart` tells the page whether a smart model may answer its hard turns now (the hybrid default, #101).
      return json({ content: r.content, calls: r.calls.filter(c => DESK_TOOLS.has(c.name)), model: r.model, slot: 'desk', provider: 'local', smart: smart.check('desk', scope).ok });
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
      for (const sp of Array.isArray(b.spans) ? b.spans.slice(0, 10) : []) { const s = spec(sp, true); if (s) traceSealed(s, b.business, session, ws); }
      return json({ ok: true });
    }
    if (path === '/api/score') {
      // { call, turn?, name, score?, label?, explanation? }: the eval's result lands in the call's Phoenix session.
      const call = clip(b.call, 64), name = clip(b.name, 60);
      if (!/^[\w-]{8,64}$/.test(call) || !name) return json({ error: 'call and name are required' }, 400);
      if (!opts.score) return json({ error: 'tracing is off' }, 503);
      const as = await opts.score({ call, name, turn: clip(b.turn, 64) || undefined, score: Number.isFinite(b.score) ? Number(b.score) : undefined,
        label: clip(b.label, 120) || undefined, explanation: clip(b.explanation, 4000) || undefined }, ws);
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
    verifiedClient: clientOf,
  });

  // One trace per backend call, after it answered, so tracing never slows a reply.
  async function traceCall(path: string, b: any, r: Response, start: number, session: string | null, scope: Scope, ws?: string) {
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
    if (path === '/api/desk') {
      // Which slot answered and with what, on every desk span: the model the server reported (or, for a refused smart call, the one asked).
      attributes['llm.model_name'] = clip(o.model, 120);
      attributes['llm.tools'] = (b.tools ?? []).length;
      attributes['copilot.slot'] = clip(o.slot, 20) || 'desk';
      attributes['copilot.provider'] = clip(o.provider, 30) || 'local';
      attributes['copilot.scope'] = scope ?? 'visitor';
      if (b.smart === true) { attributes['copilot.escalation'] = 'smart'; if (o.reason) attributes['copilot.smart_refused'] = clip(o.reason, 20); if (o.tried?.length) attributes['copilot.smart_tried'] = clip(o.tried.map((t: any) => `${t.model}:${t.why}`).join(', '), 300); }
      // The Brain picker's pick on this turn (#97): the id the page asked for (the span keeps it even when scope refused it —
      // `llm.model_name` above still says what really answered).
      if (b.brain) attributes['copilot.brain'] = clip(String(b.brain), 20);
    }
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
    traceSealed({ name: path.slice(5), kind, start, end: Date.now(), error: r.status >= 400, attributes }, b?.business, session, ws);
  }

  // Who may open a raw call, and the log of every time someone did (#131). Needs a business's own workspace and OpenBao.
  const access = offline || !vault ? null : createAccess({
    octo: octoBase.replace(/\/api\/?$/, ''), own: ownOrigins, log, workspaceOf, sqlAt, clients: sessionStore,
    host: req => (opts.ownHostHeader ? req.headers.get('x-own-host') : null) ?? new URL(req.url).host,
    record: async (business, call) => (await recordsAt(await workspaceOf(business))?.read(business, call, retentionDays(await sites?.get(business)))) ?? [],
    audio: async (business, call) => (await audioAt(await workspaceOf(business))?.open(business, call, retentionDays(await sites?.get(business)))) ?? null,
  });

  let siteMedia: { at: number; slots: Record<string, unknown> } | null = null;
  return {
    // Deletes every business's call-record entries and recordings past its retention (#129, #130), and the key of each
    // call with nothing left (#132): the shared workspace and each business's own. server.ts runs it every hour. Returns how many entries and recordings went, per business.
    async sweepRecords(): Promise<Record<string, number>> {
      const gone: Record<string, number> = {};
      const own = sites instanceof SiteConfigs ? (await sites.list()).map(r => r.workspace).filter((w): w is string => !!w) : [];
      for (const ws of [undefined, ...new Set(own)]) {
        const swept = new Set<string>();
        for (const book of [recordsAt(ws), audioAt(ws)]) {
          if (!book) continue;
          try {
            for (const business of await book.businesses()) {
              const calls = await book.sweep(business, retentionDays(await sites?.get(business)));
              gone[business] = (gone[business] ?? 0) + calls.length;
              for (const call of calls) swept.add(`${business}\n${call}`);
            }
          } catch (e) { log(`call record sweep (${ws ?? 'shared'}): ${(e as Error).message}`); }
        }
        // A call with nothing left is erased in full: its key goes too, so its backups stop opening (#132).
        for (const id of swept) {
          const [business, call] = id.split('\n');
          try {
            if (!await recordsAt(ws)?.has(business, call) && !await audioAt(ws)?.has(business, call)) await vault?.forgetCall(business, call);
          } catch (e) { log(`call key sweep (${ws ?? 'shared'}): ${(e as Error).message}`); }
        }
      }
      return gone;
    },
    // A call's record as its business keeps it, within its retention. Over HTTP only through /api/access/open (#131).
    async callRecord(business: string, call: string) {
      const book = recordsAt(await workspaceOf(business));
      return book ? book.read(business, call, retentionDays(await sites?.get(business))) : [];
    },
    // The business a new voice call is recorded for (#130), or null: one that is registered, records its calls (on unless
    // its config says no) and, from another site, is the site key's own. server.ts names the call's room after it.
    async recordingFor(business: unknown, siteBusiness?: string): Promise<string | null> {
      if (typeof business !== 'string' || !BUSINESS_ID.test(business) || (siteBusiness && business !== siteBusiness) || !vault || offline) return null;
      try { return recordsAudio(await sites?.get(business)) && (await sites?.get(business)) ? business : null; }
      catch (e) { log(`recording check for ${business}: ${(e as Error).message}`); return null; }
    },
    // A call's recording, opened, within its business's retention. Over HTTP only through /api/access/audio (#131).
    async callAudio(business: string, call: string) {
      const store = audioAt(await workspaceOf(business));
      return store ? store.open(business, call, retentionDays(await sites?.get(business))) : null;
    },
    // Erasure (#132). Not served over HTTP: who may erase is a business admin, which waits on grants (#131). Each destroys
    // the key in OpenBao first, so every copy stops opening, backups included, then removes the rows from Octo.
    // A caller (memory.ts customerKey's hash) was on this call; erasing the caller erases this call too.
    async linkCaller(business: string, caller: string, call: string): Promise<void> {
      if (!BUSINESS_ID.test(business) || !CALLER.test(caller) || !call) throw new Error('bad caller link');
      await callersAt(await workspaceOf(business))?.link(business, caller, call);
    },
    async eraseCall(business: string, call: string) {
      if (!BUSINESS_ID.test(business) || !call) throw new Error('bad call');
      const out = await eraseCall(business, call, await workspaceOf(business));
      log(`erase: call of ${business} (${out.records} record entries, ${out.recordings} recordings)`);
      return out;
    },
    async eraseCaller(business: string, caller: string) {
      if (!BUSINESS_ID.test(business) || !CALLER.test(caller)) throw new Error('bad caller');
      const ws = await workspaceOf(business), out = { calls: 0, records: 0, recordings: 0 };
      for (const call of await callersAt(ws)?.calls(business, caller) ?? []) {
        const n = await eraseCall(business, call, ws);
        out.calls++; out.records += n.records; out.recordings += n.recordings;
      }
      await sessionsAt(ws).delete(`cust:${business}:${caller}`);
      await callersAt(ws)?.forget(business, { caller });
      log(`erase: a caller of ${business} (${out.calls} calls)`);
      return out;
    },
    // A whole business, for good. `confirm` must be the business id typed again.
    async eraseBusiness(business: string, confirm: string) {
      if (!BUSINESS_ID.test(business)) throw new Error('bad business');
      if (confirm !== business) throw new Error('type the business id to confirm');
      if (!vault) throw new Error('erasing needs the key store');
      const ws = await workspaceOf(business), records = recordsAt(ws), audio = audioAt(ws);
      const kv = ws || inOcto ? ws ? sqlAt(ws) : sql : null;
      const kvRows = kv && (await kv(`select to_regclass('copilot_kv') as t`))[0]?.t
        ? await kv(`select k from copilot_kv where k like $1 or k like $2`, [`sess:${business}:%`, `cust:${business}:%`]) as { k: string }[] : [];
      const calls = new Set([...await records?.calls(business) ?? [], ...await audio?.calls(business) ?? [],
        ...kvRows.filter(r => r.k.startsWith('sess:')).map(r => r.k.slice(`sess:${business}:`.length))]);
      await vault.forgetBusiness(business);
      // The business key alone locks every call; each call's own key goes too so none is left behind in OpenBao.
      for (const call of calls) await vault.forgetCall(business, call).catch(e => log(`erase: a call key of ${business}: ${(e as Error).message}`));
      const out = { calls: calls.size, records: await records?.forget(business) ?? 0, recordings: await audio?.forget(business) ?? 0, sessions: 0 };
      await callersAt(ws)?.forget(business);
      // Resume snapshots and customer records, in Octo's key-value table.
      if (kv && kvRows.length) out.sessions = (await kv(`delete from copilot_kv where k like $1 or k like $2 returning k`, [`sess:${business}:%`, `cust:${business}:%`])).length;
      log(`erase: business ${business} (${out.calls} calls, ${out.records} record entries, ${out.recordings} recordings, ${out.sessions} snapshots and customer records)`);
      return out;
    },
    // For tests only (never over HTTP): which client a call was verified as.
    verifiedAs: clientOf,
    mode: offline ? 'offline (keyword search, word-overlap judge, rules)' : `live (Octo RAG, Jev ${env.LLAMA_URL ? '+ local LFM' : '+ rules'})`,
    // Every /api request passes the site gate first: the copilot's own site as before, another site only with its
    // business's site key and from one of that business's origins (decision 0021). Allowed cross-site answers carry
    // that origin's CORS headers; a key's business is the only one its requests may name.
    gate(req: Request) {
      return siteGate(sites, { origin: req.headers.get('origin'), host: (opts.ownHostHeader ? req.headers.get('x-own-host') : null) ?? new URL(req.url).host,
        own: ownOrigins, key: req.headers.get('x-site-key'), preflight: req.method === 'OPTIONS' });
    },
    async handle(req: Request, ip = ''): Promise<Response> {
      const path = new URL(req.url).pathname;
      if (path === '/api/health') return json({ ok: true, mode: offline ? 'offline' : 'live' });
      // The business's own page, on the copilot's own site only; it has its own sign-in, so the site gate doesn't apply.
      if (path.startsWith('/api/access/')) return access ? access.handle(req) : json({ error: 'business access needs Octo and the key store (live mode)' }, 503);
      let gate: Gate;
      try { gate = await this.gate(req); } catch (e) { log(`${path} site gate failed: ${(e as Error).message}`); return json({ error: 'backend error' }, 502); }
      if (!gate.ok) { log(`${path} ${gate.status} site not allowed`); return json({ error: gate.error }, gate.status); }
      if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: gate.headers });
      const r = await this.serve(req, ip, gate.business);
      for (const [k, v] of Object.entries(gate.headers)) r.headers.set(k, v);
      return r;
    },
    async serve(req: Request, ip: string, siteBusiness?: string): Promise<Response> {
      const path = new URL(req.url).pathname;
      if (path === '/api/call-audio' && req.method === 'POST') return callAudioApi(req);
      if (/^\/api\/(site|forms|slots|portal|staff|files|newsletter)(\/|$)/.test(path)) {
        if (!practice) return json({ error: 'the practice backend needs Octo (live mode)' }, 503);
        return practice.handle(req, ip || req.headers.get('cf-connecting-ip') || 'local');
      }
      if (path === '/api/site-media' && req.method === 'GET') {
        // The home page's pictures and films: which Octo file (public URL) goes in which slot, with its crop and cut times.
        // Octo is the only store, so when it can't answer the page just leaves the slots out. Kept for a minute so a visitor never waits on it.
        if (offline) return json({ error: 'site media needs Octo (live mode)' }, 503);
        try {
          if (!siteMedia || Date.now() - siteMedia.at > 60_000) {
            const rows = await sql(`select m.slot, m.kind, m.alt, m.pos, m.mpos, m.cuts, f.url, mf.url as mobile_url, pf.url as poster_url
              from site_media m join site_media_files f on f.name = m.file
              left join site_media_files mf on mf.name = m.mobile_file left join site_media_files pf on pf.name = m.poster_file`);
            siteMedia = { at: Date.now(), slots: Object.fromEntries(rows.map(r => [r.slot, { kind: r.kind, url: r.url, mobile_url: r.mobile_url ?? null, poster_url: r.poster_url ?? null, alt: r.alt ?? '', pos: r.pos ?? null, mpos: r.mpos ?? null, cuts: r.cuts ?? null }])) };
          }
          const ok = json({ slots: siteMedia.slots }); ok.headers.set('Cache-Control', 'public, max-age=60'); return ok;
        } catch (e) { log(`${path} failed: ${(e as Error).message}`); return json({ error: 'backend error' }, 502); }
      }
      if (path === '/api/copilot/config' && req.method === 'GET') {
        // A business's config, loaded on demand: what the widget would otherwise carry in the page.
        if (await limited(ip || req.headers.get('cf-connecting-ip') || 'local')) return json({ error: 'slow down' }, 429);
        const business = clip(new URL(req.url).searchParams.get('business'), 60);
        if (!BUSINESS_ID.test(business)) return json({ error: 'bad business' }, 400);
        if (siteBusiness && business !== siteBusiness) return json({ error: 'this site key is for another business' }, 403);
        try {
          const config = sites ? await sites.get(business) : null;
          if (!config) return json({ error: 'unknown business' }, 404);
          const { workspace: _, ...open } = config; // where its data lives is the server's business, not the page's
          const r = json({ config: open }); r.headers.set('Cache-Control', 'public, max-age=60'); return r;
        } catch (e) { log(`${path} failed: ${(e as Error).message}`); return json({ error: 'backend error' }, 502); }
      }
      if (path.startsWith('/api/library/') && path !== '/api/library/search' && req.method === 'GET') {
        if (await limited(ip || req.headers.get('cf-connecting-ip') || 'local')) return json({ error: 'slow down' }, 429);
        try { return await library(path, new URL(req.url).searchParams); } catch (e) { log(`${path} failed: ${(e as Error).message}`); return json({ error: 'backend error' }, 502); }
      }
      if (path === '/api/library/search' && req.method === 'GET') {
        // The site's own library search (Tax Guides page): Octo search over the irs/ library, no model call.
        if (await limited(ip || req.headers.get('cf-connecting-ip') || 'local')) return json({ error: 'slow down' }, 429);
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
      if (path !== '/api/warm' && path !== '/api/trace' && path !== '/api/score' && await limited(ip || req.headers.get('cf-connecting-ip') || 'local')) { log(`${path} 429 rate limit`); return json({ error: 'slow down' }, 429); }
      const raw = await req.text();
      if (raw.length > (path === '/api/desk' ? 64_000 : 32_000)) { log(`${path} 413`); return json({ error: 'too large' }, 413); }
      let b: any;
      try { b = JSON.parse(raw); } catch { log(`${path} 400 bad json`); return json({ error: 'bad json' }, 400); }
      if (siteBusiness && b && typeof b.business === 'string' && b.business !== siteBusiness) return json({ error: 'this site key is for another business' }, 403);
      const sid = req.headers.get('x-session-id');
      const session = sid && /^[\w-]{8,64}$/.test(sid) ? sid : null;
      const started = Date.now();
      try {
        const scope = smart.scope(req);
        const ws = await workspaceOf(siteBusiness ?? b?.business);
        const r = await route(path, b, ip || req.headers.get('cf-connecting-ip') || 'local', session, scope, ws);
        if (r.status >= 400) log(`${path} ${r.status}`);
        if (opts.trace && ['/api/understand', '/api/desk', '/api/search', '/api/judge', '/api/sentences'].includes(path)) void traceCall(path, b, r.clone(), started, session, scope, ws).catch(() => {});
        return r;
      } catch (e) {
        log(`${path} failed: ${(e as Error).stack ?? e}`);
        return json({ error: 'backend error' }, 502);
      }
    },
  };
}
