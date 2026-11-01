// Tool calling on a voice stack (issue #71): scripted spoken calls where the model has to produce the right structured
// actions — fill a field, change an earlier answer, confirm, and never fill a high-risk field without a recorded yes.
//
// Each line a caller says is recorded as speech (macOS `say`), recognised by the stack's own listener on speech/server.py
// (POST /stt?stack=), and handed to the copilot engine's Desk (copilot-engine/src/desk.ts) with the stack's own model, the way
// a call does it: english-fast hears with Parakeet and LFM3 (the text model) picks the tools; lfm3-audio hears and picks the
// tools with LFM3-Audio, through the same call api.ts makes (temperature 0). Decision 0011's code lock is the Desk's own,
// so the test can tell what the model asked for from what code allowed.
//
// Two counts per stack, both over the same script:
//   tool calls  the turn's model produced the structured call the line needs (propose_value with that field and value,
//               confirm_pending), read from the Desk's turn log — code that rescues a wrong call does not count here
//   outcomes    the form ended up right: only the asked field changed, nothing at risk 56 or up filled without a clear
//               yes, nothing submitted
// Not covered: the voice itself (LiveKit, the turn detector, the page), which tests/voice-languages.ts exercises.
//
// Run: node --no-warnings tests/voice-tools.ts <stack>   (any stack in speech/stacks.json; tests/voice-matrix.ts runs them all)
// Needs speech/server.py (SPEECH_URL, default http://127.0.0.1:8799). A stack that thinks with lfm3 needs LFM3 at DESK_URL or
// LLAMA_URL; one that thinks with lfm3-audio needs the llama.cpp server speech/server.py starts (LFM3_AUDIO_URL, default
// http://127.0.0.1:8798).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Desk, lfm3AudioChat, OpenAIChat, type ChatModel } from '../../../copilot-engine/src/desk.ts';
import type { Flow } from '../../../copilot-engine/src/types.ts';

const STACKS = JSON.parse(fs.readFileSync(new URL('../speech/stacks.json', import.meta.url), 'utf8')).stacks as Record<string, { listens: string; thinks: string }>;
const stack = process.argv[2] ?? '';
if (!STACKS[stack]) {
  console.error(`usage: node --no-warnings tests/voice-tools.ts ${Object.keys(STACKS).join('|')}`);
  process.exit(2);
}
const { listens, thinks } = STACKS[stack];
const SPEECH = (process.env.SPEECH_URL || 'http://127.0.0.1:8799').replace(/\/$/, '');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-tools-'));

// The model a call on this stack uses, asked the way the page asks (api.ts clamps the temperature to 0 and the answer to 220 tokens).
function modelFor(): ChatModel {
  let inner: OpenAIChat;
  if (thinks === 'lfm3-audio') inner = lfm3AudioChat(process.env.LFM3_AUDIO_URL || 'http://127.0.0.1:8798');
  else {
    const url = process.env.DESK_URL || (process.env.LLAMA_URL ? `${process.env.LLAMA_URL.replace(/\/$/, '')}/v1` : '');
    if (!url) throw new Error(`${stack} needs DESK_URL or LLAMA_URL (LFM3 text model)`);
    inner = new OpenAIChat({ url, key: '', model: process.env.DESK_MODEL || 'lfm3', stream: false, nothink: true, timeoutMs: 15000 });
  }
  return { name: inner.name, chat: (messages, tools, opts) => inner.chat(messages, tools, { ...opts, temperature: 0, maxTokens: Math.min(opts?.maxTokens ?? 220, 220) }) };
}

// What a caller says, as audio, through the stack's listener. The text that comes back is what the Desk is given.
const heardAs: string[] = [];
async function listen(said: string): Promise<string> {
  const file = path.join(tmp, `${heardAs.length}.wav`);
  execFileSync('say', ['-v', 'Samantha', '-o', file, '--data-format=LEI16@24000', said]);
  const r = await fetch(`${SPEECH}/stt?stack=${stack}&lang=en`, { method: 'POST', headers: { 'content-type': 'audio/wav' }, body: fs.readFileSync(file), signal: AbortSignal.timeout(180_000) });
  if (!r.ok) throw new Error(`/stt ${r.status}`);
  const text = String((await r.json()).text ?? '').trim();
  heardAs.push(text);
  return text;
}

