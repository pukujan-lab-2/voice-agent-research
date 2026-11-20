------------------------- MODULE recording_queue -------------------------
\* Model of what happens to a call's recording after the call ends (#186).
\*
\* Source: demo/live-site/speech/agent.py (send_audio), speech/recording.py (publish_recording)
\* and demo/live-site/recording-queue.ts (handle, pass, redisQueue). When a recorded call ends,
\* the voice agent adds the recording to a Redis stream. The site's worker reads it, saves it
\* through /api/call-audio, and only then acknowledges and deletes the message. A message that
\* was read but not acknowledged stays on the stream's pending list, and any worker may claim
\* it again. If Redis is away when the call ends, the agent posts the recording to the site
\* once, as it did before the queue existed.
\*
\* The model lets the site and Redis go down and come back, and lets a worker die between any
\* two steps. It checks:
\*
\*   QueuedNeverLost  - a recording that reached the stream is in the stream, saved, or was
\*                      refused by the site; it is never simply gone
\*   NothingLost      - no recording is lost at all (holds only while Redis stays up)
\*   DroppedForCause  - only a recording the site refuses for good is dropped
\*   EventuallySaved  - once the site and Redis stay up, every queued recording is saved
\*   SavedOnce        - a recording is saved at most once (does NOT hold: see README.md)
\*   SavedWhateverHappens - EventuallySaved without its condition (does NOT hold, on purpose)
\*
\* UseQueue = FALSE is the agent before the queue: one post, no copy kept.
\* AckFirst = TRUE is the worker written the wrong way round: acknowledge, then save.
\*
\* Check with:  java -cp tla2tools.jar tlc2.TLC -config recording_queue.cfg recording_queue.tla
\**************************************************************************
EXTENDS Naturals, FiniteSets

CONSTANTS Calls,           \* recorded calls that end
          BadCalls,        \* calls the site answers 4xx for (a bad signature, an unknown business)
          Workers,         \* site processes reading the stream (two overlap during a deploy)
          UseQueue,        \* TRUE: the agent publishes to the stream; FALSE: it posts directly
          AckFirst,        \* TRUE: the worker acknowledges before it saves
          MaxSiteFlips,    \* how many times the site may go down or come back
          MaxRedisFlips,   \* the same for Redis
          MaxCrashes,      \* how many times a worker may die mid-message
          None

ASSUME BadCalls \subseteq Calls /\ UseQueue \in BOOLEAN /\ AckFirst \in BOOLEAN
ASSUME MaxSiteFlips \in Nat /\ MaxRedisFlips \in Nat /\ MaxCrashes \in Nat

