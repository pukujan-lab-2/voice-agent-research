import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comment, lastCounts, rises, type Counts } from '../lib/standing.ts';

const cur: Counts = { 'invented-offer': { pass: 0, fail: 2, skip: 0 }, 'repeated-passage': { pass: 1, fail: 0, skip: 0 } };

test('the first run only sets the baseline', () => assert.deepEqual(rises(null, cur), []));
test('a rule whose failures went up is named, one that fell or held is not', () => {
  assert.deepEqual(rises({ 'invented-offer': 1, 'repeated-passage': 1 }, cur), [{ rule: 'invented-offer', from: 1, to: 2 }]);
  assert.deepEqual(rises({ 'invented-offer': 2 }, cur), []);
});
test('a rule that is new this run counts from zero', () => assert.deepEqual(rises({}, cur), [{ rule: 'invented-offer', from: 0, to: 2 }]));
test('the counts survive a round trip through the comment marker, newest comment first', () => {
  const run = { at: 'now', site: 'https://x', perRule: cur, failures: [{ id: 'a', rule: 'invented-offer', status: 'open', said: 'Yeah', why: 'offered "just say the word"' }] };
  const body = comment(run, [], []);
  assert.deepEqual(lastCounts(['no marker here', body, 'later chatter']), { 'invented-offer': 2, 'repeated-passage': 0 });
  assert.equal(lastCounts(['nothing']), null);
});
