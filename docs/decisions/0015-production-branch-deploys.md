# 0015. The production branch deploys the lab

**Status:** Replaced by [0016](0016-merges-go-live.md) · **Date:** 2026-11-01 · **Replaces:** [0007](0007-not-hosted-yet.md)

## Decision

The lab is hosted. Moving GitHub's `production` branch deploys it within about 5 minutes, with no hand steps ([deploy/README.md](../../deploy/README.md)):

- **The VPS** runs the site and its backend, the LiveKit server and the voice agent, as Komodo's `copilot` stack. The stack is built from the commit and rolled back if its health check fails.
- **The MacBook Pro** keeps the speech models (all five stacks) and LFM3. The VPS reaches them through reverse SSH tunnels. The Pro updates its own checkout from `production`.
- The site is at https://copilot.design-bakery.com, through Cloudflare tunnel A.

`main` is where work merges. Moving `main` to `production` is what deploys it.

## Why

The owner said "i want them all deployed too deploy it i want a cd pipeline" and "just make a deployment branch that auto deploys" (#84). Under `vps/PLAN.md` in Pukujan-lab/server-management, services run on the VPS through Komodo and AI models stay on the Pro. Decision 0007 had said hosting would go to the Pro; the plan has since moved services to the VPS.

## Consequences

- To deploy: `git push origin main:production` (a fast-forward of `production` to `main`).
- Voice calls need the Pro awake. Text chat doesn't.
- WebRTC call audio uses one TCP port (7881) and one UDP port (7882) on the VPS's public address.
