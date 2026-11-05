# TASK-WCP-0114 — Trace Words

<!-- continuity:task {"acceptance": ["Chat, desk and voice spans keep what the caller said and what was answered by default, and still point at the call record", "A business with traces.words false gets only the pointer; the voice agent drops words with OCTO_TRACE_WORDS=off", "The locked call record still gets every turn's words"], "depends_on": ["WCP-0109"], "goal": "Traces keep call words again so evals and fixes can read new calls", "id": "WCP-0114", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/147", "next_action": "Merge #148 once CI passes", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Since #129 the eval judge and fix tools read empty strings; the owner called locking words out of traces premature before the system works (#147)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0109 (#129, merged as #137)

## Goal

Traces keep call words again so evals and fixes can read new calls

## Why

Since #129 the eval judge and fix tools read empty strings; the owner called locking words out of traces premature before the system works (#147)

## Allowed files

- `copilot-engine/src/call-records.ts`, `copilot-engine/src/site-config.ts`
- `demo/live-site/api.ts`, `tracing.ts`, `speech/telemetry.py`, `speech/tests/test_telemetry.py`, `tests/own-workspace.test.ts`
- this task record

## Human outcome

The owner opens a call's trace and reads what was said and answered, and evals grade new calls again.

## Scope and boundaries

- In scope: words back in spans by default; the `traces: { words: false }` setting and its check; the voice agent's `OCTO_TRACE_WORDS=off`; tests.
- Out of scope: any further privacy work until a real business asks; retention, erasure and grants stay as they are.

## Acceptance criteria

- [x] Chat, desk and voice spans keep what the caller said and what was answered by default, and still point at the call record.
- [x] A business with `traces.words` false gets only the pointer; the voice agent drops words with `OCTO_TRACE_WORDS=off`.
- [x] The locked call record still gets every turn's words.

## Evidence and sources

- `npm run check` passes; `own-workspace.test.ts` and `test_telemetry.py` cover the default and the opt-out.

## Related records

- Leaf: #147. Parent: #121. Corrects: #129.
- Primary writer: Claude Code session for the owner / branch `fix/147-trace-words` / as of 2026-11-05 PR #148 open.

## Checkpoint log

No checkpoints yet.

### 2026-11-05 01:21:32 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/src/call-records.ts, site-config.ts, demo/live-site/api.ts, tracing.ts, speech/telemetry.py, tests"],"completed":["Traces keep call words by default again; traces.words false and OCTO_TRACE_WORDS=off keep them out (#147)"],"decisions":["Owner: privacy locking is premature before the system works; words return to traces by default"],"evidence":["npm run check exit 0; own-workspace.test.ts and test_telemetry.py cover the default and the opt-out"],"next_action":"Merge #148 once CI passes","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0114","timestamp":"2026-11-05T01:21:32Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"2fc9fcd444f1b358b81602f1252bbec26064b2159e42ea318db76f254d9a982b","request_id":"d8065a56e1bf4ed6b40b6fb587a05022","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0114"} -->

Completed:
- Traces keep call words by default again; traces.words false and OCTO_TRACE_WORDS=off keep them out (#147)

Evidence:
- npm run check exit 0; own-workspace.test.ts and test_telemetry.py cover the default and the opt-out

Decisions:
- Owner: privacy locking is premature before the system works; words return to traces by default

Changed:
- copilot-engine/src/call-records.ts, site-config.ts, demo/live-site/api.ts, tracing.ts, speech/telemetry.py, tests

Blocked/uncertain:
- none

Next:
- Merge #148 once CI passes
