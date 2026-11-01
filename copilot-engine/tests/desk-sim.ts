// Desk (v2) simulator: an LLM plays the customer, the desk plays the receptionist, code scores every conversation.
// Usage: node tests/desk-sim.ts --agent qwen-flash [--heavy qwen-27b] --customer qwen-27b --judge nemotron \
//          --n 20 --seed 1 --conc 3 --flows brookside,halvorsen --tag run1
// Models come from env files in $DESK_ENV_DIR (never printed): qwen.env / glm.env (ABA_GATEWAY_URL, ABA_API_KEY),
// or.env (openrouter_free_only), lfm.env (local llama.cpp through an SSH tunnel).
// Style examples come from tests/data/sgd_appointments.json + sgd_user.json (run the fetch scripts first).
import fs from 'node:fs';
import { Desk, OpenAIChat, clearYes, docsFrom, normalize, type ChatModel } from '../src/desk.ts';
import { MemoryStore, customerKey } from '../src/memory.ts';
import { brookside, brooksideDocs } from '../src/flows/brookside.ts';
import { halvorsen } from '../src/flows/halvorsen.ts';
import { halvorsenFilter } from '../src/manuals/halvorsen-filter.ts';
import type { Field, Flow } from '../src/types.ts';
import type { Passage } from '../src/guide.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('--n', '20'), SEED = +arg('--seed', '1'), CONC = +arg('--conc', '3'), TAG = arg('--tag', `seed${SEED}`);
const FLOWS = arg('--flows', 'brookside,halvorsen').split(',');
const MAX_TURNS = +arg('--max-turns', '32');
const FORCE = arg('--force', '').split(',').filter(Boolean) as Behavior[]; // behaviors every conversation gets

