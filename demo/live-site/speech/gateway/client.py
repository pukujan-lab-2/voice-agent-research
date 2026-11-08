"""What a project adds to use the speech gateway (docs/speech-gateway.md). Copy this file next to the agent.

    SPEECH_URL=http://host.docker.internal:18800        # the gateway, not one speech server
    SPEECH_PROJECT=riley                                # its [project.<name>] block in routes.toml, if any

Send `headers(room)` on every speech request (POST /stt, /tts, /load, the /stt/stream WebSocket), so the whole call stays
on one server, and `release(...)` when the call ends so its place frees at once rather than after idle_s.
A 503 with {"error": "no_room"} means every server on the route is full: fall back (a cloud voice) or try again later.
"""
import os

import aiohttp

NO_ROOM = 503


def headers(call: str | None = None, project: str | None = None) -> dict[str, str]:
    out = {'X-Speech-Project': project or os.environ.get('SPEECH_PROJECT', '')}
    if call:
        out['X-Speech-Call'] = call
    return out


async def warm(http: aiohttp.ClientSession, url: str, project: str | None = None) -> None:
    """Ahead of a call (the site opened, the phone rang): the gateway loads the project's stacks; it answers at once."""
    async with http.post(f'{url}/warm', headers=headers(None, project)):
        pass


async def release(http: aiohttp.ClientSession, url: str, call: str, project: str | None = None) -> None:
    async with http.post(f'{url}/release', headers=headers(call, project)):
        pass
