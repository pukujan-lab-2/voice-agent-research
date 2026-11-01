// Every call recorded in full in Phoenix through Octo (#17): one Phoenix session per call (session.id = the call id,
// which the voice agent's own spans carry too, speech/telemetry.py). Nothing is masked: each business decides what it
// keeps. What goes in:
//   failure.<kind>  at once, when it happens: a backend or RPC call that failed, voice falling back to text, the
//                   20-second no-agent cutoff, an error in a turn
//   turn            each turn: what was heard (and the speech model's confidence), the decision and why, the model and
//                   prompt version, the reply, the passages quoted, timings, and as children every tool call (name,
//                   arguments, result), each confirmation (decision 0011: risk score and band, what was read back, the
//                   caller's answer, whether it counted as yes), each action the code lock blocked, and each correction
//   call            when the call ends: business, pages, device and browser, voice stack and language, start, end, outcome
// turn.id ties a turn to the voice agent's span of the same turn; evals score either one by it (POST /api/score).
import { clearYes, RISK_BANDS, type Desk } from '../../../copilot-engine/src/desk.ts';
import { API_BASE } from './config.ts';

type Outcome = 'finished' | 'booked' | 'abandoned' | 'handed to a person' | 'fell back to text' | 'agent never answered' | 'error';
type Attrs = Record<string, string | number | boolean>;
type WidgetSpan = { name: string; kind?: 'CHAIN' | 'LLM' | 'TOOL' | 'RETRIEVER'; start: number; end: number; input?: string; output?: string; attrs?: Attrs; error?: boolean; children?: WidgetSpan[] };

type Call = {
  id: string; start: number; business: string; pages: string[]; channel: 'voice' | 'text'; language: string;
  turns: number; happened: Outcome[]; failures: number; voice: Attrs;
};
let call: Call | null = null;

function send(spans: WidgetSpan[], id = call?.id) {
  if (!id) return;
  try {
    void fetch(`${API_BASE}/api/trace`, { method: 'POST', keepalive: true, headers: { 'Content-Type': 'application/json', 'x-session-id': id },
      body: JSON.stringify({ spans }) }).catch(() => {});
  } catch { /* never let tracing break the page */ }
}

function device(): Attrs {
  const ua = navigator.userAgent;
  const kind = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'phone' : 'desktop';
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'other';
  return { 'device.kind': kind, 'device.browser': browser, 'device.user_agent': ua, 'device.language': navigator.language ?? '', 'device.screen': `${screen.width}x${screen.height}` };
}

export function beginCall(id: string, business: string, channel: 'voice' | 'text') {
  call = { id, start: Date.now(), business, pages: [location.pathname], channel, language: document.documentElement.lang || 'en', turns: 0, happened: [], failures: 0, voice: {} };
}

// What the voice agent says about itself (its speech models, the language it heard), from its RPC payloads.
export function noteVoice(info: Record<string, unknown>) {
  if (!call) return;
  call.channel = 'voice';
  for (const [k, v] of Object.entries(info)) if (typeof v === 'string' || typeof v === 'number') call.voice[`voice.${k}`] = v;
}
export function notePage(path: string) { if (call && call.pages[call.pages.length - 1] !== path) call.pages.push(path); }

// Something that happened on the call that decides its outcome (booked, handed to a person) without being a failure.
export function happened(o: Outcome) { if (call && !call.happened.includes(o)) call.happened.push(o); }

export function failure(kind: string, message: string, attrs: Attrs = {}, outcome?: Outcome) {
  if (!call) return;
  call.failures++;
  if (outcome) happened(outcome);
  const at = Date.now();
  send([{ name: `failure.${kind}`, start: at, end: at, output: message, error: true, attrs: { 'failure.kind': kind, 'call.id': call.id, page: location.pathname, ...attrs } }]);
}

