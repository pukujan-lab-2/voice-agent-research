import io, json, os, struct, sys, unittest
from contextlib import contextmanager

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
import stt_stream  # noqa: E402

SR = 16000


def frame(op, payload, mask=b'\x01\x02\x03\x04'):
    """A client frame: clients always mask."""
    n = len(payload)
    head = bytes([0x80 | op]) + (bytes([0x80 | n]) if n < 126 else bytes([0x80 | 126]) + struct.pack('>H', n))
    return head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))


def text(m):
    return frame(1, json.dumps(m).encode())


def audio(seconds):
    return frame(2, b'\x00\x01' * int(seconds * SR))


class Stacks:
    """Stands in for the server's stacks: counts transcriptions and says how many samples each one heard."""
    def __init__(self):
        self.calls = []

    @contextmanager
    def use(self, name):
        yield name

    def part(self, stack, kind):
        def listen(a, sr, lang):
            self.calls.append((stack, len(a), lang))
            return f'{len(a)} samples', lang or 'en'
        return listen


class Handler:
    def __init__(self, data):
        self.rfile, self.wfile = io.BytesIO(data), io.BytesIO()

    def replies(self):
        out, r = [], io.BytesIO(self.wfile.getvalue())
        while True:
            op, body = stt_stream.read(r)
            if op == 8:
                return out
            out.append(json.loads(body) if op == 1 else (op, body))


def run(*frames, q=None):
    h, stacks = Handler(b''.join(frames)), Stacks()
    stt_stream.serve(h, stacks, q or {'stack': 'english-fast', 'lang': 'en'}, lambda *a: None)
    return h.replies(), stacks.calls


class StreamTest(unittest.TestCase):
    def test_a_pause_that_ends_the_turn_is_kept_and_not_transcribed_twice(self):
        replies, calls = run(audio(1), text({'type': 'decode'}), audio(0.3), text({'type': 'end', 'speech_end': SR}))
        self.assertEqual(len(calls), 1)
        self.assertEqual(replies[0]['type'], 'interim')
        self.assertEqual((replies[1]['type'], replies[1]['kept'], replies[1]['text']), ('final', True, f'{SR} samples'))

    def test_speech_after_the_pause_is_transcribed_again_with_the_whole_turn(self):
        replies, calls = run(audio(1), text({'type': 'decode'}), audio(1), text({'type': 'end', 'speech_end': 2 * SR}))
        self.assertEqual([c[1] for c in calls], [SR, 2 * SR])
        self.assertFalse(replies[1]['kept'])
        self.assertEqual(replies[1]['text'], f'{2 * SR} samples')

    def test_each_turn_starts_empty(self):
        replies, calls = run(audio(1), text({'type': 'end', 'speech_end': SR}), audio(0.5), text({'type': 'end', 'speech_end': SR // 2}))
        self.assertEqual([c[1] for c in calls], [SR, SR // 2])
        self.assertEqual([r['seconds'] for r in replies], [1.0, 0.5])

    def test_too_little_audio_is_not_sent_to_the_model(self):
        replies, calls = run(audio(0.1), text({'type': 'end', 'speech_end': SR // 10}))
        self.assertEqual(calls, [])
        self.assertEqual(replies[0]['text'], '')

    def test_a_message_can_switch_the_stack_and_language(self):
        _, calls = run(audio(1), text({'type': 'end', 'speech_end': SR, 'stack': 'spanish', 'lang': 'es'}))
        self.assertEqual(calls, [('spanish', SR, 'es')])

    def test_a_ping_gets_a_pong(self):
        replies, _ = run(frame(9, b'hi'))
        self.assertEqual(replies, [(10, b'hi')])

    def test_the_handshake_answers_with_the_rfc_key(self):
        class H:
            headers = {'upgrade': 'websocket', 'sec-websocket-key': 'dGhlIHNhbXBsZSBub25jZQ=='}
            sent = {}
            wfile = io.BytesIO()

            def send_response(self, code):
                self.code = code

            def send_header(self, k, v):
                self.sent[k] = v

            def end_headers(self):
                pass
        h = H()
        self.assertTrue(stt_stream.accept(h))
        self.assertEqual((h.code, h.sent['sec-websocket-accept']), (101, 's3pPLMBiTxaQ9kYGzzhZRbK+xOo='))


if __name__ == '__main__':
    unittest.main()
