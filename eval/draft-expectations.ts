// Asks the `eval` slot's model to propose the expected result for each replay case, as a draft for code checks.
// Run: node eval/draft-expectations.ts [--cases <file>] [--out <file>] [--case <id prefix>]
//   reads   eval/cases/snapshot.json (the mined replay cases)
//   writes  eval/cases/drafts.json: one entry per case with source "model-written", the slot, provider, model and date, the draft
//           expectation (the same shape expect.ts checks), the model's reason, and the case's own expectation beside it.
// It never edits the snapshot or Octo: a draft is a proposal, promoted by a person. The model is the `eval` slot's (decision 0017,
// demo/live-site/model-slots.json, SLOT_EVAL_PROVIDER / SLOT_EVAL_MODEL). With the slot on `local` it asks the local model at LLAMA_URL,
// and without one it says so and stops.
import fs from 'node:fs';
import path from 'node:path';
import type { Case } from './lib/cases.ts';
import { draftAll } from './lib/drafts.ts';
import { chat, evalSlot, type ChatCfg } from './lib/llm.ts';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const arg = (k: string, d = '') => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const from = path.resolve(arg('--cases', path.join(root, 'eval/cases/snapshot.json')));
const out = path.resolve(arg('--out', path.join(root, 'eval/cases/drafts.json')));

const slot = evalSlot();
let cfg: ChatCfg;
if (slot.smart) cfg = { provider: slot.provider as ChatCfg['provider'], model: slot.model, url: slot.url, temperature: 0.2 };
else if (process.env.LLAMA_URL) cfg = { provider: 'llama', model: slot.model, url: process.env.LLAMA_URL.replace(/\/$/, ''), temperature: 0.2 };
else { console.log('no model to ask: set SLOT_EVAL_PROVIDER and SLOT_EVAL_MODEL (see deploy/README.md) or LLAMA_URL for the local model'); process.exit(0); }

const cases = (JSON.parse(fs.readFileSync(from, 'utf8')) as Case[]).filter(c => c.id.startsWith(arg('--case')));
const { drafts, skipped } = await draftAll(cases, p => chat(cfg, [{ role: 'user', content: p }], { what: 'draft expectation', json: true, maxTokens: 400 }), { provider: cfg.provider, model: cfg.model });
fs.writeFileSync(out, `${JSON.stringify({ note: 'Model-written drafts. Not checked by any gate; a person promotes one into a case.', slot: 'eval', provider: cfg.provider, model: cfg.model, date: new Date().toISOString().slice(0, 10), drafts, skipped }, null, 1)}\n`);
console.log(`${drafts.length} drafts (${drafts.filter(d => d.agrees).length} agree with the case's own expectation), ${skipped.length} skipped, written to ${path.relative(root, out)}`);
for (const s of skipped) console.log(`  skipped ${s.case}: ${s.why}`);
