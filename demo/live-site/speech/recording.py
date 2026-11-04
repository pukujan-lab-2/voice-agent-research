"""A recorded call's two small rules, shared by the agent and its tests (#130).

The site names a recorded call's room call-<id>.<business> (server.ts voiceToken), and checks the agent's signature on the
audio it sends (api.ts audioSignature).
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
