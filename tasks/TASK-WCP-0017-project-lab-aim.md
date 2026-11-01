# TASK-WCP-0017 — PROJECT.md states the lab aim

<!-- continuity:task {"acceptance":["PROJECT.md's opening states the owner's aim: a lab for smart, scalable AI copilot agents built as modules with versions to test, pick and choose, with voice first class, adopted by other apps, websites and customers","PROJECT.md states the main goal: a voice call inside a website does everything, so no one has to explore the site or click buttons","PROJECT.md has a rule that every module and model is swappable per task by the owner, a business or a visitor"],"depends_on":[],"goal":"PROJECT.md states the lab aim and the swappable-module rule","id":"WCP-0017","next_action":"Open the pull request and arm auto-merge","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The owner expanded the project into a lab of swappable modules with voice first class, and PROJECT.md still describes one website copilot (#75)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

PROJECT.md states the lab aim and the swappable-module rule.

## Why

On 2026-11-01 the owner expanded the project: it is a lab for smart, scalable copilot agents, built as modules with versions that can all be tested and picked, with voice a first-class feature, and other apps, websites and customers adopt it. PROJECT.md still describes a single website copilot (#75).

## Allowed files

- `PROJECT.md`
- `tasks/TASK-WCP-0017-project-lab-aim.md`

## Human outcome

Anyone, person or agent, who reads PROJECT.md learns the real aim and that no model is hard-wired.

## Scope and boundaries

- In scope: PROJECT.md's opening and one new rule.
- Out of scope: code, decisions, the decision-model work (#74) and multimodal work (#73).

## Acceptance criteria

- [x] PROJECT.md's opening states the lab aim, modules with versions, voice first class, and adopters.
- [x] PROJECT.md states the main goal: a voice call inside the website replaces exploring it and clicking buttons.
- [x] PROJECT.md rule 8 says every module is swappable per task.

## Evidence and sources

- The owner's words, quoted on [#75](https://github.com/Pukujan-lab/voice-agent-research/issues/75).

## Related records

- Leaf #75; parent none; depends on none; related #73, #74, decision 0012.
- Primary writer / branch: claude-code / `docs/project-lab-aim`; source issue open as of 2026-11-01.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 07:59:08 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["none"],"completed":["PROJECT.md states the lab aim (modules with versions, voice first class, adopters), the main goal that a voice call replaces exploring a site, and rule 8 that every module is swappable"],"decisions":["no new decisions"],"evidence":["npm run check passes (engine tests 8/8); commits 5df9f29 and 28686a2"],"next_action":"Open the pull request with Closes #75 and arm auto-merge","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0017","timestamp":"2026-11-01T07:59:08Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"7b49fff9afbe2febf299aeddd45a5536732f764fb82c92c9d20d96bdd5b08bfc","request_id":"f6b06207db7048cba44b0b5fa356194a","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0017"} -->

Completed:
- PROJECT.md states the lab aim (modules with versions, voice first class, adopters), the main goal that a voice call replaces exploring a site, and rule 8 that every module is swappable

Evidence:
- npm run check passes (engine tests 8/8); commits 5df9f29 and 28686a2

Decisions:
- no new decisions

Changed:
- none

Blocked/uncertain:
- none

Next:
- Open the pull request with Closes #75 and arm auto-merge

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