// ---------- models ----------
const ENV_DIR = process.env.DESK_ENV_DIR ?? '';
function envFile(name: string): Record<string, string> {
  const p = `${ENV_DIR}/${name}`;
  if (!ENV_DIR || !fs.existsSync(p)) return {};
  return Object.fromEntries(fs.readFileSync(p, 'utf8').split('\n').filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
}
function preset(name: string, timeoutMs = 20000): ChatModel | undefined {
  if (!name || name === 'none') return undefined;
  if (name.startsWith('qwen')) { const e = envFile('qwen.env'); return new OpenAIChat({ url: e.ABA_GATEWAY_URL, key: e.ABA_API_KEY, model: name === 'qwen-27b' ? 'qwen3.8-27b' : 'qwen3.8-flash', timeoutMs, patient: true }); }
  if (name === 'glm') { const e = envFile('glm.env'); return new OpenAIChat({ url: e.ABA_GATEWAY_URL, key: e.ABA_API_KEY, model: 'glm-5.2', stream: true, timeoutMs: Math.max(timeoutMs, 40000), patient: true }); }
  if (name === 'nemotron') { const e = envFile('or.env'); return new OpenAIChat({ url: 'https://openrouter.ai/api/v1', key: e.openrouter_free_only, model: 'nvidia/nemotron-3-ultra-550b-a55b:free', nothink: false, timeoutMs: Math.max(timeoutMs, 60000), patient: true }); }
  if (name === 'lfm') { const e = envFile('lfm.env'); return new OpenAIChat({ url: process.env.LFM_URL || e.ABA_GATEWAY_URL || 'http://127.0.0.1:11438/v1', key: '', model: 'lfm3', timeoutMs, patient: true }); }
  throw new Error(`unknown model preset ${name}`);
}
const AGENT = arg('--agent', 'lfm'), HEAVY = arg('--heavy', 'none'), CUSTOMER = arg('--customer', 'qwen-27b'), JUDGE = arg('--judge', 'nemotron');
const agentModel = preset(AGENT, +arg('--agent-timeout', '15000'));
const heavyModel = preset(HEAVY);
if (heavyModel) process.env.DESK_HYBRID = '1'; // the desk ignores a heavy model unless the hybrid flag is on
const customerModel = preset(CUSTOMER, 45000)!;
const judgeModel = preset(JUDGE, 90000);
const judgeBackup = preset('qwen-27b', 60000);
const docJudge = heavyModel ?? agentModel;

// ---------- data ----------
const load = (f: string): string[] => { try { return JSON.parse(fs.readFileSync(new URL(`./data/${f}.json`, import.meta.url), 'utf8')); } catch { return []; } };
const SGD_APPT = load('sgd_appointments'), SGD_USER = load('sgd_user'), BANK = load('banking77');
const STYLE = [...SGD_APPT, ...SGD_USER].filter(u => u.split(/\s+/).length >= 4);
const OFFTOPIC = [...BANK.slice(0, 300), "what's the weather going to be like tomorrow?", 'can you recommend a good pizza place nearby?', 'do you know if the bank is open today?', 'who won the game last night?'];

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type R = () => number;
const pick = <T>(r: R, a: T[]): T => a[Math.floor(r() * a.length)];
const shuffle = <T>(r: R, a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

const FIRST = ['Pooja', 'Maya', 'Liam', 'Siobhan', 'Xiomara', 'Aidan', 'Kaitlyn', 'Mateo', 'Yusuf', 'Chloe', 'Nnamdi', 'Ingrid', 'Ravi', 'Zoe', 'Theo', 'Amara', 'Sean', 'Leila', 'Joaquin', 'Hana', 'Owen', 'Priya', 'Dmitri', 'Grace'];
const LAST = ['Bajracharya', 'Chen', 'Okonkwo', "O'Brien", 'Nguyen', 'Kowalski', 'Garcia', 'Patel', 'Schmidt', 'Haddad', 'Johansson', 'Moreau', 'Kim', 'Abernathy', 'Fitzgerald', 'Rossi', 'Tanaka', 'Mbeki', 'Lindqvist', 'Novak'];
const PARENT = ['Anita', 'Michael', 'Fatima', 'David', 'Rosa', 'James', 'Mei', 'Carlos', 'Sarah', 'Ahmed', 'Elena', 'Tom', 'Nadia', 'Peter', 'Lucia', 'Kwame'];
// Names speech recognisers often get wrong, and what they write instead.
const MISHEAR: Record<string, string> = { Pooja: 'Puja', Aidan: 'Aiden', Kaitlyn: 'Caitlin', Sean: 'Shawn', Siobhan: 'Shivon', Xiomara: 'See Omara', Chloe: 'Cloey', Zoe: 'Zoey', Theo: 'Teo', Leila: 'Layla', Joaquin: 'Wakeen', Hana: 'Hannah', Chen: 'Chan', Nguyen: 'When', Okonkwo: 'Okonko', Kowalski: 'Kowalsky', Haddad: 'Hadad', Johansson: 'Johanson', Bajracharya: 'Bajra Charya', Abernathy: 'Abernethy', Lindqvist: 'Lindquist', Mei: 'May', Nadia: 'Nadya', Kwame: 'Kwami' };
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'icloud.com', 'brightmail.net', 'hotmail.com'];
const PROBLEMS: [string, string][] = [['it shows error E24 and the water will not drain', 'e24'], ['there is water leaking onto the kitchen floor', 'leak'], ['it stops in the middle of the cycle', 'stop'], ['the dishes come out cloudy and gritty', 'cloudy'], ['it makes a loud grinding noise', 'grinding'], ['the display is completely blank', 'display'], ["it doesn't heat the water", 'heat']];
// Questions answerable from the business's own passages, with a word the answer must contain.
const DOCQ: Record<string, [string, RegExp][]> = {
  brookside: [['what are your opening hours?', /8 am|6 pm|monday/i], ['is there parking at the clinic?', /parking/i], ['what should I bring to the appointment?', /insurance card|vaccination record/i], ['do you take Medicaid?', /medicaid/i], ['how much is a sick visit if I pay myself?', /\$95/], ['how long does a checkup take?', /30 minutes/i], ['are you open on Saturdays?', /saturday/i], ['what if I need to cancel?', /24 hours/i]],
  halvorsen: [['how often should I clean the filter?', /month|two weeks/i], ['what does error E24 mean?', /drain/i], ['how long is the warranty?', /two-year|two year/i], ['can I use washing-up liquid in it?', /foam|dishwasher/i], ['where is the wall switch usually?', /sink|cabinet/i]],
};
const DONTKNOW = /don'?t have that information|don'?t know|not sure|can only help|can'?t help|only able to help|not able to help|unable to help/i;

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const LETTERWORD: Record<string, string> = { S: 'ess', O: 'oh', C: 'see', B: 'bee', P: 'pee', T: 'tee', J: 'jay', K: 'kay', R: 'are', Y: 'why', U: 'you', A: 'ay', E: 'ee', L: 'el', M: 'em', N: 'en' };

type Truth = Record<string, string>;
type Behavior = 'rambling' | 'two_at_once' | 'vague' | 'correct_earlier' | 'asr_noise' | 'misheard_name' | 'spell_name' | 'doc_question' | 'offtopic' | 'impatient' | 'small_talk' | 'reject_fix' | 'go_back_two' | 'dropped_call' | 'returning';
const ALL_B: Behavior[] = ['rambling', 'two_at_once', 'vague', 'correct_earlier', 'asr_noise', 'misheard_name', 'spell_name', 'doc_question', 'offtopic', 'impatient', 'small_talk', 'reject_fix', 'go_back_two', 'dropped_call', 'returning'];

function makeTruth(flow: Flow, r: R): Truth {
  if (flow.id === halvorsen.id) {
    const pool = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let s = ''; do { s = ''; for (let i = 0; i < 12; i++) s += pool[Math.floor(r() * pool.length)]; } while (!/\d/.test(s) || !/[A-Z]/.test(s));
    const p = pick(r, PROBLEMS);
    return { name: `${pick(r, PARENT)} ${pick(r, LAST)}`, serial: s, problem: p[0], _problem_kw: p[1], visit_time: pick(r, ['morning', 'afternoon']) };
  }
  const last = pick(r, LAST), parent = pick(r, PARENT);
  const plast = r() < 0.8 ? last : pick(r, LAST);
  const phone = `${2 + Math.floor(r() * 8)}${Math.floor(r() * 10)}${Math.floor(r() * 10)}-${2 + Math.floor(r() * 8)}${Math.floor(r() * 10)}${Math.floor(r() * 10)}-${String(Math.floor(r() * 10000)).padStart(4, '0')}`;
  const local = pick(r, [`${parent}.${plast}`, `${parent}${plast}`, `${parent[0]}${plast}`, `${parent}${Math.floor(r() * 90 + 10)}`]).toLowerCase().replace(/[^a-z0-9.]/g, '');
  return {
    child_name: `${pick(r, FIRST)} ${last}`, visit_type: pick(r, brookside.fields[1].options!), preferred_day: pick(r, brookside.fields[2].options!),
    preferred_time: pick(r, ['Morning', 'Afternoon']), parent_name: `${parent} ${plast}`, phone, email: `${local}@${pick(r, DOMAINS)}`,
  };
}

const canon = (f: Field, v: string | undefined): string => {
  if (v === undefined) return '';
  const n = normalize(f, v).value ?? v;
  return f.kind === 'phone' ? n.replace(/\D/g, '') : f.kind === 'text' ? n.toLowerCase() : n.toLowerCase().replace(/\s+/g, ' ');
};
const valueOk = (flow: Flow, f: Field, got: string | undefined, truth: Truth): boolean => {
  if (got === undefined) return false;
  if (f.kind === 'text') return got.toLowerCase().includes(truth[`_${f.name}_kw`] ?? truth[f.name].toLowerCase());
  return canon(f, got) === canon(f, truth[f.name]);
};
const spell = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, '').split(' ').map(w => w.toUpperCase().split('').join(' ')).join(', ');

