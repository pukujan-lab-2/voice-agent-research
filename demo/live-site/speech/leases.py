"""Which calls are using this speech server, so an agent with more than one server can send a call where there is room.

A call takes a lease when it starts (POST /load ... &lease=<room>), keeps it with POST /lease every half minute, and gives it back
with POST /release when it ends. A lease nobody keeps runs out after `ttl_s`, so a worker that dies mid-call doesn't hold a place
for ever. /health reports `calls` (live leases), `calls_by_stack` and `max_calls`: one server serves about two calls at once before
callers wait on its model locks (docs/scaling-limits.md, 2026-11-07).
No server imports, so the logic has its own unit tests (speech/tests/test_leases.py).
"""
from __future__ import annotations

import threading
import time
from typing import Callable

DEFAULT_TTL_S = 90.0


class Leases:
    def __init__(self, ttl_s: float = DEFAULT_TTL_S, clock: Callable[[], float] = time.monotonic):
        self.ttl_s, self._clock, self._lock = ttl_s, clock, threading.Lock()
        self._held: dict[str, tuple[str, float]] = {}  # lease id -> (stack, last kept)

    def _prune(self) -> None:
        now = self._clock()
        for k in [k for k, (_, t) in self._held.items() if now - t > self.ttl_s]:
            del self._held[k]

    def take(self, lease: str, stack: str) -> None:
        """Take or keep a lease; a call that changes stack (the caller picked Spanish) keeps the same one."""
        with self._lock:
            self._held[lease] = (stack, self._clock())

    def keep(self, lease: str) -> bool:
        """Keep a lease alive; False when it has run out or was never taken, so the caller takes it again."""
        with self._lock:
            self._prune()
            if lease not in self._held:
                return False
            self._held[lease] = (self._held[lease][0], self._clock())
            return True

    def release(self, lease: str) -> None:
        with self._lock:
            self._held.pop(lease, None)

    def count(self) -> int:
        with self._lock:
            self._prune()
            return len(self._held)

    def by_stack(self) -> dict[str, int]:
        with self._lock:
            self._prune()
            out: dict[str, int] = {}
            for stack, _ in self._held.values():
                out[stack] = out.get(stack, 0) + 1
            return out
