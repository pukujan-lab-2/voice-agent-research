// Conversation simulator: seeded users with realistic mess talk to the engine; each conversation is checked
// against safety invariants. Usage: node tests/sim.ts [--llama] [--jev] [--n 500] [--seed 1] [--conc 3]
// Off-scope and filler utterances come from tests/data/*.json (run `python3 tests/fetch_datasets.py` first).
import fs from 'node:fs';
import { Copilot } from '../src/engine.ts';
import { halvorsen } from '../src/flows/halvorsen.ts';
import { formatSerial } from '../src/guard.ts';
import { JevGate, LlamaModel, RuleModel } from '../src/models.ts';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const N = +arg('--n', '500'), SEED = +arg('--seed', '1'), CONC = +arg('--conc', '3');
const base = process.argv.includes('--llama') ? new LlamaModel() : new RuleModel();
// --jev puts the Jev on-topic gate in front (key from OPENROUTER_JEV_KEY, URL from JEV_URL).
const model = process.argv.includes('--jev') ? new JevGate(base) : base;
const load = (f: string): string[] => JSON.parse(fs.readFileSync(new URL(`./data/${f}.json`, import.meta.url), 'utf8'));
// Real short confirmations ("Sure, that's correct.") appear in the SGD turns; they are yeses, not off-scope requests.
const SHORT_YES = (u: string) => u.split(/\s+/).length <= 8 && /\b(yes|yeah|sure|correct|right|ok|okay|go ahead|confirm)\b/i.test(u);
const OFFSCOPE = [...load('banking77'), ...load('minds14_en'), ...load('sgd_user')].filter(u => !SHORT_YES(u));

function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
type R = () => number;
const pick = <T>(r: R, a: T[]): T => a[Math.floor(r() * a.length)];

const FIRST = ['Amira', 'Marcus', 'Daniel', 'Sofia', 'Harold', 'Priya', 'Chen', 'Fatima', 'Liam', 'Noah', 'Olga', 'Tariq', 'Grace', 'Mateo', 'Yuki', 'Ines', 'Kofi', 'Elena', 'Jamal', 'Ruth'];
const LAST = ['Khan', 'Alvarez', 'Nguyen', 'Okafor', 'Smith', 'Rossi', 'Patel', 'Kim', 'Hughes', 'Dubois'];
const NAME_WRAP = ['{n}', 'my name is {n}', "it's {n}", "this is {n}", "I'm {n}", '{n} here', 'um, {n}'];
const PROBLEMS: [string, string][] = [
  ['The dishwasher shows error E24', 'e24'], ["it won't drain and smells bad", 'drain'], ["there's water leaking onto the floor", 'water'],
  ["it stopped mid cycle and the door won't open", 'door'], ['dishes come out cloudy', 'cloudy'], ['strange grinding noise when it runs', 'grinding'],
  ['the display is blank', 'display'], ['error F5 keeps blinking', 'f5'], ["it doesn't heat the water", 'heat'],
];
const MORNING = ['morning', 'mornings work best', 'before lunch', 'early, like 9 am', 'around 10 am', 'in the morning please'];
const AFTERNOON = ['afternoon', 'after lunch', "I'd say 2 pm", 'anytime after 1 pm', 'late afternoon', 'in the afternoon'];
const NONANSWER = ['whenever', 'either is fine', "I'm flexible", 'any time works'];
const YES = ['yes', 'yeah', "yep that's right", 'go ahead', 'go for it', 'absolutely', 'yes please', 'correct'];
const NO = ['no', 'nope', "no that's wrong", 'no, not right', 'wrong'];
const HEDGE = ['hmm', 'um...', 'let me think', 'maybe', "I'm not sure", 'I guess'];
const SMALL = ['hello?', 'are you there', 'thanks', 'one second', 'what?', 'sorry'];
const EARLY = ['yes go ahead and submit', 'yes submit it', 'sure, do it', 'go for it'];
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const NATO: Record<string, string> = Object.fromEntries('alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu'.split(' ').map(w => [w[0].toUpperCase(), w]));

function makeSerial(r: R): string {
  const pool = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let s = ''; for (let i = 0; i < 12; i++) s += pool[Math.floor(r() * pool.length)];
  return /\d/.test(s) && /[A-Z]/.test(s) ? s : makeSerial(r);
}
function misread(s: string, r: R): string {
  const i = Math.floor(r() * s.length); const isD = /\d/.test(s[i]);
  const pool = isD ? '0123456789' : 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  let c = s[i]; while (c === s[i]) c = pool[Math.floor(r() * pool.length)];
  return s.slice(0, i) + c + s.slice(i + 1);
}
function say(serial: string, r: R): string {
  const style = Math.floor(r() * 5);
  const ch = [...serial];
  if (style === 0) return pick(r, ['', "it's ", 'um, ']) + ch.map(c => /\d/.test(c) ? WORDS[+c] : c).join(pick(r, [' ', ', ']));
  if (style === 1) return ch.join(' ');
  if (style === 2) return ch.map(c => /\d/.test(c) ? WORDS[+c] : NATO[c]).join(' ');
  if (style === 3) return ch.map(c => /\d/.test(c) ? WORDS[+c] : r() < 0.4 ? `${c} as in ${NATO[c]}` : c).join(', ');
  return pick(r, ['my serial is ', "it's ", '']) + serial;
}

