"""The copilot's own speech: speech-to-text and text-to-speech on this machine, open models only, no audio leaves it.

  POST /stt?stack=&lang=   (used by speech/agent.py) body: 16 kHz mono float32 PCM (application/octet-stream) or a WAV
              file  ->  {"text", "language", "ms"}; lang is the caller's pick, left out to let the recogniser tell
  POST /tts   {"text", "stack", "lang"}  ->  streamed 16-bit PCM at X-Sample-Rate Hz, first sound as soon as it is made
  POST /log   one JSON line per call turn (the widget's timings), appended to speech/turns.jsonl
  POST /load?stack=        swap a stack's models in (and the others' out) ahead of its first request
  GET  /health             which stack is resident and what it loaded

STT is NVIDIA Parakeet TDT 0.6B v2 (CC-BY-4.0, sherpa-onnx int8; docs/decisions/0002): about 0.4-1 s for a sentence
on an M1, against 3-4 s for faster-whisper small.en, which pads every clip to 30 s. TTS is Kyutai's Pocket TTS (CPU, streams its first audio in about 0.2-0.5 s);
Kokoro-82M is used instead when Pocket TTS can't load and speech/models/kokoro/ holds its files.

Those two are the english-fast voice stack. The multilingual stack (speech/stacks.json, docs/decisions/0012) listens with
Whisper large-v3-turbo on Apple's GPU (mlx-whisper) and speaks with Kokoro in the caller's language.

The lfm3-audio stack is one model for all of it: LFM3-Audio-2B on llama.cpp's server (speech/models/lfm3-audio/) hears the
caller's turn (/stt), speaks the reply (/tts) and, for the page's desk, answers the tool calls (api.ts reaches the same
process at LFM3_AUDIO_URL).

Models are swapped, not run all at once (docs/decisions/0014): only the stack in use is resident. The default stack is
loaded at start (--stack, or SPEECH_PRELOAD; 'none' loads nothing) so its first call is fast. A request that names another
stack unloads the models that stack does not use and loads its own, once nothing is still running on the old ones; models
two stacks share stay. Stacks.use() is the one place that happens.

Run: speech/.venv/bin/python speech/server.py [--port 8799]   (server.ts starts it when it isn't running)
"""
import argparse, atexit, base64, contextlib, ctypes, gc, io, json, os, re, subprocess, sys, threading, time, urllib.error, urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, 'models')
PARAKEET = os.path.join(MODELS, 'sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8')
WHISPER = os.environ.get('WHISPER_MODEL', 'mlx-community/whisper-large-v3-turbo')
LFM3_AUDIO = os.path.join(MODELS, 'lfm3-audio')
LFM3_AUDIO_PORT = int(os.environ.get('LFM3_AUDIO_PORT', 8798))
LFM3_AUDIO_URL = os.environ.get('LFM3_AUDIO_URL', '')  # a llama.cpp server already running; left out, one is started from models/lfm3-audio
with open(os.path.join(HERE, 'stacks.json')) as f:
    STACKS = json.load(f)


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
        # The first real utterance of each length is slow until the model has seen it, so warm up on a few lengths of quiet noise.
        rng = np.random.default_rng(0)
        for secs in (0.8, 1.5, 2.5, 4.0):
            self((rng.standard_normal(int(16000 * secs)) * 0.01).astype('float32'), 16000)

    def close(self) -> None:
        self.rec = None

    def __call__(self, audio: np.ndarray, sr: int, lang: str | None = None) -> tuple[str, str]:
        # A last word that ends right at the clip's edge can be dropped, so pad both ends with a little silence.
        audio = np.concatenate([np.zeros(int(sr * 0.3), 'float32'), audio.astype('float32'), np.zeros(int(sr * 0.5), 'float32')])
        with self.lock:
            s = self.rec.create_stream()
            s.accept_waveform(sr, audio)
            self.rec.decode_stream(s)
            # The model's confidence for the turn: its mean token probability (0 to 1), recorded with the turn (#17).
            lp = list(s.result.ys_log_probs or [])
            self.confidence = round(float(np.exp(np.mean(lp))), 3) if lp else None
            return s.result.text.strip(), 'en'  # Parakeet v2 hears English only


