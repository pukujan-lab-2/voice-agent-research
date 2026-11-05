"""Makes a failed call to the speech server an error LiveKit retries, instead of one that ends the caller's hearing.

LiveKit's speech-to-text pump (livekit/agents/voice/audio_recognition.py, _STTPipeline._stt_pump) recreates its stream only after
an APIError; any other exception "propagates and stops the pump". The speech server runs on another machine (the Pro, over a tunnel),
and a slow turn there raised aiohttp's plain TimeoutError: the pump died with "Error in _stt_pump", and for the rest of the call
nothing the caller said was heard (2026-11-05, 32 s before the caller hung up). A timeout or a socket error is a transport failure,
so it is turned into LiveKit's retryable timeout or connection error; anything else (a bug, a bad answer) is left as it was.

No LiveKit or aiohttp imports, so the logic has its own unit tests (speech/tests/test_speech_errors.py): agent.py passes in
LiveKit's two error classes.
"""
from __future__ import annotations

import asyncio


def _from_aiohttp(error: BaseException) -> bool:
    return any(cls.__module__.split('.')[0] == 'aiohttp' for cls in type(error).__mro__)


def as_retryable(error: BaseException, timeout_error, connection_error, what: str) -> BaseException:
    """The exception to raise instead of `error`: `timeout_error(...)` for a timeout, `connection_error(...)` for a socket or HTTP
    client failure, and `error` itself for anything else. `what` names the step for the message ("speech-to-text")."""
    if isinstance(error, (asyncio.TimeoutError, TimeoutError)):
        return timeout_error(f'{what}: the speech server did not answer in time')
    if isinstance(error, OSError) or _from_aiohttp(error):
        return connection_error(f'{what}: {type(error).__name__}: {error}')
    return error
