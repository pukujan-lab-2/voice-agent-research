# TASK-WCP-0122 — Leak Check Flake

<!-- continuity:task {"acceptance": ["The leak checks in own-workspace.test.ts and call-vault.test.ts leave out a sealed record's random fields (ct, iv, key) and still check everything else", "A plain-text leak still fails each check"], "depends_on": [], "goal": "Stop the leak checks failing at random on encrypted bytes", "id": "WCP-0122", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/166", "next_action": "Merge the pull request", "owner": "owner", "priority": "P2", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "CI failed on a docs-only pull request because random base64 ciphertext spelled a caller's name (#166)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: none

## Goal

Stop the leak checks failing at random on encrypted bytes

## Why

CI failed on a docs-only pull request because random base64 ciphertext spelled a caller's name (#166)

## Allowed files

- `demo/live-site/tests/own-workspace.test.ts`, `copilot-engine/tests/call-vault.test.ts`
- this task record

## Human outcome

A pull request fails CI only when call text really leaks, not when encrypted bytes happen to spell a name.

## Scope and boundaries

- In scope: the three leak checks on stored rows and the one on a sealed record.
- Out of scope: the encryption itself.

## Acceptance criteria

- [x] The leak checks in own-workspace.test.ts and call-vault.test.ts leave out a sealed record's random fields (ct, iv, key) and still check everything else.
- [x] A plain-text leak still fails each check.

## Evidence and sources

- A sealed row whose `ct`, `iv` and `key` contain "Ana" no longer matches, and a plain `values.name: "Ana"` still does (checked with the same replacer in node).
- `npm run check` passes (exit 0).

## Related records

- Leaf: #166. Parent: none. Found on #163 (CI run 42078221820).
- Primary writer: Claude Code session for the owner / branch `fix/166-leak-check-flake` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.

### 2026-11-05 17:58:39 UTC — claude-code

<!-- continuity:checkpoint {"agent":"claude-code","blocked":[],"changed":["copilot-engine/tests/call-vault.test.ts, demo/live-site/tests/own-workspace.test.ts"],"completed":["The leak checks leave out a sealed record's random iv, ct and key, so base64 that spells a name no longer fails CI (#166)"],"decisions":["Blank only the three random fields instead of loosening the word patterns, so every readable field is still searched"],"evidence":["A sealed row with Ana in its ciphertext passes and a plain Ana still fails; npm run check exit 0"],"next_action":"Merge the pull request","protocol_version":"0.1.0-draft","schema":"project-continuity.checkpoint.v1","task_id":"WCP-0122","timestamp":"2026-11-05T17:58:39Z"} -->
<!-- continuity:checkpoint-operation {"payload_sha256":"de37f46a019984215ff58c894a0277cc7749fc4269024706bf8b0d4c68eac244","request_id":"2df80e61cd5942a4a978e799e17df56b","schema":"project-continuity.checkpoint-operation.v1","task_id":"WCP-0122"} -->

Completed:
- The leak checks leave out a sealed record's random iv, ct and key, so base64 that spells a name no longer fails CI (#166)

Evidence:
- A sealed row with Ana in its ciphertext passes and a plain Ana still fails; npm run check exit 0

Decisions:
- Blank only the three random fields instead of loosening the word patterns, so every readable field is still searched

Changed:
- copilot-engine/tests/call-vault.test.ts, demo/live-site/tests/own-workspace.test.ts

Blocked/uncertain:
- none

Next:
- Merge the pull request
