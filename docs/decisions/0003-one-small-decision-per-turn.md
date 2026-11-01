# 0003. The model makes one small decision; code acts

**Status:** Replaced by [0011](0011-model-leads-risk-sets-confirmation.md) · **Date:** 2026-10-30

## Decision

Each turn, the model returns one JSON decision (`fill`, `change`, `ask_again` or `off_scope`, with a field and value). The engine's code carries it out. There are no free-form tool calls and no sidecar agent.

## Why

Small open models are reliable at one constrained choice and unreliable at open tool use. Code keeps read-backs, confirmation and never-submit as hard rules.

## Consequences

New abilities are added as new decision types plus code, not as new tools. Lives in `copilot-engine/src/engine.ts`.