class WhisperStt:
    """Whisper large-v3-turbo on Apple's GPU. Told the caller's language when they picked one; otherwise it says which it heard."""

    def __init__(self):
        import mlx_whisper
        self.mw = mlx_whisper
        self.lock = threading.Lock()
        self.confidence: float | None = None  # Whisper gives none per turn
        with self.lock:
            self.mw.transcribe(np.zeros(16000, 'float32'), path_or_hf_repo=WHISPER, language='en')

    def close(self) -> None:
        # mlx_whisper keeps the loaded model on a class, and MLX keeps freed GPU buffers cached: drop both. (The package's
        # `transcribe` is the function, which hides the module of that name, so the module comes from sys.modules.)
        holder = getattr(sys.modules.get('mlx_whisper.transcribe'), 'ModelHolder', None)
        if holder is not None:
            holder.model, holder.model_path = None, None
        gc.collect()
        with contextlib.suppress(Exception):
            import mlx.core as mx
            (getattr(mx, 'clear_cache', None) or mx.metal.clear_cache)()

    def __call__(self, audio: np.ndarray, sr: int, lang: str | None = None) -> tuple[str, str]:
        if sr != 16000:
            audio = np.interp(np.arange(0, len(audio), sr / 16000), np.arange(len(audio)), audio).astype('float32')
        with self.lock:
            r = self.mw.transcribe(audio.astype('float32'), path_or_hf_repo=WHISPER, language=lang or None,
                                   condition_on_previous_text=False, temperature=0.0)
        return str(r.get('text', '')).strip(), str(r.get('language') or lang or '')


class PocketTts:
    def __init__(self, voice: str):
        from pocket_tts import TTSModel
        self.model = TTSModel.load_model()
        self.voice = self.model.get_state_for_audio_prompt(voice)
        self.rate = self.model.sample_rate
        self.lock = threading.Lock()

    def close(self) -> None:
        self.model, self.voice = None, None

    def stream(self, text: str, stop: threading.Event, lang: str = 'en'):
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

    def close(self) -> None:
        self.k = None

    def stream(self, text: str, stop: threading.Event, lang: str = 'en'):
        # The caller's language picks Kokoro's pronunciation and a voice made for it (speech/stacks.json).
        espeak, voice = STACKS['languages'].get(lang, STACKS['languages']['en'])['kokoro']
        if lang == 'en':
            voice = self.voice
        # Kokoro makes a sentence at a time, so each sentence plays while the next is made.
        with self.lock:
            for s in re.split(r'(?<=[.!?。！？])\s*', text):
                if stop.is_set():
                    return
                if s.strip():
                    audio, self.rate = self.k.create(s, voice=voice, speed=1.0, lang=espeak)
                    yield audio


# Short lines the copilot says again and again (the intro, "Yes, I can hear you.") are kept once made, so they start at
# once; the first time the model makes a sentence after a pause it can take a few seconds on a busy laptop.
COMMON = ["Hi, I'm Brindlewick's assistant.", 'What can I help with?', 'Yes, I can hear you.', "What's your question?",
          'Sure, take your time.', "You're welcome.", 'Anything else?', 'Let me check the tax guides.',
          # What the page says while a search runs past its first moment (copilot-engine/src/dialogue.ts, WAIT_SET); a test
          # keeps the two lists in step.
          'One sec.', 'Let me look that up.', 'Checking on that.', 'Okay, looking into it.',
          'Let me pull up the payment plan rules.', 'Let me look up the filing deadline.', 'Let me look into refunds.',
          'Let me check on extensions.', 'Let me check the estimated tax rules.', 'Let me look up amended returns.',
          'Let me look up IRS notices.', 'Let me look up that deduction.', 'Let me look up that credit.', 'Let me look up filing.']


