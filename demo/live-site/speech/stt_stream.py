"""Streaming listening over a WebSocket: GET /stt/stream?stack=&lang=&sr= upgrades, then the caller's audio arrives
while they talk, so nothing is left to upload when the turn ends.

The client (the agent's VAD) sends 16-bit mono PCM as binary messages and two text messages:
  {"type": "decode"}                    the caller just paused: transcribe what has arrived, reply {"type": "interim"}
  {"type": "end", "speech_end": n}      the turn is over at sample n (either can name "stack" and "lang"): reply {"type": "final", "text", "language", "ms"}
A pause is heard about 0.1 s after the last word and the turn ends 0.3 s after it, so by "end" the pause's transcript is
usually made already. When no speech came after it (speech_end <= the samples it covered) that transcript is the final
one, and the reply is immediate; otherwise the whole turn is transcribed then. Parakeet is not a streaming model, so each
transcript is of the whole turn so far: about two per turn, the same work as /stt plus the pauses that weren't the end.
"""
import base64
import hashlib
import json
import struct
import time

import numpy as np

GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'


def accept(h) -> bool:
    """Answer the WebSocket handshake on a BaseHTTPRequestHandler. False when the request is not an upgrade."""
    key = h.headers.get('sec-websocket-key')
    if 'websocket' not in (h.headers.get('upgrade') or '').lower() or not key:
        return False
    h.send_response(101)
    h.send_header('upgrade', 'websocket')
    h.send_header('connection', 'Upgrade')
    h.send_header('sec-websocket-accept', base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode())
    h.end_headers()
    h.wfile.flush()
    return True


def read(rfile) -> tuple[int, bytes]:
    """One whole message (continuations joined): (opcode, payload). Opcode 8 is a close, also when the socket drops."""
    op, data = None, b''
    while True:
        head = rfile.read(2)
        if len(head) < 2:
            return 8, b''
        fin, code = head[0] & 0x80, head[0] & 0x0F
        n = head[1] & 0x7F
        if n == 126:
            n = struct.unpack('>H', rfile.read(2))[0]
        elif n == 127:
            n = struct.unpack('>Q', rfile.read(8))[0]
        mask = rfile.read(4) if head[1] & 0x80 else b''
        body = rfile.read(n)
        if mask:
            body = (np.frombuffer(body, np.uint8) ^ np.resize(np.frombuffer(mask, np.uint8), n)).tobytes()
        if code in (8, 9, 10):
            return code, body  # control frames are never fragmented
        op = code if op is None else op
        data += body
        if fin:
            return op, data


def send(wfile, op: int, payload: bytes) -> None:
    n = len(payload)
    head = bytes([0x80 | op]) + (bytes([n]) if n < 126 else bytes([126]) + struct.pack('>H', n) if n < 65536
                                 else bytes([127]) + struct.pack('>Q', n))
    wfile.write(head + payload)
    wfile.flush()


def serve(h, stacks, q: dict, log) -> None:
    """The connection's loop: one call's listening, a turn at a time, until the client closes."""
    sr, lang = int(q.get('sr') or 16000), q.get('lang') or None
    turn, made = bytearray(), (0, '', '')  # this turn's audio; (samples transcribed, text, language) of the last transcript

    def transcribe(m: dict) -> tuple[int, str, str]:
        # A message can name the stack and language: the caller can switch to Spanish mid-call
        said = m.get('lang') or lang
        n = len(turn) // 2
        if n < sr * 0.15:
            return n, '', said or ''
        audio = np.frombuffer(bytes(turn[:n * 2]), '<i2').astype('float32') / 32768
        with stacks.use(m.get('stack') or q.get('stack', '')) as stack:
            text, heard = stacks.part(stack, 'listens')(audio, sr, said)
        return n, text, heard

    while True:
        op, data = read(h.rfile)
        if op == 8:
            return
        if op == 9:
            send(h.wfile, 10, data)
        elif op == 2:
            turn.extend(data)
        elif op == 1:
            m = json.loads(data or b'{}')
            t = time.time()
            if m.get('type') == 'decode':
                made = transcribe(m)
                send(h.wfile, 1, json.dumps({'type': 'interim', 'text': made[1], 'ms': round((time.time() - t) * 1000)}).encode())
            elif m.get('type') == 'end':
                kept = made[0] > 0 and made[0] >= int(m.get('speech_end') or 0)
                if not kept:
                    made = transcribe(m)
                ms = round((time.time() - t) * 1000)
                log(f"stt stream {ms} ms{' (kept from the pause)' if kept else ''}, {len(turn) / 2 / sr:.1f} s audio:", made[1][:80])
                send(h.wfile, 1, json.dumps({'type': 'final', 'text': made[1], 'language': made[2], 'ms': ms, 'kept': kept,
                                             'seconds': round(len(turn) / 2 / sr, 2)}).encode())
                turn.clear()
                made = (0, '', '')
