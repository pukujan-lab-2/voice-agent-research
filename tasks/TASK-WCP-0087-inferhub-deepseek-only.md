# TASK-WCP-0087 — Inferhub Deepseek Only

<!-- continuity:task {"acceptance":["litellm is gone and inferhub takes only deepseek-v4.1-flash or its vendor routes","A smart call walks the vendor routes on 402, 429, 5xx and timeouts, then the local answer stands","A missing, rejected or expired key fails closed with a log line and an error span","deploy/README.md documents routes, the 30-day lease, renewal and spend"],"depends_on":[],"goal":"Slots call InferHub's DeepSeek V4.1 Flash only, through the vault lease, with fallbacks","id":"WCP-0087","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/89","next_action":"Merge, set the VPS env from the lease, deploy, live call, update the table on #77","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Owner direction: direct InferHub, one model, a 30-day vault lease that must fail closed (#89, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Slots call InferHub's DeepSeek V4.1 Flash only, through the vault lease, with fallbacks

## Why

Owner direction: direct InferHub, one model, a 30-day vault lease that must fail closed (#89, parent #77)

## Allowed files

- `copilot-engine/src/slots.ts`
- `copilot-engine/src/desk.ts`
- `copilot-engine/tests/slots.test.ts`
- `demo/live-site/smart.ts`
- `demo/live-site/api.ts`
- `demo/live-site/server.ts`
- `demo/live-site/widget/remote.ts`
- `demo/live-site/tests/smart-desk.test.ts`
- `eval/lib/llm.ts`
- `eval/tests/drafts.test.ts`
- `eval/README.md`
- `deploy/README.md`
- `docs/decisions/0017-smart-model-slots-for-development.md`
- `tasks/TASK-WCP-0087-inferhub-deepseek-only.md`

## Human outcome

The only hosted model a slot can use is DeepSeek V4.1 Flash on InferHub, with the vendor routes tried in order, and an expired lease can never break a call.

## Scope and boundaries

- In scope: dropping `litellm`, the one-model allow-list for `inferhub`, route fallbacks, the fail-closed key, docs.
- Out of scope: any other InferHub model, the full vault grant, minting a lease.
- Dependencies/uncertainty: depends on #78 and #80 (merged); the lease expires 30 days after it was minted.

## Acceptance criteria

- [ ] litellm is gone and inferhub takes only deepseek-v4.1-flash or its vendor routes
- [ ] A smart call walks the vendor routes on 402, 429, 5xx and timeouts, then the local answer stands
- [ ] A missing, rejected or expired key fails closed with a log line and an error span
- [ ] deploy/README.md documents routes, the 30-day lease, renewal and spend

## Evidence and sources

Owner direction relayed by the session that started this work ("directly inferhub no litellm", "only limit inferhub to deepseek v4.1 flash", approval of the vault lease). InferHub's `/v1/models` lists `deepseek-v4.1-flash` and the vendor routes `cb/`, `cbcn/`, `ali/`, `ocg/` (checked 2026-11-02). Supersedes TASK-WCP-0086's model rule (DeepSeek or Qwen).

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #89; parent #77; depends on #78 and #80 (merged).
- Primary writer / branch: claude-code / `task/WCP-0087-inferhub-only`; source issue open as of 2026-11-02.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