class Cached:
    def __init__(self, tts, size: int = 128):
        self.tts, self.rate, self.size = tts, tts.rate, size
        self.made: dict[str, list] = {}
        self.lock = threading.Lock()

    def close(self) -> None:
        self.made.clear()
        self.tts.close()

    def stream(self, text: str, stop: threading.Event, lang: str = 'en'):
        key = f"{lang} {' '.join(text.split())}"
        if key in self.made:
            yield from self.made[key]
            return
        chunks = []
        for c in self.tts.stream(text, stop, lang):
            chunks.append(c)
            yield c
        if len(key) <= 120 and not stop.is_set():
            with self.lock:
                if len(self.made) >= self.size:
                    self.made.pop(next(iter(self.made)))
                self.made[key] = chunks


class Lfm3Audio:
    """LFM3-Audio-2B on llama.cpp's server: the stack's listener, its voice and the model behind the desk's tool calls.

    A caller's turn is cut by voice activity and recognised whole (`Perform ASR in <language>.`), not by the English-only
    live recogniser; the reply is spoken by /tts in the model's own voice. Both take the model card's 18 languages;
    stacks.json lists the ones a call test has shown."""
    rate = 24000

    def __init__(self):
        self.confidence: float | None = None  # the server gives none per turn
        self.proc: subprocess.Popen | None = None
        self.url = LFM3_AUDIO_URL.rstrip('/') or self._start()
        for _ in range(240):
            if self.proc and self.proc.poll() is not None:
                raise RuntimeError(f'llama.cpp server exited with {self.proc.returncode}; see speech/lfm3-audio.log')
            try:
                with urllib.request.urlopen(f'{self.url}/health', timeout=2) as r:
                    if r.status == 200:
                        break
            except (urllib.error.URLError, OSError):
                time.sleep(1)
        else:
            raise RuntimeError('llama.cpp server was not ready in 240 s')
        self.voice = Cached(_Lfm3Voice(self))

    def _start(self) -> str:
        server = os.path.join(LFM3_AUDIO, 'bin', 'llama-server')
        model = os.path.join(LFM3_AUDIO, 'LFM3-Audio-2B-Q4_K_M.gguf')
        mmproj = os.path.join(LFM3_AUDIO, 'mmproj-LFM3-Audio-2B-Q8_0.gguf')
        for need in (server, model, mmproj):
            if not os.path.exists(need):
                raise FileNotFoundError(f'{need} is missing (see speech/requirements.txt, the lfm3-audio stack)')
        # Greedy text (the GGUF card); the audio sampling is stored in the GGUF; --jinja uses the chat template's tool format.
        out = open(os.path.join(HERE, 'lfm3-audio.log'), 'ab')
        self.proc = subprocess.Popen([server, '-m', model, '--mmproj', mmproj, '--host', '127.0.0.1', '--port', str(LFM3_AUDIO_PORT),
                                      '-c', '8192', '--jinja', '--temp', '0'], stdout=out, stderr=subprocess.STDOUT)
        atexit.register(self.proc.terminate)
        return f'http://127.0.0.1:{LFM3_AUDIO_PORT}'

    def close(self) -> None:
        # The model lives in the llama.cpp process: ending it gives its 1.5 GB back. A server we did not start is left running.
        if self.proc and self.proc.poll() is None:
            atexit.unregister(self.proc.terminate)
            self.proc.terminate()
            try:
                self.proc.wait(20)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()

    def _post(self, path: str, body: dict, timeout: float = 60):
        req = urllib.request.Request(self.url + path, data=json.dumps(body).encode(), headers={'content-type': 'application/json'})
        return urllib.request.urlopen(req, timeout=timeout)

    def __call__(self, audio: np.ndarray, sr: int, lang: str | None = None) -> tuple[str, str]:
        if sr != 16000:
            audio = np.interp(np.arange(0, len(audio), sr / 16000), np.arange(len(audio)), audio).astype('float32')
        wav = io.BytesIO()
        sf.write(wav, audio.astype('float32'), 16000, format='WAV', subtype='PCM_16')
        # The caller's pick goes into the prompt; with none, the model is left to tell which language it hears.
        name = STACKS['languages'].get(lang or '', {}).get('name')
        body = {'messages': [{'role': 'system', 'content': f'Perform ASR in {name}.' if name else 'Perform ASR.'},
                             {'role': 'user', 'content': [{'type': 'input_audio', 'input_audio': {'data': base64.b64encode(wav.getvalue()).decode()}}]}],
                'temperature': 0, 'max_tokens': 400}
        with self._post('/v1/chat/completions', body) as r:
            text = json.load(r)['choices'][0]['message']['content']
        return str(text or '').strip(), lang or 'en'  # the text names no language: with no pick, a call is English

    def stream(self, text: str, stop: threading.Event, lang: str = 'en'):
        body = {'input': text, 'lang': lang, 'voice': 'female', 'response_format': 'pcm', 'stream': True}
        with self._post('/tts', body) as r:
            rest = b''
            while not stop.is_set():
                chunk = r.read1(16384)
                if not chunk:
                    return
                rest += chunk
                n = len(rest) - len(rest) % 4
                if n:
                    yield np.frombuffer(rest[:n], dtype='<f4').copy()
                    rest = rest[n:]


