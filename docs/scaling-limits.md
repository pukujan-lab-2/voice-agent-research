# How big a form, a call and a site can get

Our principle: code owns the state, the model never does. The model is shown a small window of it each turn; the rest lives in code. This page says where the limits are and why. Numbers were measured in this repository with `copilot-engine/tests/scale-report.ts`; they are not real traffic.

## The model's prompt (issue #101)

| What | Limit | Why |
|---|---|---|
| Fields listed to the model in full | 24 | A form up to this size is shown to the model exactly as before: every field in the system prompt, every value in each message. |
| Fields shown on a bigger form | 14 at most | The open field, the read-back waiting (and its group), the field to return to, queued answers, up to 3 fields the caller just named, the next 4 empty fields, and the last 3 filled. The rest is counted ("212 other fields are not shown"). |
| Options shown for a choice | 12, then a count | Code checks the answer against all of them. |
| Tool schema | no field list on a big form | The model names a field from the list in the message; code resolves it (`field()`), and ignores a name it doesn't know. |
| History sent to the model | last 6 user turns | Unchanged. Code restates the form state every turn. |
| History kept in memory | 12 user turns (twice the setting) | Older turns are dropped. |
| Call log kept in memory | first entry + latest 40 (up to 80) | `turns`, `events` and `fills` are small append-only records (about 200 bytes a turn) and are not capped. |

Measured: the largest request while filling a whole synthetic form (half the fields are 40-option choices) is about 9,000 characters (about 2,300 tokens) at 10, 100 and 300 fields. Before this change it was 9,572, 37,133 and 101,072.

Test: `copilot-engine/tests/desk-scale.test.ts` fills 300 fields over 600 turns and checks every value, runs a 100-turn call, and checks that a field the caller names is shown to the model and filled in its own place.

Known limit: a field the caller never names and that isn't in the window can't be filled by the model that turn. The visitor says it when that field comes up, or names it ("my favourite colour is teal").

## The backend's per-call state (issue #102)

Caller verification, rate limits and resume snapshots used to sit in plain maps inside one process. They now sit behind the `Store` interface (`copilot-engine/src/memory.ts`), which every store implements: get, set, delete, and `incr` (an atomic counter whose window starts at its first increment and does not slide).

| State | Where it lives now | Limit |
|---|---|---|
| A call's verification (who it was verified as, locked or not) and its failed tries | Octo when live (`OctoStore`, table `copilot_kv` in the workspace's own Postgres); a capped in-process store offline or with `STATE_STORE=memory` | 30 minutes from the call's start; 3 tries per call |
| Failed tries per visitor | same store | 6 per hour from the first failure |
| Rate limit | in-process capped store, per instance | 40 requests a minute per visitor (`RATE_PER_MIN`) from their first request; 20,000 visitors tracked, the oldest dropped first |
| Resume snapshots | same store as calls, one key per business and session (`POST /api/session`) | 30 minutes; 16 KB each; business and session ids are checked, so one business's key can never be another's |
| Library cache, PDF cache | in-process, unchanged | 400 entries and 6 PDFs; they hold copies of what Octo has, so losing them costs a fetch |

Why the rate limit stays in the process: it runs on every request, and one Octo query takes about 67 ms (measured on 2026-11-01 from a laptop), more than a desk turn can spare. The cost is that N instances allow N times the limit. The verification lock is the opposite case: it is rare and security-relevant, so it is shared.

Measured with `demo/live-site/tests/state-load.ts` (heap held by the call state after N calls, each from its own visitor, with one failed verification):

| Calls | Before | After (in-process store) | After (Octo store) |
|---|---|---|---|
| 10 | about 0 MB | about 0 MB | none in the process |
| 1,000 | 1.1 MB | 1.1 MB | none in the process |
| 10,000 | 1.1 MB | 4.5 MB | none in the process |
| 30,000 | 3.1 MB | 2.7 MB | none in the process |
| 100,000 | not finished (see below) | 1.0 MB | none in the process |

A call costs about 100 bytes, so memory was never the main problem at 1,000 concurrent calls; the problems were that a restart or a second instance lost every lock, and that nothing capped the maps. Heap figures from a garbage-collected process move by a few MB between runs, so read them as "a few MB at most", not as exact. Before this change the old cleanup scanned every entry on each new call past 5,000, which made 100,000 calls too slow to finish in the same run.

Known limits: the Octo store sweeps expired rows and the oldest past 200,000 every 64 writes from each instance, not on a timer. A visitor who floods `/api/session` can push real snapshots out of the cap; the rate limit slows that to 40 a minute per address. Octo has no key-value surface with expiry, so the table is ours; a proposal is filed on the Octo repository (octo-database#457).
