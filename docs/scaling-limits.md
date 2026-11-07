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

## One business's config (issue #103)

A business's copilot config (its pages, voice stacks, desk and manual settings) used to ride in the page and be sent with requests. It now lives in Octo, one row per business in the table `copilot_sites`, and the backend loads it on demand.

| What | Limit | Why |
|---|---|---|
| Config size | 256,000 characters (JSON) | A form-heavy site keeps its forms in the form index (#104), not here. |
| Configs held in memory per instance | 200, each for 60 seconds | A config that changed in Octo reaches every instance within a minute; a business with no config is asked about again after 10 seconds. |
| Business id | lower-case letters, digits and dashes, up to 40 | It is checked before it reaches SQL and is the only key, so one business can't read or write another's row, snapshot or lock. Tested with two businesses that share page paths, form ids and session ids. |
| Voice stacks | `/api/desk` refuses (403) a stack outside the business's `voice.stacks` | Only when the request names its business; a request that doesn't is held to the old checks. |
| Resume snapshots | refused (404) for a business with no config | A stranger can't open a key space of their own. |

Store a config with `npm run site-config -- put <business> <file.json>` in `demo/live-site` (it uses the Octo key the server uses). A page can mount with only `{ business, remote: true }` and take the rest from `GET /api/copilot/config?business=`; what the page passes wins.

Known limit: the config endpoint is public by design (it holds what the page already shows), so it must never hold a secret. Writing a config needs the Octo key, which only the owner has.

## Calls at once on one speech server (measured 2026-11-07)

The speech server (`demo/live-site/speech/server.py`) runs one listening, one Parakeet and one Pocket TTS job at a time; each holds a lock. Simulated calls, each turn about 4 s of speech and a reply of over 120 characters, first audio of the reply after the turn's text:

| Calls at once | Pro (M1, 16 GB) p50 / p90 | Windows, RTX 4060 p50 / p90 | Windows, CPU p50 / p90 |
|---|---|---|---|
| 1 | 83 / 90 ms | 219 / 244 ms | 357 / 387 ms |
| 2 | 102 / 1,415 ms | 259 / 2,031 ms | 334 / 1,857 ms |
| 4 | 847 / 2,569 ms | 1,944 / 4,522 ms | 8,377 / 9,952 ms |
| 6 | 1,452 / 3,602 ms | not run | not run |

One server is comfortable for one or two calls. Past that, callers wait on the voice lock. The Windows laptop is slower even with Pocket TTS on its GPU (`SPEECH_DEVICE=cuda`): its Parakeet decode took about 520 ms against the Pro's 175 ms. The cloud stack (Deepgram, Cartesia, Claude) stayed flat from 1 to 8 calls at about 2.1 s median from the caller's last word to Riley's first audio.

`GET /stt/stream` (in `stt_stream.py`) takes the caller's audio over a WebSocket while they talk. The agent's VAD sends `decode` on a 0.1 s pause and `end` when the turn ends; when nothing was said after the pause, the pause's transcript is the final one and comes back at once (12 ms against about 175 ms for a `/stt` upload). It is still Parakeet on the whole turn, not a streaming model, so it adds a decode per pause and doesn't raise how many calls one server takes.

Riley's screen end to end (bot caller on the VPS worker, Pro speech only, the caller's last word to Riley's first audio):

| | 1 call median / p90 | 3 calls median / p90 |
|---|---|---|
| `POST /stt` per utterance | 2.51 / 2.89 s | 2.38 / 3.18 s |
| `/stt/stream` | 2.22 / 2.48 s | 2.20 / 2.76 s |

Every turn's final came from its pause transcript. The slowest turn (about 9 s) is the same in both: it's the screen's long knockout reply, not listening. About 1 in 13 turns came back empty in both, which is Parakeet missing a lone short word ("Yes."); Whisper heard it.

The other stacks on the same Pro, the knockout caller's 13 lines, one at a time:

| Stack | Listens, per turn | Speaks, first audio | Misheard |
|---|---|---|---|
| `english-fast` (Parakeet + Pocket TTS) | median 116 ms, max 208 ms | 100–180 ms | "Yes." empty, "In the ICU" as "and the ICU" |
| `multilingual` (Whisper large-v3-turbo + Kokoro) | median 1,386 ms, max 1,450 ms | 340–1,410 ms | none of the 13 ("Fifty" as "50") |

Whisper's 1.4 s is mostly after the turn ends, so streaming hides only about 0.2 s of it. Switching a server between stacks takes 4.5 s (to Whisper) and 11 s (back to Parakeet and Pocket TTS), and only one is resident at a time.