class _Lfm3Voice:
    """Lfm3Audio's voice, shaped like the other voices so Cached keeps the lines the copilot says again and again."""

    def __init__(self, model: Lfm3Audio):
        self.model, self.rate = model, model.rate

    def close(self) -> None:
        pass  # the model's own close ends the server

    def stream(self, text: str, stop: threading.Event, lang: str = 'en'):
        yield from self.model.stream(text, stop, lang)


def load_tts(voice: str):
    try:
        return PocketTts(voice)
    except Exception as e:  # noqa: BLE001 - any load failure means try the fallback
        log('pocket tts failed to load:', e)
        if os.path.exists(os.path.join(MODELS, 'kokoro', 'kokoro-v1.0.onnx')):
            return KokoroTts('af_heart')
        raise


class Stacks:
    """The voice stacks' models, swapped and not kept all at once (docs/decisions/0014): only the models of the stack in
    use are resident. A request names its stack in use(); when that is not the resident stack, the models it does not use
    are unloaded and its own loaded, once nothing is still running on the old ones. Models two stacks share stay."""

    def __init__(self, voice: str = 'alba'):
        self.voice_name = voice
        self.made: dict[str, object] = {}  # the resident models, by the names stacks.json gives them
        self.active: str | None = None
        self.busy: dict[str, int] = {}     # requests running on each stack
        self.cond = threading.Condition()
        self.last_swap: dict = {}

    def _build(self, name: str):
        if name == 'parakeet-tdt-0.6b-v2':
            return Stt()
        if name == 'pocket-tts':
            tts = Cached(load_tts(self.voice_name))
            for line in COMMON:  # lines said again and again start at once, from the first call
                for _ in tts.stream(line, threading.Event()):
                    pass
            return tts
        if name == 'kokoro':
            return Cached(KokoroTts('af_heart'))
        if name.startswith('whisper'):
            return WhisperStt()
        if name == 'lfm3-audio':
            return Lfm3Audio()
        raise KeyError(name)

    def _swap(self, stack: str) -> None:
        parts = STACKS['stacks'][stack]
        need = [n for n in dict.fromkeys((parts['listens'], parts['speaks']))]
        t = time.time()
        gone = [n for n in self.made if n not in need]
        for n in gone:
            model = self.made.pop(n)
            with contextlib.suppress(Exception):
                model.close()  # type: ignore[attr-defined]
            del model
        if gone:
            gc.collect()
            with contextlib.suppress(Exception):  # hand the freed pages back to macOS now, not when it next needs them
                ctypes.CDLL(None).malloc_zone_pressure_relief(0, 0)
        freed = time.time() - t
        added = []
        for n in need:
            if n not in self.made:
                t1 = time.time()
                self.made[n] = self._build(n)
                added.append(n)
                log(f'{n} ready in {time.time() - t1:.1f} s')
        self.last_swap = {'from': self.active, 'to': stack, 'unloaded': gone, 'loaded': added, 'unload_ms': round(freed * 1000), 'total_ms': round((time.time() - t) * 1000)}
        log(f"stack {self.active} -> {stack}: unloaded {gone or 'nothing'}, loaded {added or 'nothing'} in {time.time() - t:.1f} s")
        self.active = stack

    @contextlib.contextmanager
    def use(self, stack: str):
        """Hold a stack's models for one request; loads them first, swapping out another stack's, if they are not resident."""
        stack = stack if stack in STACKS['stacks'] else STACKS['default']
        with self.cond:
            while any(n for s, n in self.busy.items() if s != stack and n):
                self.cond.wait()  # a request on the old stack is still using its models
            if self.active != stack or any(n not in self.made for n in (STACKS['stacks'][stack]['listens'], STACKS['stacks'][stack]['speaks'])):
                self._swap(stack)
            self.busy[stack] = self.busy.get(stack, 0) + 1
        try:
            yield stack
        finally:
            with self.cond:
                self.busy[stack] -= 1
                self.cond.notify_all()

    def part(self, stack: str, kind: str):
        """The stack's listener or voice. Call inside use(stack)."""
        name = STACKS['stacks'][stack][kind]
        # lfm3-audio is one model: the listener is the model itself, the voice is its cached /tts.
        return self.made[name].voice if name == 'lfm3-audio' and kind == 'speaks' else self.made[name]


