"""Keeps a keep-warm load from evicting a stack that a call is using.

The speech server holds one stack's models at a time (docs/decisions/0014) and swaps when another stack is asked for. Another app
on the same server, the NYC map agent, sends POST /load for its own stack every four minutes to keep it warm ("a no-op when it is
already there"). With a call on english-fast that is not a no-op: the call's models are unloaded mid-call and the next request waits
11 to 14 s for them to come back, past the agent's 10 s timeout (the 2026-11-05 call: swaps at 19:50:07, 19:54:07 and 20:26:07 local,
each followed by a speech timeout in the agent's log).

A plain /load now leaves the resident stack alone while it is in use or was used within `hold_s`. A call's own load (the agent adds
call=1), and every real speech-to-text and text-to-speech request, still swap: a person is waiting for those.
No server imports, so the logic has its own unit tests (speech/tests/test_stack_hold.py).
"""
from __future__ import annotations

import time
from typing import Callable


class StackHold:
    def __init__(self, hold_s: float = 300.0, clock: Callable[[], float] = time.monotonic):
        self.hold_s, self._clock = hold_s, clock
        self._last: dict[str, float] = {}

    def used(self, stack: str) -> None:
        """A request began or ended on `stack`."""
        self._last[stack] = self._clock()

    def holds(self, resident: str | None, wanted: str, in_use: bool) -> str | None:
        """The resident stack when a keep-warm load of `wanted` must leave it alone, else None."""
        if resident is None or resident == wanted:
            return None
        if in_use or self._clock() - self._last.get(resident, float('-inf')) < self.hold_s:
            return resident
        return None
