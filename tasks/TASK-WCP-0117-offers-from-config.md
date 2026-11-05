# TASK-WCP-0117 — Offers From Config

<!-- continuity:task {"acceptance": ["The question desk's prompt names only the offers in that business's config", "It mentions verifying only when the config has a verify block", "A config with a malformed desk.offers entry is refused when stored"], "depends_on": [], "goal": "What the desk may offer lives in one place: each business's config in Octo", "id": "WCP-0117", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/156", "next_action": "Merge the pull request, then start step 2 (closed action list) on its own issue", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "The question desk's prompt hardcoded the tax desk's 'check on their return' for every business, and offers were written in three places (#156)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: none

## Goal

What the desk may offer lives in one place: each business's config in Octo

## Why

The question desk's prompt hardcoded the tax desk's "check on their return" for every business, and offers were written in three places (#156)

## Allowed files

- `copilot-engine/src/desk.ts`, `types.ts`, `site-config.ts`, `demo/live-site/widget/sdk.ts`
- `copilot-engine/tests/desk.test.ts`, `copilot-engine/tests/site-config.test.ts`
- this task record

## Human outcome

A business's desk only ever names the offers that business set up, and a broken offer is refused when the config is stored, not met on a call.

## Scope and boundaries

- In scope: the question desk's offer and verify lines built from config; validating `desk.offers`.
- Out of scope: the closed action list and quote check (step 2), the prompt's tax-flavoured examples (step 3 moves prompts to their own file), the guard's phrase list (stays as backstop).

## Acceptance criteria

- [x] The question desk's prompt names only the offers in that business's config.
- [x] It mentions verifying only when the config has a `verify` block.
- [x] A config with a malformed `desk.offers` entry is refused when stored.

## Evidence and sources

- `npm run check` passes (exit 0; 337 tests, none failing), with a new desk prompt test and new config refusals.
- reports/OSS dialogue frameworks vs own desk.md, migration step 1.

## Related records

- Leaf: #156. Parent: none. Related: #38.
- Primary writer: Claude Code session for the owner / branch `refactor/156-offers-from-config` / as of 2026-11-05 PR open.

## Checkpoint log

No checkpoints yet.
