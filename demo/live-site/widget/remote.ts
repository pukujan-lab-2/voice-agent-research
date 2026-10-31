// Browser side of the backend: the engine runs in the page, and only these three things go to the server, which holds
// the keys. The server signs every passage it hands out, so the judge only ever sees real manual passages.
import type { Model, Understanding } from '../../../copilot-engine/src/types.ts';
import type { Judge, Passage, Retriever } from '../../../copilot-engine/src/guide.ts';
import type { ReturnCard, VerifyBackend, VerifyResult } from '../../../copilot-engine/src/verify.ts';
import { maskPII } from '../../../copilot-engine/src/guard.ts';
import { API_BASE } from './config.ts';
import { mask } from './mask.ts';

type Signed = Passage & { sig?: string };

// One id per call, sent with every request, so the server's traces of one call group into one Phoenix session.
export let callId = crypto.randomUUID();
export function newCall() { callId = crypto.randomUUID(); }

async function post(path: string, body: unknown): Promise<any> {
  const r = await fetch(`${API_BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-session-id': callId }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r.json();
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
// A step the widget timed itself (speech to text, voice, a turn, the call), sent to the server's traces. Masked here too.
export function traceSpan(name: string, start: number, input = '', output = '', attrs: Record<string, string | number> = {}, error = false) {
  try {
    void fetch(`${API_BASE}/api/trace`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'x-session-id': callId },
      body: JSON.stringify({ spans: [{ name, start, end: Date.now(), input: mask(input).slice(0, 2000), output: mask(output).slice(0, 2000), attrs, error }] }) }).catch(() => {});
  } catch { /* never let tracing break the page */ }
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
  async pick(question: string, passages: Passage[]): Promise<string> {
    try {
      const id: string = (await post('/api/judge', { question, passages })).id ?? '';
      this.last = passages.find(p => p.id === id);
      return id;
    } catch { return ''; }
  }
  async sentences(question: string, sentences: string[]): Promise<number[]> {
    if (!this.last) return [];
    try { return (await post('/api/sentences', { question, passage: this.last, sentences })).idx ?? []; } catch { return []; }
  }
}
