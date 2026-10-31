# 0008. Repository checks, CI and ACS

**Status:** Accepted · **Date:** 2026-10-31

## Decision

Decisions are recorded here and open work lives in GitHub issues, not in chat logs or agent memory. Every pull request runs one required check, `gates`: Biome lint, the strict TypeScript typecheck, Knip (orphan files, exports and dependencies), the engine tests and scenarios, and Ruff for Python. The ACS hotloader (with PCM, CGM and OIO) is installed through its own installer, following the Kresilo setup.

## Why

The owner asked for a real issue log, CI, typecheck, lint and orphan checks, so that the project doesn't depend on chat history.

## Consequences

Lint rules catch bugs, not this codebase's dense style. Unused exports are warnings while the engine's public API settles. CI used GitHub-hosted runners while the repository was public. It is now private, so CI and the OIO workflows run on the MacBook Pro runner `macbook-pro-chatbots` (label `chatbots`); the OIO workflows pick it up from the `OIO_RUNS_ON` repository variable (#20).
