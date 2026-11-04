"""What the speech server is doing right now, for deploy/pro/update.sh: restarting the server drops the speech-to-text and
text-to-speech of a call that is using it (#76). /health reports `inflight` (requests being served) and `idle_s` (seconds since
the last one finished), and update.sh skips the restart while either says a call may be using it.
No server imports, so the logic has its own unit tests (speech/tests/test_activity.py).
"""
from __future__ import annotations

import contextlib
import threading
import time
from typing import Callable, Iterator


class Activity:
    def __init__(self, clock: Callable[[], float] = time.monotonic):
        self._clock, self._lock = clock, threading.Lock()
        self._inflight, self._last = 0, clock()

    @contextlib.contextmanager
    def request(self) -> Iterator[None]:
        with self._lock:
            self._inflight += 1
        try:
            yield
        finally:
            with self._lock:
                self._inflight -= 1
                self._last = self._clock()

    def snapshot(self) -> dict:
        with self._lock:
            idle = 0.0 if self._inflight else self._clock() - self._last
            return {'inflight': self._inflight, 'idle_s': round(idle, 1)}
