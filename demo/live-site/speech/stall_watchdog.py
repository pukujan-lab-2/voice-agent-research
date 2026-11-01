"""Catches a call that has stopped turning speech into turns (#67). The agent feeds it what the voice activity detector
and the speech-to-text step do; check() says when the pipeline is stuck so the agent can log it and start the turn over.

  speech heard, never ends     the detector says the caller is still speaking after `speaking_s` (a stuck detector)
  speech ended, no text step   the caller stopped, but no speech-to-text request started within `silent_s`; each stretch of
                               speech the detector hears goes to the recogniser the moment it ends, so a wait means the
                               turn was lost on the way (the call that stopped hearing the caller looked exactly like this)

A recogniser that is slow is not a stall: once its request starts, that request has its own timeout and error span.
No LiveKit imports, so the logic has its own unit tests (speech/tests/test_stall_watchdog.py).
"""
from __future__ import annotations

import time
from typing import Callable


class StallWatchdog:
    def __init__(self, speaking_s: float = 30.0, silent_s: float = 8.0, min_speech_s: float = 0.4, clock: Callable[[], float] = time.monotonic):
        self.speaking_s, self.silent_s, self.min_speech_s, self._clock = speaking_s, silent_s, min_speech_s, clock
        self._speech_since: float | None = None
        self._quiet_since: float | None = None

    def speech_started(self) -> None:
        self._speech_since, self._quiet_since = self._clock(), None

    def speech_ended(self) -> None:
        # A blip (a cough, a click) is not a turn: the recogniser may never be asked about it.
        now = self._clock()
        long_enough = self._speech_since is not None and now - self._speech_since >= self.min_speech_s
        self._speech_since, self._quiet_since = None, now if long_enough else None

    def recognising(self) -> None:
        """The recogniser has the caller's speech: the pipeline is alive."""
        self._quiet_since = None

    def reset(self) -> None:
        self._speech_since = self._quiet_since = None

    def check(self) -> tuple[str, float] | None:
        """(what is stuck, for how many seconds) once, then the watchdog starts over; None while all is well."""
        now = self._clock()
        if self._speech_since is not None and now - self._speech_since > self.speaking_s:
            seen = now - self._speech_since
            self.reset()
            return 'speech-without-end', seen
        if self._quiet_since is not None and now - self._quiet_since > self.silent_s:
            seen = now - self._quiet_since
            self.reset()
            return 'speech-without-turn', seen
        return None
