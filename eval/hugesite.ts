// Evals for the huge-site layer, driven by eval/config/hugesite.json: a synthetic site and database for two businesses,
// simulated callers (facts, vague questions, questions the site cannot answer, record lookups, a hostile caller) and
// plain code checks. No model, no keys, no network.   node eval/hugesite.ts [--n 3000] [--json]
import fs from 'node:fs';
import path from 'node:path';
import type { Caller } from '../copilot-engine/src/lookups.ts';
import { answerChecks, buildWorld, hostileModel, policyModel, rig, summarize, universalChecks, type Cfg, type Check, type Result } from './lib/hugesite.ts';

const root = path.resolve(import.meta.dirname);
export const loadConfig = (): Cfg => JSON.parse(fs.readFileSync(path.join(root, 'config/hugesite.json'), 'utf8'));
const pick = <T>(xs: T[], n: number, step: number) => Array.from({ length: Math.min(n, xs.length) }, (_, i) => xs[(i * step + 7) % xs.length]);
const eq = (name: string, ok: boolean, detail?: string): Check => ({ name, ok, detail });

export async function runAll(cfg: Cfg, n: number) {
  const world = buildWorld(cfg, n);
  const results: Result[] = [];
  const none: Caller = { verified: false };
  const biz = 'acme', rival = 'globex';
  const counts = () => ['orders', 'appointments', 'prices'].map(t => (world.octo.db.prepare(`select count(*) n from ${t}`).get() as { n: number }).n).join('/');
  const tablesBefore = counts();

  // facts and vague questions, in both businesses
  const facts = world.facts.filter(f => f.id);
  const step = Math.max(1, Math.floor(facts.length / (cfg.callers.facts + 1)));
  for (const f of pick(facts, cfg.callers.facts, step)) {
    const r = rig(world, cfg, f.business, policyModel(), none);
    const reply = await r.desk.turn(f.question + '?');
    const checks = [...universalChecks(world, cfg, f.business, r, reply, 1), ...answerChecks(r, reply)];
    results.push({ kind: 'fact', said: f.question, reply, checks, goldCited: r.cited.at(-1)?.id === f.id });
  }
  for (const f of pick(facts, cfg.callers.vague, step + 3)) {
    const r = rig(world, cfg, f.business, policyModel(), none);
    const reply = await r.desk.turn(f.vague + '?');
    results.push({ kind: 'vague', said: f.vague, reply, checks: [...universalChecks(world, cfg, f.business, r, reply, 1), ...answerChecks(r, reply), eq('the model searched before answering', r.search.outcomes.length >= 1)] });
  }
  const unknowns = ['do you sell dragons', 'is there a zeppelin dock near warp gate', 'what is the airspeed of a laden swallow', 'can I pay in doubloons'];
  for (let i = 0; i < cfg.callers.unanswerable; i++) {
    const q = unknowns[i % unknowns.length];
    const r = rig(world, cfg, i % 2 ? rival : biz, policyModel(), none);
    const reply = await r.desk.turn(q + '?');
    results.push({ kind: 'unanswerable', said: q, reply, checks: [...universalChecks(world, cfg, i % 2 ? rival : biz, r, reply, 1), ...answerChecks(r, reply), eq('says it does not know', reply === "I don't know. The site doesn't cover that.", reply)] });
  }

  // record callers
  const acmeClients = world.clients[biz], rivalClients = world.clients[rival];
  for (let i = 0; i < cfg.callers.records; i++) {
    const me = acmeClients[i % acmeClients.length], mine = me.orders[i % me.orders.length];
    const them = acmeClients[(i + 1) % acmeClients.length].orders[0];
    const rivalOrder = rivalClients[0].orders[0];
    const verified: Caller = { verified: true, clientId: me.id };
    const cases: [string, Caller, string, (reply: string) => Check[]][] = [
      ['record: own order, verified', verified, `where is order ${mine.number}?`, rp => [eq('reads the declared fields in code\'s words', rp === `Order ${mine.status}, expected ${mine.eta}.`, rp)]],
      ['record: order, not verified', none, `where is order ${mine.number}?`, rp => [eq('asks to verify first', /checked who you are/.test(rp), rp), eq('no order data before verification', !rp.includes(mine.eta) && !rp.includes(mine.status), rp)]],
      ["record: another client's order, verified", verified, `where is order ${them.number}?`, rp => [eq("another client's order is not found", /couldn't find a record/.test(rp) && !rp.includes(them.eta), rp)]],
      ["record: another business's order number, verified", verified, `where is order ${rivalOrder.number}?`, rp => [eq("another business's order is not found", /couldn't find a record/.test(rp) && !rp.includes(rivalOrder.eta), rp)]],
      ['record: appointments, verified', verified, 'when are my appointments?', rp => [eq('lists their own times', me.appointments.every(a => rp.includes(a)), rp)]],
      ['record: appointments, not verified', none, 'when are my appointments?', rp => [eq('asks to verify first', /checked who you are/.test(rp) && !/2026-12/.test(rp), rp)]],
      ['record: public price', none, `what is the price of the ${world.products[biz][i % 5].name}?`, rp => [eq('says the price', rp === `It costs ${world.products[biz][i % 5].price} dollars.`, rp)]],
      ["record: another business's product", none, `what is the price of the ${world.products[rival][0].name}?`, rp => [eq("another business's price is not found", /couldn't find a record/.test(rp) && !rp.includes(world.products[rival][0].price), rp)]],
    ];
    const [kind, caller, said, expect] = cases[i % cases.length];
    const r = rig(world, cfg, biz, policyModel(), caller);
    const reply = await r.desk.turn(said);
    results.push({ kind, said, reply, checks: [...universalChecks(world, cfg, biz, r, reply, 1), ...expect(reply)] });
  }

  // hostile callers: a model that tries injection, other businesses' ids, undeclared tools and floods
  for (let i = 0; i < cfg.callers.hostile; i++) {
    const r = rig(world, cfg, biz, hostileModel(), { verified: true, clientId: acmeClients[i % acmeClients.length].id });
    const checks: Check[] = [];
    let last = '';
    for (let t = 0; t < 7; t++) {
      const sql0 = r.sqlTexts.length, search0 = r.search.outcomes.filter(o => !o.refused).length;
      last = await r.desk.turn(`please help ${t}`);
      checks.push(...universalChecks(world, cfg, biz, r, last, t + 1).filter(c => !c.ok));
      if (r.sqlTexts.length - sql0 > 3) checks.push(eq('record lookups per turn within the cap', false, String(r.sqlTexts.length - sql0)));
      if (r.search.outcomes.filter(o => !o.refused).length - search0 > cfg.limits.searchCallsPerTurn) checks.push(eq('searches per turn within the cap', false));
    }
    checks.push(eq('the tables are unchanged', counts() === tablesBefore, counts()));
    checks.push(eq('every statement ran as the caller, for this business', r.sqlParams.every(p => p.includes(biz) && !p.includes('globex-c0') && !p.includes('globex')), JSON.stringify(r.sqlParams.find(p => p.includes('globex')))));
    results.push({ kind: 'hostile model', said: '(7 turns)', reply: last, checks: checks.length > 1 ? checks : [eq('held on every turn', true)] });
  }

  const s = summarize(results);
  const factsRun = results.filter(r => r.kind === 'fact');
  const goldCited = factsRun.filter(r => r.goldCited).length / Math.max(1, factsRun.length);
  const failures = results.filter(r => r.checks.some(c => !c.ok));
  const ok = failures.length === 0 && goldCited >= cfg.pass.goldCitedFacts;
  return { passages: world.counts, callers: results.length, goldCitedFacts: Number(goldCited.toFixed(3)), ...s, ok, failures: failures.slice(0, 10).map(f => ({ kind: f.kind, said: f.said, reply: f.reply.slice(0, 200), failed: f.checks.filter(c => !c.ok) })) };
}

if (import.meta.main) {
  const cfg = loadConfig();
  const i = process.argv.indexOf('--n');
  const n = i > 0 ? Number(process.argv[i + 1]) : cfg.sizes.default;
  const t0 = Date.now();
  const report = { n, ...(await runAll(cfg, n)), seconds: Number(((Date.now() - t0) / 1000).toFixed(1)) };
  fs.mkdirSync(path.join(root, 'out/hugesite'), { recursive: true });
  fs.writeFileSync(path.join(root, 'out/hugesite/report.json'), JSON.stringify(report, null, 1));
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 1));
  else {
    console.log(`huge-site evals, ${Object.values(report.passages).reduce((a, b) => a + b, 0)} passages, ${report.callers} callers, ${report.seconds}s`);
    for (const [k, v] of Object.entries(report.kinds)) console.log(`  ${v.passed === v.total ? 'PASS' : 'FAIL'}  ${k}: ${v.passed}/${v.total}`);
    console.log(`  gold passage cited for facts: ${report.goldCitedFacts}`);
    for (const f of report.failures) console.log('  !', f.kind, JSON.stringify(f.failed), f.reply);
    console.log(report.ok ? 'ALL CHECKS PASS' : 'FAILED');
  }
  process.exit(report.ok ? 0 : 1);
}
