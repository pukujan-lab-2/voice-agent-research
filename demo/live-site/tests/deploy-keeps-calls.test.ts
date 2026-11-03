// A deploy must not cut a call that is open (#67, #76). These checks need no Docker and no real deploy: they read the scripts,
// run deploy/vps/lib.sh's wait, drain and record with a stand-in for `docker`, and run deploy/pro/update.sh against a scratch
// git repository with stand-ins for the site, the speech server and launchctl. The whole sequence with a real call, LiveKit and
// containers is tests/deploy-sequence.ts (needs Docker and macOS `say`).
import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (rel: string) => fs.readFileSync(path.join(root, rel), 'utf8');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-keeps-calls-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bash = (script: string, env: Record<string, string> = {}) =>
  execFileSync('bash', ['-c', script], { encoding: 'utf8', env: { PATH: process.env.PATH ?? '', HOME: tmp, ...env } });

// --- the scripts as written -----------------------------------------------------------------------------------------------
test('the deploy scripts are valid bash', () => {
  for (const f of ['deploy/vps/autodeploy.sh', 'deploy/vps/lib.sh', 'deploy/pro/update.sh']) execFileSync('bash', ['-n', path.join(root, f)]);
});

test('autodeploy.sh waits for calls before the site is swapped, starts the new agent after it, and drains the old one last', () => {
  const lines = read('deploy/vps/autodeploy.sh').split('\n');
  const at = (re: RegExp, from = 0) => lines.findIndex((l, i) => i >= from && re.test(l));
  const build = at(/agent_compose "\$TAG" build agent/);
  const wait = at(/^wait_for_calls /, build);
  const web = at(/up -d --no-deps web \$CHANGED/, wait);
  const healthy = at(/= "healthy"/, web);
  const start = at(/start_agent "\$TAG"/, healthy);
  const drain = at(/drain_old_agents "\$TAG"/, start);
  const record = at(/record_deploy "\$TAG"/, drain);
  assert.ok(build > 0, 'both images are built before anything is touched');
  assert.ok(wait > build && web > wait && healthy > web && start > healthy && drain > start && record > drain, `order: ${[build, wait, web, healthy, start, drain, record]}`);
});

test('autodeploy.sh never replaces the site, LiveKit or the bridges without waiting for calls', () => {
  const lines = read('deploy/vps/autodeploy.sh').split('\n');
  for (const [i, l] of lines.entries()) {
    if (!/"\$\{COMPOSE\[@\]\}" up -d/.test(l) || l.trim().startsWith('#')) continue;
    if (/rolling back/.test(lines.slice(Math.max(0, i - 3), i).join('\n')) || /^COPILOT_WEB_IMAGE=.*--no-deps web \$CHANGED/.test(l)) continue; // the rollback; the swap after the wait
    assert.ok(/wait_for_calls/.test(lines.slice(Math.max(0, i - 3), i).join('\n')), `line ${i + 1} brings containers up without a wait: ${l.trim()}`);
  }
});

test('the agent is not in the main compose file, so Komodo never replaces it', () => {
  assert.doesNotMatch(read('deploy/docker-compose.vps.yml'), /^\s{2}agent:/m);
  assert.match(read('deploy/docker-compose.agent.yml'), /^\s{2}agent:/m);
});

