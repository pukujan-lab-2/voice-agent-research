// The site reads the voice stacks and languages from their folders (voice-config.ts, #169) the same way the agent and
// the speech server do (agent/common/voice.py, which also checks them), so a stack the server offers is one a call can run.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { AGENT_DIR, loadVoice } from '../voice-config.ts';

test('the site and the voice agent read the same stacks and languages', () => {
  const python = JSON.parse(execFileSync('python3', ['-I', path.join(AGENT_DIR, 'common/voice.py')], { encoding: 'utf8' }));
  assert.deepEqual(loadVoice(), python);
});

test('every stack names its languages, and each language has a folder', () => {
  const v = loadVoice();
  assert.ok(v.stacks[v.default], 'the default is a stack');
  for (const [id, s] of Object.entries(v.stacks))
    for (const code of s.languages) assert.ok(v.languages[code], `${id} lists ${code}, which has no folder`);
});
