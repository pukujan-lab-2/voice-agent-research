# TASK-WCP-0101 — Hybrid Default

<!-- continuity:task {"acceptance":["An ordinary visitor's hard desk turn escalates to DeepSeek with no sign-in, dev host or opt-in; ordinary turns and all voice stay on LFM3","LFM3's answer stands whenever DeepSeek is unavailable (cap, expired lease, routes exhausted, timeout) — the caller never sees an error","DESK_HYBRID=0 turns the escalation off explicitly","Every desk span carries what answered; deploy/README.md and the amended decision 0017 describe the new default","Tests: a visitor's escalation hits the InferHub path; each fallback condition lands on LFM3; no secret in any response"],"depends_on":[],"goal":"Make the DeepSeek hybrid the default for visitors: LFM3 answers and talks, DeepSeek takes the hard turns","id":"WCP-0101","issue_url":"https://github.com/pukujan-lab-2/voice-agent-research/issues/101","next_action":"implement the server changes, then run the checks","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"Owner direction: 'no opt in, theyre the default, lfm 3 is for development' and 'i thought we had hybrid where deepseek does harder tasks why lfm handles basic tasks and talking' (#101, parent #77)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Make the DeepSeek hybrid the default for visitors: LFM3 answers and talks, DeepSeek takes the hard turns

## Why

The hybrid built in #79 was dev-only (scope-gated); the owner expected it to be the default and asked where it went (#101, parent #77).

## Allowed files

- `demo/live-site/smart.ts`
- `demo/live-site/api.ts`
- `demo/live-site/widget/remote.ts`
- `demo/live-site/tests/smart-desk.test.ts`
- `demo/live-site/tests/brain-picker.test.ts`
- `deploy/README.md`
- `docs/decisions/0017-smart-model-slots-for-development.md`
- `PROJECT.md`
- `tasks/TASK-WCP-0101-hybrid-default.md`

## Human outcome

Every visitor gets the smarter answer on hard turns automatically; nobody has to sign in, and a DeepSeek outage changes nothing they can see.

## Scope and boundaries

- In scope: the default-on hybrid, the scope retirement for the escalation path (cap, key health and the model allow-list stay), docs, decision amendment.
- Out of scope: the "smart-always" picker option (every turn stays an owner-only reach), the voice stacks, new providers.
- Dependencies/uncertainty: the daily cap value stays at the shipped default until the owner names a ceiling.

## Acceptance criteria

- [ ] An ordinary visitor's hard desk turn escalates to DeepSeek with no sign-in, dev host or opt-in; ordinary turns and all voice stay on LFM3
- [ ] LFM3's answer stands whenever DeepSeek is unavailable (cap, expired lease, routes exhausted, timeout) — the caller never sees an error
- [ ] `DESK_HYBRID=0` turns the escalation off explicitly
- [ ] Every desk span carries what answered; deploy/README.md and the amended decision 0017 describe the new default
- [ ] Tests: a visitor's escalation hits the InferHub path; each fallback condition lands on LFM3; no secret in any response

## Related records

- Leaf #101; parent #77; depends on #78, #79, #89, #97 (all merged).
- Primary writer / branch: workbuddy / `task/WCP-0101-hybrid-default`.
- Related PR/CI evidence and push receipt: none yet.

## Checkpoint log

No checkpoints yet.

### 2026-11-02 20:14:02 UTC — workbuddy

<!-- continuity:checkpoint {"agent":"workbuddy","blocked":[],"changed":["none"],"completed":["The DeepSeek hybrid is the default for every visitor: LFM3 answers ordinary turns and does the talking, a hard desk turn escalates to the desk slot's smart model (InferHub DeepSeek V4.1 Flash with its vendor-route fallbacks) with no sign-in or opt-in; DESK_HYBRID=0 turns it off, smart-always stays owner/dev-host only, the voice stacks never touch a hosted model. Decision 0017 amended, deploy README and picker labels updated"],"decisions":["no new decisions"],"evidence":["27 smart-desk and brain-picker tests pass; lint and typecheck clean on changed files; scenarios 8/8; replay gate ok; 147/148 overall with only the pre-existing pglite machine failure identical to main"],"next_action":"Push the branch, open the pull request with Closes #101, and confirm the VPS env has the desk slot set (SLOT_DESK_PROVIDER=inferhub, SLOT_DESK_MODEL=deepseek-v4.1-flash) plus INFERHUB_API_KEY so the default has something to escalate to","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0101","timestamp":"2026-11-02T20:14:02Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"929536c61737c78bd593b086464d69cd0d8e4894b380d3c072b5a936c2f65634","request_id":"8f43619cc49a449db50251c00732200b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0101"} -->

Completed:
- The DeepSeek hybrid is the default for every visitor: LFM3 answers ordinary turns and does the talking, a hard desk turn escalates to the desk slot's smart model (InferHub DeepSeek V4.1 Flash with its vendor-route fallbacks) with no sign-in or opt-in; DESK_HYBRID=0 turns it off, smart-always stays owner/dev-host only, the voice stacks never touch a hosted model. Decision 0017 amended, deploy README and picker labels updated

Evidence:
- 27 smart-desk and brain-picker tests pass; lint and typecheck clean on changed files; scenarios 8/8; replay gate ok; 147/148 overall with only the pre-existing pglite machine failure identical to main

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Push the branch, open the pull request with Closes #101, and confirm the VPS env has the desk slot set (SLOT_DESK_PROVIDER=inferhub, SLOT_DESK_MODEL=deepseek-v4.1-flash) plus INFERHUB_API_KEY so the default has something to escalate to

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