test('the stop grace period is longer than the agent drain timeout', () => {
  const compose = read('deploy/docker-compose.agent.yml');
  const grace = Number(/stop_grace_period:\s*(\d+)s/.exec(compose)?.[1]);
  const drain = Number(/AGENT_DRAIN_S:\s*\$\{AGENT_DRAIN_S:-(\d+)\}/.exec(compose)?.[1]);
  assert.ok(drain > 0 && grace > drain, `grace ${grace}s, drain ${drain}s`);
  assert.match(read('demo/live-site/speech/agent.py'), /drain_timeout=int\(os\.environ\.get\('AGENT_DRAIN_S', 1200\)\)/);
  assert.equal(Number(/AGENT_DRAIN_S', (\d+)/.exec(read('demo/live-site/speech/agent.py'))?.[1]), drain, 'agent.py and the compose file agree on the default');
});

test('open-calls.py counts rooms that hold anything but the agent', () => {
  const py = read('deploy/vps/open-calls.py');
  assert.match(py, /ParticipantInfo\.Kind\.AGENT/);
  assert.match(py, /list_participants/);
});

test('the agent image carries the scripts the deploy runs inside it, and the stall watchdog', () => {
  const docker = read('deploy/agent.Dockerfile');
  assert.match(docker, /stall_watchdog\.py/);
  assert.match(docker, /activity|opentelemetry|requirements/); // opentelemetry comes from agent-requirements.txt for deploy-span.py and telemetry.py
  assert.match(read('deploy/agent-requirements.txt'), /opentelemetry-exporter-otlp-proto-http/);
});

// --- lib.sh with stand-ins ------------------------------------------------------------------------------------------------
// calls_open answers from a queue (one answer per line, the last one repeats), pause() does not sleep.
function wait(queue: string[], extra = '') {
  const q = path.join(tmp, `queue-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(q, queue.join('\n') + '\n');
  const log = path.join(tmp, `deploy-${Math.random().toString(36).slice(2)}.log`);
  const out = bash(`. "${root}/deploy/vps/lib.sh"
    pause() { :; }
    calls_open() { local v; v="$(head -n1 "${q}")"; [ "$(wc -l < "${q}")" -gt 1 ] && sed '1d' "${q}" > "${q}.n" && mv "${q}.n" "${q}"; echo "$v"; }
    ${extra}
    wait_for_calls "swapping the site"
    echo "RESULT $WAIT_RESULT $WAITED_S $CALLS_START $CALLS_END"
    STARTED=$(( $(date +%s) - 3 )); record_deploy abc123 "$STARTED"`, { DEPLOY_LOG: log, CALL_WAIT_S: '20', CALL_POLL_S: '5' });
  return { result: /RESULT (.*)/.exec(out)?.[1], log: fs.readFileSync(log, 'utf8') };
}

test('no call open: no wait', () => {
  const r = wait(['0']);
  assert.equal(r.result, 'none 0 0 0');
  assert.match(r.log, /deploy abc123: wait=none waited=0s calls_at_start=0 calls_at_end=0/);
});

test('calls that end in time: the deploy waits as long as they take and says so', () => {
  const r = wait(['2', '2', '1', '0']);
  assert.equal(r.result, 'waited 15 2 0');
  assert.match(r.log, /2 call\(s\) open; waiting up to 20s before swapping the site/);
  assert.match(r.log, /calls ended after 15s; going on with swapping the site/);
  assert.match(r.log, /wait=waited waited=15s calls_at_start=2 calls_at_end=0 for='swapping the site'/);
});

test('a call that outlasts the bound does not hold the deploy back: it goes on after the bound and says so', () => {
  const r = wait(['1']);
  assert.equal(r.result, 'gave-up 20 1 1');
  assert.match(r.log, /1 call\(s\) still open after 20s; going on with swapping the site/);
  assert.match(r.log, /wait=gave-up waited=20s calls_at_start=1 calls_at_end=1/);
});

test('LiveKit that cannot be asked: the deploy goes on at once and says it could not count', () => {
  const r = wait(['unknown']);
  assert.equal(r.result, 'unknown 0 0 0');
  assert.match(r.log, /could not count open calls; not waiting before swapping the site/);
});

test('a count that fails in the middle of a wait does not end it', () => {
  const r = wait(['1', 'unknown', '0']);
  assert.equal(r.result, 'waited 10 1 0');
});

// `docker` stand-in with four release containers: aaa (an old release, running), bbb (the new release, running), old (finished
// draining: stopped, restart off) and zzz (an old release asleep: Sablier stopped it, restart still on). `ps` without -a lists the
// running ones only. Everything it is asked is recorded.
function fakeDocker(body: string, extra: Record<string, string> = {}) {
  const calls = path.join(tmp, `docker-${Math.random().toString(36).slice(2)}.calls`);
  const out = bash(`. "${root}/deploy/vps/lib.sh"
    docker() { echo "docker $*" >> "${calls}"; case "$1" in
      ps) if [ "$2" = -a ]; then printf 'copilot-agent-aaa\\ncopilot-agent-bbb\\ncopilot-agent-old\\ncopilot-agent-zzz\\n'
          else printf 'copilot-agent-aaa\\ncopilot-agent-bbb\\n'; fi ;;
      inspect) case "$*" in
        *copilot.tag*) echo "\${2#copilot-agent-}" ;;
        *State.Status*) case "$2" in copilot-agent-old|copilot-agent-zzz) echo exited ;; *) echo running ;; esac ;;
        *RestartPolicy*) case "$2" in copilot-agent-old) echo no ;; *) echo unless-stopped ;; esac ;;
      esac ;;
    esac; }
    ${body}`, { DEPLOY_LOG: path.join(tmp, 'x.log'), AGENT_LOG_DIR: path.join(tmp, 'agent-logs'), ...extra });
  return { out, calls: fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').split('\n').filter(Boolean) : [] };
}
const touches = (calls: string[], c: string) => calls.filter(l => /^docker (kill|update|stop|start|rm)/.test(l) && l.endsWith(c));

test('drain_old_agents turns the restart off and sends SIGTERM to every agent but the new release, and no other signal', () => {
  const { out, calls } = fakeDocker('drain_old_agents bbb; echo "DRAINED $DRAINED"');
  assert.match(out, /DRAINED 1/);
  const update = calls.indexOf('docker update --restart=no copilot-agent-aaa');
  const kill = calls.indexOf('docker kill --signal=SIGTERM copilot-agent-aaa');
  assert.ok(update >= 0 && kill > update, `restart off, then SIGTERM: ${calls.join(' | ')}`);
  assert.equal(touches(calls, 'copilot-agent-bbb').length, 0, 'the new release is left alone');
  assert.equal(touches(calls, 'copilot-agent-old').length, 0, 'an agent that is already draining gets no second signal: LiveKit Agents exits at once on it');
});

test('drain_old_agents removes an old agent that is asleep, after saving its log, so the site can never wake it again', () => {
  const { out, calls } = fakeDocker('drain_old_agents bbb; echo "DRAINED $DRAINED"');
  assert.match(out, /DRAINED 1/, 'only the running old agent counts as drained');
  const logs = calls.findIndex(c => /^docker logs .*copilot-agent-zzz/.test(c));
  const rm = calls.indexOf('docker rm copilot-agent-zzz');
  assert.ok(logs >= 0 && rm > logs, `logs saved, then removed: ${calls.join(' | ')}`);
  assert.deepEqual(touches(calls, 'copilot-agent-zzz'), ['docker rm copilot-agent-zzz'], 'no signal and no start: it holds no call');
});

test('reap_agents removes only the agents that finished draining, saving each log first, and keeps only the last few logs', () => {
  const keep = fs.mkdtempSync(path.join(tmp, 'agent-logs-'));
  for (const n of ['1', '2', '3']) fs.writeFileSync(path.join(keep, `copilot-agent-old${n}.log`), 'old\n');
  const { calls } = fakeDocker('AGENT_LOGS_KEPT=2 reap_agents; true', { AGENT_LOG_DIR: keep });
  const logs = calls.findIndex(c => /^docker logs .*copilot-agent-old$/.test(c));
  const rm = calls.indexOf('docker rm copilot-agent-old');
  assert.ok(logs >= 0 && rm > logs, `logs saved, then removed: ${calls.join(' | ')}`);
  assert.equal(touches(calls, 'copilot-agent-zzz').length, 0, 'an agent that is only asleep is kept: a failed deploy goes back to it');
  assert.deepEqual(calls.filter(c => /^docker rm/.test(c)), ['docker rm copilot-agent-old']);
  assert.equal(fs.readdirSync(keep).filter(f => f.endsWith('.log')).length, 2, 'only the last two are kept');
});

test('start_agent does not start a second agent for a release that already runs', () => {
  const { out, calls } = fakeDocker('start_agent bbb && echo "STATE $AGENT_STATE"');
  assert.match(out, /STATE current/);
  assert.equal(calls.filter(c => /compose/.test(c)).length, 0);
});

test('start_agent leaves the agent of the release asleep: the site wakes it when someone calls', () => {
  const { out, calls } = fakeDocker('start_agent zzz && echo "STATE $AGENT_STATE"');
  assert.match(out, /STATE current/);
  assert.equal(calls.filter(c => /compose/.test(c)).length, 0);
  assert.equal(touches(calls, 'copilot-agent-zzz').length, 0);
});

// --- sleeping between calls (#117) -------------------------------------------------------------------------------------------
test('the agent sleeps through the shared Sablier, which wakes it by the name the site is given', () => {
  const compose = read('deploy/docker-compose.agent.yml');
  assert.match(compose, /sablier\.enable: "true"/);
  const name = /container_name:\s*(\S+)/.exec(compose)?.[1];
  assert.equal(/SABLIER_NAME:\s*(\S+)/.exec(compose)?.[1], name, 'the agent renews the session of its own container');
  assert.match(read('deploy/docker-compose.vps.yml'), /SABLIER_AGENT: \$\{COPILOT_AGENT_CONTAINER:-\}/);
  assert.match(name ?? '', /^\$\{COPILOT_PREFIX:-copilot\}-agent-\$\{AGENT_TAG:-local\}$/, 'autodeploy.sh names it the same way');
  assert.match(read('deploy/vps/autodeploy.sh'), /COPILOT_AGENT_CONTAINER=%s-agent-%s/);
});

test('the agent is healthy only once it has registered with LiveKit, and forgets that when it starts again', () => {
  const compose = read('deploy/docker-compose.agent.yml');
  const marker = /test", "-f", "([^"]+)"/.exec(compose)?.[1];
  const py = read('demo/live-site/speech/agent.py');
  assert.equal(/REGISTERED = '([^']+)'/.exec(py)?.[1], marker, 'the health check looks for the file agent.py writes');
  assert.match(py, /@server\.on\('worker_registered'\)/);
  assert.match(py, /__main__[\s\S]*REGISTERED[\s\S]*cli\.run_app/, 'a stopped container keeps /tmp, so the file is removed before the worker starts');
});

// --- deploy/pro/update.sh against a scratch repository ----------------------------------------------------------------------
type Quiet = { calls?: number; inflight?: number; idle_s?: number };
async function pro(state: Quiet, opts: { deferredAgoS?: number; siteDown?: boolean } = {}) {
  const dir = fs.mkdtempSync(path.join(tmp, 'pro-'));
  const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' }).trim();
  const work = path.join(dir, 'work'), origin = path.join(dir, 'origin.git'), checkout = path.join(dir, 'pro');
  fs.mkdirSync(path.join(work, 'deploy/pro'), { recursive: true });
  fs.mkdirSync(path.join(work, 'demo/live-site/speech'), { recursive: true });
  fs.copyFileSync(path.join(root, 'deploy/pro/update.sh'), path.join(work, 'deploy/pro/update.sh'));
  fs.writeFileSync(path.join(work, 'demo/live-site/speech/requirements.txt'), 'x\n');
  git(dir, 'init', '-q', '--bare', origin);
  git(dir, 'init', '-q', work);
  git(work, 'add', '.'); git(work, 'commit', '-qm', 'one'); git(work, 'push', '-q', origin, 'HEAD:refs/heads/production');
  git(dir, 'clone', '-q', '-b', 'production', origin, checkout);
  const first = git(checkout, 'rev-parse', 'HEAD');
  fs.writeFileSync(path.join(work, 'two.txt'), '2\n');
  git(work, 'add', '.'); git(work, 'commit', '-qm', 'two'); git(work, 'push', '-q', origin, 'HEAD:refs/heads/production');
  const second = git(work, 'rev-parse', 'HEAD');
  fs.mkdirSync(path.join(checkout, 'demo/live-site/speech/.venv/bin'), { recursive: true });
  fs.writeFileSync(path.join(checkout, 'demo/live-site/speech/.venv/bin/python'), '#!/bin/sh\nexec python3 "$@"\n', { mode: 0o755 }); // a wrapper: macOS's python3 shim breaks when symlinked
  fs.mkdirSync(path.join(dir, 'bin'));
  fs.writeFileSync(path.join(dir, 'bin/launchctl'), `#!/bin/sh\necho "$@" >> "${dir}/launchctl.log"\n`, { mode: 0o755 });
  const srv = http.createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(req.url === '/health' ? { ok: true, inflight: state.inflight ?? 0, idle_s: state.idle_s ?? 999 } : { calls: state.calls ?? 0 }));
  });
  await new Promise<void>(r => srv.listen(0, '127.0.0.1', r));
  const port = (srv.address() as AddressInfo).port;
  const deferred = path.join(dir, 'deferred');
  if (opts.deferredAgoS !== undefined) fs.writeFileSync(deferred, String(Math.floor(Date.now() / 1000) - opts.deferredAgoS));
  let out = '';
  try {
    // Asynchronous: the stand-in site and speech server live in this process and must answer while the script runs.
    out = (await promisify(execFile)('bash', [path.join(checkout, 'deploy/pro/update.sh')], { encoding: 'utf8', env: {
      PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, HOME: dir, CALL_WAIT_S: '600', SPEECH_IDLE_S: '20', UPDATE_DEFERRED_FILE: deferred,
      SITE_URL: opts.siteDown ? 'http://127.0.0.1:1' : `http://127.0.0.1:${port}`, SPEECH_HEALTH_URL: `http://127.0.0.1:${port}/health` } })).stdout;
  } finally { srv.close(); }
  const kicked = fs.existsSync(path.join(dir, 'launchctl.log'));
  return { out, kicked, moved: git(checkout, 'rev-parse', 'HEAD') === second, stayed: git(checkout, 'rev-parse', 'HEAD') === first, deferredFile: fs.existsSync(deferred) };
}

