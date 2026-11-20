"""A recorded call's two small rules, shared by the agent and its tests (#130).

The site names a recorded call's room call-<id>.<business> (server.ts voiceToken), and checks the agent's signature on the
audio it sends (api.ts audioSignature).

When the call ends the agent puts the recording on a Redis stream (publish_recording) and the site saves it from there
(demo/live-site/recording-queue.ts), so a site that is restarting or can't reach the key store saves it later.
"""
import hashlib, hmac, re

ROOM = re.compile(r'call-[0-9a-f]{8}\.([a-z0-9][a-z0-9-]{0,39})')


def room_business(room: str) -> str:
    """The business the site named in the room, or '' for a room that isn't recorded."""
    m = ROOM.fullmatch(room)
    return m.group(1) if m else ''


def audio_signature(secret: str, room: str, call: str, audio: bytes) -> str:
    """HMAC-SHA256 with the site's secret over 'call-audio', the room, the call id and the audio's SHA-256."""
    msg = f'call-audio\n{room}\n{call}\n{hashlib.sha256(audio).hexdigest()}'.encode()
    return hmac.new(secret.encode(), msg, hashlib.sha256).hexdigest()


# The stream the site reads (recording-queue.ts STREAM).
STREAM = 'copilot:call-ended'


async def publish_recording(url: str, room: str, call: str, signature: str, audio: bytes, content_type: str = 'audio/ogg') -> str:
    """Adds the recording to the stream as one message and returns the message's id. Raises when Redis can't take it."""
    import redis.asyncio as redis  # here, so the two rules above need no Redis installed

    client = redis.from_url(url, socket_connect_timeout=3, socket_timeout=20)
    try:
        added = await client.xadd(STREAM, {'room': room, 'call': call, 'sig': signature, 'type': content_type, 'audio': audio})
        return added.decode() if isinstance(added, bytes) else str(added)
    finally:
        await client.aclose()
