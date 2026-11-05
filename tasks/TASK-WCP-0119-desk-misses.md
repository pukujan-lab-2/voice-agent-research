# TASK-WCP-0119 — Desk Misses

<!-- continuity:task {"acceptance": ["When the caller's own words hold a complete email, code's reading wins over a different value from the model, and a spelled-out email is read", "A name read-back says hyphens and apostrophes", "After the third miss on one field the desk leaves it blank for the caller to type, says so, and moves on", "The question desk does not read the same quote twice in a row", "The failed tau2 callers are rerun"], "depends_on": [], "goal": "Fix the desk bugs the simulated callers found", "id": "WCP-0119", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/160", "next_action": "Merge the pull request; track the wrong-page citations under the retrieval work", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The first tau2 run (#158) failed half the form callers on desk bugs: a miscopied email, a dropped hyphen, and correction loops with no way out (#160)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

Fix the desk bugs the simulated callers found

## Why

The first tau2 run (#158) failed half the form callers on desk bugs: a miscopied email, a dropped hyphen, and correction loops with no way out (#160)

## Allowed files

- `copilot-engine/src/desk.ts`, `copilot-engine/tests/desk.test.ts`
- this task record

## Human outcome

A caller with a dotted email or a hyphenated name gets it read back right, and a caller the desk keeps mishearing is let off after three tries instead of being asked forever.

## Scope and boundaries

- In scope: the four fixes in the acceptance list.
- Out of scope: which page retrieval picks (the remaining question failures), model changes.

## Acceptance criteria

- [x] When the caller's own words hold a complete email, code's reading wins over a different value from the model, and a spelled-out email is read.
- [x] A name read-back says hyphens and apostrophes.
- [x] After the third miss on one field the desk leaves it blank for the caller to type, says so, and moves on.
- [x] The question desk does not read the same quote twice in a row, unless the caller asks it to repeat.
- [x] The failed tau2 callers are rerun.

## Evidence and sources

- tau2 rerun of the seven failed tasks with this desk and LFM3: the three form callers that failed (email twice, hyphen once) now pass, and so does one question task. The three still failing all fail only "quotes the page that answers it", which is retrieval. None of the rerun callers hit a repeated quote, so that fix is covered only by its unit test.
- `npm run check` passes (exit 0; 341 tests, none failing), with four new desk tests.

## Related records

- Leaf: #160. Parent: none. Found by: #158 (PR #159).
- Primary writer: Claude Code session for the owner / branch `fix/160-desk-misses` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.
