# TASK-WCP-0118 — Simulated Callers

<!-- continuity:task {"acceptance": ["A copilot_tax domain in eval/tau2", "An agent that forwards each caller line to the shipped desk through eval/target-server.ts and mirrors desk actions as tool calls", "IRS question tasks and form-caller tasks run with LFM3 in the desk slot and an open caller, scored only by code", "tau2 pinned and installed outside the checkout"], "depends_on": [], "goal": "Test the shipped desk with simulated callers in a tau2-bench tax domain", "id": "WCP-0118", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/158", "next_action": "Merge the pull request, then file the desk bugs the run found (spoken email, hyphen read-back, no way out after repeated misses, repeated quotes)", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Our tests used hand-written callers; a tested caller simulator finds what real callers do: vague questions, corrections, frustration (#158)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Test the shipped desk with simulated callers in a τ²-bench tax domain

## Why

Our tests used hand-written callers; a tested caller simulator finds what real callers do: vague questions, corrections, frustration (#158)

## Allowed files

- `eval/tau2/` (new), `eval/target-server.ts` (the `/desk` route), `eval/README.md`
- this task record

## Human outcome

A caller who is vague, corrects the desk or gets annoyed can be simulated many times over, and code says whether the desk quoted word for word, kept the right values and never sent the form.

## Scope and boundaries

- In scope: the domain, the desk adapter, 12 IRS question tasks and 6 form callers, code-only scoring.
- Out of scope: caller verification tasks, persona cards from real calls, the realism gate, voice, and fixing the desk bugs the run found.

## Acceptance criteria

- [x] A `copilot_tax` domain in `eval/tau2`.
- [x] An agent that forwards each caller line to the shipped desk through `eval/target-server.ts` and mirrors desk actions as tool calls.
- [x] IRS question tasks and form-caller tasks run with LFM3 in the desk slot and an open caller, scored only by code.
- [x] tau2 pinned (v2.0.0 commit 989d3285) and installed outside the checkout.

## Evidence and sources

- Full run, 18 tasks, LFM3 on the Pro, caller nvidia/nemotron-3.5-super-vl:free: 11 passed. Failures: 3 form callers (spoken email kept as "siobhan...oc" or without ".e"; a hyphen dropped in the spelled read-back; the desk repeats the same wrong read-back with no offer to type or skip), 4 questions (wrong page cited, the same quote repeated instead of saying it can't find the list, and one over-strict quote check of mine, since fixed).
- After the fix, the three question tasks rerun: 3 of 3 passed.
- `npm run check` passes (exit 0; 337 tests, none failing).

## Related records

- Leaf: #158. Parent: none. Related: reports/Realistic simulated callers and datasets.md, build order step 1.
- Primary writer: Claude Code session for the owner / branch `feat/158-tau2-tax-domain` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.

### 2026-11-05 05:25:23 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["eval/tau2/, eval/target-server.ts, eval/README.md"],"completed":["Simulated callers from tau2-bench now call the shipped desk with LFM3, and code scores quotes, form values, read-backs and never sending (#158)"],"decisions":["The agent under test is our desk, not a bare model; form callers use ten-digit phones because the desk rightly asks for an area code"],"evidence":["Full run 11 of 18 passed; the failures are real desk bugs plus one over-strict quote check, since fixed (rerun 3 of 3); npm run check exit 0, 337 tests passing"],"next_action":"Merge the pull request, then file the desk bugs the run found","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0118","timestamp":"2026-11-05T05:25:23Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"be54b3a608621726e00ee871d2103d1c0a60385bd75c0d7ff22b0284d935030c","request_id":"50cbe2ab998a4fbbaa108f69f3aa8130","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0118"} -->

Completed:
- Simulated callers from tau2-bench now call the shipped desk with LFM3, and code scores quotes, form values, read-backs and never sending (#158)

Evidence:
- Full run 11 of 18 passed; the failures are real desk bugs plus one over-strict quote check, since fixed (rerun 3 of 3); npm run check exit 0, 337 tests passing

Decisions:
- The agent under test is our desk, not a bare model; form callers use ten-digit phones because the desk rightly asks for an area code

Changed:
- eval/tau2/, eval/target-server.ts, eval/README.md

Blocked/uncertain:
- none

Next:
- Merge the pull request, then file the desk bugs the run found
