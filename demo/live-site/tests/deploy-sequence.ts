// A deploy while a call is open, end to end on a scratch Docker project (#76). Nothing real is touched: containers, networks and
// images are named deploytest-*, the site is a stand-in web server, and the voice agent is a small program on the real LiveKit
// Agents 1.8.8 worker (the production agent needs the Pro's speech models). LiveKit is the real server image, the scripts are
// the real deploy/vps/autodeploy.sh and lib.sh, and the compose file for the agent is the real deploy/docker-compose.agent.yml.
//
// The call: a caller container joins a LiveKit room and plays a recording made with macOS `say` into it; the agent counts the
// audio it hears and reports the count on its participant attributes, so "the caller is still heard" is a number that rises.
//   1. deploy release one (autodeploy.sh); a call starts and the agent of release one hears the caller
//   2. push release two and deploy while the call is open: the deploy waits the bound (20 s here), then goes on; the call is
//      still heard by release one afterwards; release one is draining, release two has registered with LiveKit
//   3. a second call starts: it goes to release two
//   3b. another deploy while both calls are open: the agent that is already draining is not signalled again
//   4. the first call ends: release one's container exits by itself, with code 0
//   5. a deploy with no call open does not wait, and removes the finished container
// Needs Docker (it pulls python:3.12-slim and LiveKit's image and installs livekit-agents on the first run, a few minutes) and
// macOS `say`. Run: node --no-warnings tests/deploy-sequence.ts        Skipped (exit 0) where Docker or `say` is missing.
import { execFile, execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const root = path.join(path.dirname(new URL(import.meta.url).pathname), '../../..');
const run = promisify(execFile);
const have = (cmd: string, args: string[]) => { try { execFileSync(cmd, args, { stdio: 'ignore' }); return true; } catch { return false; } };
if (!have('docker', ['info']) || !have('which', ['say'])) { console.log('SKIP  needs Docker and macOS `say`'); process.exit(0); }

let pass = 0, fail = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) pass++; else fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `\n      ${detail}`}`);
}
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const docker = (...a: string[]) => { try { return execFileSync('docker', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return `${(e as { stdout?: string }).stdout ?? ''}`.trim(); } };
async function until<T>(what: string, secs: number, f: () => T | undefined | false): Promise<T | undefined> {
  for (let i = 0; i < secs; i++) { const v = f(); if (v) return v; await sleep(1000); }
  console.log(`      (gave up waiting for ${what} after ${secs}s)`);
  return undefined;
}

// --- the scratch tree: a git repository with a `production` branch, the real deploy scripts, and stand-ins --------------------
const P = 'deploytest';
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deploy-sequence-'));
const origin = path.join(dir, 'origin.git'), repo = path.join(dir, 'repo'), deploy = path.join(repo, 'deploy');
const git = (cwd: string, ...a: string[]) => execFileSync('git', ['-c', 'user.email=t@t', '-c', 'user.name=t', ...a], { cwd, encoding: 'utf8' }).trim();
const secret = 'deploytest-secret-deploytest-secret-0123456789';
const FILES: Record<string, string> = {
  '.gitignore': 'deploy/.env\ndeploy/deploy.log\ndeploy/.deploy-failed\n',
  'deploy/docker-compose.vps.yml': `name: ${P}
services:
  web:
    container_name: ${P}-web
    image: \${COPILOT_WEB_IMAGE:-copilot-web:local}
    build: { context: .., dockerfile: deploy/web.Dockerfile }
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8787/')"]
      interval: 2s
      timeout: 3s
      retries: 10
      start_period: 1s
  livekit:
    container_name: ${P}-livekit
    image: livekit/livekit-server:v1.13.11
    environment:
      LIVEKIT_CONFIG: |
        port: 7880
        keys: { devkey: ${secret} }
        rtc: { tcp_port: 7881, port_range_start: 50000, port_range_end: 50200, use_external_ip: false }
`,
  'deploy/web.Dockerfile': 'FROM python:3.12-slim\nCOPY deploy/release.txt /srv/release.txt\nWORKDIR /srv\nCMD ["python", "-m", "http.server", "8787"]\n',
  'deploy/agent.Dockerfile': `FROM python:3.12-slim
