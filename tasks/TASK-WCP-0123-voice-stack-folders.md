# TASK-WCP-0123 — Voice Stack Folders

<!-- continuity:task {"acceptance": ["Each voice stack has agent/voice/stacks/<stack>/manifest.json and each language agent/languages/<code>/manifest.json; agent/voice/manifest.json names the default", "One loader in agent/common builds what stacks.json held and refuses a mismatched folder, a missing or unknown field, a stack language with no folder, a banned model name, or a default that is not a stack", "server.ts, speech/agent.py, speech/server.py and the voice tests read the folders; stacks.json is gone; the site and agent images copy the folders", "The import check fails when one stack imports another, and a test fails when a stack folder is missing from it", "A test shows the TypeScript and Python loaders give the same result"], "depends_on": ["WCP-0121"], "goal": "Give each voice stack and language its own folder and manifest", "id": "WCP-0123", "issue_url": "https://github.com/pukujan-lab-2/voice-agent-research/issues/169", "next_action": "Merge the pull request; then file step 4, each form's steps as data", "owner": "owner", "priority": "P1", "protocol_version": "0.1.0-draft", "schema": "project-continuity.task.v1", "status": "active", "why": "Decision 0022 gives each voice stack and language its own folder and manifest and bars imports between stacks, but all of them sat in one file, speech/stacks.json (#169)"} -->

- Status: active
- Owner: owner
- Priority: P1
- Depends on: WCP-0121

## Goal

Give each voice stack and language its own folder and manifest

## Why

Decision 0022 gives each voice stack and language its own folder and manifest and bars imports between stacks, but all of them sat in one file, speech/stacks.json (#169)

## Allowed files

- `agent/voice/`, `agent/languages/`, `agent/common/voice.py`, `agent/tests/test_voice.py` (new)
- `agent/pyproject.toml`, `agent/tests/test_manifest.py`
- `demo/live-site/voice-config.ts`, `demo/live-site/tests/voice-config.test.ts`, `demo/live-site/speech/voice_config.py` (new)
- the readers of `demo/live-site/speech/stacks.json` (removed), both Dockerfiles, decision 0012
- this task record

## Human outcome

A change to one voice stack or one language touches only that stack's or language's folder, and calls pick and run stacks as before.

## Scope and boundaries

- In scope: the folders, the two loaders, switching every reader, both images, the stack import check.
- Out of scope: speech code or model changes, fixed sentences per language, form steps as data (step 4).

## Acceptance criteria

- [x] Each voice stack has agent/voice/stacks/<stack>/manifest.json and each language agent/languages/<code>/manifest.json; agent/voice/manifest.json names the default.
- [x] One loader in agent/common builds what stacks.json held and refuses a mismatched folder, a missing or unknown field, a stack language with no folder, a banned model name, or a default that is not a stack.
- [x] server.ts, speech/agent.py, speech/server.py and the voice tests read the folders; stacks.json is gone; the site and agent images copy the folders.
- [x] The import check fails when one stack imports another, and a test fails when a stack folder is missing from it.
- [x] A test shows the TypeScript and Python loaders give the same result.

## Evidence and sources

- `npm run test:agent`: 22 tests pass; the three import contracts are kept, and the stack contract breaks when one stack imports another (tried, then undone).
- `tests/voice-config.test.ts`: the TypeScript loader equals `agent/common/voice.py`'s output; the Python loader's output equals the old `stacks.json` (checked before it was removed).
- `npm run test:speech`: 26 tests pass, including the new check that the agent image copies the folders where `COPILOT_AGENT_DIR` points; the image's file layout was copied into a temporary folder and loaded.
- `npm run check` passes (exit 0).

## Related records

- Leaf: #169. Parent: none. Depends on: #162, #164.
- Primary writer: Claude Code session for the owner / branch `feat/169-voice-stack-folders` / as of 2026-11-06 PR open.

## Checkpoint log

No checkpoints yet.