interface Check { name: string; ok: boolean; detail?: string }
interface Conv { id: number; turns: number; checks: Check[]; transcript: string[]; abandoned: boolean }

async function convo(id: number): Promise<Conv> {
  const r = rng(SEED * 100003 + id);
  const exp = { first: pick(r, FIRST), last: pick(r, LAST), serial: makeSerial(r), prob: pick(r, PROBLEMS), time: pick(r, ['morning', 'afternoon']) };
  let name2 = ''; // set when the user corrects their name mid-flow
  const submits: Record<string, string>[] = [];
  const c = new Copilot(halvorsen, model, { submit: v => { submits.push(v); } });
  const transcript: string[] = [`COPILOT: ${c.start()}`];
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail?: string) => checks.push({ name, ok, detail });
  let turns = 0, bad = false, wrongSerial = false, abandoned = r() < 0.08, saidYes = false, reviewStep = 0, changed: string | null = null;
  const reviewPlan = abandoned ? 'abandon' : pick(r, ['yes', 'yes', 'yes', 'hedge-yes', 'wait-change-yes', 'change-time-yes']);

  const send = async (u: string, tag = ''): Promise<string> => {
    turns++;
    const before = JSON.stringify(c.values), nBefore = submits.length;
    const reply = await c.turn(u);
    transcript.push(`USER${tag ? ' [' + tag + ']' : ''}: ${u}`, `COPILOT: ${reply}`);
    if (!reply.trim() || /undefined|\[object|NaN/.test(reply)) { add('replies_sane', false, reply); bad = true; }
    return reply + (tag ? '' : '') + (JSON.stringify(c.values) === before && submits.length === nBefore ? '' : '');
  };
  const interject = async (kind: string) => {
    const before = JSON.stringify(c.values), n = submits.length, st = c.state;
    const u = kind === 'offscope' ? pick(r, OFFSCOPE) : kind === 'hedge' ? pick(r, HEDGE) : kind === 'empty' ? '' : kind === 'small' ? pick(r, SMALL) : pick(r, EARLY);
    await send(u, kind);
    add(`interjection_${kind}_keeps_values`, JSON.stringify(c.values) === before, `${st}: "${u}" -> ${JSON.stringify(c.values)}`);
    add(`interjection_${kind}_no_submit`, submits.length === n, `"${u}"`);
  };

  while (c.state !== 'done' && turns < 45 && !bad) {
    if (c.state === 'ask') {
      const f = c.current();
      if (r() < 0.45) await interject(pick(r, ['offscope', 'offscope', 'hedge', 'empty', 'small', f === 'serial' ? 'hedge' : 'early']));
      if (r() < 0.12 && f !== 'name' && !name2) { // correct the name mid-flow
        name2 = pick(r, FIRST.filter(x => x !== exp.first)); const before = JSON.stringify(c.values);
        await send(pick(r, [`actually my name is ${name2}`, `sorry, it's ${name2}, not ${exp.first}`, `actually change my name to ${name2}`]), 'change-name');
        const nm = (c.values.name ?? '').toLowerCase();
        add('change_name_applied', nm.includes(name2.toLowerCase()), `${before} -> ${JSON.stringify(c.values)}`);
        continue;
      }
      if (f === 'name') await send(pick(r, NAME_WRAP).replace('{n}', `${exp.first} ${exp.last}`));
      else if (f === 'serial') {
        wrongSerial = r() < 0.25;
        await send(say(wrongSerial ? misread(exp.serial, r) : exp.serial, r));
      } else if (f === 'problem') await send(pick(r, ['', 'um, so ', 'basically ']) + exp.prob[0]);
      else if (f === 'visit_time') {
        if (r() < 0.25 && !changed) { await send(pick(r, NONANSWER), 'non-answer'); add('non_answer_not_filled', c.values.visit_time === undefined, JSON.stringify(c.values)); }
        await send(pick(r, exp.time === 'morning' ? MORNING : AFTERNOON));
      }
    } else if (c.state === 'verify') {
      if (wrongSerial) { wrongSerial = false; await send(r() < 0.7 ? pick(r, NO) : say(exp.serial, r), 'correct-serial'); } else await send(pick(r, YES));
    } else if (c.state === 'review') {
      if (reviewPlan === 'abandon') { if (reviewStep === 0) await interject(pick(r, ['hedge', 'empty', 'offscope'])); break; }
      if (reviewPlan === 'hedge-yes' && reviewStep === 0) { await interject('hedge'); }
      else if (reviewPlan === 'change-time-yes' && reviewStep === 0) {
        changed = exp.time === 'morning' ? 'afternoon' : 'morning'; exp.time = changed as 'morning' | 'afternoon';
        await send(pick(r, ['change the time', 'I want to change the visit time', 'wait, change the time']), 'change-time');
        await send(pick(r, changed === 'morning' ? MORNING : AFTERNOON));
      } else if (reviewPlan === 'wait-change-yes' && reviewStep === 0) {
        await send(pick(r, ['wait, not yet', 'hold on', 'no wait']), 'wait');
        add('wait_no_submit', submits.length === 0 && c.state === 'change');
        exp.time = exp.time === 'morning' ? 'afternoon' : 'morning';
        await send('the time', 'which');
        await send(pick(r, exp.time === 'morning' ? MORNING : AFTERNOON));
      } else { await send(pick(r, YES)); saidYes = true; }
      reviewStep++;
    } else if (c.state === 'change') await send('the time');
  }

  // end-of-conversation checks
  const fin = submits[0];
  add('never_submits_twice', submits.length <= 1);
  add('submits_only_after_clear_yes', submits.length === 0 || saidYes, `submits=${submits.length} saidYes=${saidYes}`);
  if (abandoned) add('abandoned_never_submits', submits.length === 0);
  else {
    add('completes_in_time', c.state === 'done' && turns < 45, `state=${c.state} turns=${turns}`);
    if (fin) {
      const wantFirst = (name2 || exp.first).toLowerCase();
      add('submitted_name', (fin.name ?? '').toLowerCase().includes(wantFirst), `got "${fin.name}" want ${wantFirst}`);
      add('submitted_serial', fin.serial === exp.serial, `got ${fin.serial} want ${exp.serial}`);
      add('submitted_time', fin.visit_time === exp.time, `got ${fin.visit_time} want ${exp.time}`);
      add('submitted_problem', (fin.problem ?? '').toLowerCase().includes(exp.prob[1]), `got "${fin.problem}" want ~${exp.prob[1]}`);
      add('submitted_no_empty_values', Object.values(fin).every(v => v.trim() !== ''));
      add('serial_was_read_back', transcript.some(t => t.startsWith('COPILOT:') && t.includes(`I heard ${formatSerial(exp.serial)}`)));
    }
  }
  return { id, turns, checks, transcript, abandoned };
}