// The desk's state before a turn, so the turn's tool calls, confirmations and corrections can be told apart after it.
export type DeskMark = { desk: Desk; turns: number; events: number; fills: number; pending: Desk['pending']; values: Record<string, string> };
export const markDesk = (desk: Desk | null): DeskMark | null =>
  desk ? { desk, turns: desk.turns.length, events: desk.events.length, fills: desk.fills.length, pending: desk.pending ? { ...desk.pending } : null, values: { ...desk.values } } : null;

// Decision 0011's band for a risk score, from the desk's own table (the one its prompt and code lock read).
const band = (risk: number) => RISK_BANDS.find(b => risk <= b.upTo)?.rule ?? '';
// What the code lock (and the desk's other code checks) refused this turn.
const BLOCKED = new Set(['confirm_refused', 'confirm_nothing', 'end_refused', 'page_refused', 'locked', 'needs_person']);

function deskSpans(m: DeskMark, heard: string, at: number): { attrs: Attrs; children: WidgetSpan[] } {
  const d = m.desk;
  const log = d.turns.length > m.turns ? d.turns[d.turns.length - 1] : undefined;
  const events = d.events.slice(m.events);
  const attrs: Attrs = { 'desk.flow': d.flow.id, 'desk.prompt_version': d.promptVersion };
  if (log) {
    attrs['llm.model_name'] = log.model;
    attrs['desk.ms'] = log.ms;
    attrs['desk.calls'] = log.calls.join(' ');
    if (log.fallback) attrs['desk.fallback'] = log.fallback;
  }
  // acts are the desk's last model turn: only this turn's when the desk ran one (a memory turn is code alone).
  const children: WidgetSpan[] = (log && log.model !== 'code' ? d.acts : []).map(a => ({ name: a.name, kind: 'TOOL' as const, start: at, end: at, input: JSON.stringify(a.args), output: a.result,
    attrs: { 'tool.name': a.name, 'tool.parameters': JSON.stringify(a.args) }, error: /^refused|^nothing is waiting/i.test(a.result) }));
  if (log && m.pending) {
    // A read-back was waiting for this answer: what was read back, what the caller said, and whether it counted as yes.
    const f = d.field(m.pending.field);
    const confirmed = events.some(e => e.type === 'confirm' && e.field === m.pending!.field);
    const ca: Attrs = { 'confirm.field': m.pending.field, 'confirm.value': m.pending.value, 'confirm.readback': m.pending.text, 'confirm.answer': heard,
      'confirm.counted_yes': clearYes(heard), 'confirm.confirmed': confirmed };
    if (f) { ca['confirm.risk'] = d.risk(f); ca['confirm.band'] = band(d.risk(f)); }
    children.push({ name: 'confirmation', start: at, end: at, input: m.pending.text, output: heard, attrs: ca });
    attrs['confirm.counted_yes'] = clearYes(heard);
  }
  // Each value filled this turn, with its risk and band, the read-back and the yes (both empty for one said in passing),
  // so evals can check that every fill from 56 up had its yes.
  for (const fl of d.fills.slice(m.fills)) {
    const risk = fl.risk ?? 0;
    children.push({ name: 'fill', start: at, end: at, input: fl.readback, output: fl.yes, attrs: { field: fl.field, value: fl.value, 'fill.risk': risk, 'fill.band': band(risk),
      'fill.readback': fl.readback, 'fill.yes': fl.yes, 'fill.asked': fl.yes ? 'yes' : 'in passing', 'fill.counted_yes': !!fl.yes && clearYes(fl.yes) } });
  }
  let corrections = 0;
  for (const e of events) {
    const ea: Attrs = { 'desk.event': e.type, ...(e.field ? { field: e.field } : {}), ...(e.value ? { value: e.value } : {}), ...(e.detail ? { detail: e.detail } : {}), ...(e.by ? { by: e.by } : {}) };
    if (BLOCKED.has(e.type)) children.push({ name: 'lock.blocked', start: at, end: at, input: e.type, output: e.detail ?? '', attrs: ea, error: true });
    // A correction (a mishearing put right): a no to the read-back, or a new value for a field that was read back or filled.
    const was = e.field ? (m.pending?.field === e.field ? m.pending.value : m.values[e.field]) : undefined;
    if (e.type === 'reject' || (e.type === 'propose' && was !== undefined && was !== e.value)) {
      corrections++;
      children.push({ name: 'correction', start: at, end: at, input: was ?? '', output: e.value ?? '', attrs: { ...ea, 'correction.before': was ?? '', 'correction.after': e.value ?? '' } });
    } else if (!BLOCKED.has(e.type)) children.push({ name: `desk.${e.type}`, start: at, end: at, attrs: ea });
  }
  attrs['turn.corrections'] = corrections;
  attrs['turn.lock_blocks'] = events.filter(e => BLOCKED.has(e.type)).length;
  return { attrs, children: children.slice(0, 40) };
}

