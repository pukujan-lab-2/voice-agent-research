# 0016. A merge to main goes live when CI passes

**Status:** Accepted · **Date:** 2026-11-01 · **Replaces:** [0015](0015-production-branch-deploys.md)

## Decision

Moving the `production` branch deploys the lab (as in decision 0015), and it moves by itself: when CI passes on a push to `main`, [`.github/workflows/promote.yml`](../../.github/workflows/promote.yml) fast-forwards `production` to that commit. Komodo then deploys it within about 5 minutes ([deploy/README.md](../../deploy/README.md)).

- It only fast-forwards, and it never forces. If `production` has commits that are not on `main`, the workflow fails and leaves it alone; a person decides what to do.
- Only a CI run on a push to `main` of this repository promotes. Pull requests and forks never do.
- A person can still move `production` by hand (`git push origin main:production`), for example to roll back one commit.
- There is no automatic revert. When the loop's post-deploy replay finds a worse result than the previous deploy, it posts a warning with the evidence, and a person rolls back.

## Why

The owner asked for merged work to go live without a hand step ("ok lets do it", "do it", #124). The gate before the live site is CI, and the live-traces loop's replay checks, once they run in CI.

## Consequences

- Every merge that passes CI goes live. Required checks and auto-merge on pull requests are the human-free gate; keep them strict.
- It depends on GitHub Actions. While runs don't start, nothing is promoted; the hand push still works.
- If the `GITHUB_TOKEN` can't push `production` (a permission error in the run), a fine-grained token in a repository secret is needed, and the owner adds it.
