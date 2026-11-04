# TASK-WCP-0042 — Business Config

<!-- continuity:task {"acceptance":["A business's config is stored in Octo by business and loaded on demand through a bounded cache","/api/desk refuses a voice stack the business does not allow","Two businesses with the same session ids and page paths never read each other's config or snapshot (test)","A page can mount with only its business id"],"depends_on":[],"goal":"Each business's copilot config is stored in Octo and loaded on demand","id":"WCP-0042","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/103","next_action":"Merge the pull request, then start the large-site form index (#104)","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The page sends the whole config with requests, so the server can't enforce a business's allowed voice stacks and a big config rides every request (#103)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Each business's copilot config is stored in Octo and loaded on demand

## Why

The page sends the whole config with requests, so the server can't enforce a business's allowed voice stacks and a big config rides every request (#103)

## Allowed files

- `copilot-engine/src/site-config.ts`, `copilot-engine/tests/site-config.test.ts`, `copilot-engine/package.json`
- `demo/live-site/api.ts`, `widget/sdk.ts`, `widget/remote.ts`, `tools/site-config.ts`, `package.json`, `tests/state.test.ts`
- `docs/scaling-limits.md`
- `tasks/TASK-WCP-0042-business-config.md`

## Human outcome

A business's settings live on the server, so a large site sends only its id and the server can hold each call to what that business allows.

## Scope and boundaries

- In scope: the config table and loader, the endpoint, the stack check, the widget's remote mount, a put tool, tests, limits doc.
- Out of scope: an admin UI; per-form storage (#104).
- Dependencies/uncertainty: stacked on #102's branch.

## Acceptance criteria

- [ ] Config stored and loaded by business; cache bounded.
- [ ] Stack check on /api/desk.
- [ ] Isolation test between two businesses.

## Evidence and sources

Observed 2026-11-01: SiteConfigs put, get and remove against the live Octo workspace on a scratch table (dropped afterwards).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #103; parent #100; depends on #102.
- Primary writer claude-code / `task/WCP-0042-business-config`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
