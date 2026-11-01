# TASK-WCP-0020 — Deploy the lab from a production branch

<!-- continuity:task {"acceptance": ["Moving production deploys the VPS stack within about 5 minutes, built from the commit and rolled back if its health check fails", "The VPS runs the site and backend, LiveKit and the voice agent; text chat uses the Pro's LFM3", "The Pro's speech server serves all five stacks to the VPS through a reverse SSH tunnel and updates itself from production", "https://copilot.design-bakery.com serves the site, with LiveKit signalling through the same hostname", "Keys live in an env file on the VPS, never in git", "Decision 0015 replaces 0007; Komodo resources and vps/PLAN.md updated in server-management"], "depends_on": [], "goal": "The lab deploys itself to the VPS when the production branch moves", "id": "WCP-0020", "next_action": "Merge, push production, and check the live site", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The demo only ran on the owner's Mac, so nobody could try it from a phone or another computer (#84)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

The lab deploys itself to the VPS when the `production` branch moves.

## Why

The demo only ran on the owner's Mac at 127.0.0.1:8787, so nobody could try it from a phone or another computer. The owner asked for it all deployed, from a branch that deploys by itself (#84).

## Allowed files

- `deploy/` (new), `.dockerignore` (new), `.gitignore`
- `demo/live-site/server.ts` (LiveKit's public address and `/rtc` pass-through, the visitor's address behind the tunnel)
- `docs/decisions/0015-production-branch-deploys.md` (new), `docs/decisions/0007-not-hosted-yet.md`, `docs/decisions/README.md`
- `PROJECT.md` (status table)
- `tasks/TASK-WCP-0020-production-deploy.md`

## Human outcome

Anyone opens https://copilot.design-bakery.com on a phone or computer and talks to the copilot by text or voice. The owner deploys with `git push origin main:production`.

## Scope and boundaries

- In scope: the images, the compose file, the VPS and Pro deploy scripts, the Komodo resources, the decision.
- Out of scope: phone calls (SIP), businesses stored on the server, more than one VPS.

## Acceptance criteria

- [x] Images build on the VPS and the site comes up live (smoke run).
- [ ] Moving `production` deploys it through Komodo.
- [ ] The Pro serves all five stacks to the VPS.
- [ ] https://copilot.design-bakery.com serves the site and a voice call connects.
- [x] Keys only in `~/apps/copilot.env` on the VPS.
- [ ] Komodo resources and `vps/PLAN.md` merged in server-management.

## Evidence and sources

- Test build on the VPS, 2026-11-01: both images built, and `copilot-web` answered `/api/health` with `{"ok":true,"mode":"live"}`.

## Related records

- Leaf #84; parent none; depends on none; related #82, decisions 0002, 0007, 0014, 0015.
- Primary writer / branch: claude-code / `feat/84-production-deploy`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 08:59:26 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["The lab had no deploy path; deploy/ now builds the site, LiveKit and the voice agent on the VPS from the production branch, with the speech models on the Pro behind a reverse tunnel (decision 0015 replaces 0007)"],"decisions":["no new decisions"],"evidence":["npm run check passes; both images built on the VPS and copilot-web answered /api/health live"],"next_action":"Merge, push production and check https://copilot.design-bakery.com","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0020","timestamp":"2026-11-01T08:59:26Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"20a2ee0ac5dff73326684b98eaf46835a34756cddd0ccfd7606f85db7fafa4d6","request_id":"fba004de222845dfbf2d40a603ecd121","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0020"} -->

Completed:
- The lab had no deploy path; deploy/ now builds the site, LiveKit and the voice agent on the VPS from the production branch, with the speech models on the Pro behind a reverse tunnel (decision 0015 replaces 0007)

Evidence:
- npm run check passes; both images built on the VPS and copilot-web answered /api/health live

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Merge, push production and check https://copilot.design-bakery.com

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