RUN pip install --no-cache-dir livekit-agents==1.8.8 opentelemetry-sdk==1.45.2 opentelemetry-exporter-otlp-proto-http==1.45.2
COPY deploy/release.txt deploy/test/fake_agent.py deploy/test/caller.py /agent/
WORKDIR /agent
CMD ["python", "fake_agent.py", "start"]
`,
};
for (const f of ['docker-compose.agent.yml', 'vps/autodeploy.sh', 'vps/lib.sh', 'vps/open-calls.py', 'vps/deploy-span.py', 'test/fake_agent.py', 'test/caller.py']) {
  FILES[`deploy/${f}`] = fs.readFileSync(path.join(root, 'deploy', f), 'utf8');
}
let release = 0;
function commit(): string {
  release++;
  for (const [f, body] of Object.entries(FILES)) { fs.mkdirSync(path.dirname(path.join(repo, f)), { recursive: true }); fs.writeFileSync(path.join(repo, f), body, { mode: f.endsWith('.sh') ? 0o755 : 0o644 }); }
  fs.writeFileSync(path.join(deploy, 'release.txt'), `release-${release}\n`);
  git(repo, 'add', '-A'); git(repo, 'commit', '-qm', `release ${release}`); git(repo, 'push', '-q', origin, 'HEAD:refs/heads/production');
  return git(repo, 'rev-parse', 'HEAD').slice(0, 12);
}
fs.mkdirSync(repo);
git(dir, 'init', '-q', '--bare', origin); git(repo, 'init', '-q'); git(repo, 'remote', 'add', 'origin', origin);
fs.writeFileSync(path.join(dir, 'copilot.env'), `LIVEKIT_API_KEY=devkey\nLIVEKIT_API_SECRET=${secret}\nOCTO_TRACES=off\n`);
const env = { ...process.env, COPILOT_PREFIX: P, COPILOT_PROJECT: P, SABLIER_NETWORK: `${P}-sablier`, CALL_WAIT_S: '20', CALL_POLL_S: '4', AGENT_DRAIN_S: '120', AGENT_READY_S: '90', DEPLOY_LOG: path.join(dir, 'deploy.log') };
const deployNow = () => run('bash', [path.join(deploy, 'vps/autodeploy.sh')], { env, encoding: 'utf8', maxBuffer: 1 << 26 }).then(r => ({ code: 0, out: r.stdout + r.stderr }), (e: { code?: number; stdout?: string; stderr?: string }) => ({ code: e.code ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` }));

function token(room: string, sub: string): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ iss: 'devkey', sub, nbf: now - 5, exp: now + 3600, video: { room, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: true } })}`;
  return `${body}.${crypto.createHmac('sha256', secret).update(body).digest('base64url')}`;
}
const wav = path.join(dir, 'say.wav');
execFileSync('say', ['-o', wav, '--data-format=LEI16@24000', 'Hello, I would like to ask about the opening hours. And also about how I can book a visit next week. Thank you, that is all for now.']);
// A caller: a container of the release's agent image running caller.py, with the recording copied in. Its log is one JSON line a second.
function startCall(name: string, image: string, secs: number) {
  docker('rm', '-f', name);
  docker('create', '--name', name, '--network', `${P}_default`, '-e', `URL=ws://${P}-livekit:7880`, '-e', `ROOM=call-${name}`, '-e', `TOKEN=${token(`call-${name}`, name)}`, '-e', `SECONDS=${secs}`, image, 'python', 'caller.py');
  docker('cp', wav, `${name}:/agent/say.wav`); docker('start', name);
}
type Line = { t: number; release?: string; heard?: number };
function callLog(name: string): Line[] {
  return docker('logs', name).split('\n').flatMap(l => { try { return [JSON.parse(l) as Line]; } catch { return []; } });
}
const last = (name: string) => callLog(name).at(-1);

const everything = () => docker('ps', '-a', '--filter', `name=${P}-`, '--format', '{{.Names}}').split('\n').filter(Boolean);
async function cleanup() {
  for (const c of everything()) docker('rm', '-f', c);
  docker('network', 'rm', `${P}_default`, `${P}-sablier`);
  for (const img of docker('image', 'ls', '--format', '{{.Repository}}:{{.Tag}}').split('\n').filter(i => /^copilot-(web|agent):[0-9a-f]{12}$/.test(i))) {
    if (fs.existsSync(dir) && fs.readFileSync(path.join(dir, 'tags'), 'utf8').includes(img.split(':')[1])) docker('rmi', img);
  }
  fs.rmSync(dir, { recursive: true, force: true });
}
fs.writeFileSync(path.join(dir, 'tags'), '');
docker('network', 'create', `${P}-sablier`); // the agent's compose file joins the VPS's Sablier network; no Sablier runs here
const remember = (tag: string) => fs.appendFileSync(path.join(dir, 'tags'), `${tag}\n`);
const log = () => fs.existsSync(path.join(dir, 'deploy.log')) ? fs.readFileSync(path.join(dir, 'deploy.log'), 'utf8') : '';