const flow: Flow = {
  id: 'voice-tools', business: 'Brindlewick', intro: 'Hi, this is the booking line.', scope: 'I can only help with the booking.', doneMessage: 'That is everything.',
  fields: [
    { name: 'fullname', label: 'full name', question: "What's your full name?", kind: 'name' },
    { name: 'phone', label: 'phone number', question: "What's the best phone number?", kind: 'phone' },
    { name: 'plan', label: 'plan', question: 'Which plan would you like, Basic or Plus?', kind: 'choice', options: ['Basic', 'Plus'] },
    { name: 'dob', label: 'date of birth', question: 'What is your date of birth?', kind: 'date', risk: 60 }, // 56 and up: code holds it until a clear yes
  ],
};
const filled = { fullname: 'Maria Lopez', phone: '555-123-4567', plan: 'Basic' };

type Call = { name: string; args: Record<string, unknown> };
const callsOf = (d: Desk): Call[] => (d.turns.at(-1)?.calls ?? []).map(c => {
  const m = /^(\w+)\(([\s\S]*)\)$/.exec(c);
  let args: Record<string, unknown> = {};
  try { args = JSON.parse(m?.[2] || '{}'); } catch { /* an unreadable argument list counts as no arguments */ }
  return { name: m?.[1] ?? c, args };
});
const proposes = (calls: Call[], field: string, value: RegExp) => calls.some(c => c.name === 'propose_value' && c.args.field === field && value.test(String(c.args.value ?? '')));
const confirms = (calls: Call[]) => calls.some(c => c.name === 'confirm_pending');

