# TASK-WCP-0025 — After Deploy Replay

<!-- continuity:task {"acceptance":["When `production` moves and Komodo has deployed, the replay cases run against https://copilot.design-bakery.com","The voice test runs against the public URL","An eval span on the deploy is in Phoenix with the outcome"],"depends_on":["WCP-0024"],"goal":"Replay the cases against the live site after each deploy","id":"WCP-0025","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/92","next_action":"Find how GitHub can tell that the deploy has finished","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"A merge doesn't show whether the live site answers right (#92)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0024 (#91)

## Goal

Replay the cases against the live site after each deploy

## Why

A merge doesn't show whether the live site answers right (#92)

## Allowed files

- `.github/workflows/after-deploy.yml`
- `deploy/pro/voice-check.sh`
- `deploy/pro/update.sh`
- `.gitignore`
- `eval/README.md`
- `eval/after-deploy.ts`
- `demo/live-site/tests/voice-call.ts`
- `tasks/TASK-WCP-0025-after-deploy-replay.md`

## Human outcome

After each deploy the owner has a recorded answer to "does the live site still answer right".

## Scope and boundaries

- In scope: detecting a finished deploy, replaying the cases and the voice test against the public URL, an eval span in Phoenix.
- Out of scope: rollback (Komodo does it).
- Dependencies/uncertainty: WCP-0024 (#91)

## Acceptance criteria

- [x] When `production` moves and Komodo has deployed, the replay cases run against https://copilot.design-bakery.com
- [ ] The voice test runs against the public URL (code and Pro script are in; a first run from the Pro is pending)
- [x] An eval span on the deploy is in Phoenix with the outcome

## Evidence and sources

Live spans read from the chatbots workspace on 2026-11-01 (call 7d689fcd-fe99-439c-8350-6305244e2875); parent #88.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #92; parent #88; depends on WCP-0024 (#91); related #17, #12, #13, #15.
- Primary writer / branch: claude-code / `task/WCP-0025-after-deploy-replay` (stacked on #98); source issue open as of 2026-11-01.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
