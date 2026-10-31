# 0008. Repository checks, CI and ACS

**Status:** Accepted · **Date:** 2026-10-31

## Decision

Decisions are recorded here and open work lives in GitHub issues, not in chat logs or agent memory. Every pull request runs one required check, `gates`: Biome lint, the strict TypeScript typecheck, Knip (orphan files, exports and dependencies), the engine tests and scenarios, and Ruff for Python. The ACS hotloader (with PCM, CGM and OIO) is installed through its own installer, following the Kresilo setup.

## Why

The owner asked for a real issue log, CI, typecheck, lint and orphan checks, so that the project doesn't depend on chat history.

## Consequences

Lint rules catch bugs, not this codebase's dense style. Unused exports are warnings while the engine's public API settles. CI uses GitHub-hosted runners while the repository is public and moves to the MacBook Pro runner once it is private.
