// Replay cases built from the owner's recorded call, and what the shipped library path does with them. Needs no keys.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { caseFromFlag, type Case } from '../lib/cases.ts';
import { check } from '../lib/expect.ts';
import { runGuide } from '../lib/replay.ts';
import { flagCall } from '../lib/rules.ts';
import { buildCalls, type Span } from '../lib/spans.ts';

const [call] = buildCalls(JSON.parse(fs.readFileSync(new URL('./fixtures/call-7d689fcd.json', import.meta.url), 'utf8')) as Span[]);
const cases = flagCall(call).map(f => caseFromFlag(call, f)).filter((c): c is Case => !!c);
const by = (rule: string, said: string) => cases.find(c => c.rule === rule && c.said.startsWith(said))!;

test('every replayable flag of the call becomes a case, seeded with the owner\'s five complaints', () => {
  assert.equal(cases.filter(c => c.path === 'desk').length, 2);
  for (const said of ['How do I find my taxes?', 'Yeah', 'Is it gonna take long?', 'You guide me how to file it. Can I file it from here?', 'Do you not have a form']) {
    assert.ok(cases.some(c => c.said.startsWith(said)), said);
  }
  assert.ok(cases.every(c => c.status === 'open' && c.history.length % 2 === 0));
});

test('the dropped-answer case carries the recorded search results and expects an answer from the passage that says yes', () => {
  const c = by('judge-dropped-answer', 'You guide me');
  assert.equal(c.input, 'Can I file my tax return from here?');
  assert.deepEqual(c.recorded.judges.map(j => j.id), ['', '']);
  assert.ok(c.recorded.searches[0].passages[0].text.startsWith('Yes, you can file an original Form 1040'));
  assert.ok(c.expect.kind === 'answers-from' && c.expect.ids.includes(c.recorded.searches[0].passages[0].id));
});

test('a library case replays on its recorded results and gets a verdict', async () => {
  for (const c of cases.filter(c => c.path === 'guide')) {
    const r = await runGuide(c);
    assert.ok(r.verdict && r.reply.length > 0, c.said);
  }
});

test('the checks read plain text', () => {
  assert.equal(check({ kind: 'clarifies' }, { reply: 'Which form do you mean?', quoted: false }).pass, true);
  assert.equal(check({ kind: 'clarifies' }, { reply: 'Which form? Or which year?', quoted: false }).pass, false);
  assert.equal(check({ kind: 'clarifies' }, { reply: 'I don\'t know. I couldn\'t find that in the tax guides.', quoted: false }).pass, false);
  assert.equal(check({ kind: 'no-offer' }, { reply: 'Just say the word.', quoted: false }).pass, false);
  assert.equal(check({ kind: 'answers-from', ids: ['a'] }, { reply: 'It says yes.', cited: 'a', quoted: true }).pass, true);
  assert.equal(check({ kind: 'not-passage', id: 'a' }, { reply: 'x', cited: 'a', quoted: true }).pass, false);
});

test('the gate fails the run when a guarded case fails, and passes when only an open case does', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-'));
  const gate = (status: 'open' | 'guarded') => {
    const file = path.join(dir, `${status}.json`);
    fs.writeFileSync(file, JSON.stringify([{ ...by('repeated-passage', 'Do you not have'), status }]));
    return spawnSync('node', [fileURLToPath(new URL('../replay.ts', import.meta.url)), '--snapshot', file, '--gate'], { encoding: 'utf8' });
  };
  const bad = gate('guarded');
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /guarded case\(s\) regressed/);
  assert.equal(gate('open').status, 0);
});
