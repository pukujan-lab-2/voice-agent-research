"""A recorded call's two small rules, shared by the agent and its tests (#130).

The site names a recorded call's room call-<id>.<business> (server.ts voiceToken), and checks the agent's signature on the
audio it sends (api.ts audioSignature).

When the call ends the agent puts the recording on a Redis stream (publish_recording) and the site saves it from there
(demo/live-site/recording-queue.ts), so a site that is restarting or can't reach the key store saves it later.

If Redis is away the agent posts the recording to the site. If that fails too, the recording is kept in a folder on disk
(keep) and sent again when an agent next starts or finishes a call (resend_kept). formal/recording_queue.tla is the model.
"""
import hashlib, hmac, os, re, time
from pathlib import Path

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


# A kept recording is named <room>__<call>.ogg. Both parts come from the site and are checked before they name a file.
CALL = re.compile(r'[\w-]{6,64}')
KEPT = re.compile(r'(call-[0-9a-f]{8}\.[a-z0-9][a-z0-9-]{0,39})__([\w-]{6,64})\.ogg')
KEEP_MAX_AGE_S = 24 * 3600   # as long as the queue keeps trying (recording-queue.ts MAX_AGE_MS)
SENDING_STALE_S = 600        # a file an agent claimed and never finished with is taken up again after this


async def deliver(audio: bytes, room: str, call: str, *, secret: str, queue_url: str, post, log=print) -> str:
    """Sends one recording: the queue first, then one post to the site. `post(headers, audio)` returns the site's HTTP status.

    Returns 'queued', 'saved', 'refused' (the site answered 4xx: it will never take this recording) or 'failed'."""
    signature = audio_signature(secret, room, call, audio)
    if queue_url:
        try:
            log('recording:', len(audio), 'bytes queued as', await publish_recording(queue_url, room, call, signature, audio))
            return 'queued'
        except Exception as e:  # noqa: BLE001 - Redis is away or full: the post below is still worth a try
            log('recording: not queued, posting it instead:', e)
    try:
        status = await post({'content-type': 'audio/ogg', 'x-call-room': room, 'x-call-id': call, 'x-call-sig': signature}, audio)
    except Exception as e:  # noqa: BLE001 - the site is unreachable
        log('recording: not sent:', e)
        return 'failed'
    if 200 <= status < 300:
        log('recording:', len(audio), 'bytes sent,', status)
        return 'saved'
    if 400 <= status < 500 and status != 429:
        log('recording: refused by the site,', status)
        return 'refused'
    log('recording: the site answered', status)
    return 'failed'


def keep(folder: str, room: str, call: str, audio: bytes) -> Path | None:
    """Writes a recording that could not be sent into the folder. Returns its path, or None when the names can't name a file."""
    if not (ROOM.fullmatch(room) and CALL.fullmatch(call)):
        return None
    Path(folder).mkdir(parents=True, exist_ok=True)
    path = Path(folder) / f'{room}__{call}.ogg'
    part = path.with_name(path.name + '.part')
    part.write_bytes(audio)
    os.replace(part, path)   # a reader never sees half a file
    return path


async def resend_kept(folder: str, *, secret: str, queue_url: str, post, log=print, now=time.time) -> dict[str, int]:
    """Tries every kept recording again. One that is sent or refused is deleted; one older than a day is deleted unsent.

    Several agents may run this at once. Each takes a file by renaming it to <name>.sending.<time>, so one of them sends it;
    a rename keeps the file's modification time, which is when the call ended."""
    counts = {'sent': 0, 'refused': 0, 'waiting': 0, 'expired': 0}
    if not folder or not Path(folder).is_dir():
        return counts
    for path in sorted(Path(folder).iterdir()):
        name, _, taken_at = path.name.partition('.sending.')
        if taken_at and (not taken_at.isdigit() or now() - int(taken_at) < SENDING_STALE_S):
            continue   # another agent is sending it; if that agent died, it is taken up again after SENDING_STALE_S
        match = KEPT.fullmatch(name)
        if not match:
            continue
        taken = path.with_name(f'{name}.sending.{int(now())}')
        try:
            os.replace(path, taken)   # fails if another agent took it first
            age = now() - taken.stat().st_mtime
        except OSError:
            continue
        room, call = match.groups()
        if age >= KEEP_MAX_AGE_S:
            taken.unlink(missing_ok=True)
            counts['expired'] += 1
            log('recording: dropped', call, 'kept for', round(age / 3600), 'h and never sent')
            continue
        outcome = await deliver(taken.read_bytes(), room, call, secret=secret, queue_url=queue_url, post=post, log=log)
        if outcome == 'failed':
            os.replace(taken, path.with_name(name))
            counts['waiting'] += 1
        else:
            taken.unlink(missing_ok=True)
            counts['refused' if outcome == 'refused' else 'sent'] += 1
    return counts
