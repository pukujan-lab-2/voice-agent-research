import { yesNo } from '../src/guard.ts';
// Utterances written once and NOT tuned against. Run with: node tests/holdout.ts [--llama]
// Failures here are findings to turn into rules or prompt examples (then add new unseen cases).
import fs from 'node:fs';
import { Copilot } from '../src/engine.ts';
import { halvorsen } from '../src/flows/halvorsen.ts';
import { LlamaModel, RuleModel } from '../src/models.ts';

const model = process.argv.includes('--llama') ? new LlamaModel() : new RuleModel();
const S = 'one three three four, five nine two, C, L as in Lima, S, D, three';
type Case = { name: string; setup: string[]; say: string; ok: (c: Copilot, reply: string, submits: number) => boolean };
const cases: Case[] = [
  { name: 'serial as digits and spaces', setup: ['Marcus', 'yes'], say: '1 3 3 4 5 9 2 C L S D 3', ok: (_c, r) => r.includes('1334-592C-LSD3') },
  { name: 'serial typed in one go', setup: ['Marcus', 'yes'], say: 'my serial is 1334592CLSD3', ok: (_c, r) => r.includes('1334-592C-LSD3') },
  { name: 'serial with phonetic words', setup: ['Marcus', 'yes'], say: 'one three three four five nine two charlie lima sierra delta three', ok: (_c, r) => r.includes('1334-592C-LSD3') },
  { name: 'serial too short asks again', setup: ['Marcus', 'yes'], say: 'one three three four', ok: (c, r) => /didn't catch|that's 4 characters; the serial has 12/i.test(r) && c.state === 'ask' },
  { name: 'time: mornings work best', setup: ['Marcus', 'yes', S, 'yes', 'drain problem'], say: 'mornings work best for me', ok: c => c.values.visit_time === 'morning' },
  { name: "time: I'd rather come after lunch", setup: ['Marcus', 'yes', S, 'yes', 'drain problem'], say: "I'd rather come after lunch", ok: c => c.values.visit_time === 'afternoon' },
  { name: 'time: either is not an answer', setup: ['Marcus', 'yes', S, 'yes', 'drain problem'], say: 'either one is fine', ok: c => c.values.visit_time === undefined && c.state === 'ask' },
  { name: 'problem: free description', setup: ['Marcus', 'yes', S, 'yes'], say: "it won't drain and there's a bad smell", ok: c => /drain/.test(c.values.problem ?? '') },
  { name: 'off-scope: return policy', setup: ['Marcus', 'yes', S, 'yes'], say: "what's your return policy on blenders?", ok: c => c.values.problem === undefined },
  { name: 'off-scope: joke', setup: ['Marcus', 'yes', S, 'yes'], say: 'tell me a joke', ok: c => c.values.problem === undefined },
  { name: 'correct the name mid-flow', setup: ['Marcus', 'yes', S, 'yes'], say: 'sorry, my name is actually Amira', ok: c => c.values.name === 'Amira' || c.values.name === 'Marcus' && c.values.problem === undefined },
  { name: 'review: "yep that is right" submits', setup: ['Marcus', 'yes', S, 'yes', 'drain problem', 'morning'], say: "yep that's right", ok: (_c, _r, n) => n === 1 },
  { name: 'review: "go for it" submits', setup: ['Marcus', 'yes', S, 'yes', 'drain problem', 'morning'], say: 'go for it', ok: (_c, _r, n) => n === 1 },
  { name: 'review: "sounds good" never submits by accident (either result is safe)', setup: ['Marcus', 'yes', S, 'yes', 'drain problem', 'morning'], say: 'sounds good', ok: (_c, _r, n) => n <= 1 },
  { name: 'review: "not really" does not submit', setup: ['Marcus', 'yes', S, 'yes', 'drain problem', 'morning'], say: 'not really', ok: (_c, _r, n) => n === 0 },
  { name: 'review: "I think so" does not submit', setup: ['Marcus', 'yes', S, 'yes', 'drain problem', 'morning'], say: 'I think so', ok: (_c, _r, n) => n === 0 },
];

let pass = 0;
const ledger = new URL('../ledger.jsonl', import.meta.url);
for (const t of cases) {
  let n = 0;
  const c = new Copilot(halvorsen, model, { submit: () => { n++; } });
  c.start();
  // Every answer is read back for a yes; the setup confirms each one unless its next step already does.
  for (const [i, s] of t.setup.entries()) {
    await c.turn(s);
    if (c.state === 'verify' && yesNo(t.setup[i + 1] ?? '') !== 'yes') await c.turn('yes');
  }
  const reply = await c.turn(t.say);
  if (c.state === 'verify') await c.turn('yes'); // the case checks what was kept
  const ok = t.ok(c, reply, n);
  pass += ok ? 1 : 0;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${t.name}${ok ? '' : `\n      said "${t.say}" -> "${reply.slice(0, 110)}"`}`);
  fs.appendFileSync(ledger, JSON.stringify({ ts: new Date().toISOString(), set: 'holdout', model: model.name, scenario: t.name, pass: ok }) + '\n');
}
console.log(`\nholdout: ${pass}/${cases.length} (model: ${model.name})`);