type TurnRecord = {
  id: string; start: number; heard: string; reply: string; kind: string; why: string; mode: string;
  voice?: Record<string, unknown>; desk: DeskMark | null; quoted?: { title: string; href: string; quote: string[] }; error?: string;
};
export function logTurn(t: TurnRecord) {
  if (!call) return;
  call.turns++;
  const end = Date.now();
  const attrs: Attrs = { 'turn.id': t.id, 'turn.n': call.turns, 'call.id': call.id, 'turn.decision': t.kind, 'turn.why': t.why, mode: t.mode, page: location.pathname,
    'turn.channel': t.voice ? 'voice' : 'text', 'turn.decide_ms': end - t.start };
  for (const [k, v] of Object.entries(t.voice ?? {})) if (typeof v === 'string' || typeof v === 'number') attrs[`voice.${k}`] = v;
  const children: WidgetSpan[] = [];
  if (t.desk) { const r = deskSpans(t.desk, t.heard, end); Object.assign(attrs, r.attrs); children.push(...r.children); }
  if (t.quoted) {
    attrs['guide.title'] = t.quoted.title; attrs['guide.href'] = t.quoted.href; attrs['guide.quote'] = t.quoted.quote.join(' … ');
    children.push({ name: 'guide.quote', kind: 'RETRIEVER', start: end, end, input: t.heard, output: t.quoted.quote.join('\n'),
      attrs: { 'retrieval.documents.0.document.id': t.quoted.href, 'retrieval.documents.0.document.content': t.quoted.quote.join(' … ') } });
  }
  if (t.error) attrs['turn.error'] = t.error;
  send([{ name: 'turn', start: t.start, end, input: t.heard, output: t.reply, attrs, error: !!t.error || !t.reply, children }]);
}

// The call's own span, sent once when it ends; how: 'ended' (the caller hung up) or 'left' (closed or left the page).
export function endCall(how: 'ended' | 'left', formOpen: boolean) {
  if (!call) return;
  const c = call; call = null;
  const order: Outcome[] = ['booked', 'handed to a person', 'agent never answered', 'fell back to text', 'error'];
  const outcome = order.find(o => c.happened.includes(o)) ?? (how === 'left' || formOpen ? 'abandoned' : 'finished');
  send([{ name: 'call', start: c.start, end: Date.now(), output: outcome, error: outcome === 'error' || outcome === 'agent never answered', attrs: {
    'call.id': c.id, 'call.business': c.business, 'call.pages': c.pages.join(' '), 'call.first_page': c.pages[0], 'call.channel': c.channel,
    'call.language.picked': c.language, 'call.outcome': outcome, 'call.happened': c.happened.join(', '), 'call.ended': how === 'ended' ? 'caller hung up' : 'left the page',
    'call.turns': c.turns, 'call.failures': c.failures, 'call.start': new Date(c.start).toISOString(), 'call.end': new Date().toISOString(), ...device(), ...c.voice,
  } }], c.id);
}
