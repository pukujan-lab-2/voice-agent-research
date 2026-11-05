// The desk's offer guard (src/guard.ts, #38): an offer in the model's own words is dropped; code writes the real ones.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dropOffers } from '../src/guard.ts';

test('the two offers from the owner\'s call of 2026-11-01 are dropped, and the rest of the reply stays', () => {
  assert.equal(dropOffers("Thanks for letting me know. If you'd like to proceed with checking your return or need more details, just say the word."), 'Thanks for letting me know.');
  assert.equal(dropOffers("I don't have the exact turnaround time from my guides right now, but I can help you check on your return."), '');
});

test('every kind of offer goes', () => {
  for (const s of ['I can book that for you.', "I'll email you the details.", 'Let me schedule it.', 'I can look up your account.'])
    assert.equal(dropOffers(`Sure. ${s}`), 'Sure.', s);
});

test('a reply with no offer is untouched', () => {
  assert.equal(dropOffers('Of course, go ahead. What would you like to know?'), 'Of course, go ahead. What would you like to know?');
});