// ---------- speech recognition noise ----------
function asr(text: string, r: R, truth: Truth): string {
  let t = text;
  const ops = shuffle(r, ['lower', 'homophone', 'split', 'dup', 'letters', 'joined_name']).slice(0, 1 + Math.floor(r() * 2));
  for (const op of ops) {
    if (op === 'lower') t = t.toLowerCase().replace(/[!?;]/g, '').replace(/,/g, r() < 0.5 ? '' : ',');
    if (op === 'homophone') t = t.replace(/\b(two|four|eight|right|week|there)\b/i, m => ({ two: 'to', four: 'for', eight: 'ate', right: 'write', week: 'weak', there: 'their' }[m.toLowerCase()] ?? m));
    if (op === 'split') t = t.replace(/\b([A-Za-z]{8,})\b/, m => `${m.slice(0, 4)} ${m.slice(4)}`);
    if (op === 'dup') { const w = t.split(' '); if (w.length > 4) { const i = Math.floor(r() * (w.length - 2)); w.splice(i + 2, 0, ...w.slice(i, i + 2)); t = w.join(' '); } }
    if (op === 'letters') t = t.replace(/\b([A-Z])\b/g, (m, c: string) => (r() < 0.5 && LETTERWORD[c]) ? LETTERWORD[c] : m).replace(/\b0\b/g, () => (r() < 0.5 ? 'oh' : '0'));
    if (op === 'joined_name') {
      for (const k of ['child_name', 'parent_name', 'name']) {
        const nm = truth[k]; if (!nm) continue;
        if (t.includes(nm)) { const j = nm.replace(/[^A-Za-z]/g, '').toUpperCase(); const bad = j.replace(/OO/, 'U').replace(/AE/, 'E'); t = t.replace(nm, `${nm} ${bad}`); break; }
      }
    }
  }
  return t;
}

// ---------- the customer ----------
type Plan = { behaviors: Behavior[]; wrongFirst: Record<string, string>; correctAfter: { field: string; newValue: string; atField: string } | null; goBack: { field: string; newValue: string; atField: string } | null; docAt: string | null; offAt: string | null; smallAt: string | null; misheard: string | null; dropAt: number | null; stored: Record<string, string> | null; changedField: string | null };

