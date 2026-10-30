// Runs every scenario and appends one line per result to ledger.jsonl (the regression record).
import fs from 'node:fs';
import { scenarios } from './scenarios.ts';
import { LlamaModel, RuleModel } from '../src/models.ts';

const llama = process.argv.includes('--llama');
const model = llama ? new LlamaModel() : new RuleModel();
const version = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const ledger = new URL('../ledger.jsonl', import.meta.url);
let pass = 0;
for (const s of scenarios) {
  const r = await s.run(model);
  pass += r.pass ? 1 : 0;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.scenario}${r.pass ? '' : '\n      ' + r.detail}`);
  fs.appendFileSync(ledger, JSON.stringify({ ts: new Date().toISOString(), engine: version, model: model.name, scenario: r.scenario, pass: r.pass, detail: r.pass ? '' : r.detail }) + '\n');
}
console.log(`\n${pass}/${scenarios.length} passed (model: ${model.name}, engine ${version})`);
process.exit(pass === scenarios.length ? 0 : 1);
