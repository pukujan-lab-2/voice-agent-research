# TASK-WCP-0027 — Conversation Quality

<!-- continuity:task {"acceptance":["A vague question (\"How do I find my taxes?\") is asked back with one question instead of quoted", "The judge keeps a pick whose own probability clearly beats \"none\" (0.70 vs 0.26 in call 7d689fcd) and the judge span records Jev's probabilities and errors", "An answer is worded naturally with one follow-up, and offers the matching site form when the visitor wants to do the thing", "The same passage is not repeated for a different question without saying so", "\"Yeah\" and \"is it gonna take long?\" refer to the last topic or ask what is meant, with no invented flows", "Held-out judge numbers do not get worse; tests replay the call; `npm run check` passes"],"depends_on":[],"goal":"Fix the tax demo copilot's conversation quality","id":"WCP-0027","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/99","next_action":"Merge, move production, and check the live traces","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner found the tax demo still too dumb in a voice call (#99)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Fix the tax demo copilot's conversation quality

## Why

The owner found the tax demo still too dumb in a voice call (#99)

## Allowed files

- `copilot-engine/src/dialogue.ts`
- `copilot-engine/src/guide.ts`
- `copilot-engine/src/desk.ts`
- `copilot-engine/tests/dialogue.test.ts`
- `copilot-engine/tests/judge-rule.test.ts`
- `copilot-engine/package.json`
- `demo/live-site/api.ts`
- `demo/live-site/build.ts`
- `demo/live-site/widget/sdk.ts`
- `demo/live-site/widget/remote.ts`
- `demo/live-site/app/src/lib/copilot.ts`
- `demo/live-site/tests/judge-trace.test.ts`
- `eval/lib/target.ts`
- `eval/judge-rule.ts`
- `eval/clarify-rate.ts`
- `eval/tests/conversation.test.ts`
- `eval/out/irs/judge-rule.json`
- `eval/out/irs/clarify-rate.json`
- `eval/README.md`
- `package.json`
- `PROJECT.md`
- `tasks/TASK-WCP-0027-conversation-quality.md`

## Human outcome

A visitor who asks something vague gets a question back, a question the guides can answer gets its answer instead of "I don't know", and "I want to file" ends with an offer to start the form on the site.

## Scope and boundaries

- In scope: the tax demo's question desk: judge rule and its trace, clarifying questions, wording and follow-up, repeats, short answers, tests that replay call 7d689fcd.
- Out of scope: model changes or comparisons, the live-traces-to-tests loop (#88, another session; its replay cases are read, its files are not edited), voice stacks.
- Dependencies/uncertainty: none. Parent: none (top-level). Related: #12, #16, #88.

## Acceptance criteria

- [ ] A vague question ("How do I find my taxes?") is asked back with one question instead of quoted
- [ ] The judge keeps a pick whose own probability clearly beats "none" (0.70 vs 0.26 in call 7d689fcd) and the judge span records Jev's probabilities and errors
- [ ] An answer is worded naturally with one follow-up, and offers the matching site form when the visitor wants to do the thing
- [ ] The same passage is not repeated for a different question without saying so
- [ ] "Yeah" and "is it gonna take long?" refer to the last topic or ask what is meant, with no invented flows
- [ ] Held-out judge numbers do not get worse; tests replay the call; `npm run check` passes

## Evidence and sources

Phoenix traces of the owner's call, 2026-11-01 17:10-17:12 UTC, session 7d689fcd (fixture `eval/tests/fixtures/call-7d689fcd.json`). Held-out numbers: `eval/out/irs/judge-rule.json` and `eval/out/irs/clarify-rate.json`.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #99 (https://github.com/Pukujan-lab/voice-agent-research/issues/99); parent: none; dependencies: none.
- Primary writer claude-code / branch `task/WCP-0027-conversation-quality` / issue open as of 2026-11-01. The installed `continuity worktree create` refused (it expects worktrees inside the checkout, the layout the sibling sessions' trees do not use), so the tree was made with `git worktree add` at `../worktrees/WCP-0027`.
- Related PR/CI evidence and push receipt (request ID / SHA):

## Checkpoint log

No checkpoints yet.

### 2026-11-01 18:13:53 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/dialogue.ts, copilot-engine/src/guide.ts, demo/live-site/widget/sdk.ts, demo/live-site/api.ts, eval/lib/target.ts, tests"],"completed":["The tax copilot asked nothing back and dropped a right answer at a 0.25 cut-off; it now asks vague questions back, keeps a pick that clearly beats none, words answers with one follow-up and offers the site form."],"decisions":["Pick stands when Jev's own probability is at least 0.65 and 0.35 above none; a looser 0.5/0.3 let one unanswerable question through."],"evidence":["npm run check passed (73 engine tests, 20 eval and live-site tests, 8 scenarios). Held-out: right passage 139 of 200 either way, made-up answers 3 of 100 either way; vague questions asked back 35 of 100 (0 before), clear ones 4 of 200."],"next_action":"Open the pull request, merge, move production, replay the call on the live site and check Phoenix.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0027","timestamp":"2026-11-01T18:13:53Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7c351869a230eddadaa198d22d7be6f2b590fd6d8a09ee2ea2706e60a4a62433","request_id":"bdf590b4e4744ac6bb158dadef3e68c4","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0027"} -->

Completed:
- The tax copilot asked nothing back and dropped a right answer at a 0.25 cut-off; it now asks vague questions back, keeps a pick that clearly beats none, words answers with one follow-up and offers the site form.

Evidence:
- npm run check passed (73 engine tests, 20 eval and live-site tests, 8 scenarios). Held-out: right passage 139 of 200 either way, made-up answers 3 of 100 either way; vague questions asked back 35 of 100 (0 before), clear ones 4 of 200.

Decisions:
- Pick stands when Jev's own probability is at least 0.65 and 0.35 above none; a looser 0.5/0.3 let one unanswerable question through.

Changed:
- copilot-engine/src/dialogue.ts, copilot-engine/src/guide.ts, demo/live-site/widget/sdk.ts, demo/live-site/api.ts, eval/lib/target.ts, tests

Blocked/uncertain:
- none

Next:
- Open the pull request, merge, move production, replay the call on the live site and check Phoenix.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
