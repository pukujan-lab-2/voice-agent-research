# 0010. CI runs on GitHub-hosted runners

**Status:** Accepted · **Date:** 2026-11-01 · **Replaces:** [0008](0008-repo-checks-and-ci.md)

## Decision

Decisions are recorded here and open work lives in GitHub issues, not in chat logs or agent memory. Every pull request runs one required check, `gates`: Biome lint, the strict TypeScript typecheck, Knip (orphan files, exports and dependencies), the engine tests and scenarios, and Ruff for Python. `main` requires `gates` before a pull request merges (#42). The ACS hotloader (with PCM, CGM and OIO) is installed through its own installer, following the Kresilo setup.

CI and the OIO issue workflows run on GitHub-hosted runners (`ubuntu-latest`), not the VPS runner pool.

## Why

The repository is public (#42). Hosted minutes are free for public repositories, and a self-hosted runner on a public repository would run code from anyone's pull request or issue on our machine. The `Pukujan-lab` runner group also refuses public repositories, so CI on the VPS pool never started (#50). The owner chose hosted runners on 2026-10-31.

## Consequences

Lint rules catch bugs, not this codebase's dense style. Unused exports are warnings while the engine's public API settles. The `OIO_RUNS_ON` repository variable is removed, so the OIO workflows use their `ubuntu-latest` default. If the repository goes private again, hosted minutes become budget-capped and the runner choice needs a new decision.
