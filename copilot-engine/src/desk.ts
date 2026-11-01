// Desk (v2): an LLM-led front-desk conversation over a code-owned form runtime (the Pipecat Flows idea in TS).
// The model talks and picks actions through tools; code owns the form. Code normalises and validates every value,
// writes the read-back (names spelled, numbers grouped), fills a field only after a confirmed read-back, never
// submits, only knows real fields and options, and answers side questions only from the business's own passages.
// If the model fails or times out, that turn runs on the v1 rules (the same guard functions the Copilot uses).
// It runs in Node (tests, the desk simulator) and in the browser (the live site), so it reads no Node-only globals.
import type { Field, Flow, Hooks } from './types.ts';
import { formatDate, formatSerial, parseName, spellOut, spokenDigits, spokenToCode, spokenToDate, spokenToEmail, spokenToPhone, spokenToSerial, stripFiller, validEmail, validSerial, yesNo } from './guard.ts';
import { shortQuote, type Passage, type SearchFilter } from './guide.ts';
import { filterFrom, SEARCH_HINT, withSearchTools, type SiteSearch } from './search-site.ts';
import { LOOKUP_HINT, type Caller, type Lookups } from './lookups.ts';
import { customerKey, newSessionId, SESSION_TTL_MS, type CustomerRecord, type SessionSnapshot, type Store } from './memory.ts';

// Environment settings in Node; none in the browser.
const ENV: Record<string, string | undefined> = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

// ---------- model client (OpenAI-compatible chat completions with tools) ----------
export type ToolCall = { name: string; args: Record<string, unknown> };
export type ChatMsg = { role: 'system' | 'user' | 'assistant' | 'tool'; content: string | null; tool_calls?: unknown[]; tool_call_id?: string };
export type ChatResult = { content: string; calls: ToolCall[]; ms: number; model: string };
export interface ChatModel { name: string; chat(messages: ChatMsg[], tools: unknown[], opts?: { maxTokens?: number; temperature?: number; json?: boolean }): Promise<ChatResult> }

export class OpenAIChat implements ChatModel {
  name: string;
  waitedMs = 0; // time spent waiting out rate limits (a test harness subtracts it from latency)
  private o: { url: string; key: string; model: string; stream: boolean; nothink: boolean; timeoutMs: number; patient: boolean; toolsHeader: string };
  // patient: in tests, wait out 429 rate-limit windows (up to ~10 min) instead of failing the turn.
  // toolsHeader: a line the system prompt ends with when tools are offered (LFM3-Audio's card: "List of tools:"; its chat template then adds the tools).
  constructor(o: { url?: string; key?: string; model?: string; stream?: boolean; nothink?: boolean; timeoutMs?: number; patient?: boolean; toolsHeader?: string } = {}) {
    this.o = {
      url: (o.url ?? ENV.DESK_URL ?? '').replace(/\/$/, ''), key: o.key ?? ENV.DESK_KEY ?? '',
      model: o.model ?? ENV.DESK_MODEL ?? '', stream: o.stream ?? ENV.DESK_STREAM === '1',
      nothink: o.nothink ?? ENV.DESK_THINK !== '1', timeoutMs: o.timeoutMs ?? 15000, patient: o.patient ?? false, toolsHeader: o.toolsHeader ?? '',
    };
    if (!this.o.url) throw new Error('DESK_URL is not set');
    this.name = this.o.model || 'desk-model';
  }

  async chat(messages: ChatMsg[], tools: unknown[], opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}): Promise<ChatResult> {
    const t0 = Date.now();
    if (this.o.toolsHeader && tools.length && messages[0]?.role === 'system') messages = [{ ...messages[0], content: `${messages[0].content ?? ''}\n\n${this.o.toolsHeader}` }, ...messages.slice(1)];
    const body: Record<string, unknown> = { model: this.o.model, messages, max_tokens: opts.maxTokens ?? 220, temperature: opts.temperature ?? 0.3 };
    if (tools.length) { body.tools = tools; body.tool_choice = 'auto'; }
    if (this.o.nothink) body.chat_template_kwargs = { enable_thinking: false };
    if (this.o.stream) body.stream = true;
    let lastErr = '';
    let t1 = t0;
    for (let attempt = 0; attempt < (this.o.patient ? 40 : 3); attempt++) {
      try {
        t1 = Date.now();
        const r = await fetch(`${this.o.url}/chat/completions`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...(this.o.key ? { Authorization: `Bearer ${this.o.key}` } : {}) },
          body: JSON.stringify(body), signal: AbortSignal.timeout(this.o.timeoutMs),
        });
        const txt = await r.text();
        if (!r.ok) {
          lastErr = `${r.status} ${txt.slice(0, 120)}`;
          if ((r.status === 429 || r.status >= 500) && !/context size|context length|exceeds the context/i.test(txt)) {
            // Only rate limits are waited out patiently; a server error gets three tries.
            if ((!this.o.patient || r.status !== 429) && attempt >= 2) break;
            if (ENV.DESK_DEBUG) console.error(`[${this.o.model}] ${lastErr.slice(0, 160)}`);
            const wait = this.o.patient && r.status === 429 ? 15000 : 1500 * (attempt + 1);
            this.waitedMs += wait; await new Promise(res => setTimeout(res, wait)); continue;
          }
          throw new Error(lastErr);
        }
        let content = '', calls: ToolCall[] = [], model = this.o.model;
        if (this.o.stream) {
          const acc: Record<number, { name: string; args: string }> = {};
          for (const line of txt.split('\n')) {
            if (!line.startsWith('data:') || line.includes('[DONE]')) continue;
            try { const j = JSON.parse(line.slice(5)); model = j.model ?? model; const d = j.choices?.[0]?.delta ?? {}; content += d.content ?? '';
              for (const c of d.tool_calls ?? []) { acc[c.index ?? 0] ??= { name: '', args: '' }; acc[c.index ?? 0].name += c.function?.name ?? ''; acc[c.index ?? 0].args += c.function?.arguments ?? ''; } } catch { /* skip */ }
          }
          calls = Object.values(acc).map(c => ({ name: c.name, args: parseArgs(c.args) }));
        } else {
          const j = JSON.parse(txt);
          model = j.model ?? model;
          const m = j.choices?.[0]?.message ?? {};
          content = m.content ?? '';
          calls = (m.tool_calls ?? []).map((c: { function: { name: string; arguments: string } }) => ({ name: c.function?.name, args: parseArgs(c.function?.arguments) }));
        }
        if (!calls.length) { const t = textToolCalls(content); if (t.calls.length) { calls = t.calls; content = t.rest; } }
        return { content: content.replace(/<think>[\s\S]*?<\/think>/g, '').trim(), calls, ms: Date.now() - t1, model };
      } catch (e) {
        lastErr = (e as Error).message;
        if ((e as Error).name === 'TimeoutError') break;
      }
    }
    throw new Error(`chat failed: ${lastErr}`);
  }
}

// LFM3-Audio-2B as the desk's model, on the llama.cpp server speech/server.py runs (the lfm3-audio voice stack, decision 0012).
export function lfm3AudioChat(baseUrl: string): OpenAIChat {
  return new OpenAIChat({ url: `${baseUrl.replace(/\/$/, '')}/v1`, key: '', model: 'lfm3-audio', stream: false, nothink: true, timeoutMs: 30000, toolsHeader: 'List of tools:' });
}

function parseArgs(a: unknown): Record<string, unknown> {
  if (a && typeof a === 'object') return a as Record<string, unknown>;
  try { return JSON.parse(String(a || '{}')); } catch { return {}; }
}

