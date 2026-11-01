# TASK-WCP-0074 — Hugesite Evals

<!-- continuity:task {"acceptance":["Citation present, quote word for word in the cited passage, no undeclared field, no cross-business data, all by code","Runs in CI without keys"],"depends_on":["WCP-0050","WCP-0051","WCP-0052","WCP-0053"],"goal":"Automated code-check evals for facts, vague questions and record lookups on a large site","id":"WCP-0074","issue_url":"https://github.com/Pukujan-lab/voice-agent-research/issues/112","next_action":"Start the leaf on its task branch","owner":"owner","priority":"P2","protocol_version":"0.1.0-draft","schema":"project-continuity.task.v1","status":"active","why":"The new layer has no end-to-end check (#112)"} -->

- Status: active
- Owner: owner
- Priority: P2
- Depends on: WCP-0050, WCP-0051, WCP-0052, WCP-0053

## Goal

Automated code-check evals for facts, vague questions and record lookups on a large site

## Why

The new layer has no end-to-end check (#112)

## Allowed files

- `eval/config/hugesite.json`
- `eval/hugesite.ts and eval/lib/ additions`
- `eval/tests/`
- `eval/README.md`
- `tasks/TASK-WCP-0074-hugesite-evals.md`

## Human outcome

One command shows whether the huge-site layer still answers with a real citation, quotes word for word and leaks nothing.

## Scope and boundaries

- In scope: a business config for a synthetic large site and a database; simulated callers; code checks only.
- Out of scope: new model runs or comparisons.
- Dependencies/uncertainty: builds on WCP-0050, WCP-0051, WCP-0052, WCP-0053. Octo's RAG has no metadata filter; title paths and an Octo table stand in until Octo adds one.

## Acceptance criteria

- [ ] Citation present, quote word for word in the cited passage, no undeclared field, no cross-business data, all by code.
- [ ] Runs in CI without keys.

## Evidence and sources

Link repository state at a revision and cite external factual claims directly. Record commands and results for claims that need verification.

## Reproduction details (only when needed)

Starting revision, material inputs/configuration, runtime, exact command or prompt, observed result, and limitations.

## Related records

- Leaf #112; parent #107; depends on WCP-0050, WCP-0051, WCP-0052, WCP-0053.
- Primary writer claude-code / `task/WCP-0074-*`; source issue open as of 2026-11-01.
- PR/CI evidence: pending.

## Checkpoint log

No checkpoints yet.

## Handoff

Read PROJECT → CURRENT → this task → minimum relevant spec. Checkpoint before stopping.
