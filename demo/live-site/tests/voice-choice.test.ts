import assert from 'node:assert/strict';
import { test } from 'node:test';
import { stackForLanguage } from '../widget/voice-choice.ts';

const stacks = [
  { id: 'english-fast', languages: [{ code: 'en' }] },
  { id: 'multilingual', languages: [{ code: 'en' }, { code: 'es' }, { code: 'fr' }] },
];

test('a Spanish or French request selects a compatible listener instead of silently keeping English', () => {
  assert.equal(stackForLanguage(stacks, 'english-fast', 'es'), 'multilingual');
  assert.equal(stackForLanguage(stacks, 'english-fast', 'fr'), 'multilingual');
});
test('automatic language detection selects a multilingual listener', () => {
  assert.equal(stackForLanguage(stacks, 'english-fast', ''), 'multilingual');
});
test('a compatible choice stays selected and a fixed business stack is respected', () => {
  assert.equal(stackForLanguage(stacks, 'multilingual', 'en'), 'multilingual');
  assert.equal(stackForLanguage(stacks.slice(0, 1), 'english-fast', 'es'), 'english-fast');
});