def read_audio(body: bytes, ctype: str, sr_param: str | None):
    if ctype.startswith('application/octet-stream'):
        return np.frombuffer(body, dtype='<f4'), int(sr_param or 16000)
    audio, sr = sf.read(io.BytesIO(body), dtype='float32')
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    return audio, sr


def handler(stacks: Stacks, turns_path: str):
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
                parts = STACKS['stacks'][stacks.active or STACKS['default']]
                return self.json(200, {'ok': True, 'stt': parts['listens'], 'tts': parts['speaks'], 'rate': 24000, 'active': stacks.active,
                                       'loaded': sorted(stacks.made), 'last_swap': stacks.last_swap,
                                       'rates': {'kokoro': 24000, 'pocket-tts': 24000, 'lfm3-audio': 24000}})
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
                lang = q.get('lang') or None
                if len(audio) < sr * 0.15:
                    return self.json(200, {'text': '', 'language': lang or '', 'ms': 0})
                with stacks.use(q.get('stack', '')) as stack:
                    listener = stacks.part(stack, 'listens')
                    t = time.time()  # the turn's time, not the wait for a swap
                    text, heard = listener(audio, sr, lang)
                    confidence = listener.confidence
                ms = round((time.time() - t) * 1000)
                log(f'stt {ms} ms, {len(audio) / sr:.1f} s audio, {heard}:', text[:80])
                return self.json(200, {'text': text, 'language': heard, 'ms': ms, 'seconds': round(len(audio) / sr, 2), 'confidence': confidence})
            if path == '/load':
                # Swap a stack's models in (and the others' out) ahead of its first request: the agent asks before it greets.
                t = time.time()
                with stacks.use(q.get('stack', '')) as stack:
                    pass
                return self.json(200, {'ok': True, 'stack': stack, 'loaded': sorted(stacks.made), 'ms': round((time.time() - t) * 1000), 'swap': stacks.last_swap})
            if path == '/tts':
                try:
                    b = json.loads(self.body() or b'{}')
                    text = str(b.get('text', '')).strip()[:1200]
                except ValueError:
                    return self.json(400, {'error': 'bad json'})
                lang = str(b.get('lang') or 'en').split('-')[0]
                if not text:
                    return self.json(400, {'error': 'no text'})
                with stacks.use(str(b.get('stack') or '')) as stack:  # held until the last chunk is sent, so a swap waits for it
                    tts = stacks.part(stack, 'speaks')
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
                        for chunk in tts.stream(text, stop, lang):
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
    ap.add_argument('--stack', default=os.environ.get('SPEECH_PRELOAD', STACKS['default']),
                    help="the stack loaded at start so its first call is fast; 'none' loads nothing until a call picks a stack")
    a = ap.parse_args()
    stacks = Stacks(a.voice)
    if a.stack != 'none':
        t = time.time()
        with stacks.use(a.stack):
            pass
        log(f'{stacks.active} ready in {time.time() - t:.1f} s')
    srv = ThreadingHTTPServer(('127.0.0.1', a.port), handler(stacks, os.path.join(HERE, 'turns.jsonl')))
    log(f'speech on http://127.0.0.1:{a.port}')
    srv.serve_forever()


if __name__ == '__main__':
    sys.exit(main())
