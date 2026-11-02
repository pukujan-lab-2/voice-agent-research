// Browser side of the backend: the engine runs in the page, and only these three things go to the server, which holds
// the keys. The server signs every passage it hands out, so the judge only ever sees real manual passages.
import type { Model, Understanding } from '../../../copilot-engine/src/types.ts';
import type { ChatModel, ChatMsg, ChatResult } from '../../../copilot-engine/src/desk.ts';
import type { Judge, Passage, Retriever } from '../../../copilot-engine/src/guide.ts';
import type { ReturnCard, VerifyBackend, VerifyResult } from '../../../copilot-engine/src/verify.ts';
import { maskPII } from '../../../copilot-engine/src/guard.ts';
import { API_BASE } from './config.ts';
import { failure } from './calllog.ts';

type Signed = Passage & { sig?: string };

// One id per call, sent with every request, so the server's traces of one call group into one Phoenix session.
export let callId = crypto.randomUUID();
export function newCall() { callId = crypto.randomUUID(); deskStack = ''; }
// The voice stack the call runs on, so the server can send the desk's tool calls to the stack's own model (stacks.json "thinks").
let deskStack = '';
export function setDeskStack(stack: string) { deskStack = stack; }

// Every failed backend call goes to the call's traces as it happens (the caller's turn then carries on without it).
async function post(path: string, body: unknown): Promise<any> {
  try {
    const r = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-id': callId }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return await r.json();
  } catch (e) {
    failure('backend', (e as Error).message, { path });
    throw e;
  }
}

// Errors in the visitor's browser go to the server log (at most 10 per page), so failures on real phones can be seen.
let reported = 0;
export function report(where: string, message: string) {
  if (++reported > 10) return;
  try {
    void fetch(`${API_BASE}/api/log`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ where, message: maskPII(String(message)).slice(0, 300), page: location.pathname, ua: navigator.userAgent }) }).catch(() => {});
  } catch { /* never let reporting break the page */ }
}
addEventListener('error', e => report('page', `${e.message} @ ${e.filename?.split('/').pop()}:${e.lineno}`));
addEventListener('unhandledrejection', e => report('promise', String((e as PromiseRejectionEvent).reason?.message ?? (e as PromiseRejectionEvent).reason)));

// Caller verification: the confirmed answers go to the server, which compares them with the client list and says only
// match / no_match / need_more / locked. The call id it hands back carries the tries; a new call starts a new one.
export class RemoteVerify implements VerifyBackend {
  call = '';
  async check(values: Record<string, string>): Promise<VerifyResult> {
    try {
      const r = await post('/api/verify', { call: this.call || undefined, ...values });
      this.call = r.call ?? this.call;
      return { result: r.result, ask: r.ask, triesLeft: r.triesLeft };
    } catch { return { result: 'no_match', triesLeft: 1 }; }
  }
  async status(): Promise<ReturnCard | null> {
    try { return (await post('/api/account/status', { call: this.call })).card ?? null; } catch { return null; }
  }
}

// Jev decides whether a free-text answer is on topic; a failure is only ever "ask again".
export class RemoteModel implements Model {
  name = 'remote';
  async understand({ flow, field, said, values }: Parameters<Model['understand']>[0]): Promise<Understanding> {
    try {
      return await post('/api/understand', {
        flow: { business: flow.business, scope: flow.scope },
        field: { name: field.name, label: field.label, question: field.question, kind: field.kind },
        said, values,
      });
    } catch { return { action: 'ask_again' }; }
  }
}

// One turn of the v2 desk's model (LFM3 on our server). Any failure throws, and the desk runs that turn on its code
// rules; when the server has no desk model (offline), every later turn goes straight to the rules.
// The caller's language on a voice call (docs/decisions/0012): LFM3 writes its replies in it, and the lines code writes
// (greetings, read-backs, small talk) are put into it before they are spoken. English needs neither.
let replyLanguage = 'English';
export function setReplyLanguage(name: string) { replyLanguage = name || 'English'; }
function inLanguage(messages: ChatMsg[]): ChatMsg[] {
  if (replyLanguage === 'English') return messages;
  const rule = `\nThe caller speaks ${replyLanguage}. Write every reply in ${replyLanguage}, read-backs and confirmations included. Keep names, numbers, email addresses and tool arguments exactly as the caller gave them.`;
  let done = false;
  return messages.map(m => {
    if (done || m.role !== 'system' || typeof m.content !== 'string') return m;
    done = true;
    return { ...m, content: m.content.replace(/Spoken English/g, `Spoken ${replyLanguage}`) + rule };
  });
}
const translated = new Map<string, string>();
export async function toReplyLanguage(text: string): Promise<string> {
  if (replyLanguage === 'English' || !text.trim()) return text;
  const key = `${replyLanguage}\n${text}`;
  const hit = translated.get(key);
  if (hit) return hit;
  try {
    const r = await post('/api/desk', { messages: [
      { role: 'system', content: `Translate what the assistant is about to say on a phone call into natural spoken ${replyLanguage}. If it is already in ${replyLanguage}, return it unchanged. Keep names, numbers, spelled-out letters and email addresses exactly as they are. Reply with the translation only.` },
      { role: 'user', content: text }], tools: [], max_tokens: 220 });
    const out = String(r.content ?? '').trim();
    if (!out) return text;
    if (translated.size > 200) translated.clear();
    translated.set(key, out);
    return out;
  } catch (e) {
    report('voice', `translate: ${(e as Error).message}`);
    return text;
  }
}