// Small models sometimes write tool calls as text: JSON {"name":..,"arguments":..} or python style propose_value(field="x", value="y").
const TOOL_NAMES = ['propose_value', 'confirm_pending', 'reject_pending', 'go_to_field', 'answer_question', 'search_site', 'end_call'];
export function textToolCalls(content: string): { calls: ToolCall[]; rest: string } {
  const calls: ToolCall[] = [];
  let rest = content.replace(/<\|?tool_call(_start)?\|?>|<\|?tool_call(_end)?\|?>|<\/?tool_call>/g, ' ');
  rest = rest.replace(/\{[^{}]*"name"\s*:\s*"(\w+)"[^{}]*"(?:arguments|parameters)"\s*:\s*(\{[^{}]*\})[^{}]*\}/g, (_m, n: string, a: string) => {
    if (TOOL_NAMES.includes(n)) { calls.push({ name: n, args: parseArgs(a) }); return ' '; } return _m;
  });
  rest = rest.replace(new RegExp(`\\[?\\b(${TOOL_NAMES.join('|')})\\(([^()]*)\\)\\]?`, 'g'), (_m, n: string, a: string) => {
    const args: Record<string, unknown> = {};
    for (const m of a.matchAll(/(\w+)\s*=\s*("([^"]*)"|'([^']*)')/g)) args[m[1]] = m[3] ?? m[4];
    calls.push({ name: n, args }); return ' ';
  });
  return { calls, rest: rest.replace(/\s+/g, ' ').trim() };
}

// ---------- values: normalise, validate, read back ----------
const NUM: Record<string, string> = { zero: '0', oh: '0', o: '0', one: '1', two: '2', to: '2', too: '2', three: '3', four: '4', for: '4', five: '5', six: '6', seven: '7', eight: '8', ate: '8', nine: '9' };
const LETTERS: Record<string, string> = {
  ay: 'a', bee: 'b', be: 'b', cee: 'c', see: 'c', sea: 'c', dee: 'd', ee: 'e', ef: 'f', eff: 'f', gee: 'g', aitch: 'h', jay: 'j', kay: 'k',
  el: 'l', ell: 'l', em: 'm', en: 'n', oh: 'o', pee: 'p', cue: 'q', queue: 'q', ar: 'r', are: 'r', ess: 's', es: 's', tee: 't', tea: 't',
  you: 'u', vee: 'v', ex: 'x', why: 'y', zee: 'z', zed: 'z',
  alpha: 'a', alfa: 'a', bravo: 'b', charlie: 'c', delta: 'd', echo: 'e', foxtrot: 'f', golf: 'g', hotel: 'h', india: 'i', juliet: 'j', juliett: 'j',
  kilo: 'k', lima: 'l', mike: 'm', november: 'n', oscar: 'o', papa: 'p', quebec: 'q', romeo: 'r', sierra: 's', tango: 't', uniform: 'u',
  victor: 'v', whiskey: 'w', xray: 'x', yankee: 'y', zulu: 'z',
};
const letterOf = (tok: string): string => {
  const w = tok.toLowerCase();
  if (/^[a-z]$/.test(w)) return w;
  if (w === 'doubleu' || w === 'doubleyou') return 'w';
  return LETTERS[w] ?? '';
};

// Joins spelled-out runs ("P O O J A", "pee oh oh jay ay", "P-O-O-J-A", "P double O J A") into words.
export function joinSpelled(text: string): string {
  const t = text.replace(/\bdouble[\s-]+(u|you)\b/gi, 'doubleu').replace(/\b([A-Za-z])(?:-(?=[A-Za-z]\b))/g, '$1 ');
  const toks = t.split(/[\s,]+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < toks.length;) {
    let j = i, word = '';
    while (j < toks.length) {
      const tk = toks[j].replace(/[.]/g, '');
      if (/^(double|triple)$/i.test(tk) && j + 1 < toks.length && letterOf(toks[j + 1].replace(/[.]/g, ''))) { word += letterOf(toks[j + 1].replace(/[.]/g, '')).repeat(/double/i.test(tk) ? 2 : 3); j += 2; continue; }
      const l = letterOf(tk);
      if (!l) break;
      word += l; j++;
    }
    if (j - i >= 3 || (j - i >= 2 && toks.slice(i, j).every(x => /^[A-Za-z]\.?$/.test(x)))) { out.push(word); i = j; } else { out.push(toks[i]); i++; }
  }
  return out.join(' ');
}

const lev = (a: string, b: string): number => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
};
const titleWord = (w: string): string => w.split(/([-'])/).map(p => /^[a-z]/i.test(p) ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p).join('').replace(/^(Mc)([a-z])/, (_m, a: string, b: string) => a + b.toUpperCase());

// A first or last name field ("Beneficiary first name") takes one word.
const partName = (f: Field) => /\b(first|last|given|family|middle)\s+name\b|\bsurname\b/i.test(f.label);

export function normalizeName(raw: string, part = false): { value?: string; problem?: string } {
  let t = raw.trim().replace(/[’]/g, "'").replace(/[.!?;:"]+/g, ' ');
  const parsed = parseName(t);
  if (parsed) t = parsed;
  t = joinSpelled(t);
  let words = t.split(/\s+/).filter(Boolean).filter(w => !/^(and|the|is|my|name|its|it's|um|uh)$/i.test(w));
  if (words.some(w => /\d/.test(w))) return { problem: 'That has numbers in it, so it may not be a name.' };
  if (words.length && words.every(w => /^(yes|yeah|yep|yup|no|nope|ok(ay)?|sure|that'?s|thats|that|is|it|right|correct|fine|good|great|perfect|thanks?|thank|you|please|exactly|absolutely)$/i.test(w))) return { problem: "Sorry, I didn't catch a name there. What's the full name?" };
  words = words.map(w => w.replace(/[^A-Za-z'\-]/g, '')).filter(Boolean);
  // Speech-recognition doubling: "Pooja Pooja Bajracharya", "Pooja Bajracharya Pooja Bajracharya",
  // "Pooja Bajracharya PUJANBAJRACHARYA" (the whole name again, joined): keep one copy.
  words = words.filter((w, i) => i === 0 || w.toLowerCase() !== words[i - 1].toLowerCase());
  for (let n = Math.floor(words.length / 2); n >= 1; n--) {
    const a = words.slice(0, n).join(' ').toLowerCase(), b = words.slice(n, 2 * n).join(' ').toLowerCase();
    if (words.length === 2 * n && a === b) { words = words.slice(0, n); break; }
  }
  if (words.length >= 3) {
    const last = words[words.length - 1].toLowerCase(), joined = words.slice(0, -1).join('').toLowerCase();
    if (last.length >= 6 && lev(last, joined) <= Math.max(2, Math.round(joined.length * 0.35))) words = words.slice(0, -1);
  }
  if (!words.length) return { problem: "I didn't catch the name." };
  if (words.length > 5) return { problem: 'That sounded like more than one name.' };
  if (words.length < 2 && !part) return { problem: 'Could I have the full name, first and last?' };
  return { value: words.map(titleWord).join(' ') };
}

export function normalizePhone(raw: string): { value?: string; problem?: string } {
  let d = spokenToPhone(raw).replace(/\D/g, '') || raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('1')) d = d.slice(1);
  if (d.length !== 10) return { problem: `I got ${d.length} digit${d.length === 1 ? '' : 's'}, and a phone number here has 10.` };
  return { value: `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` };
}

export function normalizeEmail(raw: string): { value?: string; problem?: string } {
  let t = raw.trim().toLowerCase();
  const spoken = spokenToEmail(t);
  if (spoken) t = spoken;
  t = t.replace(/\s*\bat\b\s*/g, '@').replace(/\s*\bdot\b\s*/g, '.').replace(/\s+/g, '').replace(/\.+$/, '');
  if (!validEmail(t)) return { problem: "I didn't get a complete email address. Could you say it like name at example dot com?" };
  return { value: t };
}

export function normalizeSerial(raw: string, example = '1334-592C-LSD3'): { value?: string; problem?: string } {
  const s = spokenToSerial(raw);
  if (validSerial(s)) return { value: s };
  // Chatty speech adds stray letters ("a little", "I", "see"): try each sentence alone, and the part after "it's".
  const found = new Set<string>();
  for (const sent of raw.split(/[.!?;]+\s|\bthat'?s\b/i)) {
    for (const c of [sent, sent.split(/\b(?:it'?s|it is|here goes|number is)\b[:,]?/i).pop() ?? '']) { const v = spokenToSerial(c); if (validSerial(v)) found.add(v); }
  }
  if (found.size === 1) return { value: [...found][0] };
  if (!s) return { problem: `I didn't catch the serial number. It has 12 characters, like ${example}.` };
  return { problem: `I got ${groupChars(s)}, that's ${s.length} character${s.length === 1 ? '' : 's'}, but the serial number has 12, in three groups of four like ${example}.` };
}

export function matchOption(f: Field, raw: string): string {
  const t = raw.trim().toLowerCase();
  const opts = f.options ?? [];
  const exact = opts.find(o => o.toLowerCase() === t);
  if (exact) return exact;
  const hits = opts.filter(o => [o, ...(f.synonyms?.[o] ?? [])].some(w => new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/[.*+?^$()|[\]\\{}]/g, '\\$&')}s?($|[^a-z])`).test(t)));
  return hits.length === 1 ? hits[0] : '';
}

export function normalize(f: Field, raw: string): { value?: string; problem?: string } {
  const v = String(raw ?? '').trim();
  if (!v) return { problem: 'I did not catch that.' };
  switch (f.kind) {
    case 'name': return normalizeName(v, partName(f));
    case 'phone': return normalizePhone(v);
    case 'email': return normalizeEmail(v);
    case 'serial': return normalizeSerial(v, f.hint?.match(/\b[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}\b/)?.[0]);
    case 'choice': { const o = matchOption(f, v); return o ? { value: o } : { problem: `For the ${f.label} I can put ${orList(f.options ?? [])}.` }; }
    case 'code': { const c = spokenToCode(v); return c ? { value: c } : { problem: `I didn't catch the ${f.label}. You can read it out letter by letter.` }; }
    case 'date': case 'when': {
      const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : spokenToDate(v, new Date(), { future: f.kind === 'when' });
      return d ? { value: d } : { problem: f.kind === 'when' ? 'I need a date from today on, like November 16.' : 'I need the month, the day and the year, like March 3, 1985.' };
    }
    case 'digits': {
      // Never echoes what was heard: it may be a whole SSN said by mistake.
      const d = spokenDigits(v), n = f.length ?? 4;
      return d.length === n ? { value: d } : { problem: d.length > n ? `That's more digits than I need. Just the ${n} digits, please.` : `I need ${n} digits.` };
    }
    default: {
      const s = stripFiller(v).replace(/\s+/g, ' ');
      return s.length < 2 ? { problem: 'I did not catch that.' } : s.length > 300 ? { value: s.slice(0, 300) } : { value: s };
    }
  }
}

const orList = (a: string[]) => a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} or ${a[a.length - 1]}`;
const spellWord = (w: string) => w.replace(/[^A-Za-z]/g, '').toUpperCase().split('').join('-');
const groupChars = (s: string) => (s.match(/.{1,4}/g) ?? []).map(g => g.split('').join(' ')).join(', ');
const COMMON_DOMAINS = /^(gmail|yahoo|hotmail|outlook|icloud|aol|proton|protonmail|live|msn|comcast)\.(com|net|me)$/;

// The exact words the customer hears before a value is kept.
// `n` varies the wording so it does not sound canned.
// brisk: the customer asked to hurry, so the read-back is just the value (still spelled) and "right?".
export function readback(f: Field, v: string, n = 0, brisk = false): string {
  const pick = (a: string[]) => a[n % a.length];
  if (brisk) return briskReadback(f, v);
  switch (f.kind) {
    case 'name': { const sp = v.split(/\s+/).map(spellWord).join(', '); return pick([`I have ${v}, that's ${sp}. Did I get that right?`, `Let me spell that back: ${v}, ${sp}. Is that right?`, `So that's ${v}, spelled ${sp}. Is that correct?`]); }
    case 'phone': { const d = v.replace(/\D/g, ''); const g = [d.slice(0, 3), d.slice(3, 6), d.slice(6)].map(x => x.split('').join(' ')).join(', '); return pick([`I have ${g}. Is that right?`, `Let me read that back: ${g}. Is that correct?`]); }
    case 'email': {
      const [local, dom] = v.split('@');
      const sayLocal = local.split(/([._-])/).map(p => p === '.' ? 'dot' : p === '_' ? 'underscore' : p === '-' ? 'dash' : /^\d+$/.test(p) ? p.split('').join(' ') : spellWord(p)).join(' ');
      const sayDom = COMMON_DOMAINS.test(dom) ? dom.replace(/\./g, ' dot ') : dom.split('.').map((p, i, a) => i === a.length - 1 && /^(com|net|org|edu|gov|io|co|us|uk)$/.test(p) ? p : spellWord(p)).join(' dot ');
      return pick([`I have ${v}, that's ${sayLocal}, at ${sayDom}. Is that right?`, `Let me read that back: ${v}, ${sayLocal}, at ${sayDom}. Is that correct?`]);
    }
    case 'serial': return pick([`I have ${formatSerial(v)}, that's ${groupChars(v)}. Is that right?`, `Let me read that back in groups: ${formatSerial(v)}, ${groupChars(v)}. Is that correct?`]);
    case 'choice': return pick([`So that's ${v} for the ${f.label}, is that right?`, `Okay, ${v} for the ${f.label}. Did I get that right?`, `${v} for the ${f.label}, is that correct?`]);
    case 'code': return pick([`I have ${v}, that's ${spellOut(v)}. Is that right?`, `Let me read that back: ${spellOut(v)}. Is that correct?`]);
    case 'date': case 'when': return pick([`I have ${formatDate(v)} for the ${f.label}. Is that right?`, `So that's ${formatDate(v)}, is that right?`]);
    case 'digits': return pick([`I have ${spellOut(v)}. Is that right?`, `Let me read that back: ${spellOut(v)}. Is that correct?`]);
    default: if (f.spell) return `I have "${v}", spelled ${v.split(/\s+/).map(spellWord).join(', ')}. Is that right?`;
      return pick([`I'll put down "${v}" for the ${f.label}. Is that right?`, `So for the ${f.label}: "${v}". Is that right?`]);
  }
}

function briskReadback(f: Field, v: string): string {
  switch (f.kind) {
    case 'name': return `${v}, ${v.split(/\s+/).map(spellWord).join(', ')}, right?`;
    case 'phone': { const d = v.replace(/\D/g, ''); return `${[d.slice(0, 3), d.slice(3, 6), d.slice(6)].map(x => x.split('').join(' ')).join(', ')}, right?`; }
    case 'email': { const r = readback(f, v); const m = r.match(/that's (.*)\. Is that right\?$/); return `${v}, ${m ? m[1] : ''}, right?`.replace(', , ', ', '); }
    case 'serial': return `${formatSerial(v)}, ${groupChars(v)}, right?`;
    case 'choice': return `${v} for the ${f.label}, right?`;
    case 'code': case 'digits': return `${spellOut(v)}, right?`;
    case 'date': case 'when': return `${formatDate(v)}, right?`;
    default: return `"${v}", right?`;
  }
}

// Several short choices said together are read back together: "So that's Wednesday and Afternoon. Is that right?"
export function groupReadback(items: string[], n = 0, brisk = false): string {
  const list = items.length <= 2 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  return brisk ? `${list}, right?` : [`So that's ${list}. Is that right?`, `Okay, ${list}. Did I get that right?`][n % 2];
}

// ---------- yes / no ----------
const YES_START = /^\s*(?:oh\s+|um+\s+|uh+\s+|well\s+)?(yes|yeah|yea|yep|yup|ya|aye|correct|that'?s (?:right|correct|it|perfect)|right|exactly|perfect|sounds good|uh[- ]?huh|mm[- ]?hmm|you got it|got it|spot on|affirmative|sure|absolutely|definitely|yes please|that is (?:right|correct)|all good|looks good|good)\b/i;
const KEEP = /\b(leave it|keep it|as it is|as is|that'?s (still )?(the )?(same|correct|right|fine)|it'?s (the )?same|no change|don'?t change)\b/i;
const HURRY = /\b(speed (this|it|things) up|hurry|quick(er|ly)?|faster|in a rush|short on time|move (this )?along)\b/i;
const SMALL_TALK = /\b(how are you|how'?s (your|the) day|how is your day|how'?s it going|hope you'?re (doing )?well|nice weather|the weather|crazy (day|morning|week)|long day|busy (day|morning)|running around|hectic|sorry,? (i'?m|it'?s been)|happy (friday|monday))\b/i;
const ACKS = ['Perfect, thank you.', 'Great.', 'Lovely, thanks.', 'Got it, thank you.'];
function smallTalkReply(said: string): string {
  if (/how are you|how'?s (your|the) day|how is your day|how'?s it going/i.test(said)) return "I'm doing well, thanks for asking!";
  if (/weather/i.test(said)) return 'It really is something today!';
  if (/crazy|long day|busy|running around|hectic|sorry/i.test(said)) return "No worries at all, we'll get this sorted quickly.";
  return 'Thanks, you too!';
}
// The next question, with a light varied lead-in so it does not sound like a script.
function transition(q: string, n: number): string {
  // A question that already opens with its own lead-in ("And what time of day…") keeps it.
  const lead = /^(and|next|now|also|so|then)\b/i.test(q) ? '' : ['', 'Next, ', 'And ', ''][n % 4];
  return lead ? lead + q.charAt(0).toLowerCase() + q.slice(1) : q;
}
const CORRECTION = /\b(?:my|the)\s+([a-z]+(?:\s+[a-z]+)?)\s+(?:should be|is actually|is really|should say)\s+(.+)$/i;
const FORGET = /\b(forget (me|my (details|info\w*|data|number|email))|delete (my|all my) (details|info\w*|data|record|number)|don'?t (remember|keep|store|save) (me|my \w+)|remove my (details|info\w*|data))\b/i;
const RETURNING = /\b((been|come|came|brought \w+|booked|visited|called|seen)\b[^.?!]{0,30}\bbefore|already in (your|the) system|been (a )?(patients?|customers?) (here|there|with you|for)|returning (customer|patient)|last time (i|we)|you (should |might )?(already )?have (my|our|her|his|their) (details|info\w*))\b/i;
const SUBMIT_LINE = "Everything is filled in on the form on your screen. Have a look, and when it's right, press Submit. I won't send it for you.";
const id = (s: string) => s.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
// Reading back a value kept from an earlier call: same detail as any read-back, and still needs a yes.
function reuseReadback(f: Field, v: string): string {
  if (f.kind === 'phone') { const d = v.replace(/\D/g, ''); return `Is ${[d.slice(0, 3), d.slice(3, 6), d.slice(6)].map(x => x.split('').join(' ')).join(', ')} still the best number?`; }
  const r = readback(f, v, 0); // "I have X, that's ... . Did I get that right?" / "... Is that right?"
  return `From last time, ${r.replace(/^I have /, `I have the ${f.label} as `).replace(/\s*(Did I get that right|Is that right|Is that correct)\?$/, '')} Is that still right?`;
}
const META_Q = /\b(move on|moving|next|speed|hurry|quick|faster|keep going|go on|what else|anything else|done|continue|finish|wrap (this |it )?up|get on with|be done)\b/i;
const NOT_YES = /\b(no|nope|nah|not|wrong|incorrect|wait|hold on|hang on|change|fix|actually|but|except|unless|if|however|though|instead|rather|mistake|misspel\w*|maybe|not sure|i guess|i suppose|whatever|if you say so|hmm+|almost|close|nearly|twice|typo|missing|forgot|spell(ed|t)?|sorry)\b/i;

// A clear yes to a read-back: starts with a yes, and nothing hedges it or changes it ("yes but change the time" is not a yes).
export function clearYes(said: string): boolean {
  const t = said.replace(/[’]/g, "'").replace(/\b(mm[- ]?hmm|uh[- ]?huh)\b/gi, 'yes')
    .replace(/\bsorry (about|for) (all )?(that|this|the (trouble|confusion|wait|hassle))\b/gi, '').trim();
  if (!t || NOT_YES.test(t)) return false;
  let first = t.split(/(?<=[.!])\s+/)[0];
  // "yep, that's right, can we move on?" is a yes; "sure, how much is it?" answers nothing.
  if (/\?/.test(first)) { const m = first.match(/^(.*?),\s*([^,]*\?)\s*$/); if (!m || !META_Q.test(m[2])) return false; first = m[1]; }
  return YES_START.test(first) || yesNo(first) === 'yes';
}
export function clearNo(said: string): boolean {
  return /^\s*(no|nope|nah|not quite|not really|that'?s (not|wrong)|wrong|incorrect)\b/i.test(said) || yesNo(said) === 'no';
}

// ---------- docs ----------
export type Docs = (question: string) => Promise<Passage | null>;
const STOP = new Set('a an the is are do does did i my me you your yours to of in on for and or it this that can how what where which when why should will with be at by from we our us there their have has any much many long get about tell know please would could if so'.split(' '));
const docWords = (s: string) => (s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter(w => !STOP.has(w)).map(w => w.replace(/(ing|es|s)$/, ''));
// Keyword search, then (if a model is given) the model picks the passage that answers, or none. Never writes an answer.
export function docsFrom(passages: Passage[], judge?: ChatModel): Docs {
  return async (question: string) => {
    const q = new Set(docWords(question));
    const ranked = passages.map(p => ({ p, s: new Set(docWords(p.text).filter(w => q.has(w))).size })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
    if (!ranked.length) return null;
    if (!judge) return ranked[0].s >= 1 ? ranked[0].p : null;
    // One yes/no question per passage, asked in parallel: small models (LFM3-1.7B) answer this reliably, while
    // "reply with the passage number" makes them say 0 and then name the right one.
    try {
      const yes = await Promise.all(ranked.map(async x => {
        const r = await judge.chat([
          { role: 'system', content: 'Answer only yes or no.' },
          { role: 'user', content: `Passage: ${x.p.text}\n\nDoes this passage contain the answer to the question "${question}"? Answer yes or no.` },
        ], [], { maxTokens: 2, temperature: 0 });
        return /^\s*yes/i.test(r.content);
      }));
      const i = yes.indexOf(true);
      return i >= 0 ? ranked[i].p : null;
    } catch { return ranked[0].s >= 2 ? ranked[0].p : null; }
  };
}

// ---------- the desk ----------
export type DeskEvent = { turn: number; type: string; field?: string; value?: string; detail?: string; by?: 'model' | 'net' | 'rules' };
export type Fill = { turn: number; field: string; value: string; readback: string; yes: string; risk?: number }; // readback and yes are empty for a fill said in passing
export type TurnLog = { turn: number; said: string; reply: string; ms: number; model: string; calls: string[]; fallback?: string };
type Pending = { field: string; value: string; text: string; group?: { field: string; value: string }[]; reuse?: boolean; sure?: boolean };

// ---------- risk (decision 0011) ----------
// Every field has a score from 1 to 100 that sets how it is confirmed. The bands live here only: the prompt prints
// them and the code lock reads them, so the two cannot drift apart.
export const RISK_BANDS = [
  { upTo: 10, rule: 'just do it' },
  { upTo: 30, rule: 'fill it and mention it in passing; no yes needed' },
  { upTo: 55, rule: 'read it back and wait for a yes' },
  { upTo: 75, rule: 'read it back and wait for a clear yes ("I guess" or "sure, whatever" is not one)' },
  { upTo: 90, rule: 'read it back, get a clear yes, then ask "are you sure?"' },
  { upTo: 100, rule: 'a person must approve it; never fill it yourself' },
] as const;
const RISK_LOCK = 56;     // from here up, code fills only after a recorded clear yes
const RISK_TWICE = 76;    // from here up, the yes is asked twice (and so is a skip)
const RISK_PERSON = 91;   // from here up, a person approves; the desk never fills it
const RISK_MISHEARD = 15; // added to every remaining step once the caller has corrected a misheard value
// Defaults when the business sets none: a pick from a short list is low, anything typed is read back, a secret locked.
function defaultRisk(f: Field): number {
  return f.secret ? 60 : f.kind === 'choice' || f.kind === 'when' ? 25 : 40;
}
const riskRule = (r: number) => RISK_BANDS.find(b => r <= b.upTo)!.rule;

// ---------- prompt budget (#101) ----------
// The model never holds the form; code does. A form of up to FULL_FORM_FIELDS fields is listed to the model in full, as
// it always was. A bigger one shows the model only a window of it, so the prompt stays one size however many fields the
// form has: the open field, the read-back waiting, where to return to, the next few empty fields, the last few filled,
// and any field the caller just named. Everything else stays in `values` and is only counted.
const FULL_FORM_FIELDS = 24;
const WINDOW_AHEAD = 4;    // empty fields after the open one
const WINDOW_RECENT = 3;   // most recently filled fields, so "change that" has something to point at
const WINDOW_NAMED = 3;    // fields the caller's words name
const WINDOW_MAX = 14;     // hard cap on the window
const OPTIONS_SHOWN = 12;  // a choice with more options shows this many and a count
const LOG_KEEP = 40;       // entries kept at each end of a long call's log (the first and the latest)

// A real question sentence anywhere in the turn (not a meta one like "can we move on?").
const ASKED_Q = /\b(what|where|which|how|why|when|can i|do i|do you|does|is there|is it|are there|should i|will it)\b(?![^.?!]*\b(move on|speed|hurry|hear me|still there|get that|got that)\b)[^.?!]*\?/i;
const QUESTION = /\?\s*$|^\s*(what|where|which|how|why|when|can you|could you|do you|does|is there|are you|will|would you)\b/i;
const CLAIMS = /\b(submit\w*|i'?ve (added|put|entered|noted|recorded|saved|filled|updated|changed)|i have (added|put|entered|noted|recorded|saved|filled|updated|changed)|(is|are|been) (saved|recorded|filled|updated|noted|entered|confirmed)|all set|booked|scheduled|you'?re set)\b/i;
const BYE = /\b(bye|goodbye|that'?s all|have to go|gotta go|hang up|stop|cancel|never ?mind)\b/i;
// An optional field's "none": left blank (the same words the Copilot accepts).
const NONE = /^\s*(no(ne|pe)?|n\/?a|skip( it| that)?|nothing|not applicable|no notice|leave it (blank|empty)|there (isn'?t|is no) (one|code)|i (didn'?t|did not|haven'?t|have not) (get|got|receive[d]?)( one| a notice| any( notice)?)?)\W*$/i;
// A desk with no form only answers questions. Model text that states a rule, a date, an amount or what the caller can or
// must do is a fact that has to come from the business's own passages, so that turn is looked up instead.
const FACTS = /\b(deduct\w*|credits?|deadlines?|due (date|by|on)|penalt\w*|refunds?|percent|withh[eo]ld\w*|exempt\w*|qualif\w*|eligib\w*|owe|filing status|you (can|can't|cannot|must|need to|have to|should|may|will)|the (rule|law|limit)s?|allowed|required|costs?|prices?|hours|open (on|at|from|until))\b|[$%]|\d/i;

export class Desk {
  flow: Flow;
  values: Record<string, string> = {};
  pending: Pending | null = null;
  queue: { field: string; value: string; reuse?: boolean }[] = [];
  current: string;
  returnTo: string[] = [];
  brisk = false; // the customer asked to hurry: shorter read-backs
  histTurns = Number(ENV.DESK_HISTORY_TURNS) || 6; // past user turns the model sees (cut on a context error)
  done = false;
  complete = false;
  log: { who: 'user' | 'agent'; text: string }[] = [];
  events: DeskEvent[] = [];
  fills: Fill[] = [];
  turns: TurnLog[] = [];
  submitted = 0; // stays 0: there is no submit path. Kept so tests can assert it.
  private chatModel?: ChatModel;
  private heavy?: ChatModel;
  private docs?: Docs;
  private hooks: Partial<Hooks>;
  private n = 0;
  private lastUser = '';
  private hist: ChatMsg[] = []; // the conversation as the model sees it, with every action shown as a tool call
  acts: { name: string; args: Record<string, unknown>; result: string }[] = []; // this turn's tool calls and what code answered (read by the call log)
  private maxModel = 220;
  private toolsSpec: unknown[];
  private system: string;
  private windowed: boolean;
  // The prompt version the traces record: a short hash of the system prompt and the tools, so a change to either shows.
  get promptVersion(): string {
    let h = 0x811c9dc5;
    for (const ch of this.system + JSON.stringify(this.toolsSpec)) h = Math.imul(h ^ ch.charCodeAt(0), 0x01000193);
    return `desk-${(h >>> 0).toString(16).padStart(8, '0')}`;
  }

  // Memory (both optional): `sessions` keeps a snapshot for call resume; `customers` keeps opt-in returning-customer
  // details. Any Store works (memory.ts has a Map and a JSON file store; an Octo store can implement the same).
  sessionId?: string;
  private sessions?: Store;
  private customers?: Store;
  private mem = { asked: false, awaiting: false, lookedUp: false, forget: false, returning: false };
  private notes: string[] = []; // things code must say this turn (from inside confirm)
  private misheard = false; // the caller corrected a misheard value: every remaining step scores RISK_MISHEARD higher
  private sureAsked = false; // this turn asked "are you sure?" instead of filling
  private skipAsk = ''; // a skip from RISK_TWICE up, asked once and waiting for the second yes

  // answer: the site's own lookup for a question (it may also show the source); it returns the words to say, quoted
  // from the business's documents, or null when nothing answers. Without it, `docs` is searched and quoted here.
  // unknown: what to say when nothing answers. finish: what to say when every field is filled (a page form names its
  // own submit button, and anything the customer still has to do by hand).
  private answer?: (question: string, filter?: SearchFilter) => Promise<string | null>;
  private search?: SiteSearch; // search_site: look before answering (search-site.ts)
  private lookupsThisTurn = 0;
  private lookups?: Lookups; // the business's declared record lookups (lookups.ts); code runs them, the model only names one
  private caller?: () => Caller; // who the caller is, from the host's verification (never from the model)
  private pendingLookup: ToolCall | null = null; // a lookup waiting for the caller's yes
  private unknown: string;
  private finish?: string;

  constructor(flow: Flow, opts: { model?: ChatModel; heavy?: ChatModel; docs?: Docs; answer?: (question: string, filter?: SearchFilter) => Promise<string | null>; search?: SiteSearch; lookups?: Lookups; caller?: () => Caller; unknown?: string; finish?: string; hooks?: Partial<Hooks>; route?: (said: string, d: Desk) => boolean; sessions?: Store; customers?: Store; fullFormFields?: number } = {}) {
    this.flow = flow;
    this.windowed = flow.fields.length > (opts.fullFormFields ?? FULL_FORM_FIELDS);
    this.answer = opts.answer;
    this.unknown = opts.unknown ?? "I'm sorry, I don't have that information.";
    this.finish = opts.finish;
    this.sessions = opts.sessions;
    this.customers = opts.customers;
    this.chatModel = opts.model;
    // Hybrid (a hosted model for hard turns) is off unless DESK_HYBRID=1: the default path is the local model only.
    this.heavy = ENV.DESK_HYBRID === '1' ? opts.heavy : undefined;
    this.docs = opts.docs;
    this.hooks = opts.hooks ?? {};
    if (opts.route) this.route = opts.route;
    this.current = flow.fields[0]?.name ?? '';
    this.search = opts.search;
    this.lookups = opts.lookups;
    this.caller = opts.caller;
    this.toolsSpec = [...(this.search ? withSearchTools(this.tools()) : this.tools()), ...(this.lookups?.tools ?? [])];
    this.system = this.systemPrompt() + (this.search ? SEARCH_HINT : '') + (this.lookups ? LOOKUP_HINT : '');
  }

  // Appends to the call log. A long call keeps its first entry (the opening line) and the latest ones.
  private note(who: 'user' | 'agent', text: string) {
    this.log.push({ who, text });
    if (this.log.length > 2 * LOG_KEEP) this.log.splice(1, this.log.length - LOG_KEEP - 1);
  }

  field(name: string): Field | undefined {
    const n = String(name ?? '').trim().toLowerCase();
    return this.flow.fields.find(f => f.name.toLowerCase() === n) ?? this.flow.fields.find(f => f.label.toLowerCase() === n || (f.aliases ?? []).includes(n));
  }

  // A flow with no fields is a question desk: it talks and answers from the business's documents, and fills nothing.
  get answerOnly(): boolean { return !this.flow.fields.length; }

  start(): string {
    const f = this.field(this.current);
    const say = f ? `${this.flow.intro} ${f.question}` : this.flow.intro;
    this.note('agent', say);
    return say;
  }

  // Starts with answers already on the form (a draft kept from earlier in the call, or what the page filled in itself):
  // they count as given, and the first empty field is asked.
  prefill(values: Record<string, string>, lead: string): string {
    for (const [k, v] of Object.entries(values)) { const f = this.field(k); if (f) this.values[f.name] = v; }
    this.moveOn();
    let say: string;
    if (this.allFilled()) { say = `${lead} ${this.finishLine()}`; this.complete = true; }
    else say = `${lead} ${this.field(this.current)!.question}`;
    this.note('agent', say);
    return say;
  }

  async turn(said: string): Promise<string> {
    this.n++;
    this.lastUser = said;
    if (HURRY.test(said)) this.brisk = true;
    this.note('user', said);
    const memReply = await this.memoryTurn(said);
    if (memReply !== null) {
      this.note('agent', memReply);
      this.remember(said, memReply);
      this.turns.push({ turn: this.n, said, reply: memReply, ms: 0, model: 'code', calls: [] });
      await this.save();
      return memReply;
    }
    // A lookup that asked for a yes: this turn is the answer. A yes runs it; anything else drops it.
    if (this.pendingLookup) {
      const waiting = this.pendingLookup;
      this.pendingLookup = null;
      if (clearYes(said)) {
        const out = await this.runLookup(waiting, true);
        this.log.push({ who: 'agent', text: out });
        this.remember(said, out);
        this.turns.push({ turn: this.n, said, reply: out, ms: 0, model: 'code', calls: [waiting.name] });
        await this.save();
        return out;
      }
    }
    const waited = () => [this.chatModel, this.heavy].reduce((a, m) => a + ((m as { waitedMs?: number } | undefined)?.waitedMs ?? 0), 0);
    const t0 = Date.now() - waited();
    this.acts = [];
    this.lookupsThisTurn = 0;
    let reply = '', modelName = 'rules', calls: string[] = [], fallback: string | undefined;
    const useHeavy = !!this.heavy && this.route(said, this);
    const first = useHeavy ? this.heavy : this.chatModel;
    try {
      if (!first) throw new Error('no model');
      let r: ChatResult;
      try { r = await this.chatRounds(first, said); }
      catch (e) {
        // A small local model with a short context: keep less history from now on and try again at once.
        if (!/context/i.test((e as Error).message) || this.histTurns <= 1) throw e;
        this.histTurns = Math.max(1, this.histTurns - 3);
        r = await first.chat(this.messages(said), this.toolsSpec);
      }
      modelName = r.model;
      // Escalate a turn the small model got wrong (a value code rejects, or nothing done when something was said).
      if (this.heavy && first !== this.heavy && this.needsEscalation(r, said)) {
        try { r = await this.heavy.chat(this.messages(said), this.toolsSpec); modelName = `${modelName}>${r.model}`; } catch { /* keep the small model's answer */ }
      }
      // No tool call on a turn where the customer said something substantive: remind the model once.
      if (!r.calls.length && this.nudgeWorthy(said)) {
        try {
          const m = this.messages(said);
          m[m.length - 1] = { role: 'user', content: `${m[m.length - 1].content}\n[Reminder: if the customer gave or corrected ANY field value, call propose_value now (one call per value); if they said yes to the read-back, call confirm_pending; if they asked about the business, call answer_question.]` };
          const r2 = await (useHeavy || !this.heavy ? first : this.heavy).chat(m, this.toolsSpec);
          if (r2.calls.length) { r = r2; modelName = `${modelName}+nudge`; }
        } catch { /* keep the first answer */ }
      }
      calls = r.calls.map(c => `${c.name}(${JSON.stringify(c.args)})`);
      reply = await this.apply(r.content, r.calls, 'model');
    } catch (e) {
      fallback = (e as Error).message.slice(0, 120);
      reply = await this.rulesTurn(said);
    }
    reply = reply.replace(/\s+/g, ' ').trim();
    this.note('agent', reply);
    this.remember(said, reply);
    this.turns.push({ turn: this.n, said, reply, ms: Date.now() - waited() - t0, model: modelName, calls, fallback });
    await this.save();
    return reply;
  }

  // ----- memory: call resume -----
  // Saves the call under an opaque random id (30 minute TTL). Called after every turn when a session store is set.
  async save(): Promise<string | undefined> {
    if (!this.sessions) return undefined;
    this.sessionId ??= newSessionId();
    const snap: SessionSnapshot = { v: 1, flow: this.flow.id, savedAt: Date.now(), values: { ...this.values }, pending: this.pending ? { ...this.pending } : null, queue: [...this.queue], current: this.current, returnTo: [...this.returnTo], log: this.log.slice(-12) };
    try { await this.sessions.set(`sess:${id(this.sessionId)}`, snap, SESSION_TTL_MS); } catch { /* a failed save never breaks the call */ }
    return this.sessionId;
  }

  // Picks a dropped call back up. Unknown or expired ids start fresh. A read-back that was waiting is asked again,
  // never filled: it still needs a yes on this call.
  async restore(sessionId: string): Promise<string> {
    let snap: SessionSnapshot | undefined;
    try { snap = this.sessions ? (await this.sessions.get(`sess:${id(sessionId)}`)) as SessionSnapshot | undefined : undefined; } catch { snap = undefined; }
    if (!snap || snap.v !== 1 || snap.flow !== this.flow.id) { this.events.push({ turn: this.n, type: 'resume_fresh' }); return this.start(); }
    this.sessionId = sessionId;
    for (const [k, v] of Object.entries(snap.values)) if (this.field(k)) this.values[k] = v;
    this.pending = snap.pending && this.field(snap.pending.field) ? snap.pending : null;
    this.queue = snap.queue.filter(q => this.field(q.field));
    this.current = this.field(snap.current) ? snap.current : (this.flow.fields.find(f => this.values[f.name] === undefined) ?? this.flow.fields[0]).name;
    this.returnTo = snap.returnTo.filter(r => this.field(r));
    this.log = [...snap.log];
    this.hist = snap.log.map(m => ({ role: m.who === 'user' ? 'user' : 'assistant', content: m.text }) as ChatMsg);
    const had = this.flow.fields.filter(f => this.values[f.name] !== undefined).map(f => f.label);
    let say = had.length ? `Welcome back. We already have the ${had.length === 1 ? had[0] : `${had.slice(0, -1).join(', ')} and ${had[had.length - 1]}`}.` : "Welcome back, let's pick up where we left off.";
    if (this.pending) say += ` Before we got cut off I was checking this: ${this.pending.text}`;
    else if (this.allFilled()) say += ` ${this.finishLine()}`;
    else say += ` Next is the ${this.field(this.current)!.label}. ${this.field(this.current)!.question}`;
    this.note('agent', say);
    this.hist.push({ role: 'assistant', content: say });
    this.events.push({ turn: this.n, type: 'resumed', detail: had.join(',') });
    return say;
  }

  // ----- memory: returning customers (opt-in) -----
  private rememberable(f: Field): boolean {
    if (f.kind === 'serial' || f.kind === 'text' || f.kind === 'choice') return false; // never serials, symptoms, visit reasons
    return (f as Field & { remember?: boolean }).remember ?? (f.kind === 'name' || f.kind === 'phone' || f.kind === 'email');
  }
  private contactKeys(): string[] {
    return this.flow.fields.filter(f => (f.kind === 'phone' || f.kind === 'email') && this.values[f.name]).map(f => customerKey(f.kind as 'phone' | 'email', this.values[f.name]));
  }
  private async forgetCustomer(): Promise<void> {
    // Delete under every contact the record holds, not only the ones given on this call.
    const keys = new Set(this.contactKeys());
    for (const k of [...keys]) {
      const rec = (await this.customers!.get(k).catch(() => undefined)) as CustomerRecord | undefined;
      for (const f of this.flow.fields) if ((f.kind === 'phone' || f.kind === 'email') && rec?.values[f.name]) keys.add(customerKey(f.kind, rec.values[f.name]));
    }
    for (const k of keys) await this.customers!.delete(k);
    this.queue = this.queue.filter(q => !q.reuse);
    if (this.pending?.reuse) this.pending = null;
    this.mem.forget = false; this.mem.asked = true; // and do not offer to remember at the end
    this.events.push({ turn: this.n, type: 'forgot' });
  }
  // A confirmed phone or email: look the customer up once and offer what we kept, each value read back for a yes.
  private async onContact(f: Field): Promise<void> {
    if (!this.customers || (f.kind !== 'phone' && f.kind !== 'email')) return;
    if (this.mem.forget) { await this.forgetCustomer(); this.notes.push("Done, I've deleted the details I had saved for you."); return; }
    if (this.mem.lookedUp) return;
    this.mem.lookedUp = true;
    let rec: CustomerRecord | undefined;
    try { rec = (await this.customers.get(customerKey(f.kind, this.values[f.name]))) as CustomerRecord | undefined; } catch { rec = undefined; }
    if (!rec || rec.v !== 1) return;
    const offers = this.flow.fields.filter(g => rec!.values[g.name] && this.rememberable(g) && this.values[g.name] === undefined && this.pending?.field !== g.name && !this.queue.some(q => q.field === g.name));
    if (!offers.length) return;
    this.mem.returning = true;
    for (const g of offers) this.queue.push({ field: g.name, value: rec.values[g.name], reuse: true });
    this.notes.push('Welcome back! I have a few details from last time; let me check them with you.');
    this.events.push({ turn: this.n, type: 'returning', detail: offers.map(g => g.name).join(',') });
  }
  private async storeCustomer(): Promise<void> {
    const values: Record<string, string> = {};
    for (const f of this.flow.fields) if (this.rememberable(f) && this.values[f.name]) values[f.name] = this.values[f.name];
    const rec: CustomerRecord = { v: 1, flow: this.flow.id, savedAt: Date.now(), values };
    for (const k of this.contactKeys()) await this.customers!.set(k, rec, 365 * 24 * 3600 * 1000);
    this.events.push({ turn: this.n, type: 'stored', detail: Object.keys(values).join(',') });
  }
  // Memory turns handled by code alone: "forget me", and the answer to "want me to remember your details?".
  private async memoryTurn(said: string): Promise<string | null> {
    if (FORGET.test(said)) {
      if (!this.customers) return `I don't keep any of your details after the call, so there's nothing to forget. ${this.resumeLine()}`;
      if (this.contactKeys().length) { await this.forgetCustomer(); return `Done, I've deleted the details I had saved for you. ${this.allFilled() ? this.finishLine() : this.resumeLine()}`; }
      this.mem.forget = true;
      const pf = this.flow.fields.find(f => f.kind === 'phone') ?? this.flow.fields.find(f => f.kind === 'email');
      if (pf) { this.goTo(pf); return `Of course. What's the ${pf.label} you used with us? I'll delete what I have under it.`; }
    }
    if (this.mem.awaiting) {
      this.mem.awaiting = false;
      if (clearYes(said)) { await this.storeCustomer(); return `Done, I'll remember them for next time. ${SUBMIT_LINE}`; }
      if (clearNo(said) && said.trim().split(/\s+/).length <= 8) return `No problem, I won't keep them. ${SUBMIT_LINE}`;
      // Anything else is not a yes: nothing is stored, and the turn goes on as usual.
    }
    if (this.customers && !this.mem.lookedUp && RETURNING.test(said)) {
      const pf = this.flow.fields.find(f => f.kind === 'phone' && this.values[f.name] === undefined);
      if (pf && this.current !== pf.name && !this.pending && !/\d{3}/.test(said)) { this.goTo(pf); return `Welcome back! What's the ${pf.label} you used last time? I'll find your details.`; }
    }
    return null;
  }
  private resumeLine(): string {
    return this.pending ? this.pending.text : this.field(this.current)?.question ?? '';
  }

  // Hybrid routing: questions, corrections, long or messy turns go straight to the bigger model.
  route(said: string, _d: Desk): boolean {
    const words = said.trim().split(/\s+/).length;
    return QUESTION.test(said) || words > 22 || /\b(wrong|fix|twice|change|actually|go back|instead|mistake|typo|spell|back to|earlier|previous)\b/i.test(said) || this.field(this.current)?.kind === 'serial';
  }

  private nudgeWorthy(said: string): boolean {
    const t = stripFiller(said);
    if (!t || t.split(/\s+/).length < 2 && !/\d/.test(t)) return false;
    if (this.pending && (clearYes(said) || clearNo(said))) return true;
    if (/\d{3,}|@|\bat\b.*\bdot\b/i.test(t)) return true;
    if (this.flow.fields.some(f => f.kind === 'choice' && matchOption(f, t))) return true;
    if (this.flow.fields.some(f => f.kind === 'name') && /\b(name|it'?s|i'?m|this is|called|spelled|[A-Z][a-z]+ [A-Z][a-z]+)\b/.test(said)) return true;
    return !QUESTION.test(said) && t.split(/\s+/).length >= 3;
  }

  private needsEscalation(r: ChatResult, said: string): boolean {
    if (!r.calls.length) return !!stripFiller(said) && !QUESTION.test(said) && said.split(/\s+/).length > 1 && !clearYes(said);
    for (const c of r.calls) {
      if (c.name === 'propose_value') {
        const f = this.field(String(c.args.field)); if (!f) return true;
        const nv = normalize(f, String(c.args.value ?? '')); if (!nv.value || !this.grounded(f, nv.value)) return true;
      }
      if (c.name === 'confirm_pending' && !clearYes(said)) return true;
      if (!TOOL_NAMES.includes(c.name)) return true;
    }
    return false;
  }

  // ----- prompts -----
  private systemPrompt(): string {
    if (this.answerOnly) return this.askPrompt();
    const form = this.windowed
      ? `The form has ${this.flow.fields.length} fields, asked in order. Each message ends with the fields to work on now (the open one, the next few and any the customer just named), each with its rule and its answer so far, and a count of the rest. Code keeps every answer. Work only on the fields listed; never guess a field's name.`
      : `Form fields, in order:\n${this.flow.fields.map(f => this.fieldLine(f)).join('\n')}`;
    return `You are the front-desk receptionist at ${this.flow.business}, on a voice call. You fill in the online form for the customer while you talk. You cannot see or press the Submit button; the customer presses it at the end.

How you sound: warm, calm and professional, like an experienced receptionist. Spoken English, 1 or 2 short sentences. No lists, no markdown, no emojis. A little small talk is fine, then gently steer back. Ask for one thing at a time.

${form}

How you work. The form changes ONLY through your tools:
- The customer gives a value for any field (even out of order, or several at once): call propose_value for each, with the value cleaned up (no "my name is", digits for numbers, lower-case email). Code reads it back to them word for word, spelling names and grouping numbers. Do not read values back yourself and never say anything is saved.
- They clearly say yes to the read-back: call confirm_pending. They say no and give the right value: call propose_value with it. They say no without a value: call reject_pending.
- They want to change an earlier answer: call propose_value for that field when the new value is clear (fix what they point out, e.g. "you wrote my name twice" means keep one copy), otherwise call go_to_field.
- Speech recognition garbles things: split or joined words, a name repeated, letters as words ("ess" = S, "oh" = O or zero, "double five" = 55). Clean these up. If they spell letter by letter, use exactly those letters.
- A vague answer ("sometime next week, mornings are better"): propose what is clear, then ask one short question to pin down the rest.
- Any question about ${this.flow.business} (hours, prices, address, policies, what to bring...): call answer_question. Never state such facts yourself. Anything unrelated: say kindly that you can only help with this form.
- Each field has a risk score from 1 to 100 that says how to confirm it (shown beside it). Code holds anything from ${RISK_LOCK} up until the customer clearly says yes, and never fills anything from ${RISK_PERSON} up: that needs a person.
- If the customer says goodbye or wants to stop, call end_call.
- Never make up values. Never claim the form is submitted or booked.

Examples of how you reply (your words stay short; code adds read-backs and the next question):
Customer: "Hi, it's for my son, Leo Park." -> propose_value(field, "Leo Park"); say "Hi there, thanks for calling!"
Customer: "Yep, that's right." -> confirm_pending; say "Perfect, thank you."
Customer: "How's your day going?" -> no tool; say "It's going well, thanks for asking!"
Customer: "Sorry, it's been a crazy morning." -> no tool; say "No worries at all, we'll get this done quickly."
Customer: "Do you take walk-ins?" -> answer_question("Do you take walk-ins?"); say nothing else.`;
  }

  // The question desk (no form): the model talks, and every fact comes from answer_question.
  private askPrompt(): string {
    const docs = this.flow.scope || `${this.flow.business}'s documents`;
    return `You are the front-desk assistant at ${this.flow.business}, on a call or a chat. You answer questions only from the ${docs}, through the answer_question tool.

What you told the caller you can do: "${this.flow.intro}"

How you sound: warm, calm and professional. Spoken English, 1 or 2 short sentences. No lists, no markdown, no emojis.

How you work:
- Any question about rules, forms, dates, amounts, deadlines, prices, hours or what someone can or must do: call answer_question with the question. Never state such facts yourself, not even ones you are sure of. Code reads the answer from the ${docs} and shows where it comes from.
- Greetings, thanks, small talk, and questions about you ("can I ask you about taxes?", "what can you do?", "are you a bot?"): answer briefly yourself, with no tool, from what you told the caller you can do. You are the ${this.flow.business} assistant, an AI; never name a model or the company that made it.
- Anything unrelated to ${this.flow.business}: say kindly that you can only help with questions the ${docs} answer.
- If the caller says goodbye or wants to stop, call end_call.

Examples:
Caller: "Hi, can I ask you about taxes?" -> no tool; say "Of course, go ahead. What would you like to know?"
Caller: "How long do I have to file an amended return?" -> answer_question("How long do I have to file an amended return?"); say nothing else.
Caller: "Thanks, that helps." -> no tool; say "You're welcome. Anything else?"`;
  }

  // One field as the model is told about it: name, label, kind, options, how it is confirmed.
  private fieldLine(f: Field): string {
    const shown = !f.options ? undefined : this.windowed && f.options.length > OPTIONS_SHOWN ? `${f.options.slice(0, OPTIONS_SHOWN).join(' | ')} | (${f.options.length - OPTIONS_SHOWN} more; code checks the answer)` : f.options.join(' | ');
    const hint = f.hint && this.windowed ? f.hint.slice(0, 160) : f.hint;
    return `- ${f.name}: ${f.label} (${f.kind}${shown !== undefined ? `; one of: ${shown}` : ''}${f.optional ? '; optional, the customer may say none' : ''}; risk ${this.risk(f)}: ${riskRule(this.risk(f))})${hint ? `. ${hint}` : ''}`;
  }

  // One field's answer so far, and whether it is open or waiting for a yes.
  private valueTag(f: Field): string {
    const v = this.values[f.name];
    const g = this.pending?.group?.find(x => x.field === f.name);
    const tag = this.pending?.field === f.name ? ` (waiting for yes/no on: "${this.pending.value}")` : g ? ` (waiting for yes/no on: "${g.value}")` : '';
    return `${v !== undefined ? `"${v}"` : 'empty'}${tag}${f.name === this.current && !this.pending ? '  <- asking now' : ''}`;
  }

  // Fields whose label the caller's words name ("change my favourite colour"), best match first.
  private named(said: string): Field[] {
    const have = new Set(docWords(said));
    if (!have.size) return [];
    return this.flow.fields.map(f => ({ f, w: docWords(f.label) })).filter(x => x.w.length && x.w.every(w => have.has(w)))
      .sort((a, b) => b.w.length - a.w.length).slice(0, WINDOW_NAMED).map(x => x.f);
  }

  // The fields a large form shows the model this turn, most important first, at most WINDOW_MAX.
  private windowFields(said: string): Field[] {
    const out: Field[] = [], seen = new Set<string>();
    const add = (f?: Field) => { if (f && !seen.has(f.name)) { seen.add(f.name); out.push(f); } };
    if (this.pending) { add(this.field(this.pending.field)); for (const g of this.pending.group ?? []) add(this.field(g.field)); }
    add(this.field(this.current));
    if (this.returnTo.length) add(this.field(this.returnTo[this.returnTo.length - 1]));
    for (const q of this.queue) add(this.field(q.field));
    for (const f of this.named(said)) add(f);
    const fields = this.flow.fields;
    for (let k = fields.findIndex(f => f.name === this.current) + 1, ahead = 0; k < fields.length && ahead < WINDOW_AHEAD; k++) {
      if (this.values[fields[k].name] === undefined) { add(fields[k]); ahead++; }
    }
    for (let k = this.fills.length - 1, got = 0; k >= 0 && got < WINDOW_RECENT; k--) {
      const f = this.field(this.fills[k].field);
      if (f && this.values[f.name] !== undefined && !seen.has(f.name)) { add(f); got++; }
    }
    return out.slice(0, WINDOW_MAX);
  }

  private stateNote(said: string): string {
    const back = this.returnTo.length ? `\nAfter this, return to: ${this.returnTo[this.returnTo.length - 1]}` : '';
    const misheard = this.misheard ? `\nA value was misheard earlier: every risk is now ${RISK_MISHEARD} higher, so read back even short picks.` : '';
    if (!this.windowed) return `[Form state, not said by the customer]\n${this.flow.fields.map(f => `${f.name}: ${this.valueTag(f)}`).join('\n')}${back}${misheard}`;
    const win = this.windowFields(said);
    const total = this.flow.fields.length, filled = this.flow.fields.filter(f => this.values[f.name] !== undefined).length;
    return `[Form state, not said by the customer]\n${filled} of ${total} fields filled. Fields to work on now:\n${win.map(f => `${this.fieldLine(f)} => ${this.valueTag(f)}`).join('\n')}\n${total - win.length} other fields are not shown; code keeps their answers.${back}${misheard}`;
  }

  // Past turns keep their tool calls (including the ones code made for the model), so the model sees how the form is
  // worked and does not learn to type read-backs as plain text.
  // The model's reply, with up to `rounds` trips back to it while it only searches (search_site). Code runs the searches under
  // their caps and hands the results back; search calls never reach apply(), so searching alone never speaks or changes a field.
  private async chatRounds(model: ChatModel, said: string): Promise<ChatResult> {
    const msgs = this.messages(said);
    let r = await model.chat(msgs, this.toolsSpec);
    const search = this.search;
    if (!search) return r;
    search.startTurn();
    let ms = r.ms;
    for (let round = 0; round < search.limits.rounds; round++) {
      const looks = r.calls.filter(c => c.name === 'search_site');
      if (!looks.length || looks.length !== r.calls.length) break; // nothing to look up, or it also acted: act on that
      const ids = looks.map((_, i) => `search_${this.n}_${round}_${i}`);
      msgs.push({ role: 'assistant', content: '', tool_calls: looks.map((c, i) => ({ id: ids[i], type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) });
      for (const [i, c] of looks.entries()) {
        const out = await search.run(c.args ?? {});
        this.events.push({ turn: this.n, type: out.refused ? 'search_refused' : 'search', detail: `${String(c.args?.query ?? '').slice(0, 80)} -> ${out.hits.length}${out.relaxed ? ' (filter dropped)' : ''}` });
        msgs.push({ role: 'tool', tool_call_id: ids[i], content: out.text });
      }
      r = await model.chat(msgs, this.toolsSpec);
      ms += r.ms;
    }
    return { ...r, ms, calls: r.calls.filter(c => c.name !== 'search_site') };
  }

  private messages(said: string): ChatMsg[] {
    let h = this.hist;
    const starts = h.map((m, i) => (m.role === 'user' ? i : -1)).filter(i => i >= 0);
    if (starts.length > this.histTurns) h = h.slice(starts[starts.length - this.histTurns]);
    const opening: ChatMsg[] = h === this.hist ? [{ role: 'user', content: '(call connected)' }, { role: 'assistant', content: this.log[0]?.text ?? '' }] : [];
    return [{ role: 'system', content: this.system }, ...opening, ...h, { role: 'user', content: this.answerOnly ? said : `${said}\n\n${this.stateNote(said)}` }];
  }

  private remember(said: string, reply: string) {
    this.hist.push({ role: 'user', content: said });
    if (this.acts.length) {
      const ids = this.acts.map((_, i) => `call_${this.n}_${i}`);
      this.hist.push({ role: 'assistant', content: '', tool_calls: this.acts.map((a, i) => ({ id: ids[i], type: 'function', function: { name: a.name, arguments: JSON.stringify(a.args) } })) });
      this.acts.forEach((a, i) => this.hist.push({ role: 'tool', tool_call_id: ids[i], content: a.result }));
    }
    this.hist.push({ role: 'assistant', content: reply });
    // Only the last histTurns user turns are ever sent, so a long call keeps twice that and drops the rest.
    const starts = this.hist.flatMap((m, i) => (m.role === 'user' ? [i] : []));
    const keep = Math.max(12, this.histTurns * 2);
    if (starts.length > keep) this.hist = this.hist.slice(starts[starts.length - keep]);
  }

  // A small form lets the model pick a field name from a list; a large form does not (the list would be the form).
  private fieldParam(names: string[]): Record<string, unknown> {
    return this.windowed ? { type: 'string', description: 'The name of a field listed in the message' } : { type: 'string', enum: names };
  }

  private tools(): unknown[] {
    const names = this.flow.fields.map(f => f.name);
    const fn = (name: string, description: string, properties: Record<string, unknown> = {}, required: string[] = []) =>
      ({ type: 'function', function: { name, description, parameters: { type: 'object', properties, required } } });
    const ask = [
      fn('answer_question', `Look up the answer to a question about ${this.flow.business} in its own documents.`, { question: { type: 'string' } }, ['question']),
      fn('end_call', 'The customer says goodbye or wants to stop.', { reason: { type: 'string' } }),
    ];
    if (this.answerOnly) return ask;
    return [
      fn('propose_value', 'Propose a value for a form field. Code reads it back to the customer; it is only filled after they say yes.',
        { field: this.fieldParam(names), value: { type: 'string', description: 'The cleaned-up value' } }, ['field', 'value']),
      fn('confirm_pending', 'The customer clearly said yes to the read-back: fill the field.'),
      fn('reject_pending', 'The customer said the read-back is wrong and gave no new value.'),
      fn('go_to_field', 'Go back (or forward) to a field the customer wants to change; the form returns to where it was afterwards.', { field: this.fieldParam(names) }, ['field']),
      fn('answer_question', `Look up the answer to a question about ${this.flow.business} in its own documents.`, { question: { type: 'string' } }, ['question']),
      fn('end_call', 'The customer says goodbye or wants to stop.', { reason: { type: 'string' } }),
    ];
  }

  // ----- grounding: values must come from what the customer said -----
  private userText(): string { return this.log.filter(m => m.who === 'user').slice(-8).map(m => m.text).join(' \n '); }
  grounded(f: Field, v: string): boolean {
    const said = this.userText();
    if (f.kind === 'choice') {
      // A real option, and one the customer just named: a word of it (or a synonym), or a number when it has one.
      const recent = this.log.filter(m => m.who === 'user').slice(-2).map(m => m.text).join(' \n ');
      if (matchOption(f, recent) === v) return true;
      const have = new Set(docWords(recent));
      if ([v, ...(f.synonyms?.[v] ?? [])].flatMap(docWords).some(x => have.has(x))) return true;
      return /\d/.test(v) && /\d|\b(one|two|three|four|five|six|seven|eight|nine|ten|hundred|thousand|k)\b/i.test(recent);
    }
    if (f.kind === 'name' || f.kind === 'email') {
      const letters = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');
      const pool = letters(joinSpelled(said)) + '|' + letters(said);
      const parts = f.kind === 'email' ? v.split('@')[0].split(/[._\-\d]+/) : v.split(/[\s\-']+/);
      return parts.filter(p => p.length).every(p => pool.includes(letters(p)));
    }
    if (f.kind === 'phone') {
      const digits = said.toLowerCase().replace(/\b(double|triple)\s+(\w+)/g, (_m, n: string, d: string) => Array(n === 'double' ? 2 : 3).fill(d).join(' '))
        .split(/[^a-z0-9]+/).map(w => /^\d+$/.test(w) ? w : NUM[w] ?? '').join('');
      return digits.includes(v.replace(/\D/g, '')) || digits.includes(v.replace(/\D/g, '').slice(-7));
    }
    if (f.kind === 'code') return said.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(v) || this.log.filter(m => m.who === 'user').slice(-8).some(m => spokenToCode(m.text) === v);
    if (f.kind === 'digits') return this.log.filter(m => m.who === 'user').slice(-8).some(m => spokenDigits(m.text).includes(v));
    if (f.kind === 'date' || f.kind === 'when') return this.log.filter(m => m.who === 'user').slice(-8).some(m => spokenToDate(m.text, new Date(), { future: f.kind === 'when' }) === v);
    if (f.kind === 'serial') {
      const pool = this.log.filter(m => m.who === 'user').slice(-8).map(m => spokenToSerial(m.text)).join('|') + '|' + said.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return pool.includes(v);
    }
    const w = docWords(v), have = new Set(docWords(said));
    return w.length === 0 || w.filter(x => have.has(x)).length / w.length >= 0.5;
  }

  // A declared record lookup, run by code. The events say which lookup ran and what came of it, never the values.
  private async runLookup(c: ToolCall, confirmed: boolean): Promise<string> {
    const r = await this.lookups!.run(c.name, c.args ?? {}, this.caller?.() ?? { verified: false }, confirmed);
    this.events.push({ turn: this.n, type: 'lookup', detail: `${c.name} ${r.status} risk ${r.risk}`, by: 'model' });
    if (r.status === 'needs_confirmation') this.pendingLookup = c;
    return r.text;
  }

  // One question looked up: the site's own answer, else a quote from the business's passages; null when nothing answers.
  private async lookup(q: string, filter?: SearchFilter): Promise<{ text: string; id: string } | null> {
    if (this.answer) { const t = await this.answer(q, filter); return t ? { text: t, id: 'site' } : null; }
    const p = this.docs ? await this.docs(q) : null;
    return p ? { text: shortQuote(p.text, q, 140), id: p.id } : null;
  }
  private get canLookUp(): boolean { return !!(this.answer || this.docs); }

  // An optional field the customer has nothing for: left blank, and the form moves on.
  private skip(f: Field) {
    this.values[f.name] = '';
    this.events.push({ turn: this.n, type: 'skipped', field: f.name });
    if (this.current === f.name) this.moveOn();
  }

  // ----- applying the model's tool calls -----
  private async apply(content: string, calls: ToolCall[], by: 'model' | 'rules'): Promise<string> {
    const tails: string[] = [];
    let confirmedNow = false, proposedNow = false, answered = false, acted = false, questionTail = false, keptNow = false;
    const said = this.lastUser;
    const stale = !!this.pending; // a read-back asked on an earlier turn
    this.sureAsked = false;
    const ev = (e: Omit<DeskEvent, 'turn'>) => this.events.push({ turn: this.n, by, ...e });
    const rec = (c: ToolCall, result: string) => this.acts.push({ name: c.name, args: c.args ?? {}, result });
    // "My email should be …": a correction to a named field goes to that field, whatever the model called.
    const fix = CORRECTION.exec(said);
    // "The name should be …": the one filled field of that kind, when the words name no field directly.
    const kindWord: Record<string, string> = { name: 'name', email: 'email', phone: 'phone', number: 'phone' };
    const byKind = fix ? this.flow.fields.filter(f => f.kind === kindWord[fix[1].trim().split(/\s+/).pop()!.toLowerCase()] && this.values[f.name]) : [];
    const ff = fix ? this.field(fix[1].trim()) ?? (byKind.length === 1 ? byKind[0] : undefined) : undefined;
    if (ff && !this.pending) {
      const v = this.ruleParse(ff, fix![2]);
      if (v && this.grounded(ff, v)) calls = [{ name: 'propose_value', args: { field: ff.name, value: v } }];
    }
    // "None" to an optional question: left blank, whatever the model called.
    const cur = this.field(this.current);
    // From RISK_TWICE up a skip is asked twice: "none" asks "are you sure?", and only a clear yes then skips it.
    const skipNow = !!cur && this.skipAsk === cur.name && clearYes(said);
    if (cur && this.skipAsk === cur.name && !skipNow) this.skipAsk = '';
    if (!this.pending && cur?.optional && this.values[cur.name] === undefined && NONE.test(said) && this.risk(cur) >= RISK_TWICE && !skipNow) {
      this.skipAsk = cur.name; acted = true; calls = []; questionTail = true;
      ev({ type: 'skip_asked', field: cur.name }); tails.push(`Just to be sure: you want to leave the ${cur.label} blank?`);
    }
    if (!this.pending && cur?.optional && this.values[cur.name] === undefined && (skipNow || (NONE.test(said) && this.risk(cur) < RISK_TWICE))) {
      this.skip(cur); keptNow = true; acted = true; calls = []; this.skipAsk = '';
      rec({ name: 'skip_field', args: { field: cur.name } }, `Left ${cur.name} blank. ${this.allFilled() ? 'All fields are filled.' : `Next: ${this.current}.`}`);
      tails.push(`Okay, I'll leave the ${cur.label.replace(/\s*\(optional\)\s*$/i, '')} blank.`);
    }
    // A clear yes to the read-back just asked fills it first, whatever the model called: small models often
    // re-propose the same value instead of confirming, which would loop the read-back forever.
    if (this.pending && this.lastAgentAskedReadback() && clearYes(said)) {
      const viaModel = calls.some(c => c.name === 'confirm_pending');
      if (await this.confirm(viaModel ? by : 'net')) { confirmedNow = true; acted = true; rec({ name: 'confirm_pending', args: {} }, this.confirmNote()); }
      calls = calls.filter(c => c.name !== 'confirm_pending');
    }
    for (const c of calls) {
      const a = c.args ?? {};
      if (c.name === 'propose_value') {
        const f = this.field(String(a.field ?? ''));
        if (!f) { ev({ type: 'bad_field', detail: String(a.field) }); rec(c, 'Error: no such field.'); continue; }
        if (f.optional && NONE.test(String(a.value ?? '')) && NONE.test(said) && this.pending?.field !== f.name && this.risk(f) < RISK_TWICE) {
          this.skip(f); keptNow = true; acted = true; rec(c, `Left ${f.name} blank.`); continue;
        }
        let nv = normalize(f, String(a.value ?? ''));
        // The model miscopied what was said (two letters swapped, a stray digit): if the rules read a valid value
        // straight from the customer's words, use that one instead.
        if (f.kind !== 'text' && f.kind !== 'choice' && (!nv.value || !this.grounded(f, nv.value))) {
          const rv = this.ruleParse(f, said);
          if (rv && rv !== nv.value && this.grounded(f, rv)) { ev({ type: 'rule_value', field: f.name, value: rv, detail: String(a.value ?? '') }); nv = { value: rv }; }
        }
        // A choice the model named badly ("S" for "my son", the next range up): the option the customer's own words
        // name wins, when just one does.
        if (f.kind === 'choice') {
          const rv = matchOption(f, said);
          if (rv && rv !== nv.value && this.grounded(f, rv)) { ev({ type: 'rule_value', field: f.name, value: rv, detail: String(a.value ?? '') }); nv = { value: rv }; }
        }
        if (!nv.value && (f.kind === 'serial' || f.kind === 'phone') && !/\d|\b(zero|oh|one|two|three|four|five|six|seven|eight|nine)\b/i.test(said)) { ev({ type: 'ungrounded', field: f.name, value: String(a.value ?? '') }); rec(c, 'Not used: the customer did not say that.'); continue; }
        if (!nv.value) { ev({ type: 'problem', field: f.name, detail: nv.problem }); rec(c, `Not valid: ${nv.problem}`); tails.push(`${nv.problem} ${/\?$/.test(nv.problem ?? '') ? '' : f.kind === 'name' ? 'Could you spell it for me?' : f.kind === 'serial' ? 'Could you read it again, in groups of four?' : f.question}${this.offer(f)}`); questionTail = true; acted = true; continue; }
        const value = nv.value; // non-empty from here; a const keeps that narrowing inside the callbacks below
        // A field that isn't open, proposed from words the caller didn't say ("yes" read as a serial, a guessed tax
        // year): ignored without a word, and it doesn't stop the net below from reading the open field's answer.
        if (!this.grounded(f, nv.value) && f.name !== this.current && this.pending?.field !== f.name) {
          ev({ type: 'ungrounded', field: f.name, value: nv.value }); rec(c, 'Not used: the customer did not say that.'); continue;
        }
        if (!this.grounded(f, nv.value)) {
          ev({ type: 'ungrounded', field: f.name, value: nv.value }); rec(c, 'Not used: the customer did not say that. Ask them to say or spell it.');
          tails.push((f.kind === 'name' || f.kind === 'email' ? `Sorry, could you spell the ${f.label} for me, letter by letter?` : `Sorry, could you say the ${f.label} once more?`) + this.offer(f));
          questionTail = true; acted = true; continue;
        }
        acted = true;
        if (this.values[f.name] === nv.value && this.pending?.field !== f.name) {
          ev({ type: 'already', field: f.name, value: nv.value });
          // The customer went back and gave the same value again: keep it and move on, never ask for it again.
          if (f.name === this.current && !keptNow) { keptNow = true; this.moveOn(); tails.push(`Okay, I'll keep the ${f.label} as it is.`); }
          rec(c, `Already filled with that value; kept. ${this.allFilled() ? 'All fields are filled.' : `Next: ${this.current}.`}`); continue;
        }
        const check = await this.hooks.check?.(f, nv.value);
        if (check) { ev({ type: 'page_refused', field: f.name, detail: String(check) }); tails.push(`${check} ${f.question}`); questionTail = true; continue; }
        // A fix to one item of a read-back: re-read it with the new value.
        if (this.pending && (this.pending.field === f.name || this.pending.group?.some(g => g.field === f.name))) {
          const p = this.pending;
          if (p.field === f.name) this.setPending(f, nv.value, p.group);
          else this.setPending(this.field(p.field)!, p.value, p.group!.map(g => g.field === f.name ? { field: f.name, value } : g));
          proposedNow = true;
          ev({ type: 'propose', field: f.name, value: nv.value }); rec(c, `Read back to the customer: "${this.pending!.text}" Waiting for yes or no.`);
          continue;
        }
        if (this.pending && this.pending.field !== f.name && stale && !clearYes(said)) {
          ev({ type: 'dropped', field: this.pending.field, value: this.pending.value });
          this.pending = null;
        }
        if (this.pending && this.pending.field !== f.name) {
          if (!this.queue.some(q => q.field === f.name)) this.queue.push({ field: f.name, value: nv.value });
          else this.queue = this.queue.map(q => q.field === f.name ? { field: f.name, value } : q);
          ev({ type: 'queued', field: f.name, value: nv.value }); rec(c, 'Queued: read back after the current one.');
          continue;
        }
        if (this.needsPerson(f, tails)) { questionTail = true; continue; }
        this.setPending(f, nv.value);
        proposedNow = true;
        ev({ type: 'propose', field: f.name, value: nv.value }); rec(c, `Read back to the customer: "${this.pending!.text}" Waiting for yes or no.`);
        if (await this.passing(by)) { confirmedNow = true; this.acts[this.acts.length - 1].result = this.confirmNote(); }
      } else if (c.name === 'confirm_pending') {
        if (!this.pending) { ev({ type: 'confirm_nothing' }); rec(c, 'Nothing is waiting for confirmation.'); continue; }
        if (!clearYes(said) || !this.lastAgentAskedReadback()) { ev({ type: 'confirm_refused', field: this.pending.field, detail: said }); rec(c, 'Refused: the customer did not clearly say yes.'); continue; }
        acted = true;
        if (await this.confirm(by)) { confirmedNow = true; rec(c, this.confirmNote()); }
      } else if (c.name === 'reject_pending') {
        if (!this.pending) continue;
        acted = true;
        const f = this.field(this.pending.field)!;
        ev({ type: 'reject', field: f.name, value: this.pending.value }); rec(c, 'Cleared. Ask for it again.'); this.mishear(f);
        this.pending = null;
        this.current = f.name;
        tails.push((f.kind === 'name' || f.kind === 'email' ? `Sorry about that. Could you spell it for me, letter by letter?` : f.kind === 'serial' ? 'Sorry about that. Could you read it again, slowly, in groups of four?' : `Sorry about that. ${f.question}`) + this.offer(f));
        questionTail = true;
      } else if (c.name === 'go_to_field') {
        const f = this.field(String(a.field ?? ''));
        if (!f) { ev({ type: 'bad_field', detail: String(a.field) }); continue; }
        // "Go to" the empty field already open is no move: small models do this instead of proposing the answer
        // just given, and the code net below then reads that answer back.
        if (f.name === this.current && !this.pending && this.values[f.name] === undefined) { ev({ type: 'goto_same', field: f.name } as DeskEvent); continue; }
        acted = true;
        if (this.pending && (this.pending.field === f.name || this.pending.group?.some(g => g.field === f.name))) {
          ev({ type: 'goto_pending', field: f.name }); rec(c, `Still waiting for yes or no on ${f.name}.`);
          tails.push(this.pending.text); questionTail = true; continue;
        }
        this.goTo(f);
        ev({ type: 'goto', field: f.name }); rec(c, `Now on ${f.name}.`);
        const v = this.values[f.name];
        tails.push(v !== undefined ? `Sure. I have the ${f.label} as ${v}. What should it be?` : `Sure. ${f.question}`);
        questionTail = true;
      } else if (c.name === 'answer_question') {
        acted = true; answered = true;
        const q = String(a.question ?? said);
        // At most 3 lookups a turn (a two-part question is two); a filter the model took from a search is tried first, and dropped if it finds nothing.
        if (++this.lookupsThisTurn > 3) { ev({ type: 'lookup_limit' }); rec(c, 'Too many lookups this turn; ask the caller to take the rest one at a time.'); continue; }
        const filter = this.search ? filterFrom(a) : undefined;
        let p = await this.lookup(q, filter);
        if (!p && filter && (filter.section || filter.pageType || filter.language)) { ev({ type: 'filter_dropped', detail: JSON.stringify(filter) }); p = await this.lookup(q); }
        // The model's rewording can lose the point; try the customer's own question too.
        const own = said.match(ASKED_Q)?.[0] ?? said;
        const same = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!p && same(own) !== same(q)) p = await this.lookup(own);
        ev({ type: 'answer', detail: p ? p.id : 'none' }); rec(c, p ? `Read to the customer: ${p.text}` : 'Nothing in the documents answers this; told the customer you do not know.');
        tails.push(p ? p.text : this.unknown);
      } else if (this.lookups && c.name.startsWith('lookup_')) {
        acted = true; answered = true;
        if (++this.lookupsThisTurn > 3) { ev({ type: 'lookup_limit' }); rec(c, 'Too many lookups this turn.'); continue; } // the cap is shared with answer_question
        const text = await this.runLookup(c, false);
        rec(c, text); tails.push(text);
      } else if (c.name === 'end_call') {
        if (this.allFilled() || BYE.test(said)) {
          acted = true; this.done = true; ev({ type: 'end' });
          return this.allFilled() ? this.finishLine() : this.answerOnly ? 'Thanks for calling, goodbye.' : "No problem. I haven't sent anything; the form stays as it is. Thanks for calling, goodbye.";
        }
        ev({ type: 'end_refused' });
      } else ev({ type: 'bad_tool', detail: c.name });
    }

    // A question the model did not look up: look it up; answer only if the business's passages answer it.
    // A question asked in the same breath as an answer ("my name's Sarah. What does E24 mean?") is answered too,
    // before the read-back.
    // On a question desk the model decides what is a question for the documents ("can I ask you about taxes?" is not);
    // code looks it up only when the model stated a fact itself, or said nothing at all to a question.
    const askedQ = said.match(ASKED_Q)?.[0];
    const stated = content.split(/(?<=[.!?])\s+/).some(x => FACTS.test(x));
    const netAsk = this.answerOnly ? !answered && !this.done && (stated || (!content.trim() && QUESTION.test(said)))
      : !answered && (askedQ || (!proposedNow && !confirmedNow && QUESTION.test(said))) && !calls.some(c => c.name === 'go_to_field' || c.name === 'end_call');
    if (netAsk && this.canLookUp) {
      const p = await this.lookup(askedQ && (proposedNow || confirmedNow) ? askedQ : said);
      if (p) { answered = true; acted = true; ev({ type: 'answer', detail: p.id, by: 'net' } as DeskEvent); rec({ name: 'answer_question', args: { question: said } }, `Read to the customer: ${p.text}`); tails.push(p.text); }
      else if (this.answerOnly) { answered = true; ev({ type: 'answer', detail: 'none', by: 'net' } as DeskEvent); tails.push(this.unknown); }
    }
    // Code nets for weak models: a clear yes to the read-back just asked is a yes; a clear no is a no.
    if (!acted && this.pending && this.lastAgentAskedReadback()) {
      if (clearYes(said)) { if (await this.confirm('net')) { confirmedNow = true; rec({ name: 'confirm_pending', args: {} }, this.confirmNote()); } }
      else if (clearNo(said) && said.trim().split(/\s+/).length <= 4) {
        const f = this.field(this.pending.field)!; ev({ type: 'reject', field: f.name, value: this.pending.value, by: 'net' } as DeskEvent); this.mishear(f); rec({ name: 'reject_pending', args: {} }, 'Cleared. Ask for it again.'); this.pending = null; this.current = f.name;
        tails.push(f.kind === 'name' || f.kind === 'email' ? 'Sorry about that. Could you spell it for me, letter by letter?' : `Sorry about that. ${f.question}`); questionTail = true;
      }
    } else if (!acted && !this.pending && !QUESTION.test(said) && !this.answerOnly) {
      const f = this.field(this.current)!;
      // Free text is taken as said only when it reads like an answer: a few words, not a bare yes or no.
      const v = f.kind !== 'text' ? this.ruleParse(f, said) : said.trim().split(/\s+/).length >= 3 && !clearYes(said) && !clearNo(said) ? said.trim() : '';
      const refused = v && this.grounded(f, v) ? await this.hooks.check?.(f, v) : undefined;
      if (refused) { ev({ type: 'page_refused', field: f.name, detail: String(refused), by: 'net' } as DeskEvent); tails.push(`${refused} ${f.question}`); questionTail = true; }
      else if (v && this.grounded(f, v) && this.needsPerson(f, tails)) questionTail = true;
      else if (v && this.grounded(f, v)) {
        this.setPending(f, v); proposedNow = true; ev({ type: 'propose', field: f.name, value: v, by: 'net' } as DeskEvent); rec({ name: 'propose_value', args: { field: f.name, value: v } }, `Read back to the customer: "${this.pending!.text}" Waiting for yes or no.`);
        if (await this.passing('net')) { confirmedNow = true; this.acts[this.acts.length - 1].result = this.confirmNote(); }
      }
    }

    // Back on a field that is already filled, and the customer wants it kept: move on.
    if (!acted && !keptNow && !this.pending && this.values[this.current] !== undefined && (clearYes(said) || KEEP.test(said))) {
      const f = this.field(this.current)!; keptNow = true; this.moveOn();
      ev({ type: 'kept', field: f.name, by: 'net' } as DeskEvent); rec({ name: 'keep_value', args: { field: f.name } }, `Kept ${f.name}. ${this.allFilled() ? 'All fields are filled.' : `Next: ${this.current}.`}`);
      tails.push(`Okay, I'll keep the ${f.label} as it is.`);
    }
    // Short choices given together are read back together, so one yes covers them.
    if (proposedNow && this.pending && this.field(this.pending.field)!.kind === 'choice' && this.queue.some(q => this.field(q.field)!.kind === 'choice')) {
      const extra = this.queue.filter(q => this.field(q.field)!.kind === 'choice' && this.values[q.field] !== q.value);
      const p = this.pending;
      this.setPending(this.field(p.field)!, p.value, [...(p.group ?? []), ...extra]);
      const last = this.acts[this.acts.length - 1];
      if (last) last.result += ` (Now read back together: "${this.pending.text}")`;
    }
    if (this.notes.length) { tails.unshift(...this.notes); this.notes = []; }
    // What the reply must end with, written by code.
    if (this.pending && (proposedNow || confirmedNow)) { tails.push(this.pending.text); questionTail = true; }
    else if ((confirmedNow || keptNow) && this.allFilled()) { tails.push(this.finishLine()); this.complete = true; questionTail = true; }
    else if (confirmedNow || keptNow) { tails.push(transition(this.field(this.current)!.question, this.n)); questionTail = true; }
    else if (answered && !questionTail && !this.answerOnly) { tails.push(this.pending ? `Now, back to that read-back: ${this.pending.text}` : `Now, ${lowerFirst(this.field(this.current)!.question)}`); questionTail = true; }

    // On a question desk, a looked-up answer is said on its own: the model's words beside it could state a fact.
    let text = this.answerOnly && answered ? '' : this.cleanModelText(content, tails.length > 0, confirmedNow);
    // Warmth that does not depend on the model: a short reply to small talk, a varied thank-you after a yes.
    if (!text && SMALL_TALK.test(said)) text = smallTalkReply(said);
    if (!text && confirmedNow && !this.sureAsked && this.fills[this.fills.length - 1]?.yes) text = ACKS[this.n % ACKS.length];
    if (!tails.length) {
      if (this.pending) { tails.push(this.pending.text); questionTail = true; }
      else if (!this.pending && this.allFilled() && !this.done) { tails.push(this.finishLine()); this.complete = true; }
      else if (this.answerOnly) { if (!text) tails.push(this.done ? '' : "Sorry, I didn't catch that. What would you like to know?"); }
      else if (!/\?/.test(text)) tails.push(this.field(this.current)!.question);
    }
    if (questionTail) text = text.split(/(?<=[.!?])\s+/).filter(s => !/\?$/.test(s)).join(' ');
    return [text, ...tails].filter(Boolean).join(' ');
  }

  private confirmNote(): string {
    if (this.sureAsked) return `Asked again: "${this.pending!.text}" Waiting for a second clear yes.`;
    const last = this.fills[this.fills.length - 1];
    return `Filled ${last.field} = "${last.value}". ${this.pending ? `Now reading back ${this.pending.field}.` : this.allFilled() ? 'All fields are filled.' : `Next: ${this.current}.`}`;
  }

  private finishLine(): string {
    if (this.customers && !this.mem.asked && this.contactKeys().length) {
      this.mem.asked = true; this.mem.awaiting = true;
      return this.mem.returning ? "That's everything I need. Shall I update the details I keep for you, for next time?" : "That's everything I need. Would you like me to remember your name and contact details for next time?";
    }
    return this.finish ?? "That's everything I need, it's all filled in on the form on your screen. Have a look, and when it's right, press Submit. I won't send it for you.";
  }

  private lastAgentAskedReadback(): boolean {
    const a = [...this.log].reverse().find(m => m.who === 'agent');
    return !!a && !!this.pending && /\?\s*$/.test(a.text) && a.text.toLowerCase().includes(this.pending.text.toLowerCase());
  }

  private setPending(f: Field, v: string, group: { field: string; value: string }[] = []) {
    // A new value for one just read back or filled is a correction: the rest of the call is more careful.
    const was = this.pending?.field === f.name ? this.pending.value : this.values[f.name];
    if (was && was !== v) this.mishear(f);
    const g = group.filter(x => x.field !== f.name);
    this.pending = { field: f.name, value: v, group: g, text: g.length ? groupReadback([v, ...g.map(x => x.value)], this.n, this.brisk) : readback(f, v, this.n, this.brisk) };
    this.queue = this.queue.filter(q => q.field !== f.name && !g.some(x => x.field === q.field));
  }

  // After a second miss on a serial, email or phone, the flow's typeOffer ("You can also type it with Keyboard.").
  private offer(f: Field): string {
    if (!this.flow.typeOffer || !['serial', 'email', 'phone'].includes(f.kind)) return '';
    const misses = this.events.filter(e => e.field === f.name && ['problem', 'ungrounded', 'reject'].includes(e.type)).length;
    return misses >= 2 ? ` ${this.flow.typeOffer}` : '';
  }

  // A field's score now: the business's (or the default for its kind), raised once the caller has corrected a mishearing.
  risk(f: Field): number { return Math.min(100, (f.risk ?? defaultRisk(f)) + (this.misheard ? RISK_MISHEARD : 0)); }

  private mishear(f: Field) {
    if (!this.misheard) this.events.push({ turn: this.n, type: 'misheard', field: f.name });
    this.misheard = true;
  }

  // Up to 30: the value read from the caller's words is filled at once and said in passing ("Okay, Tuesday for the
  // day."); the caller can still change it. A group read-back still waits for its yes.
  private async passing(by: 'model' | 'net' | 'rules'): Promise<boolean> {
    const p = this.pending;
    if (!p || p.group?.length || p.reuse) return false;
    const f = this.field(p.field)!;
    if (this.risk(f) > 30) return false;
    const said = `Okay, ${f.kind === 'when' || f.kind === 'date' ? formatDate(p.value) : p.value} for the ${f.label}.`;
    if (!(await this.confirm(by, true))) return false;
    this.notes.push(said);
    return true;
  }

  // From RISK_PERSON up the desk never fills it: a person on the business's side approves it. The field is left
  // blank and the caller is told.
  private needsPerson(f: Field, tails: string[]): boolean {
    if (this.risk(f) < RISK_PERSON) return false;
    this.events.push({ turn: this.n, type: 'needs_person', field: f.name, detail: String(this.risk(f)) });
    this.skip(f);
    tails.push(`The ${f.label} needs a person on our team to approve it, so I'll leave it blank for them. ${this.allFilled() ? '' : this.field(this.current)!.question}`.trim());
    return true;
  }

  private goTo(f: Field) {
    if (this.pending && this.pending.field !== f.name) this.pending = null;
    if (f.name !== this.current && this.values[this.current] === undefined && !this.returnTo.includes(this.current)) this.returnTo.push(this.current);
    this.current = f.name;
  }

  private async confirm(by: 'model' | 'net' | 'rules', passing = false): Promise<boolean> {
    const p = this.pending!;
    const f = this.field(p.field)!;
    const risk = this.risk(f);
    // The code lock (decision 0011): from RISK_LOCK up nothing is filled without a recorded clear yes, and from
    // RISK_TWICE up the yes is asked for twice.
    if (!passing && risk >= RISK_LOCK && !clearYes(this.lastUser)) { this.events.push({ turn: this.n, type: 'locked', field: f.name, detail: String(risk), by }); return false; }
    if (!passing && risk >= RISK_TWICE && !p.sure) {
      p.sure = true; p.text = `Just to be sure, ${f.kind === 'when' || f.kind === 'date' ? formatDate(p.value) : p.value} for the ${f.label}: are you sure?`;
      this.sureAsked = true; this.events.push({ turn: this.n, type: 'are_you_sure', field: f.name, detail: String(risk), by });
      return true;
    }
    const no = await this.hooks.fill?.(f, p.value);
    if (no) { this.events.push({ turn: this.n, type: 'page_refused', field: f.name, detail: String(no), by }); this.pending = null; return false; }
    for (const it of [{ field: p.field, value: p.value }, ...(p.group ?? [])]) {
      const itf = this.field(it.field)!;
      if (it.field !== p.field) { const no2 = await this.hooks.fill?.(itf, it.value); if (no2) { this.events.push({ turn: this.n, type: 'page_refused', field: itf.name, detail: String(no2), by }); continue; } }
      this.values[it.field] = it.value;
      this.fills.push({ turn: this.n, field: it.field, value: it.value, readback: passing ? '' : p.text, yes: passing ? '' : this.lastUser, risk });
      this.events.push({ turn: this.n, type: 'confirm', field: it.field, value: it.value, by, ...(passing ? { detail: 'passing' } : {}) });
    }
    this.pending = null;
    for (const it of [{ field: p.field }, ...(p.group ?? [])]) await this.onContact(this.field(it.field)!);
    // Next: a value already given and queued, else where the customer came from, else the first empty field.
    while (this.queue.length) {
      const q = this.queue.shift()!; const qf = this.field(q.field)!;
      if (this.values[q.field] !== q.value) {
        this.setPending(qf, q.value); this.current = q.field;
        if (q.reuse) { this.pending!.text = reuseReadback(qf, q.value); this.pending!.reuse = true; }
        else await this.passing(by);
        return true;
      }
    }
    this.moveOn();
    return true;
  }

  // Where the customer came from, else the first empty field.
  private moveOn() {
    while (this.returnTo.length) { const r = this.returnTo.pop()!; if (this.values[r] === undefined) { this.current = r; return; } }
    const next = this.flow.fields.find(x => this.values[x.name] === undefined);
    if (next) this.current = next.name;
  }

  allFilled(): boolean { return !this.answerOnly && this.flow.fields.every(f => this.values[f.name] !== undefined); }

  // Model text is kept only where it is safe: no claims of saving or submitting, no numbers nobody said, no read-backs
  // of its own, and short.
  private cleanModelText(content: string, haveTail: boolean, confirmedNow: boolean): string {
    // A stray thinking tag ("…taxes?</thinkYes, go ahead."): keep what came before it.
    const cut = (content ?? '').split(/<\/?think>?/i);
    let t = (cut.find(x => x.trim()) ?? '').replace(/[*_#`>]+/g, '').replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const known = new Set((this.userText() + ' ' + Object.values(this.values).join(' ')).match(/\d+/g) ?? []);
    let sents = t.split(/(?<=[.!?])\s+/).filter(s => s.trim());
    sents = sents.filter(s => !(CLAIMS.test(s) && !(confirmedNow && !/submit/i.test(s))));
    // Internal talk ("I need to fill preferredtime", "let me fill in visit type next") is not for the caller.
    sents = sents.filter(s => !/\b(fill(ing)?|field|tool|pending|propos\w*|confirm_\w+|\w+_\w+)\b/i.test(s));
    sents = sents.filter(s => (s.match(/\d+/g) ?? []).every(d => known.has(d)));
    sents = sents.filter(s => !/\b[A-Za-z]-[A-Za-z]-[A-Za-z]\b|^(so )?i have\b|^i'?ll put\b|, is that right\?$/i.test(s));
    if (haveTail) {
      const vals = [this.pending?.value, ...this.queue.map(q => q.value)].filter(Boolean).map(v => v!.toLowerCase());
      sents = sents.filter(s => !vals.some(v => s.toLowerCase().includes(v.split(/[\s@]/)[0])) && !/\b(spell|is that (right|correct)|did i get)\b/i.test(s));
      sents = sents.filter(s => !/\?$/.test(s)).slice(0, 1).filter(s => s.length <= 110);
    } else sents = sents.slice(0, 2);
    let out = sents.join(' ');
    if (out.length > this.maxModel) out = out.slice(0, this.maxModel).replace(/\s+\S*$/, '') + '.';
    return out;
  }

  // ----- v1-style rules: used for a turn when the model fails, and by the code nets -----
  private ruleParse(f: Field, said: string): string {
    switch (f.kind) {
      case 'name': { const n = parseName(joinSpelled(said)); return n ? normalizeName(n, partName(f)).value ?? '' : ''; }
      case 'phone': return normalizePhone(said).value ?? '';
      case 'email': return normalizeEmail(said).value ?? '';
      case 'serial': return normalizeSerial(said).value ?? '';
      case 'choice': return matchOption(f, said);
      default: return normalize(f, said).value ?? '';
    }
  }

  private async rulesTurn(said: string): Promise<string> {
    this.events.push({ turn: this.n, type: 'fallback', by: 'rules' });
    if (this.pending) {
      if (clearYes(said)) return this.apply('', [{ name: 'confirm_pending', args: {} }], 'rules');
      const f = this.field(this.pending.field)!;
      const v = this.ruleParse(f, said);
      if (v && v !== this.pending.value) return this.apply('', [{ name: 'propose_value', args: { field: f.name, value: v } }], 'rules');
      if (clearNo(said)) return this.apply('', [{ name: 'reject_pending', args: {} }], 'rules');
      return `Sorry, ${lowerFirst(this.pending.text)}`;
    }
    if ((QUESTION.test(said) || this.answerOnly) && this.canLookUp) return this.apply('', [{ name: 'answer_question', args: { question: said } }], 'rules');
    if (this.answerOnly) return "Sorry, I didn't catch that. What would you like to know?";
    const f = this.field(this.current)!;
    const v = this.ruleParse(f, said);
    if (v) return this.apply('', [{ name: 'propose_value', args: { field: f.name, value: v } }], 'rules');
    // A serial, phone or code that is there but wrong gets what was heard and what is wrong, as with the model.
    if (['serial', 'phone', 'digits', 'code'].includes(f.kind) && /\d/.test(said)) return this.apply('', [{ name: 'propose_value', args: { field: f.name, value: said } }], 'rules');
    return `Sorry, I didn't quite catch that. ${f.question}`;
  }
}

const lowerFirst = (s: string) => s ? s[0].toLowerCase() + s.slice(1) : s;

// Builds a model from env-style config (DESK_URL, DESK_KEY, DESK_MODEL, DESK_STREAM).
// Default agent model: local LFM3-1.7B served by llama.cpp (OpenAI-compatible) at DESK_URL.
export const DEFAULT_DESK_URL = 'http://127.0.0.1:11438/v1';
export function modelFromEnv(prefix = 'DESK', env: Record<string, string | undefined> = ENV): OpenAIChat | undefined {
  const url = env[`${prefix}_URL`] ?? (prefix === 'DESK' ? DEFAULT_DESK_URL : undefined);
  if (!url) return undefined;
  return new OpenAIChat({ url, key: env[`${prefix}_KEY`] ?? '', model: env[`${prefix}_MODEL`] ?? (prefix === 'DESK' ? 'lfm3' : ''), stream: env[`${prefix}_STREAM`] === '1', timeoutMs: +(env[`${prefix}_TIMEOUT_MS`] ?? 15000) });
}
// The hosted model for the optional hybrid (DESK_HYBRID=1, DESK_HEAVY_URL / _KEY / _MODEL).
export function heavyFromEnv(env: Record<string, string | undefined> = ENV): OpenAIChat | undefined {
  return env.DESK_HYBRID === '1' ? modelFromEnv('DESK_HEAVY', env) : undefined;
}