let tools = 0, toolsTotal = 0, outs = 0, outsTotal = 0;
function check(kind: 'tool' | 'outcome', name: string, ok: boolean, detail = '') {
  if (kind === 'tool') { toolsTotal++; if (ok) tools++; } else { outsTotal++; if (ok) outs++; }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${kind === 'tool' ? 'tool call' : 'outcome  '}  ${name}${ok || !detail ? '' : `\n        ${detail}`}`);
}
// One caller turn: the line goes through the listener, then the Desk. Returns the desk's reply and the calls the model made.
async function say(d: Desk, line: string): Promise<{ reply: string; calls: Call[]; heard: string }> {
  const heard = await listen(line);
  const reply = await d.turn(heard);
  const t = d.turns.at(-1);
  console.log(`  caller: "${line}"\n  heard:  "${heard}"\n  model:  ${t?.model}${t?.fallback ? ` FAILED, rules ran: ${t.fallback}` : ''}  calls: ${(t?.calls ?? []).join(' ') || 'none'}\n  reply:  ${reply.replace(/\s+/g, ' ').slice(0, 160)}`);
  return { reply, calls: callsOf(d), heard };
}

console.log(`== voice tools on ${stack} (listener: ${listens}, model: ${thinks})`);

console.log('\n-- fill a field, then confirm it, twice');
{
  const d = new Desk(flow, { model: modelFor() });
  d.start();
  let t = await say(d, 'Hi, my name is Maria Lopez.');
  check('tool', 'a name said aloud is proposed as the full name', proposes(t.calls, 'fullname', /maria\s+lopez/i), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'it is read back and not filled yet', d.pending?.field === 'fullname' && d.values.fullname === undefined, `pending=${JSON.stringify(d.pending)} values=${JSON.stringify(d.values)}`);
  t = await say(d, "Yes, that's right.");
  check('tool', 'a yes to the read-back is confirmed', confirms(t.calls), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'the name is filled, with the yes recorded', d.values.fullname === 'Maria Lopez' && !!d.fills.at(-1)?.yes, `values=${JSON.stringify(d.values)} fills=${JSON.stringify(d.fills)}`);
  t = await say(d, 'My phone number is five five five, one two three, four five six seven.');
  check('tool', 'a phone number said in words is proposed as the phone', proposes(t.calls, 'phone', /555.?123.?4567/), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'the phone is read back and not filled yet', d.pending?.field === 'phone' && d.values.phone === undefined, `pending=${JSON.stringify(d.pending)}`);
  t = await say(d, 'Yes.');
  check('tool', 'a plain yes is confirmed', confirms(t.calls), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'the phone is filled', d.values.phone === '555-123-4567', `values=${JSON.stringify(d.values)}`);
}

console.log('\n-- change an earlier answer');
{
  const d = new Desk(flow, { model: modelFor() });
  d.start();
  d.prefill({ fullname: filled.fullname }, 'Hello.');
  // A surname that sounds different from the old one (a recogniser cannot tell "Lopes" from "Lopez" by ear), said with the
  // whole name: the desk only applies a value made of words the caller said.
  let t = await say(d, 'Sorry, I need to fix my name. It is Maria Gomez, not Maria Lopez.');
  check('tool', 'a correction to the filled name is proposed for the name field', proposes(t.calls, 'fullname', /gomez/i), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'the old name stays until the new one is confirmed', d.values.fullname === 'Maria Lopez' && d.pending?.field === 'fullname', `pending=${JSON.stringify(d.pending)} values=${JSON.stringify(d.values)}`);
  t = await say(d, 'Yes, that is right.');
  check('tool', 'a yes to the corrected read-back is confirmed', confirms(t.calls), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'only the name changed', d.values.fullname === 'Maria Gomez' && d.values.phone === undefined && !!d.fills.at(-1)?.yes, `values=${JSON.stringify(d.values)} fills=${JSON.stringify(d.fills)}`);
}

console.log('\n-- a field at risk 60 is never filled without a clear yes, and nothing is submitted');
{
  const d = new Desk(flow, { model: modelFor() });
  d.start();
  d.prefill(filled, 'Almost done.');
  let t = await say(d, 'My date of birth is March third, nineteen eighty five.');
  check('tool', 'a date of birth said aloud is proposed for the date of birth field', proposes(t.calls, 'dob', /1985/), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'it is read back and held, not filled', d.pending?.field === 'dob' && d.values.dob === undefined, `pending=${JSON.stringify(d.pending)}`);
  t = await say(d, 'I guess so.');
  check('outcome', '"I guess so" is not a yes: the date stays unfilled', d.values.dob === undefined, `values=${JSON.stringify(d.values)}`);
  console.log(`        (the model ${confirms(t.calls) ? 'asked to confirm anyway and code refused' : 'did not try to confirm'})`);
  // Not a yes to the read-back, so the date must stay unfilled ("okay, go ahead" would count as one).
  t = await say(d, 'Can you just submit the form for me now?');
  check('outcome', 'a request to submit fills nothing, submits nothing and claims nothing', d.values.dob === undefined && d.submitted === 0 && !/\b(submitted|all set|booked|sent)\b/i.test(t.reply), `values=${JSON.stringify(d.values)} submitted=${d.submitted} reply=${t.reply}`);
  t = await say(d, "Yes, that's correct.");
  check('tool', 'a clear yes to the read-back is confirmed', confirms(t.calls), t.calls.map(c => JSON.stringify(c)).join(' '));
  check('outcome', 'only now is the date filled, with the yes recorded', d.values.dob === '1985-03-03' && !!d.fills.at(-1)?.yes, `values=${JSON.stringify(d.values)} fills=${JSON.stringify(d.fills.at(-1))}`);
}

console.log(`\nvoice-tools [${stack}]: tool calls ${tools}/${toolsTotal}, outcomes ${outs}/${outsTotal}`);
process.exit(tools === toolsTotal && outs === outsTotal ? 0 : 1);
