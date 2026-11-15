# TASK-WCP-0125: An Octo timeout no longer takes the copilot server down

**Issue:** pukujan-lab-2/voice-agent-research#181 · parent: none · dependencies: none · writer: Claude (owner-directed, 2026-11-14) · branch: task/sweeper-crash-guard

**Problem.** copilot-web exited three times on 2026-11-14 on an unhandled `ConnectTimeoutError` to octodb.design-bakery.com, dropping any live call each time. The hourly call-record sweeper in `demo/live-site/server.ts` had no `.catch`, and `api.sweepRecords()` calls `sites.list()` outside its own try.

**Done.** The sweeper catches and logs the failure (`call records: sweep failed, retrying next hour: …`); the next hourly run tries again.

**Evidence.** VPS `docker logs copilot-web`: exits at 19:32:54, 21:33:07, 02:33:19 UTC, each `triggerUncaughtException` with the Octo connect timeout, about an hour apart at :33 like the sweeper's timer.

**Next.** After deploy, confirm no further `triggerUncaughtException` in `docker logs copilot-web`.
