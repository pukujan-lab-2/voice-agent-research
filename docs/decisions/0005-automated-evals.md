# 0005. Evals are fully automated

**Status:** Accepted · **Date:** 2026-10-31

## Decision

Every eval runs without a human spot-check. Exact code checks are preferred over judge-model scores. The focus is ambiguous questions, spelling and speech-to-text errors, read-backs, and grounding against the document library.

## Why

The owner asked for no spot checks. Code checks are repeatable and cheap to run on every change.

## Consequences

New behaviour ships with an automated check in `eval/` or the package tests.
