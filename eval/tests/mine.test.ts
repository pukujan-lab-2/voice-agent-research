// The mining rules, run on the owner's real call of 2026-11-01 17:10-17:12 UTC (session 7d689fcd), recorded from the
// chatbots workspace with long fields trimmed. Needs no keys.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { test } from 'node:test';
import { buildCalls, type Span } from '../lib/spans.ts';
import { flagCall, isVague, LIMITS } from '../lib/rules.ts';

const spans: Span[] = JSON.parse(fs.readFileSync(new URL('./fixtures/call-7d689fcd.json', import.meta.url), 'utf8'));
const [call] = buildCalls(spans);
const flags = flagCall(call);
const at = (rule: string) => flags.filter(f => f.rule === rule).map(f => f.n);

test('the recorded call becomes one call of seven turns, each with its backend spans', () => {
  assert.equal(buildCalls(spans).length, 1);
  assert.equal(call.turns.length, 7);
  assert.equal(call.turns[5].judges.filter(j => !j.id).length, 2);
  assert.ok(call.turns[5].searches[0].texts[0].startsWith('Yes, you can file an original Form 1040'));
});

test('the judge that dropped "Can I file it from here?" is flagged', () => {
  assert.deepEqual(at('judge-dropped-answer'), [6]);
});

test('the Publication 570 quote repeated for a different question is flagged', () => {
  assert.deepEqual(at('repeated-passage'), [7]);
});

test('vague questions answered by a quote are flagged, specific ones are not', () => {
  assert.deepEqual(at('vague-answered-by-quote'), [1, 4, 5]);
  assert.ok(isVague('Yeah.') && isVague('what about that') && isVague('How do I find my taxes?'));
  assert.ok(!isVague('How do I set up a payment plan with the IRS?') && !isVague('Where do I find Form 9465?'));
});

test('replies that offer something nobody told the copilot it can do are flagged', () => {
  assert.deepEqual(at('invented-offer'), [2, 3]);
});

test('slow first audio and slow search are flagged past the limits', () => {
  assert.deepEqual(at('slow-first-audio'), [3, 4]);
  assert.deepEqual(at('slow-search'), [1, 5]);
  assert.ok(LIMITS.firstAudioMs > 0);
});

test('a clean call raises no flag', () => {
  const clean = buildCalls(spans.filter(s => s.name !== 'judge')).flatMap(flagCall).filter(f => f.rule === 'judge-dropped-answer');
  assert.equal(clean.length, 0);
});
