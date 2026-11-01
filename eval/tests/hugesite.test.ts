// The huge-site evals pass on the shipped code, and they fail when the thing each check guards is broken (negative controls).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadConfig, runAll } from '../hugesite.ts';

const small = 1200;

test('simulated callers, a hostile model and every code check pass on the shipped layer', async () => {
  const r = await runAll(loadConfig(), small);
  assert.deepEqual(r.failures, []);
  assert.equal(r.ok, true);
  assert.ok(r.callers >= 90);
  assert.ok(r.goldCitedFacts >= 0.9);
  const names = Object.keys(r.checks);
  for (const must of ['citation present', 'quote is word for word in the cited passage', 'no undeclared field or private value (canary strings)', 'no other business', 'every statement is a declared one']) {
    assert.ok(names.includes(must), must);
    assert.equal(r.checks[must].failed, 0, must);
  }
});

test('control: if a private column reached the caller, the canary check would fail', async () => {
  const cfg = loadConfig();
  cfg.lookups.lookups[0].fields.push({ column: 'internal_note', label: 'Note' });
  cfg.lookups.lookups[0].say = 'Order {Status}, expected {Expected}. Note: {Note}';
  const r = await runAll(cfg, small);
  assert.equal(r.ok, false);
  assert.ok(r.checks['no undeclared field or private value (canary strings)'].failed > 0);
});

test("control: tables shared between businesses without a business column let other businesses' rows through, and the checks see it", async () => {
  const cfg = loadConfig();
  delete cfg.lookups.businessColumn;
  const r = await runAll(cfg, small);
  assert.equal(r.ok, false);
  assert.ok(r.checks['every statement is scoped to this business'].failed > 0);
});

test('control: a pass mark the run cannot reach fails the run', async () => {
  const cfg = loadConfig();
  cfg.pass.goldCitedFacts = 1.01;
  assert.equal((await runAll(cfg, small)).ok, false);
});

test('the same seed gives the same world and the same report', async () => {
  const a = await runAll(loadConfig(), small), b = await runAll(loadConfig(), small);
  assert.deepEqual({ ...a, failures: 0 }, { ...b, failures: 0 });
});
