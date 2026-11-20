# TASK-WCP-0126 — Recording Queue

<!-- continuity:task {"acceptance":["A recording published while the site is down is saved once the site is back","A save that fails with 5xx stays queued and is saved later by whichever site process runs then","A recording the site will never accept is dropped at once and logged","Saved recordings leave Redis","With Redis unreachable the site starts, serves and stops cleanly, and the agent posts the recording directly"],"depends_on":[],"goal":"A finished call's recording waits in a Redis stream until the site has saved it","id":"WCP-0126","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/186","next_action":"Read the first CI run on a real Redis, then write the TLA+ model and property tests before the pull request leaves draft","owner":"Claude","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The agent posts a recording once and keeps no copy, so a call that ends during a deploy or a key-store outage loses its recording"} -->

- Status: active
- Owner: Claude
- Priority: P1
- Depends on: none

## Goal

A finished call's recording waits in a Redis stream until the site has saved it

## Why

The agent posts a recording once and keeps no copy, so a call that ends during a deploy or a key-store outage loses its recording

## Allowed files

- `demo/live-site/recording-queue.ts`, `demo/live-site/server.ts`, `demo/live-site/tests/recording-queue.test.ts`
- `demo/live-site/speech/agent.py`, `recording.py`, `requirements.txt`, `tests/test_recording.py`
- `deploy/docker-compose.vps.yml`, `deploy/docker-compose.agent.yml`, `deploy/agent-requirements.txt`, `deploy/README.md`
- `demo/live-site/package.json` and its lockfile, the root `package.json`, `.github/workflows/ci.yml`

## Human outcome

A business that records its calls keeps the recording of a call that ended while the copilot's site was restarting or could not reach its key store.

## Scope and boundaries

- In scope: the Redis stream between the voice agent and the site, its worker, the `redis` service in the VPS compose file, tests, and the deploy notes.
- Out of scope: call-record entries and traces, which are written during the call; any other use of Redis.
- Dependencies/uncertainty: none on other tasks. The worker has run against a stand-in Redis only; the first run on a real Redis is this pull request's CI. server-management's `vps/services.toml` needs a `copilot-redis` entry before the merge.

## Acceptance criteria

- [ ] A recording published while the site is down is saved once the site is back.
- [ ] A save that fails with 5xx stays queued and is saved later by whichever site process runs then.
- [ ] A recording the site will never accept is dropped at once and logged.
- [ ] Saved recordings leave Redis.
- [ ] With Redis unreachable the site starts, serves and stops cleanly, and the agent posts the recording directly.

## Evidence and sources

The gap was read in `demo/live-site/speech/agent.py` (`send_audio`) on `production` at 702f25a on 2026-11-20: one post, no retry, and a 502 or 503 answer logged as sent. No lost recording was looked for in the VPS logs.

On the branch, 2026-11-20: `npm run check` exits 0. The worker's five tests against a stand-in stream pass. The publisher's two tests against fakeredis pass. By hand, the Python publisher and the Node worker passed a 2 KB recording through fakeredis's TCP server: a 503 save stayed pending, was not retried early, was claimed by a second consumer and saved, and the stream ended empty. That server drops connections on a 1 MB message and after an error reply, so large recordings and the group-already-exists path are covered only by the two real-Redis tests, which CI runs.

## Reproduction details (only when needed)

Not needed.

## Related records

- Required leaf owning issue, parent ancestry and dependencies (or explicitly none): pukujan-lab-2/voice-agent-research#186 is the leaf; parent: none; dependencies: none.
- Primary writer / branch / source issue revision / as-of status: Claude (owner-directed) / `task/186-recording-queue` / #186 as opened 2026-11-20 / in progress, pull request in draft.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
