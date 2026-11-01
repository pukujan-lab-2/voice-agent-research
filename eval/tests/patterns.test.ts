import assert from 'node:assert/strict';
import { test } from 'node:test';
import { groupByRule, issueBody, PATTERNS, titleFor, type Row } from '../lib/patterns.ts';
import { RULES } from '../lib/rules.ts';

const row = (id: string, rule: string, n = 1): Row => ({ id, call_id: '7d689fcd-fe99-439c-8350-6305244e2875', turn_n: n, rule, text: '"Yeah" → "just say the word"', evidence: 'offers "just say the word"', call_at: null });

test('flags group by rule, and the title names the pattern so one issue stays open per pattern', () => {
  const g = groupByRule([row('a', 'invented-offer'), row('b', 'invented-offer', 2), row('c', 'barge-in')]);
  assert.deepEqual([...g].map(([k, v]) => [k, v.length]), [['invented-offer', 2], ['barge-in', 1]]);
  assert.equal(titleFor('invented-offer'), 'Flagged turns: the desk model offers something nobody told it it can do');
});
test('the issue body lists each flag with a marker the next run can find, and says no model decided', () => {
  const body = issueBody('invented-offer', [row('abc123', 'invented-offer')]);
  assert.match(body, /flag:abc123/);
  assert.match(body, /plain code/);
  assert.match(body, /### Lifecycle Status/);
});
test('every rule the miner has is written up', () => {
  for (const f of ['judge-dropped-answer', 'repeated-passage', 'vague-answered-by-quote', 'invented-offer', 'slow-first-audio', 'slow-search', 'barge-in', 'unresolved-call']) assert.ok(PATTERNS[f], f);
  assert.equal(RULES.length, 7);
});
