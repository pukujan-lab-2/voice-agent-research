import test from 'node:test';
import assert from 'node:assert/strict';
import { scenarios } from './scenarios.ts';
import { RuleModel } from '../src/models.ts';
import { spokenToSerial, validSerial, yesNo } from '../src/guard.ts';

for (const s of scenarios) {
  test(s.name, async () => {
    const r = await s.run(new RuleModel());
    assert.ok(r.pass, r.detail);
  });
}

test('spoken serials', () => {
  assert.equal(spokenToSerial("It's one three three four, five nine two, C, L as in Lima, S, D, three"), '1334592CLSD3');
  assert.equal(spokenToSerial('1334 592C LSD3'), '1334592CLSD3');
  assert.equal(spokenToSerial('one three three four five nine two charlie lima sierra delta three'), '1334592CLSD3');
  assert.equal(spokenToSerial('1334 592 C, L as in Lima, X-ray, D, 3'), '1334592CLXD3');
  assert.ok(!validSerial('1334'));
});

test('yes/no never treats hedges as yes', () => {
  for (const t of ['maybe', "I'm not sure", 'hmm', '']) assert.equal(yesNo(t), 'unclear', t);
  assert.equal(yesNo('wait, not yet'), 'no');
  assert.equal(yesNo('yes go ahead'), 'yes');
  assert.equal(yesNo('no, wait'), 'no');
  assert.equal(yesNo('go for it'), 'yes');
  assert.equal(yesNo('not really'), 'unclear');
});
