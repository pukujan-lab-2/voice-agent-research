"""The copilot's own speech: speech-to-text and text-to-speech on this machine, open models only, no audio leaves it.

  POST /stt   (used by speech/agent.py) body: 16 kHz mono float32 PCM (application/octet-stream) or a WAV file  ->  {"text", "ms"}
  POST /tts   {"text"}  ->  streamed 16-bit PCM at X-Sample-Rate Hz, first sound as soon as it is made
  POST /log   one JSON line per call turn (the widget's timings), appended to speech/turns.jsonl
  GET  /health

STT is NVIDIA Parakeet TDT 0.6B v2 (CC-BY-4.0, sherpa-onnx int8; docs/decisions/0002): about 0.4-1 s for a sentence
on an M1, against 3-4 s for faster-whisper small.en, which pads every clip to 30 s. TTS is Kyutai's Pocket TTS (CPU, streams its first audio in about 0.2-0.5 s);
Kokoro-82M is used instead when Pocket TTS can't load and speech/models/kokoro/ holds its files.

Run: speech/.venv/bin/python speech/server.py [--port 8799]   (server.ts starts it when it isn't running)
"""
import argparse, io, json, os, re, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, 'models')
PARAKEET = os.path.join(MODELS, 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8')


def log(*a):
    print(time.strftime('%H:%M:%S'), *a, flush=True)


class Stt:
    def __init__(self):
        import sherpa_onnx as so
        d = PARAKEET + '/'
        self.rec = so.OfflineRecognizer.from_transducer(
            encoder=d + 'encoder.int8.onnx', decoder=d + 'decoder.int8.onnx', joiner=d + 'joiner.int8.onnx',
            tokens=d + 'tokens.txt', model_type='nemo_transducer', num_threads=4)
        self.lock = threading.Lock()
        self.confidence: float | None = None

    def __call__(self, audio: np.ndarray, sr: int) -> str:
        # A last word that ends right at the clip's edge can be dropped, so pad both ends with a little silence.
        audio = np.concatenate([np.zeros(int(sr * 0.3), 'float32'), audio.astype('float32'), np.zeros(int(sr * 0.5), 'float32')])
        with self.lock:
            s = self.rec.create_stream()
            s.accept_waveform(sr, audio)
            self.rec.decode_stream(s)
            # The model's confidence for the turn: its mean token probability (0 to 1), recorded with the turn (#17).
            lp = list(s.result.ys_log_probs or [])
            self.confidence = round(float(np.exp(np.mean(lp))), 3) if lp else None
            return s.result.text.strip()


class PocketTts:
    def __init__(self, voice: str):
        from pocket_tts import TTSModel
        self.model = TTSModel.load_model()
        self.voice = self.model.get_state_for_audio_prompt(voice)
        self.rate = self.model.sample_rate
        self.lock = threading.Lock()

    def stream(self, text: str, stop: threading.Event):
        with self.lock:
            for chunk in self.model.generate_audio_stream(self.voice, text, stop=stop):
                yield chunk.numpy()


class KokoroTts:
    def __init__(self, voice: str):
        from kokoro_onnx import Kokoro
        d = os.path.join(MODELS, 'kokoro')
        self.k = Kokoro(os.path.join(d, 'kokoro-v1.0.onnx'), os.path.join(d, 'voices-v1.0.bin'))
        self.voice = voice if voice in self.k.get_voices() else 'af_heart'
        self.rate = 24000
        self.lock = threading.Lock()

    def stream(self, text: str, stop: threading.Event):
        # Kokoro makes a sentence at a time, so each sentence plays while the next is made.
        with self.lock:
            for s in re.split(r'(?<=[.!?])\s+', text):
                if stop.is_set():
                    return
                if s.strip():
                    audio, self.rate = self.k.create(s, voice=self.voice, speed=1.0, lang='en-us')
                    yield audio


# Short lines the copilot says again and again (the intro, "Yes, I can hear you.") are kept once made, so they start at
# once; the first time the model makes a sentence after a pause it can take a few seconds on a busy laptop.
COMMON = ["Hi, I'm Brindlewick's assistant.", 'What can I help with?', 'Yes, I can hear you.', "What's your question?",
          'Sure, take your time.', "You're welcome.", 'Anything else?', 'Let me check the tax guides.']


class Cached:
    def __init__(self, tts, size: int = 128):
        self.tts, self.rate, self.size = tts, tts.rate, size
        self.made: dict[str, list] = {}
        self.lock = threading.Lock()

    def stream(self, text: str, stop: threading.Event):
        key = ' '.join(text.split())
        if key in self.made:
            yield from self.made[key]
            return
        chunks = []
        for c in self.tts.stream(text, stop):
            chunks.append(c)
            yield c
        if len(key) <= 120 and not stop.is_set():
            with self.lock:
                if len(self.made) >= self.size:
                    self.made.pop(next(iter(self.made)))
                self.made[key] = chunks


def load_tts(voice: str):
    try:
        return PocketTts(voice)
    except Exception as e:  # noqa: BLE001 - any load failure means try the fallback
        log('pocket tts failed to load:', e)
        if os.path.exists(os.path.join(MODELS, 'kokoro', 'kokoro-v1.0.onnx')):
            return KokoroTts('af_heart')
        raise


def read_audio(body: bytes, ctype: str, sr_param: str | None):
    if ctype.startswith('application/octet-stream'):
        return np.frombuffer(body, dtype='<f4'), int(sr_param or 16000)
    audio, sr = sf.read(io.BytesIO(body), dtype='float32')
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sr


def handler(stt: Stt, tts, turns_path: str):
    class H(BaseHTTPRequestHandler):
        protocol_version = 'HTTP/1.1'

        def log_message(self, *a):
            pass

        def body(self) -> bytes:
            n = int(self.headers.get('content-length') or 0)
            return self.rfile.read(n) if n else b''

        def json(self, code: int, obj):
            b = json.dumps(obj).encode()
            self.send_response(code)
            self.send_header('content-type', 'application/json')
            self.send_header('content-length', str(len(b)))
            self.end_headers()
            self.wfile.write(b)

        def do_GET(self):
            if self.path == '/health':
                return self.json(200, {'ok': True, 'stt': 'parakeet-tdt-0.6b-v2', 'tts': type(tts.tts).__name__, 'rate': tts.rate})
            self.json(404, {'error': 'not found'})

        def do_POST(self):
            path, _, query = self.path.partition('?')
            q = dict(p.split('=', 1) for p in query.split('&') if '=' in p)
            if path == '/stt':
                t = time.time()
                try:
                    audio, sr = read_audio(self.body(), self.headers.get('content-type', ''), q.get('sr'))
                except Exception as e:  # noqa: BLE001
                    return self.json(400, {'error': f'bad audio: {e}'})
                if len(audio) < sr * 0.15:
                    return self.json(200, {'text': '', 'ms': 0})
                text = stt(audio, sr)
                ms = round((time.time() - t) * 1000)
                log(f'stt {ms} ms, {len(audio) / sr:.1f} s audio:', text[:80])
                return self.json(200, {'text': text, 'ms': ms, 'seconds': round(len(audio) / sr, 2), 'confidence': stt.confidence})
            if path == '/tts':
                try:
                    text = str(json.loads(self.body() or b'{}').get('text', '')).strip()[:1200]
                except ValueError:
                    return self.json(400, {'error': 'bad json'})
                if not text:
                    return self.json(400, {'error': 'no text'})
                t = time.time()
                stop = threading.Event()
                self.send_response(200)
                self.send_header('content-type', 'audio/L16')
                self.send_header('x-sample-rate', str(tts.rate))
                self.send_header('transfer-encoding', 'chunked')
                self.send_header('cache-control', 'no-store')
                self.end_headers()
                first, samples = None, 0
                try:
                    for chunk in tts.stream(text, stop):
                        pcm = (np.clip(chunk, -1, 1) * 32767).astype('<i2').tobytes()
                        if first is None:
                            first = round((time.time() - t) * 1000)
                        samples += len(chunk)
                        self.wfile.write(f'{len(pcm):x}\r\n'.encode() + pcm + b'\r\n')
                        self.wfile.flush()
                    self.wfile.write(b'0\r\n\r\n')
                except (BrokenPipeError, ConnectionResetError):
                    # The caller talked over it: the widget dropped the stream, so stop making audio.
                    stop.set()
                    log('tts stopped by the caller')
                    self.close_connection = True
                log(f'tts first {first} ms, total {round((time.time() - t) * 1000)} ms, {samples / tts.rate:.1f} s audio:', text[:60])
                return
            if path == '/log':
                line = self.body().decode('utf-8', 'replace').strip()
                if line and len(line) < 4000:
                    with open(turns_path, 'a') as f:
                        f.write(line.replace('\n', ' ') + '\n')
                self.send_response(204)
                self.send_header('content-length', '0')
                self.end_headers()
                return
            self.json(404, {'error': 'not found'})
    return H


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--port', type=int, default=int(os.environ.get('SPEECH_PORT', 8799)))
    ap.add_argument('--voice', default=os.environ.get('SPEECH_VOICE', 'alba'))
    a = ap.parse_args()
    t = time.time()
    stt = Stt()
    log(f'stt ready in {time.time() - t:.1f} s')
    t = time.time()
    tts = load_tts(a.voice)
    # Warm both up so the first caller doesn't pay for it.
    # The first real utterance of each length is slow until the model has seen it, so warm up on a few lengths of quiet noise.
    rng = np.random.default_rng(0)
    for secs in (0.8, 1.5, 2.5, 4.0):
        stt((rng.standard_normal(int(16000 * secs)) * 0.01).astype('float32'), 16000)
    tts = Cached(tts)
    for line in COMMON:
        for _ in tts.stream(line, threading.Event()):
            pass
    log(f'tts ready in {time.time() - t:.1f} s ({type(tts.tts).__name__}, {tts.rate} Hz)')
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), handler(stt, tts, os.path.join(HERE, 'turns.jsonl')))
    log(f'speech on http://127.0.0.1:{a.port}')
    srv.serve_forever()


if __name__ == '__main__':
    sys.exit(main())