// The server's smart model for the hard turns of a development call (decision 0017). The page never decides who may use it: every
// local answer from /api/desk says whether a smart model may answer now (a development host or the owner, under the cap), and
// until it says so this model is unavailable, so the desk runs exactly as it did before and an ordinary visitor's page never asks.
export class RemoteSmartModel implements ChatModel {
  name = 'smart';
  available = false;
  unavailable() { return !this.available; }
  async chat(messages: ChatMsg[], tools: unknown[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<ChatResult> {
    if (this.available === false) throw new Error('no smart model');
    messages = inLanguage(messages);
    const t0 = Date.now();
    const r = await fetch(`${API_BASE}/api/desk`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-id': callId },
      body: JSON.stringify({ messages, tools, max_tokens: opts.maxTokens, temperature: opts.temperature, smart: true }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      // off, out of scope, no key or over the cap: stop asking. A timeout or a failed call is kept quiet only in the turn (the local answer stands).
      if (['off', 'scope', 'no-key', 'cap'].includes(j.reason)) this.available = false;
      else failure('desk-smart', `/api/desk smart: ${j.reason ?? r.status}`, { path: '/api/desk', fallback: 'local model' });
      throw new Error(`smart: ${j.reason ?? r.status}`);
    }
    this.available = j.smart === true;
    return { content: String(j.content ?? ''), calls: Array.isArray(j.calls) ? j.calls : [], ms: Date.now() - t0, model: String(j.model ?? this.name) };
  }
}

export class RemoteDeskModel implements ChatModel {
  name = 'lfm3';
  private smart?: RemoteSmartModel;
  constructor(smart?: RemoteSmartModel) { this.smart = smart; }
  private off = new Set<string>(); // the stacks whose model the server said it has none of (a call on another stack still has its own)
  async chat(messages: ChatMsg[], tools: unknown[], opts: { maxTokens?: number; temperature?: number } = {}): Promise<ChatResult> {
    if (this.off.has(deskStack)) throw new Error('no desk model');
    messages = inLanguage(messages);
    const t0 = Date.now();
    const r = await fetch(`${API_BASE}/api/desk`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-id': callId },
      body: JSON.stringify({ messages, tools, max_tokens: opts.maxTokens, temperature: opts.temperature, stack: deskStack }) });
    if (r.status === 503) this.off.add(deskStack);
    if (!r.ok) { failure('desk-model', `/api/desk: ${r.status}`, { path: '/api/desk', fallback: 'code rules' }); throw new Error(`/api/desk: ${r.status}`); }
    const j = await r.json();
    if (this.smart) this.smart.available = j.smart === true;
    return { content: String(j.content ?? ''), calls: Array.isArray(j.calls) ? j.calls : [], ms: Date.now() - t0, model: String(j.model ?? this.name) };
  }
}

// Wakes the local model on the server (it unloads after a few idle minutes). Resolves when it has loaded.
export async function warmUp(): Promise<void> {
  try { await post('/api/warm', {}); } catch { /* the first answer just takes a little longer */ }
}

// Octo RAG search, limited by the server to one manual.
export class RemoteRetriever implements Retriever {
  private manual: string;
  constructor(manual: string) { this.manual = manual; }
  async search(query: string, k: number): Promise<Passage[]> {
    try { return (await post('/api/search', { manual: this.manual, query, k })).passages ?? []; } catch { return []; }
  }
}

export class RemoteJudge implements Judge {
  private last?: Signed;
  lastProbs?: Record<string, number>;
  async pick(question: string, passages: Passage[]): Promise<string> {
    try {
      const r = await post('/api/judge', { question, passages });
      const id: string = r.id ?? '';
      this.lastProbs = r.probs && typeof r.probs === 'object' ? r.probs : undefined;
      this.last = passages.find(p => p.id === id);
      return id;
    } catch { this.lastProbs = undefined; return ''; }
  }
  async sentences(question: string, sentences: string[]): Promise<number[]> {
    if (!this.last) return [];
    try { return (await post('/api/sentences', { question, passage: this.last, sentences })).idx ?? []; } catch { return []; }
  }
}