test('update.sh restarts the speech server when nothing is going on', async () => {
  const r = await pro({});
  assert.ok(r.kicked && r.moved, r.out);
  assert.match(r.out, /speech server on production/);
});

for (const [name, state] of [['a call open on the site', { calls: 1 }], ['a speech request in flight', { inflight: 1 }], ['a speech request that finished a moment ago', { idle_s: 3 }]] as const) {
  test(`update.sh waits for the next run while there is ${name}`, async () => {
    const r = await pro(state);
    assert.ok(!r.kicked && r.stayed && r.deferredFile, r.out);
    assert.match(r.out, /deferred, waited 0s of 600s/);
  });
}

test('update.sh goes on after the bound, with the reason in the log', async () => {
  const r = await pro({ calls: 2 }, { deferredAgoS: 700 });
  assert.ok(r.kicked && r.moved, r.out);
  assert.match(r.out, /still busy after 70\ds \(2 call\(s\) open on the site\); restarting the speech server anyway/);
});

test('update.sh says when the calls ended while it was waiting', async () => {
  const r = await pro({}, { deferredAgoS: 320 });
  assert.ok(r.kicked && r.moved, r.out);
  assert.match(r.out, /calls ended after waiting 32\ds; restarting the speech server/);
  assert.ok(!r.deferredFile);
});

test('update.sh does not wait for a site it cannot reach', async () => {
  const r = await pro({}, { siteDown: true });
  assert.ok(r.kicked && r.moved, r.out);
});