try {
  // 1. release one
  const t1 = commit(); remember(t1);
  console.log(`release one ${t1}: first deploy (builds the images; the first run downloads a few hundred MB)`);
  let d = await deployNow();
  check('release one deploys', d.code === 0 && /deployed /.test(d.out), d.out.slice(-600));
  const a1 = `${P}-agent-${t1}`;
  check('its agent is running and registered with LiveKit', docker('inspect', a1, '--format', '{{.State.Status}}') === 'running' && /registered worker/.test(docker('logs', a1)));

  // a call on release one
  startCall(`${P}-caller1`, `copilot-agent:${t1}`, 300);
  const heard1 = await until('release one hearing the caller', 60, () => (last(`${P}-caller1`)?.release === 'release-1' && (last(`${P}-caller1`)?.heard ?? 0) > 0) && last(`${P}-caller1`));
  check('the first call is heard by release one', !!heard1);

  // 2. release two, while the call is open
  const t2 = commit(); remember(t2);
  const before = last(`${P}-caller1`)?.heard ?? 0;
  const started = Date.now();
  d = await deployNow();
  const took = Math.round((Date.now() - started) / 1000);
  check('release two deploys', d.code === 0 && /deployed /.test(d.out), d.out.slice(-800));
  check('the deploy waited the bound for the open call, then went on', /1 call\(s\) open; waiting up to 20s/.test(log()) && /1 call\(s\) still open after 20s/.test(log()) && took >= 20, log());
  check('the record says so', /deploy [0-9a-f]{12}: wait=gave-up waited=20s calls_at_start=1 calls_at_end=1/.test(log()), log());
  const a2 = `${P}-agent-${t2}`;
  check('release two registered with LiveKit before release one was told to stop', /registered worker/.test(docker('logs', a2)) && /draining agent/.test(log()));
  check('release one is still running, draining, with its restart policy off', docker('inspect', a1, '--format', '{{.State.Status}} {{.HostConfig.RestartPolicy.Name}}') === 'running no' && /draining worker/.test(docker('logs', a1)));
  check('the site is on release two', docker('inspect', `${P}-web`, '--format', '{{.Config.Image}}') === `copilot-web:${t2}`);
  const mid = last(`${P}-caller1`);
  await sleep(6000);
  const after = last(`${P}-caller1`);
  check('the first call is still heard by release one after the deploy', mid?.release === 'release-1' && (after?.heard ?? 0) > (mid?.heard ?? 0) && (mid?.heard ?? 0) > before, JSON.stringify({ before, mid, after }));

  // 3. a new call goes to release two
  startCall(`${P}-caller2`, `copilot-agent:${t2}`, 300);
  const heard2 = await until('release two hearing the second caller', 60, () => (last(`${P}-caller2`)?.release === 'release-2' && (last(`${P}-caller2`)?.heard ?? 0) > 0) && last(`${P}-caller2`));
  check('the next call goes to the new container and is heard', !!heard2, JSON.stringify(last(`${P}-caller2`)));

  // 3b. another deploy while both calls are open: release one is already draining and must not be signalled again (a second
  // SIGTERM makes LiveKit Agents exit at once, with its call); release two, now old, starts to drain
  const t2b = commit(); remember(t2b);
  d = await deployNow();
  check('a deploy while an agent is already draining goes through', d.code === 0 && /deployed /.test(d.out), d.out.slice(-600));
  const mid2 = last(`${P}-caller1`);
  await sleep(5000);
  check('the draining agent was not signalled again: it is still running and its call still heard',
    docker('inspect', a1, '--format', '{{.State.Status}}') === 'running' && (last(`${P}-caller1`)?.heard ?? 0) > (mid2?.heard ?? 0), JSON.stringify({ mid2, now: last(`${P}-caller1`) }));
  check('release two, with a call, drains too and keeps it', docker('inspect', a2, '--format', '{{.State.Status}} {{.HostConfig.RestartPolicy.Name}}') === 'running no' && last(`${P}-caller2`)?.release === 'release-2');

  // 4. the first call ends; release one leaves by itself
  docker('stop', '-t', '15', `${P}-caller1`);
  const gone = await until('release one to exit', 60, () => docker('inspect', a1, '--format', '{{.State.Status}}') === 'exited' && 'exited');
  check('when its call ended, release one exited by itself', !!gone && docker('inspect', a1, '--format', '{{.State.ExitCode}}') === '0', docker('logs', '--tail', '8', a1));
  check('the second call was not touched', last(`${P}-caller2`)?.release === 'release-2');
  docker('stop', '-t', '15', `${P}-caller2`);
  const gone2 = await until('release two to exit', 60, () => docker('inspect', a2, '--format', '{{.State.Status}}') === 'exited' && 'exited');
  check('release two, drained, exited by itself when its call ended', !!gone2 && docker('inspect', a2, '--format', '{{.State.ExitCode}}') === '0');

  // 5. a deploy with no call open
  const t3 = commit(); remember(t3);
  d = await deployNow();
  check('with no call open the deploy does not wait', d.code === 0 && /deploy [0-9a-f]{12}: wait=none waited=0s calls_at_start=0/.test(log().split('\n').filter(l => l.includes(`deploy ${t3}`)).join('\n')) && !/open; waiting/.test(d.out), log());
  check('the finished container of release one was removed', !everything().includes(a1) && /removed finished agent/.test(log()));
} catch (e) {
  check('the sequence ran', false, String((e as Error).stack ?? e));
} finally {
  await cleanup();
}
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
