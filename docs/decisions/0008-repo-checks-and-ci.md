# 0008. Repository checks, CI and ACS

**Status:** Accepted · **Date:** 2026-10-31

## Decision

Decisions are recorded here and open work lives in GitHub issues, not in chat logs or agent memory. Every pull request runs one required check, `gates`: Biome lint, the strict TypeScript typecheck, Knip (orphan files, exports and dependencies), the engine tests and scenarios, and Ruff for Python. The ACS hotloader (with PCM, CGM and OIO) is installed through its own installer, following the Kresilo setup.

## Why

The owner asked for a real issue log, CI, typecheck, lint and orphan checks, so that the project doesn't depend on chat history.

## Consequences

Lint rules catch bugs, not this codebase's dense style. Unused exports are warnings while the engine's public API settles. CI used GitHub-hosted runners while the repository was public. It is now private and the hosted minutes are used up. CI briefly ran on a stopgap runner on the MacBook Pro (#20), which has since been removed. CI and the OIO workflows now run on the VPS runner pool (label `org-pool`, in the `Pukujan-lab` organization); the OIO workflows pick it up from the `OIO_RUNS_ON` repository variable (#29, #30, #25). `Pukujan-lab` is on GitHub's free plan, so `main` has no branch protection and pull requests are merged by hand after `gates` passes (owner direction on #29).