VARIABLES agent,       \* agent[c]: "ended" (the recording is in the agent's hands) or "done"
          stream,      \* messages in the Redis stream
          pending,     \* messages handed to a worker and not yet acknowledged
          hand,        \* hand[w]: the message worker w is working on, or None
          step,        \* step[w]: "idle", "got", "acked" (AckFirst only), "saved" or "rejected"
          saved,       \* recordings the site has stored
          saves,       \* saves[c]: how many times c was stored
          dropped,     \* recordings the site refused for good
          lost,        \* recordings that are gone: the direct post failed and nothing holds a copy
          everQueued,  \* recordings that reached the stream at some point
          siteUp, redisUp, siteFlips, redisFlips, crashes

vars == <<agent, stream, pending, hand, step, saved, saves, dropped, lost, everQueued,
          siteUp, redisUp, siteFlips, redisFlips, crashes>>

TypeOK ==
    /\ agent \in [Calls -> {"ended", "done"}]
    /\ stream \subseteq Calls /\ pending \subseteq stream
    /\ hand \in [Workers -> Calls \cup {None}]
    /\ step \in [Workers -> {"idle", "got", "acked", "saved", "rejected"}]
    /\ saved \subseteq Calls /\ dropped \subseteq Calls /\ lost \subseteq Calls /\ everQueued \subseteq Calls
    /\ saves \in [Calls -> Nat]
    /\ siteUp \in BOOLEAN /\ redisUp \in BOOLEAN
    /\ siteFlips \in 0..MaxSiteFlips /\ redisFlips \in 0..MaxRedisFlips /\ crashes \in 0..MaxCrashes

Init ==
    /\ agent = [c \in Calls |-> "ended"]
    /\ stream = {} /\ pending = {} /\ saved = {} /\ dropped = {} /\ lost = {} /\ everQueued = {}
    /\ hand = [w \in Workers |-> None] /\ step = [w \in Workers |-> "idle"]
    /\ saves = [c \in Calls |-> 0]
    /\ siteUp \in BOOLEAN /\ redisUp = TRUE
    /\ siteFlips = 0 /\ redisFlips = 0 /\ crashes = 0

Store(c) == /\ saved' = saved \cup {c}
            /\ saves' = [saves EXCEPT ![c] = @ + 1]
Free(w)  == /\ hand' = [hand EXCEPT ![w] = None]
            /\ step' = [step EXCEPT ![w] = "idle"]

----
\* The agent, when a call ends.

\* publish_recording: XADD. The agent's copy is gone once Redis has the message.
Publish(c) ==
    /\ agent[c] = "ended" /\ UseQueue /\ redisUp
    /\ agent' = [agent EXCEPT ![c] = "done"]
    /\ stream' = stream \cup {c}
    /\ everQueued' = everQueued \cup {c}
    /\ UNCHANGED <<pending, hand, step, saved, saves, dropped, lost, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* send_audio's direct post: the only path without a queue, and the fallback when Redis is away.
\* It happens once. If the site is down the recording is gone.
DirectPost(c) ==
    /\ agent[c] = "ended" /\ (~UseQueue \/ ~redisUp)
    /\ agent' = [agent EXCEPT ![c] = "done"]
    /\ IF c \in BadCalls
         THEN dropped' = dropped \cup {c} /\ UNCHANGED <<saved, saves, lost>>
         ELSE IF siteUp
           THEN Store(c) /\ UNCHANGED <<dropped, lost>>
           ELSE lost' = lost \cup {c} /\ UNCHANGED <<saved, saves, dropped>>
    /\ UNCHANGED <<stream, pending, hand, step, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

----
\* A worker (recording-queue.ts pass).

\* XREADGROUP with '>': a message no worker has been handed yet. It goes on the pending list.
Read(w, c) ==
    /\ redisUp /\ step[w] = "idle" /\ c \in stream \ pending
    /\ pending' = pending \cup {c}
    /\ hand' = [hand EXCEPT ![w] = c] /\ step' = [step EXCEPT ![w] = "got"]
    /\ UNCHANGED <<agent, stream, saved, saves, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* XAUTOCLAIM: a pending message, whoever read it first. The code waits until it has been
\* pending for a minute; the model lets a worker claim at any time, which covers a first
\* worker that is slow as well as one that is dead.
Claim(w, c) ==
    /\ redisUp /\ step[w] = "idle" /\ c \in pending
    /\ hand' = [hand EXCEPT ![w] = c] /\ step' = [step EXCEPT ![w] = "got"]
    /\ UNCHANGED <<agent, stream, pending, saved, saves, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* Only with AckFirst: XACK and XDEL before the save.
AckEarly(w) ==
    /\ AckFirst /\ redisUp /\ step[w] = "got"
    /\ stream' = stream \ {hand[w]} /\ pending' = pending \ {hand[w]}
    /\ step' = [step EXCEPT ![w] = "acked"]
    /\ UNCHANGED <<agent, hand, saved, saves, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

ReadyToSave(w) == step[w] = (IF AckFirst THEN "acked" ELSE "got")

\* The save answers 2xx. CallAudio.save replaces an earlier row for the same call.
SaveOk(w) ==
    /\ ReadyToSave(w) /\ siteUp /\ hand[w] \notin BadCalls
    /\ Store(hand[w])
    /\ IF AckFirst THEN Free(w) ELSE step' = [step EXCEPT ![w] = "saved"] /\ UNCHANGED hand
    /\ UNCHANGED <<agent, stream, pending, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* The save answers 4xx: the site will never take this recording.
SaveRejected(w) ==
    /\ ReadyToSave(w) /\ siteUp /\ hand[w] \in BadCalls
    /\ IF AckFirst
         THEN dropped' = dropped \cup {hand[w]} /\ Free(w)
         ELSE step' = [step EXCEPT ![w] = "rejected"] /\ UNCHANGED <<hand, dropped>>
    /\ UNCHANGED <<agent, stream, pending, saved, saves, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* The save fails (5xx, or the site's stores are unreachable). The worker lets go of the
\* message. In the right order it is still pending; with AckFirst nothing holds it any more.
SaveFails(w) ==
    /\ ReadyToSave(w) /\ ~siteUp
    /\ Free(w)
    /\ UNCHANGED <<agent, stream, pending, saved, saves, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* done(): XACK and XDEL after the save, or after a refusal.
Ack(w) ==
    /\ redisUp /\ step[w] \in {"saved", "rejected"}
    /\ stream' = stream \ {hand[w]} /\ pending' = pending \ {hand[w]}
    /\ dropped' = IF step[w] = "rejected" THEN dropped \cup {hand[w]} ELSE dropped
    /\ Free(w)
    /\ UNCHANGED <<agent, saved, saves, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* Redis went away before the acknowledgement: the pass throws and the worker starts over.
AckFails(w) ==
    /\ ~redisUp /\ step[w] \in {"saved", "rejected"}
    /\ Free(w)
    /\ UNCHANGED <<agent, stream, pending, saved, saves, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips, crashes>>

\* The site process dies (a deploy, a crash) with a message in hand.
Crash(w) ==
    /\ crashes < MaxCrashes /\ step[w] # "idle"
    /\ crashes' = crashes + 1
    /\ Free(w)
    /\ UNCHANGED <<agent, stream, pending, saved, saves, dropped, lost, everQueued, siteUp, redisUp, siteFlips, redisFlips>>

Work(w) == \/ \E c \in Calls : Read(w, c) \/ Claim(w, c)
           \/ AckEarly(w) \/ SaveOk(w) \/ SaveRejected(w) \/ SaveFails(w) \/ Ack(w) \/ AckFails(w)

----
\* The world.

FlipSite  == /\ siteFlips < MaxSiteFlips /\ siteUp' = ~siteUp /\ siteFlips' = siteFlips + 1
             /\ UNCHANGED <<agent, stream, pending, hand, step, saved, saves, dropped, lost, everQueued, redisUp, redisFlips, crashes>>
\* Redis keeps its data across a restart (the append-only file). Losing it is not modelled.
FlipRedis == /\ redisFlips < MaxRedisFlips /\ redisUp' = ~redisUp /\ redisFlips' = redisFlips + 1
             /\ UNCHANGED <<agent, stream, pending, hand, step, saved, saves, dropped, lost, everQueued, siteUp, siteFlips, crashes>>

Next == \/ \E c \in Calls : Publish(c) \/ DirectPost(c)
        \/ \E w \in Workers : Work(w) \/ Crash(w)
        \/ FlipSite \/ FlipRedis

\* Every worker keeps working. Nothing forces a call to end, the site to come back or a crash.
Spec == Init /\ [][Next]_vars /\ \A w \in Workers : WF_vars(Work(w))

----
Held(c) == \E w \in Workers : hand[w] = c

QueuedNeverLost == \A c \in everQueued : c \in stream \/ c \in saved \/ c \in dropped \/ Held(c)
NothingLost     == lost = {}
DroppedForCause == dropped \subseteq BadCalls
BadNeverSaved   == saved \cap BadCalls = {}
SavedOnce       == \A c \in Calls : saves[c] <= 1

EventuallySaved ==
    <>[](siteUp /\ redisUp) => \A c \in Calls \ BadCalls : (c \in everQueued) ~> (c \in saved)
\* The same without the condition. It does NOT hold: while the site stays down nothing can be saved.
\* It is here to show that the checker does look for recordings that wait forever.
SavedWhateverHappens == \A c \in Calls \ BadCalls : (c \in everQueued) ~> (c \in saved)
===========================================================================