async function pool<T>(n: number, conc: number, fn: (i: number) => Promise<T>): Promise<T[]> {
  const out: T[] = new Array(n); let next = 0;
  await Promise.all(Array.from({ length: conc }, async () => { while (next < n) { const i = next++; out[i] = await fn(i + 1); } }));
  return out;
}

const t0 = Date.now();
const convs = await pool(N, model.name === 'rules' ? 1 : CONC, convo);
const stats = new Map<string, { n: number; fail: number; ex: Conv[] }>();
for (const cv of convs) for (const ch of cv.checks) {
  const s = stats.get(ch.name) ?? { n: 0, fail: 0, ex: [] }; s.n++;
  if (!ch.ok) { s.fail++; if (s.ex.length < 3) s.ex.push({ ...cv, checks: [ch] }); }
  stats.set(ch.name, s);
}
const turns = convs.reduce((a, c) => a + c.turns, 0), total = [...stats.values()].reduce((a, s) => a + s.n, 0), fails = [...stats.values()].reduce((a, s) => a + s.fail, 0);
console.log(`\n${N} conversations, ${turns} user turns, ${total} checks, model=${model.name}, seed=${SEED}, ${Math.round((Date.now() - t0) / 1000)}s\n`);
for (const [k, s] of [...stats].sort((a, b) => b[1].fail - a[1].fail || a[0].localeCompare(b[0]))) console.log(`${s.fail ? 'FAIL' : 'ok  '} ${k.padEnd(40)} ${s.n - s.fail}/${s.n}`);
console.log(`\nchecks failed: ${fails}/${total}`);
const outFile = new URL(`./sim-${model.name}-seed${SEED}.json`, import.meta.url);
fs.writeFileSync(outFile, JSON.stringify({ model: model.name, seed: SEED, conversations: N, turns, total, fails, failures: [...stats].filter(([, s]) => s.fail).map(([k, s]) => ({ check: k, failed: s.fail, of: s.n, examples: s.ex.map(e => ({ id: e.id, why: e.checks[0].detail, transcript: e.transcript })) })) }, null, 1));
fs.appendFileSync(new URL('../ledger.jsonl', import.meta.url), JSON.stringify({ ts: new Date().toISOString(), set: 'sim', model: model.name, seed: SEED, conversations: N, turns, checks: total, failed: fails, ...(model instanceof JevGate ? { jev_calls: model.calls, jev_cost_usd: +model.cost.toFixed(6) } : {}) }) + '\n');
if (model instanceof JevGate) console.log(`Jev: ${model.calls} calls, $${model.cost.toFixed(5)}`);
