# formal

TLA+ models of how parts of the copilot behave when things fail.

| File | What |
|---|---|
| `recording_queue.tla` | What happens to a call's recording after the call ends (#186): the agent's publish, the worker's read, save and acknowledgement, with the site and Redis going down and workers dying in between. |
| `recording_queue.cfg` | The queue as built, Redis always up. TLC finds no violation. |
| `recording_queue_redis_down.cfg` | The same, with Redis going away and coming back. A recording that reached the stream is still never lost. TLC finds no violation. |
| `recording_queue_both_down.cfg` | The same, asking that nothing at all is lost. TLC is expected to find a violation. |
| `recording_direct.cfg` | The agent before the queue: one post, no copy kept. TLC is expected to find a violation. |
| `recording_queue_ack_first.cfg` | The worker written the wrong way round, acknowledging before it saves. TLC is expected to find a violation. |
| `recording_queue_once.cfg` | Asks that a recording is saved at most once. TLC is expected to find a violation. |
| `recording_queue_site_stays_down.cfg` | Asks that a queued recording is saved even if the site never comes back. TLC is expected to find a violation. |

Each run uses two calls (one the site refuses), two workers, two changes of the site's state and two worker deaths.

## What the model says

**A recording that reaches the stream is not lost.** With the site and Redis failing and workers dying between any two steps, every queued recording is in the stream, saved, or refused by the site (`QueuedNeverLost`). Once the site and Redis stay up, every queued recording the site accepts is saved (`EventuallySaved`).

**The order of save and acknowledge is what makes that true.** `recording_queue_ack_first.cfg` swaps them. The counterexample: a worker reads a message and acknowledges it, the site is down, the save fails, and nothing holds the recording any more.

**One way to lose a recording is left.** `recording_queue_both_down.cfg`: Redis is away when the call ends, so the agent posts directly, and the site is down too. That is the old behaviour, now needing two failures at once instead of one. Closing it would mean the agent keeping the file on disk until either path works, which it does not do.

**A recording can be saved twice.** `recording_queue_once.cfg`: worker 1 saves, and before it acknowledges, worker 2 claims the same message and saves it again. This is how a stream with acknowledgements works, and it is harmless here because `CallAudio.save` replaces the earlier row for the same call (`copilot-engine/src/call-audio.ts`). It would stop being harmless if saving ever sent a notification or charged for storage per save.

**Before the queue, one failure was enough.** `recording_direct.cfg` loses a recording in three states: the call ends while the site is down.

## Run it

TLC needs Java 11 or newer and `tla2tools.jar` (v1.7.4):

```bash
TLA2TOOLS=/path/to/tla2tools.jar npm run test:formal
```

Without `TLA2TOOLS` or Java the tests are skipped. CI downloads the jar, checks its SHA-256 and runs them.

## The same rules on the real code

`demo/live-site/tests/recording-queue.test.ts` runs the worker's own `pass()` through 500 random histories with the same failures, and checks that what gets saved does not depend on the number of workers or the order the calls ended in. The model covers every interleaving of a small world; those tests cover the code that ships.

## What it leaves out

- Redis losing data. The stream is assumed to survive a restart (the append-only file). Redis writes that file once a second, so a crash can lose the last second.
- The one-day limit after which a recording that still cannot be saved is dropped. With it, `EventuallySaved` would read "saved, or dropped after a day".
- The one-minute wait before a pending message can be claimed. The model lets a worker claim at any time, which is the harsher case.
- More than two calls, two workers or two outages, and the 400 MB cap on Redis's memory.