function makePlan(flow: Flow, truth: Truth, r: R): Plan {
  const names = flow.fields.map(f => f.name);
  const k = 2 + Math.floor(r() * 3);
  const hasContact = flow.fields.some(f => f.kind === 'phone' || f.kind === 'email');
  const forced = FORCE.filter(b => b !== 'returning' || hasContact);
  const behaviors = [...forced, ...shuffle(r, ALL_B.filter(b => (b !== 'returning' || hasContact) && !forced.includes(b))).slice(0, Math.max(0, k - forced.length))];
  const plan: Plan = { behaviors, wrongFirst: {}, correctAfter: null, goBack: null, docAt: null, offAt: null, smallAt: null, misheard: null, dropAt: null, stored: null, changedField: null };
  if (behaviors.includes('dropped_call')) plan.dropAt = 3 + Math.floor(r() * 5);
  const variant = (f: Field): string => {
    const v = truth[f.name];
    if (f.kind === 'choice') return pick(r, (f.options ?? []).filter(o => o !== v));
    if (f.kind === 'phone') { const d = v.replace(/\D/g, '').split(''); const i = 3 + Math.floor(r() * 7); d[i] = String((+d[i] + 3) % 10); const j = d.join(''); return `${j.slice(0, 3)}-${j.slice(3, 6)}-${j.slice(6)}`; }
    if (f.kind === 'name') { const [a, ...b] = v.split(' '); return [pick(r, FIRST.filter(x => x !== a)), ...b].join(' '); }
    if (f.kind === 'email') return v.replace('@', `${Math.floor(r() * 9) + 1}@`);
    if (f.kind === 'serial') { const i = Math.floor(r() * 12); return v.slice(0, i) + (v[i] === '7' ? '1' : '7') + v.slice(i + 1); }
    return v;
  };
  const fields = flow.fields.filter(f => f.kind !== 'text');
  if (behaviors.includes('returning')) {
    const keep = flow.fields.filter(f => f.kind === 'name' || f.kind === 'phone' || f.kind === 'email');
    plan.stored = Object.fromEntries(keep.map(f => [f.name, truth[f.name]]));
    const changeable = keep.filter(f => f.kind !== 'phone'); // the phone is how they are found
    const cf = pick(r, changeable);
    plan.stored[cf.name] = variant(cf); plan.changedField = cf.name;
  }
  if (behaviors.includes('reject_fix')) { const f = pick(r, fields); plan.wrongFirst[f.name] = variant(f); }
  if (behaviors.includes('correct_earlier')) {
    // Says one value, later changes it ("actually, make it ..."): the later value is the truth.
    const i = Math.floor(r() * (names.length - 2));
    const f = flow.fields[i]; if (f.kind !== 'text') { const old = variant(f); plan.correctAfter = { field: f.name, newValue: truth[f.name], atField: names[i + 2] }; truth[`_first_${f.name}`] = old; }
  }
  if (behaviors.includes('go_back_two')) {
    const i = 2 + Math.floor(r() * (names.length - 2));
    const f = flow.fields[i - 2]; if (f.kind !== 'text' && !plan.correctAfter?.field.includes(f.name)) { plan.goBack = { field: f.name, newValue: truth[f.name], atField: names[i] }; truth[`_first_${f.name}`] = variant(f); }
  }
  if (behaviors.includes('doc_question')) plan.docAt = pick(r, names);
  if (behaviors.includes('offtopic')) plan.offAt = pick(r, names);
  if (behaviors.includes('small_talk')) plan.smallAt = pick(r, names.slice(0, 3));
  if (behaviors.includes('misheard_name')) { const nf = flow.fields.find(f => f.kind === 'name')!; const first = truth[nf.name].split(' ')[0], last = truth[nf.name].split(' ').slice(1).join(' '); plan.misheard = MISHEAR[first] ? truth[nf.name].replace(first, MISHEAR[first]) : MISHEAR[last] ? `${first} ${MISHEAR[last]}` : null; truth._misheard_field = nf.name; }
  return plan;
}

const STYLE_NOTES: Record<Behavior, string> = {
  rambling: 'You ramble a bit and add irrelevant details about your day before getting to the point.',
  two_at_once: 'When you answer, you often also give the next piece of information in the same breath.',
  vague: 'When asked about day or time, you first answer vaguely (e.g. "sometime next week, mornings are better") and only get specific when asked again.',
  dropped_call: '', returning: '', correct_earlier: '', asr_noise: '', misheard_name: '', doc_question: '', offtopic: '', small_talk: '', reject_fix: '', go_back_two: '',
  spell_name: 'When you give a name, you spell it out letter by letter as well.',
  impatient: 'You are in a hurry and a little impatient; short answers, you may say "come on" or "can we speed this up".',
};

