# TASK-WCP-0014 — The copilot call widget redesigned and its page actions easy to follow

<!-- continuity:task {"acceptance":["Widget, chat panel and on-page activity are readable on desktop and phone","Scene and voice tests pass","Matches the new demo design system"],"depends_on":[],"goal":"The copilot call widget redesigned and its page actions easy to follow","id":"WCP-0014","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/65","next_action":"none; delivered in #68 and merged as da521b8; the harness voice path moved to #69","owner":"owner","priority":"P1","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"completed","why":"The owner finds the widget bad and its activity view too small"} -->

- Status: completed
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

The copilot call widget redesigned and its page actions easy to follow.

## Why

The owner finds the widget bad and its activity view too small (#65).

## Related records

- Leaf #65; parent none; depends on none.
- Primary writer / branch: claude-code / task/WCP-0014-widget-redesign.

## Delivery

- Delivered in pull request #68, merged as `da521b8` on 2026-11-01 06:46 UTC from pushed head `f9ef518`.
- Checks on merged `main`: `npm run check` passed (49 engine tests, 8 of 8 scenarios); the layout scene passed at 390×664, 375×560, 360×640 and 1280×800, including the two-row phone bar that used to push "Type instead" outside the screen.
- Issue #65 closed as completed with the evidence in [the delivery comment](https://github.com/Pukujan-lab/voice-agent-research/issues/65#issuecomment-6554681039).
- Its "voice tests pass" acceptance transferred to #69: a call runs on LiveKit and needs a microphone that headless Chromium refuses, so the voice scene cannot run and a full offline run stops there.

## Checkpoint log

No checkpoints yet.

### 2026-11-01 05:41:12 UTC — codex

<!-- continuity:checkpoint {"agent":"codex","blocked":["The voice stack pull request is still open; desktop and phone call panel verification remains."],"changed":["demo/live-site/app/src/components/copilot/CopilotWidget.tsx, demo/live-site/app/src/styles/copilot-view.css, demo/live-site/app/src/main.tsx"],"completed":["Enlarged the call panel and improved the active field highlight and keyboard focus."],"decisions":["no new decisions"],"evidence":["Repository checks and React build passed; offline scenes passed 97 of 99 checks, with the same two lookup failures on unchanged main."],"next_action":"Reconcile with the voice stack changes and review the panel on desktop and phone.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0014","timestamp":"2026-11-01T05:41:12Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"562a9c371ee553dce8c5fd2c58ede73e8104b18ad826636ef053cc8d2ae390d9","request_id":"67d6c7baf0524b418cc0eb4a6a8a26e5","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0014"} -->

Completed:
- Enlarged the call panel and improved the active field highlight and keyboard focus.

Evidence:
- Repository checks and React build passed; offline scenes passed 97 of 99 checks, with the same two lookup failures on unchanged main.

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src/components/copilot/CopilotWidget.tsx, demo/live-site/app/src/styles/copilot-view.css, demo/live-site/app/src/main.tsx

Blocked/uncertain:
- The voice stack pull request is still open; desktop and phone call panel verification remains.

Next:
- Reconcile with the voice stack changes and review the panel on desktop and phone.

### 2026-11-01 05:50:35 UTC — codex

<!-- continuity:checkpoint {"agent":"codex","blocked":["Phone layout and full scene checks remain; the baseline has two offline document lookup failures."],"changed":["demo/live-site/app/src/components/copilot/CopilotWidget.tsx, demo/live-site/app/src/styles/copilot-view.css"],"completed":["Reconciled the widget redesign with the merged voice controls."],"decisions":["no new decisions"],"evidence":["Repository checks and the React build passed after merging the voice changes; the earlier desktop preview showed the enlarged panel and active field."],"next_action":"Inspect the merged call panel at phone width and finish the widget review.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0014","timestamp":"2026-11-01T05:50:35Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"c1545929236f16b60d492c530d52616cc6f4ed05489077254070be8d538c3024","request_id":"1386925ab070432faaadd481b8998314","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0014"} -->

Completed:
- Reconciled the widget redesign with the merged voice controls.

Evidence:
- Repository checks and the React build passed after merging the voice changes; the earlier desktop preview showed the enlarged panel and active field.

Decisions:
- no new decisions

Changed:
- demo/live-site/app/src/components/copilot/CopilotWidget.tsx, demo/live-site/app/src/styles/copilot-view.css

Blocked/uncertain:
- Phone layout and full scene checks remain; the baseline has two offline document lookup failures.

Next:
- Inspect the merged call panel at phone width and finish the widget review.

### 2026-11-01 06:44:40 UTC — workbuddy

<!-- continuity:checkpoint {"agent":"workbuddy","blocked":["The voice checks need a real microphone and the LiveKit stack, which a headless run does not have; the scene harness still stubs browser speech from before #61."],"changed":["demo/live-site/app/src/styles/copilot-view.css, demo/live-site/app/src/components/copilot/CopilotWidget.tsx, demo/live-site/app/src/main.tsx"],"completed":["Rebuilt the call widget on the shared design system: paper, ink and clay with the site's own accent on the primary button and the caller's bubbles, a 392px compact corner window that keeps every control in view, an expanded conversation at 1rem, and a caption that shows the copilot's question instead of a read-back cut off mid-sentence. On a phone the start bar is now two rows, so the pickers no longer push Type instead off the screen."],"decisions":["Compact stays a small corner window and the conversation is what expands, because the widget sits on a page a visitor is reading."],"evidence":["npm run check passes. Offline scenes: 151 checks pass, including all three phone sizes for the typing path that used to crash the layout scene on an unclickable Type instead button. Three voice checks per phone size and the voice scene still fail: a call now runs on LiveKit and needs a real microphone, so headless the widget falls back to typing and there is no spoken question or highlighted field."],"next_action":"Add a voice path to the scene harness that can drive a LiveKit call, so the three phone voice checks and the voice scene can run.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0014","timestamp":"2026-11-01T06:44:40Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"0b7bd23cc4b3e7a0dc153c5a5358f8bc2a362435b3cbdf88afb16cd3c2f3065b","request_id":"760f52bec5924df1bcb7af50b4291ace","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0014"} -->

Completed:
- Rebuilt the call widget on the shared design system: paper, ink and clay with the site's own accent on the primary button and the caller's bubbles, a 392px compact corner window that keeps every control in view, an expanded conversation at 1rem, and a caption that shows the copilot's question instead of a read-back cut off mid-sentence. On a phone the start bar is now two rows, so the pickers no longer push Type instead off the screen.

Evidence:
- npm run check passes. Offline scenes: 151 checks pass, including all three phone sizes for the typing path that used to crash the layout scene on an unclickable Type instead button. Three voice checks per phone size and the voice scene still fail: a call now runs on LiveKit and needs a real microphone, so headless the widget falls back to typing and there is no spoken question or highlighted field.

Decisions:
- Compact stays a small corner window and the conversation is what expands, because the widget sits on a page a visitor is reading.

Changed:
- demo/live-site/app/src/styles/copilot-view.css, demo/live-site/app/src/components/copilot/CopilotWidget.tsx, demo/live-site/app/src/main.tsx

Blocked/uncertain:
- The voice checks need a real microphone and the LiveKit stack, which a headless run does not have; the scene harness still stubs browser speech from before #61.

Next:
- Add a voice path to the scene harness that can drive a LiveKit call, so the three phone voice checks and the voice scene can run.

### 2026-11-01 06:58:32 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["checkpoints/CURRENT.md, tasks/TASK-WCP-0013-demo-sites-redesign.md, tasks/TASK-WCP-0014-widget-redesign.md, copilot-engine/ledger.jsonl"],"completed":["The owner found the demo plain and the call panel too small; both redesigns are now merged and the two issues that asked for them are closed with their evidence, so no task stays active after its merge."],"decisions":["no new decisions"],"evidence":["Merged main da521b8 passes npm run check (lint, Python lint, typecheck, orphan check, 49 engine tests, 8 of 8 engine scenarios) and npm run build including the copilot contract check; the layout scene passes at 390x664, 375x560, 360x640 and 1280x800; a full offline run still stops in the voice scene, now issue #69."],"next_action":"Make the offline scene suite skip its voice scene with a printed reason and count it in the summary (#69), then run a full offline suite before the next demo change.","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0014","timestamp":"2026-11-01T06:58:32Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"9f947e94fe55637f61e6d7ec26c5c7126f93a2a31be79da4f57478561bfe0cf4","request_id":"1a2058753a1a438da62871c74b19cb17","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0014"} -->

Completed:
- The owner found the demo plain and the call panel too small; both redesigns are now merged and the two issues that asked for them are closed with their evidence, so no task stays active after its merge.

Evidence:
- Merged main da521b8 passes npm run check (lint, Python lint, typecheck, orphan check, 49 engine tests, 8 of 8 engine scenarios) and npm run build including the copilot contract check; the layout scene passes at 390x664, 375x560, 360x640 and 1280x800; a full offline run still stops in the voice scene, now issue #69.

Decisions:
- no new decisions

Changed:
- checkpoints/CURRENT.md, tasks/TASK-WCP-0013-demo-sites-redesign.md, tasks/TASK-WCP-0014-widget-redesign.md, copilot-engine/ledger.jsonl

Blocked/uncertain:
- none

Next:
- Make the offline scene suite skip its voice scene with a printed reason and count it in the summary (#69), then run a full offline suite before the next demo change.
