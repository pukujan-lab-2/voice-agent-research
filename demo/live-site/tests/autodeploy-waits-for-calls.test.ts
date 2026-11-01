// A deploy must not replace the voice agent while a call is open (#67): a new agent never joins a room that already
// exists, so the caller is left talking to nobody. These checks read deploy/vps/autodeploy.sh; the real thing needs the VPS.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const script = fs.readFileSync(path.join(root, 'deploy/vps/autodeploy.sh'), 'utf8');
const lines = script.split('\n');
const at = (re: RegExp, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));

test('autodeploy.sh is valid bash', () => {
  execFileSync('bash', ['-n', path.join(root, 'deploy/vps/autodeploy.sh')]);
});

test('the web container is swapped without the agent, and the agent only after the wait for open calls', () => {
  const web = at(/up -d --no-deps web/);
  const wait = at(/^\s+wait_for_calls$/, web);
  const agent = at(/up -d --no-deps agent/, wait);
  assert.ok(web > 0, 'web is brought up on its own');
  assert.ok(wait > web, 'the wait for open calls comes after the web swap');
  assert.ok(agent > wait, 'the agent is brought up after the wait');
});

test('no other step brings the agent up without waiting first', () => {
  for (const [i, l] of lines.entries()) {
    if (!/\bup -d\b/.test(l) || /--no-deps (web|agent)/.test(l) || l.trim().startsWith('#')) continue;
    // The early exit (already at production) and the rollback (the old images back) may run a plain `up`: the first waits when the agent differs, the second never changes the agent (the swap failed before it).
    const before = lines.slice(Math.max(0, i - 2), i).join('\n');
    assert.ok(/wait_for_calls/.test(before) || /rolling back/.test(lines.slice(Math.max(0, i - 3), i).join('\n')), `line ${i + 1} brings the agent up without waiting: ${l.trim()}`);
  }
});

test('open-calls.py counts rooms that hold anything but the agent', () => {
  const py = fs.readFileSync(path.join(root, 'deploy/vps/open-calls.py'), 'utf8');
  assert.match(py, /ParticipantInfo\.Kind\.AGENT/);
  assert.match(py, /list_participants/);
});

test('the agent image carries the stall watchdog', () => {
  const docker = fs.readFileSync(path.join(root, 'deploy/agent.Dockerfile'), 'utf8');
  assert.match(docker, /stall_watchdog\.py/);
});
