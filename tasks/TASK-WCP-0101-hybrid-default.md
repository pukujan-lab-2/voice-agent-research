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

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