async function customerSay(flow: Flow, truth: Truth, plan: Plan, desk: Desk, directive: string, r: R): Promise<string> {
  const facts = flow.fields.map(f => `${f.label}: ${truth[f.name]}`).join('; ');
  const style = plan.behaviors.map(b => STYLE_NOTES[b]).filter(Boolean).join(' ');
  const examples = Array.from({ length: 4 }, () => pick(r, STYLE)).map(s => `- ${s}`).join('\n');
  const convo = desk.log.slice(-8).map(m => `${m.who === 'user' ? 'YOU' : 'RECEPTIONIST'}: ${m.text}`).join('\n');
  const sys = `You are role-playing a CUSTOMER calling ${flow.business} on the phone. A receptionist fills in a form for you. Your true details: ${facts}.
Speak like a real person on the phone: casual, spoken English, usually one or two sentences, no lists, no stage directions, no quotes. ${style}
Real customer phrasing examples (for tone only):\n${examples}
Output ONLY what you say next.`;
  const user = `Conversation so far:\n${convo}\n\nWhat to do now: ${directive}`;
  for (let i = 0; i < 2; i++) {
    try {
      const res = await customerModel.chat([{ role: 'system', content: sys }, { role: 'user', content: user }], [], { maxTokens: 120, temperature: 0.8 });
      const t = res.content.replace(/^(YOU|CUSTOMER|Customer|You)\s*:\s*/, '').replace(/^["']|["']$/g, '').replace(/\*[^*]+\*/g, '').trim();
      if (t) return t;
    } catch { /* retry */ }
  }
  return 'sorry, can you say that again?';
}

// ---------- one conversation ----------
type Check = { name: string; ok: boolean; detail?: string };
async function conversation(id: number) {
  const r = rng(SEED * 1000003 + id * 7919);
  const flow = FLOWS[(id - 1) % FLOWS.length] === 'halvorsen' ? halvorsen : brookside;
  const passages: Passage[] = flow === brookside ? brooksideDocs : halvorsenFilter.passages;
  const truth = makeTruth(flow, r);
  const plan = makePlan(flow, truth, r);
  let submits = 0;
  const sessions = new MemoryStore(), customers = new MemoryStore();
  if (plan.stored) { const ph = flow.fields.find(f => f.kind === 'phone')!; await customers.set(customerKey('phone', truth[ph.name]), { v: 1, flow: flow.id, savedAt: 0, values: plan.stored }); }
  const newDesk = () => new Desk(flow, { model: agentModel, heavy: heavyModel, docs: docsFrom(passages, docJudge), hooks: { submit: () => { submits++; } }, sessions, customers });
  let desk = newDesk();
  const lines = [`AGENT: ${desk.start()}`];
  const turnsLog: typeof desk.turns = [];
  const fillTurns = new Set<number>();
  const allEvents: typeof desk.events = [];
  let fillsSeen = 0, resumed = false;
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });
  const tags: string[] = [];
  const done = { correction: false, goBack: false, doc: false, off: false, small: false, wrongGiven: new Set<string>(), vagueUsed: false, misheardUsed: false };
  let snapshot = JSON.stringify(desk.values);
  const sideTurns: { kind: 'doc' | 'off'; turn: number; expect?: RegExp }[] = [];
  let userTurns = 0;

  while (!desk.done && !desk.complete && userTurns < MAX_TURNS) {
    // A dropped call: a new desk picks the call up from the saved session.
    if (plan.dropAt === userTurns && !resumed) {
      resumed = true;
      const before = { values: JSON.stringify(desk.values), pending: desk.pending ? { ...desk.pending } : null };
      allEvents.push(...desk.events);
      const sid = desk.sessionId!;
      desk = newDesk(); fillsSeen = 0;
      const welcome = await desk.restore(sid);
      lines.push('--- call dropped; caller reconnects and the call is resumed from the saved session ---', `AGENT (resume): ${welcome}`);
      add('resume_restored', JSON.stringify(desk.values) === before.values && (!before.pending || (desk.pending?.value === before.pending.value && welcome.includes(desk.pending.text))) && /welcome back/i.test(welcome), welcome.slice(0, 160));
      continue;
    }
    const cur = desk.current;
    const f = desk.field(cur)!;
    let directive = '', tag = '', raw: string | null = null, noise = plan.behaviors.includes('asr_noise') && r() < 0.6;
    const agentLast = desk.log[desk.log.length - 1]?.text ?? '';
    if (desk.pending && /\?\s*$/.test(agentLast)) {
      const pf = desk.field(desk.pending.field)!;
      const right = valueOk(flow, pf, desk.pending.value, truth);
      if (right) { directive = 'The receptionist read back a detail and it is CORRECT. Confirm briefly (e.g. "yes", "yep that\'s right").'; tag = 'yes'; noise = false; }
      else {
        const t = truth[pf.name];
        const how = pf.kind === 'name' || pf.kind === 'email' ? ` Spell it letter by letter: ${spell(pf.kind === 'email' ? t.split('@')[0] : t)}${pf.kind === 'email' ? ` at ${t.split('@')[1]}` : ''}.` : pf.kind === 'serial' ? ` Read it slowly in groups: ${t.match(/.{4}/g)!.map(g => g.split('').join(' ')).join(', ')}.` : '';
        directive = `The receptionist read back "${desk.pending.value}" for ${pf.label}, but that is WRONG. Say no and give the correct ${pf.label}: ${t}.${how}`;
        tag = 'no+fix';
        if (pf.kind === 'name' || pf.kind === 'serial') noise = noise && r() < 0.3;
      }
    } else if (plan.stored && userTurns === 0) { directive = 'Say hello and mention that you have booked with them before (you are a returning customer). Give no other details this turn.'; tag = 'returning'; }
    else if (plan.smallAt === cur && !done.small) { done.small = true; directive = 'Make brief small talk first (e.g. ask how their day is going, or comment on the weather); do not give any form details this turn.'; tag = 'small_talk'; }
    else if (plan.docAt === cur && !done.doc) { done.doc = true; const q = pick(r, DOCQ[flow === brookside ? 'brookside' : 'halvorsen']); directive = `Before answering, ask this question in your own words: "${q[0]}" Do not give form details this turn.`; tag = 'doc_q'; sideTurns.push({ kind: 'doc', turn: userTurns + 1, expect: q[1] }); }
    else if (plan.offAt === cur && !done.off) { done.off = true; raw = pick(r, OFFTOPIC); tag = 'off_topic'; sideTurns.push({ kind: 'off', turn: userTurns + 1 }); }
    else if (plan.correctAfter && plan.correctAfter.atField === cur && !done.correction && desk.values[plan.correctAfter.field] !== undefined) {
      done.correction = true; const cf = desk.field(plan.correctAfter.field)!;
      directive = `You changed your mind about an earlier answer: the ${cf.label} should be ${plan.correctAfter.newValue}, not ${desk.values[cf.name]}. Tell the receptionist naturally (e.g. "oh wait, actually ..."). Do not answer the current question yet.`; tag = 'correct_earlier';
    } else if (plan.goBack && plan.goBack.atField === cur && !done.goBack && desk.values[plan.goBack.field] !== undefined) {
      done.goBack = true; const gf = desk.field(plan.goBack.field)!;
      directive = `Ask to go back to the ${gf.label} question because you want to change it. Do NOT say the new value yet.`; tag = 'go_back';
    } else {
      // Answer what the receptionist is asking (it may be asking to spell, to pin down a vague answer...).
      const firstVal = truth[`_first_${cur}`] && !done.wrongGiven.has(cur) ? truth[`_first_${cur}`] : plan.wrongFirst[cur] && !done.wrongGiven.has(cur) ? plan.wrongFirst[cur] : truth[cur];
      if (firstVal !== truth[cur]) done.wrongGiven.add(cur);
      const goBackPending = plan.goBack && done.goBack && cur === plan.goBack.field && desk.values[cur] !== truth[cur];
      let say = goBackPending ? truth[cur] : firstVal;
      let extra = '';
      if (plan.misheard && truth._misheard_field === cur && !done.misheardUsed && say === truth[cur]) { done.misheardUsed = true; raw = null; extra = ''; tag = 'misheard'; }
      if (plan.behaviors.includes('vague') && !done.vagueUsed && (f.name === 'preferred_day' || f.name === 'visit_time')) { done.vagueUsed = true; directive = `Answer vaguely without naming a specific day: something like "sometime next week, ${String(truth.preferred_time ?? truth.visit_time).toLowerCase()}s are better".`; tag = 'vague'; }
      else {
        if (plan.behaviors.includes('two_at_once')) { const i = flow.fields.indexOf(f); const nx = flow.fields[i + 1]; if (nx && desk.values[nx.name] === undefined) extra = ` In the same sentence also tell them your ${nx.label}: ${truth[nx.name]}.`; }
        const spellIt = plan.behaviors.includes('spell_name') && f.kind === 'name' ? ` Also spell it: ${spell(say)}.` : '';
        const serialHow = f.kind === 'serial' ? ` Read the serial out character by character (digits as words is fine).` : '';
        directive = `Answer the receptionist's last question. Your ${f.label}: ${say}.${spellIt}${serialHow}${extra} If they asked you to spell something or asked something else, answer that instead using your true details.`;
        tag = tag || 'answer';
      }
    }
    let said = raw ?? await customerSay(flow, truth, plan, desk, directive, r);
    if (tag === 'misheard' && plan.misheard) { const nf = desk.field(truth._misheard_field)!; said = said.includes(truth[nf.name]) ? said.replace(truth[nf.name], plan.misheard) : said.replace(truth[nf.name].split(' ')[0], plan.misheard.split(' ')[0]); }
    if (noise) { said = asr(said, r, truth); tag += '+asr'; }
    tags.push(tag);
    userTurns++;
    const reply = await desk.turn(said);
    turnsLog.push(desk.turns[desk.turns.length - 1]);
    lines.push(`USER [${tag}]: ${said}`, `AGENT (${turnsLog[turnsLog.length - 1].ms}ms${turnsLog[turnsLog.length - 1].fallback ? ', FALLBACK' : ''}${turnsLog[turnsLog.length - 1].model.includes('>') ? ', ESCALATED' : ''}): ${reply}`);
    // Every fill: the agent's message just before held the exact read-back, and this turn was a clear yes.
    for (const fl of desk.fills.slice(fillsSeen)) { add('readback_then_yes', agentLast.includes(fl.readback) && clearYes(said), `${fl.field}="${fl.value}" yes="${said}"`); fillTurns.add(userTurns); }
    fillsSeen = desk.fills.length;
    // Values may only change on a turn with a confirmed fill.
    const now = JSON.stringify(desk.values);
    if (now !== snapshot) {
      const fills = desk.fills.filter(x => x.turn === desk.turns.length);
      const changed = Object.keys(desk.values).filter(k => JSON.parse(snapshot)[k] !== desk.values[k]);
      add('values_change_only_by_fill', changed.every(k => fills.some(x => x.field === k && x.value === desk.values[k])), changed.join(','));
      snapshot = now;
    }
    if (!reply.trim() || /undefined|\[object|NaN/.test(reply)) add('reply_sane', false, reply);
  }

  // The end-of-call offer to remember details: answer it, and check a record exists only after a clear yes.
  const lastAgent = desk.log[desk.log.length - 1]?.text ?? '';
  if (desk.complete && /remember your|update the details/i.test(lastAgent)) {
    const wantYes = r() < 0.5;
    const said = await customerSay(flow, truth, plan, desk, wantYes ? 'They asked whether to remember your details for next time. Say yes, clearly.' : 'They asked whether to remember your details for next time. Say no thanks.', r);
    const reply = await desk.turn(said);
    turnsLog.push(desk.turns[desk.turns.length - 1]);
    lines.push(`USER [remember_${wantYes ? 'yes' : 'no'}]: ${said}`, `AGENT (${turnsLog[turnsLog.length - 1].ms}ms): ${reply}`);
    const ph = flow.fields.find(f => f.kind === 'phone');
    const rec = ph && desk.values[ph.name] ? await customers.get(customerKey('phone', desk.values[ph.name])) as { savedAt: number; values: Record<string, string> } | undefined : undefined;
    const storedNow = !!rec && rec.savedAt > 0;
    add('stored_only_on_clear_yes', storedNow === clearYes(said) && (!rec || !Object.keys(rec.values).some(k => { const f = desk.field(k); return !f || f.kind === 'text' || f.kind === 'serial' || f.kind === 'choice'; })), `said="${said}" stored=${storedNow}`);
  }
  allEvents.push(...desk.events);
  if (plan.stored) {
    add('returning_details_offered', allEvents.some(e => e.type === 'returning'), JSON.stringify(allEvents.filter(e => e.type === 'returning')));
    add('returning_change_applied', valueOk(flow, desk.field(plan.changedField!)!, desk.values[plan.changedField!], truth), `${plan.changedField}: stored "${plan.stored[plan.changedField!]}" now "${desk.values[plan.changedField!]}"`);
  }

  // ----- scoring -----
  const agentMsgs = lines.filter(l => l.startsWith('AGENT')).map(l => l.replace(/^AGENT[^:]*: /, ''));
  add('never_submitted', submits === 0 && desk.submitted === 0 && !agentMsgs.some(m => /\b(i'?ve submitted|i have submitted|has been submitted|is submitted|i submitted|submitted (it|the form|your))\b/i.test(m)));
  const complete = flow.fields.every(f => desk.values[f.name] !== undefined);
  add('completed', complete, `turns=${userTurns} filled=${Object.keys(desk.values).join(',')}`);
  const perField: Record<string, boolean> = {};
  for (const f of flow.fields) perField[f.name] = valueOk(flow, f, desk.values[f.name], truth);
  add('values_exact', complete && Object.values(perField).every(Boolean), flow.fields.filter(f => !perField[f.name]).map(f => `${f.name}: got "${desk.values[f.name]}" want "${truth[f.name]}"`).join('; '));
  if (plan.correctAfter && done.correction) add('correction_applied', valueOk(flow, desk.field(plan.correctAfter.field)!, desk.values[plan.correctAfter.field], truth), plan.correctAfter.field);
  if (plan.goBack && done.goBack) add('go_back_applied', valueOk(flow, desk.field(plan.goBack.field)!, desk.values[plan.goBack.field], truth), plan.goBack.field);
  if (plan.misheard && done.misheardUsed) add('misheard_name_fixed', valueOk(flow, desk.field(truth._misheard_field)!, desk.values[truth._misheard_field], truth), plan.misheard);
  for (const s of sideTurns) {
    const t = turnsLog[s.turn - 1];
    if (!t) continue;
    const keptForm = !fillTurns.has(s.turn);
    if (s.kind === 'doc') add('doc_question_answered', keptForm && !!s.expect && s.expect.test(t.reply), `${t.said} -> ${t.reply}`);
    else {
      // Handled: no fill that turn, and either "I don't know / only this form" or an answer whose numbers all come from
      // the business's own passages (a dataset question can turn out to be answerable).
      const docNums = new Set(passages.map(p => p.text).join(' ').match(/\d+/g) ?? []);
      const madeUp = (t.reply.replace(/\d( \d)+/g, '').match(/\d{2,}/g) ?? []).some(d => !docNums.has(d));
      add('offtopic_handled', keptForm && (DONTKNOW.test(t.reply) || /\?/.test(t.reply)) && !madeUp, `${t.said} -> ${t.reply}`);
    }
  }
  const lens = turnsLog.map(t => t.reply.length);
  const transcript = lines;
  return { id, flow: flow.id, behaviors: plan.behaviors, truth, values: desk.values, checks, userTurns, lens, ms: turnsLog.filter(t => t.model !== 'code').map(t => t.ms), models: turnsLog.map(t => t.model), fallbacks: turnsLog.filter(t => t.fallback).length, nets: allEvents.filter(e => e.by === 'net').length, events: allEvents, transcript, judge: null as null | { receptionist: number; handled: number; note: string } };
}

async function judge(transcript: string[]): Promise<{ receptionist: number; handled: number; note: string } | null> {
  const prompt = `Rate this phone call between a customer and an AI receptionist who fills a web form by voice. Lines tagged in [brackets] are test labels; ignore them. Timings in parentheses are not heard by the customer.
The customer is on the business's website and talks to the AI by voice while the AI fills the form on their screen. Required product rules (do not mark these down): the AI reads back every value before filling it (names spelled, numbers grouped) and waits for a yes; it never submits, so at the end it asks the customer to check the form and press Submit themselves. Judge tone and handling within those rules.
Score 1-5 each:
- receptionist: does the AI sound like a real, warm, professional front-desk receptionist (natural, brief, not robotic or repetitive)?
- handled: did it handle the customer well (understood them, fixed mistakes, kept things moving, answered or deflected side questions properly)?
Reply with JSON only: {"receptionist": n, "handled": n, "note": "one short sentence"}

${transcript.join('\n')}`;
  for (const m of [judgeModel, judgeBackup]) {
    if (!m) continue;
    try {
      const r = await m.chat([{ role: 'user', content: prompt }], [], { maxTokens: 1200, temperature: 0 });
      const j = JSON.parse(r.content.match(/\{[\s\S]*\}/)?.[0] ?? '');
      if (j.receptionist && j.handled) return { receptionist: +j.receptionist, handled: +j.handled, note: String(j.note ?? '').slice(0, 200) + (m === judgeBackup ? ' [judge: qwen-27b]' : '') };
    } catch { /* next */ }
  }
  return null;
}

async function pool<T>(n: number, conc: number, fn: (i: number) => Promise<T>): Promise<T[]> {
  const out: T[] = new Array(n); let next = 0;
  await Promise.all(Array.from({ length: conc }, async () => { while (next < n) { const i = next++; try { out[i] = await fn(i + 1); } catch (e) { console.error('conversation', i + 1, 'crashed', e); } } }));
  return out;
}

const t0 = Date.now();
// --rejudge tests/desk-x.json: score saved transcripts again with the current judge prompt (writes desk-x-rejudged.json).
const REJUDGE = arg('--rejudge', '');
if (REJUDGE) {
  const j = JSON.parse(fs.readFileSync(REJUDGE, 'utf8'));
  await pool(j.conversations.length, CONC, async i => { const c = j.conversations[i - 1]; c.judge = await judge(c.transcript); return c; });
  const js = j.conversations.filter((c: { judge: unknown }) => c.judge);
  const a = (k: string) => +(js.reduce((x: number, c: { judge: Record<string, number> }) => x + c.judge[k], 0) / js.length).toFixed(2);
  j.summary.judge = { receptionist: a('receptionist'), handled: a('handled'), n: js.length };
  j.summary.tag += '-rejudged';
  fs.writeFileSync(REJUDGE.replace(/\.json$/, '-rejudged.json'), JSON.stringify(j, null, 1));
  console.log(JSON.stringify(j.summary.judge));
  process.exit(0);
}
const convs = (await pool(N, CONC, async i => { const c = await conversation(i); if (JUDGE !== 'none') c.judge = await judge(c.transcript); process.stderr.write(`#${i} ${c.flow} ${c.checks.filter(x => !x.ok).map(x => x.name).join(',') || 'ok'}\n`); return c; })).filter(Boolean);
const q = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const allMs = convs.flatMap(c => c.ms), allLens = convs.flatMap(c => c.lens);
const byCheck: Record<string, { ok: number; n: number }> = {};
for (const c of convs) for (const ch of c.checks) { byCheck[ch.name] ??= { ok: 0, n: 0 }; byCheck[ch.name].n++; if (ch.ok) byCheck[ch.name].ok++; }
const judged = convs.filter(c => c.judge);
const avg = (a: number[]) => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(2) : 0;
const fieldAcc: Record<string, { ok: number; n: number }> = {};
for (const c of convs) { const flow = c.flow === halvorsen.id ? halvorsen : brookside; for (const f of flow.fields) { fieldAcc[f.name] ??= { ok: 0, n: 0 }; fieldAcc[f.name].n++; if (valueOk(flow, f, c.values[f.name], c.truth)) fieldAcc[f.name].ok++; } }
const summary = {
  tag: TAG, seed: SEED, conversations: convs.length, agent: AGENT, heavy: HEAVY, customer: CUSTOMER, judge_model: JUDGE, seconds: Math.round((Date.now() - t0) / 1000),
  checks: byCheck, field_accuracy: fieldAcc,
  latency_ms: { p50: q(allMs, 0.5), p95: q(allMs, 0.95), mean: Math.round(avg(allMs)) },
  reply_chars: { mean: Math.round(avg(allLens)), p95: q(allLens, 0.95), max: Math.max(0, ...allLens) },
  user_turns: { mean: avg(convs.map(c => c.userTurns)), max: Math.max(0, ...convs.map(c => c.userTurns)) },
  judge: { n: judged.length, receptionist: avg(judged.map(c => c.judge!.receptionist)), handled: avg(judged.map(c => c.judge!.handled)) },
  fallback_turns: convs.reduce((a, c) => a + c.fallbacks, 0), net_actions: convs.reduce((a, c) => a + c.nets, 0),
  escalated_turns: convs.reduce((a, c) => a + c.models.filter(m => m.includes('>')).length, 0), total_turns: allMs.length,
  heavy_turns: HEAVY !== 'none' ? convs.reduce((a, c) => a + c.models.filter(m => /qwen|glm|nemotron/i.test(m)).length, 0) : undefined,
};
console.log(JSON.stringify(summary, null, 1));
fs.writeFileSync(new URL(`./desk-${TAG}.json`, import.meta.url), JSON.stringify({ summary, conversations: convs }, null, 1));
