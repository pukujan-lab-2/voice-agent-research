"""The voice call's agent on LiveKit Agents (docs/decisions/0002): it hears and speaks; the copilot engine decides.

  caller's browser ──WebRTC──► LiveKit server (local, dev mode) ◄──► this worker
    Silero VAD + LiveKit's turn detector end each turn and handle barge-in (the caller talks over the voice);
    LocalSTT / LocalTTS call speech/server.py with the call's voice stack (speech/stacks.json, docs/decisions/0012):
      english-fast  Parakeet to listen, the English turn detector, Pocket TTS to speak
      multilingual  Whisper large-v3-turbo, the multilingual turn detector, Kokoro in the caller's language
    The page puts the stack server.ts picked and the caller's language on the caller's participant attributes
    (copilot.stack, copilot.language); a language changed mid-call takes effect from the next turn;
    the decision step is the copilot engine in the caller's page (widget/sdk.ts), reached over LiveKit RPC:
      copilot.greet  -> the short spoken intro          copilot.turn {text} -> the reply to speak
    so read-backs, never-submit, quote-only answers, verification and page actions all stay in the engine.

Every turn's timings go to speech/turns.jsonl: from the moment the caller stops talking, the end-of-turn wait (VAD and
turn detector), STT, the engine's decision (which includes any library search) and the voice's first audio.

Run: speech/.venv/bin/python speech/agent.py dev    (server.ts starts it with the speech server)
"""
import asyncio, json, os, time, uuid

import aiohttp
from livekit import rtc
from livekit.agents import (
    Agent, AgentServer, AgentSession, APIConnectOptions, JobContext, JobProcess, StopResponse, cli, stt, tts,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.plugins import silero
from livekit.plugins.turn_detector.english import EnglishModel
from livekit.plugins.turn_detector.multilingual import MultilingualModel

SPEECH = os.environ.get('SPEECH_URL', 'http://127.0.0.1:8799')
HERE = os.path.dirname(os.path.abspath(__file__))
TURNS = os.path.join(HERE, 'turns.jsonl')
with open(os.path.join(HERE, 'stacks.json')) as f:
    STACKS = json.load(f)


def log_turn(row: dict):
    row = {'at': time.strftime('%Y-%m-%dT%H:%M:%S'), **row}
    print('turn', json.dumps(row), flush=True)
    with open(TURNS, 'a') as f:
        f.write(json.dumps(row) + '\n')


class Voice:
    """The call's stack and language. language is the caller's pick, or '' to go by what the recogniser hears."""

    def __init__(self, stack: str, language: str):
        self.stack = stack if stack in STACKS['stacks'] else STACKS['default']
        self.parts = STACKS['stacks'][self.stack]
        self.picked = ''
        self.heard = ''
        self.pick(language)

    def pick(self, language: str) -> None:
        self.picked = language if language in self.parts['languages'] else ''

    @property
    def language(self) -> str:
        """What the voice speaks and the reply is written in: the pick, else the last language heard that the stack speaks."""
        return self.picked or (self.heard if self.heard in self.parts['languages'] else self.parts['languages'][0])


class LocalSTT(stt.STT):
    """One finished turn to text on speech/server.py with the stack's listener. The VAD cuts the turns, so no streaming is needed."""

    def __init__(self, http: aiohttp.ClientSession, voice: Voice):
        super().__init__(capabilities=stt.STTCapabilities(streaming=False, interim_results=False))
        self._http, self._voice = http, voice
        self.last_ms = 0

    @property
    def model(self) -> str:
        return self._voice.parts['listens']

    @property
    def provider(self) -> str:
        return 'local'

    async def warm(self) -> None:
        # Parakeet is slow on its first turn after a while idle; Whisper is warmed when it loads, and a second call on
        # it would only queue behind the caller's first turn.
        if not self._voice.parts['listens'].startswith('parakeet'):
            return
        import numpy as np
        noise = (np.random.default_rng().standard_normal(16000 * 2) * 0.01).astype(np.float32).tobytes()
        try:
            async with self._http.post(f'{SPEECH}/stt', params={'sr': 16000, 'stack': self._voice.stack, 'lang': 'en'}, data=noise, headers={'content-type': 'application/octet-stream'}) as r:
                await r.read()
        except aiohttp.ClientError:
            pass

    def _timeout(self, conn_options: APIConnectOptions) -> float:
        # Whisper pads every clip to 30 s of audio and shares the GPU, so on a busy 8 GB laptop a turn can take
        # well over LiveKit's default 10 s (34 s for one turn, seen with the machine in swap); dropping it would lose what the caller said.
        return conn_options.timeout if self._voice.parts['listens'].startswith('parakeet') else max(conn_options.timeout, 60.0)

    async def _recognize_impl(self, buffer, *, language=None, conn_options: APIConnectOptions) -> stt.SpeechEvent:
        frame = rtc.combine_audio_frames(buffer)
        t = time.perf_counter()
        v = self._voice
        async with self._http.post(f'{SPEECH}/stt', params={'sr': frame.sample_rate, 'stack': v.stack, 'lang': v.picked}, data=_pcm_float(frame),
                                   headers={'content-type': 'application/octet-stream'},
                                   timeout=aiohttp.ClientTimeout(total=self._timeout(conn_options))) as r:
            r.raise_for_status()
            j = await r.json()
        text = j.get('text', '')
        # The language the recogniser heard (or was told): the turn detector and the voice go by it.
        if text and j.get('language'):
            v.heard = j['language']
        self.last_ms = round((time.perf_counter() - t) * 1000)
        return stt.SpeechEvent(type=stt.SpeechEventType.FINAL_TRANSCRIPT,
                               alternatives=[stt.SpeechData(language=j.get('language') or v.language, text=text)])


def _pcm_float(frame: rtc.AudioFrame) -> bytes:
    import numpy as np
    pcm = np.frombuffer(frame.data, dtype=np.int16)
    if frame.num_channels > 1:
        pcm = pcm.reshape(-1, frame.num_channels).mean(axis=1)
    return (pcm.astype(np.float32) / 32768).tobytes()


class LocalTTS(tts.TTS):
    """The stack's voice on speech/server.py, in the call's language, streamed: the first words play while the rest is made."""

    def __init__(self, http: aiohttp.ClientSession, sample_rate: int, voice: Voice):
        super().__init__(capabilities=tts.TTSCapabilities(streaming=False), sample_rate=sample_rate, num_channels=1)
        self._http, self._voice = http, voice
        self.first_ms: int | None = None  # the last reply's first audio, from the request

    @property
    def model(self) -> str:
        return self._voice.parts['speaks']

    @property
    def provider(self) -> str:
        return 'local'

    def synthesize(self, text: str, *, conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS) -> tts.ChunkedStream:
        return _LocalStream(tts=self, input_text=text, conn_options=conn_options)


class _LocalStream(tts.ChunkedStream):
    async def _run(self, output_emitter: tts.AudioEmitter) -> None:
        t: LocalTTS = self._tts  # type: ignore[assignment]
        output_emitter.initialize(request_id=uuid.uuid4().hex, sample_rate=t.sample_rate, num_channels=1,
                                  mime_type='audio/pcm', frame_size_ms=40, stream=False)
        async with t._http.post(f'{SPEECH}/tts', json={'text': self._input_text, 'stack': t._voice.stack, 'lang': t._voice.language},
                                timeout=aiohttp.ClientTimeout(total=60, sock_read=self._conn_options.timeout)) as r:
            r.raise_for_status()
            async for chunk in r.content.iter_any():
                if t.first_ms is None:
                    t.first_ms = round((time.perf_counter() - self._started_time) * 1000)
                output_emitter.push(chunk)
        output_emitter.flush()


class Copilot(Agent):
    """No LLM of its own: each finished turn goes to the copilot engine in the caller's page, and its reply is spoken."""

    def __init__(self, room: rtc.Room, caller: str, stt_: LocalSTT, tts_: LocalTTS, voice: Voice):
        super().__init__(instructions='The copilot engine in the page decides every reply.')
        self._room, self._caller, self._stt, self._tts, self._voice = room, caller, stt_, tts_, voice
        self.turn: dict = {}

    async def _rpc(self, method: str, payload: dict, timeout: float = 45.0) -> dict:
        r = await self._room.local_participant.perform_rpc(
            destination_identity=self._caller, method=method, payload=json.dumps(payload), response_timeout=timeout)
        return json.loads(r or '{}')

    async def on_enter(self) -> None:
        # Wake the speech-to-text model while the intro plays: after a while idle, its first turn is seconds slower.
        self._warming = asyncio.create_task(self._stt.warm())
        # The page asked for the microphone before it joined, so the caller already answered that prompt.
        r = await self._rpc('copilot.greet', {})
        if r.get('say'):
            self.session.say(r['say'], allow_interruptions=True)

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        said = (new_message.text_content or '').strip()
        if not said:
            raise StopResponse()
        t = time.perf_counter()
        try:
            # The language goes with the words, so the reply is written in it (a pick, or what the recogniser heard).
            r = await self._rpc('copilot.turn', {'text': said, 'language': self._voice.language, 'heard': self._voice.heard})
        except Exception as e:  # noqa: BLE001 - a page that went away or timed out: say so, don't hang
            print('copilot.turn failed:', e, flush=True)
            r = {'say': "Sorry, something went wrong on my side. Could you say that again?"}
        self.turn = {'stt_ms': self._stt.last_ms, 'decide_ms': round((time.perf_counter() - t) * 1000),
                     'kind': r.get('kind', ''), 'search_ms': r.get('searchMs')}
        if r.get('say'):
            self._tts.first_ms = None
            self.session.say(r['say'], allow_interruptions=True)
        # The engine's reply is the whole response: no LLM runs after it.
        raise StopResponse()


# One local caller at a time on a busy laptop: the machine's CPU load (a library load, the LiveKit VM) must not make the
# worker turn calls away, so it is always available. Modules the agent loop would otherwise import mid-call are loaded first.
server = AgentServer(num_idle_processes=1, load_fnc=lambda: 0.0, load_threshold=1.0, preload_modules=['filelock', 'numpy'])


def prewarm(proc: JobProcess):
    proc.userdata['vad'] = silero.VAD.load(min_speech_duration=0.15, min_silence_duration=0.3, prefix_padding_duration=0.3)


server.setup_fnc = prewarm


def voice_parts(http: aiohttp.ClientSession, voice: Voice, rates: dict) -> tuple[LocalSTT, LocalTTS, object]:
    """The stack's listener, voice and turn detector. A stack whose one model hears, thinks and speaks (lfm3-audio, later)
    replaces this cascade with its own adapter here; the engine's turns and decision 0011's code lock stay as they are."""
    turns = MultilingualModel() if voice.parts['turns'] == 'multilingual' else EnglishModel()
    return LocalSTT(http, voice), LocalTTS(http, int(rates.get(voice.parts['speaks'], 24000)), voice), turns


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    caller = await ctx.wait_for_participant()
    http = aiohttp.ClientSession()
    async with http.get(f'{SPEECH}/health') as r:
        health = await r.json()
    rates = health.get('rates') or {'pocket-tts': health.get('rate', 24000)}
    voice = Voice(caller.attributes.get('copilot.stack', ''), caller.attributes.get('copilot.language', ''))
    print('call', ctx.room.name, 'stack', voice.stack, 'language', voice.picked or 'heard', flush=True)
    stt_, tts_, turns = voice_parts(http, voice, rates)
    agent = Copilot(ctx.room, caller.identity, stt_, tts_, voice)
    session = AgentSession(
        vad=ctx.proc.userdata['vad'], stt=stt_, tts=tts_,
        turn_handling={
            'turn_detection': turns,
            # A third of a second of quiet ends a turn when the turn detector thinks the caller is done; up to 2 s when
            # the sentence sounds unfinished ("my number is 512…").
            'endpointing': {'min_delay': 0.3, 'max_delay': 2.0},
            # Barge-in: 0.15 s of the caller's voice stops the copilot's (the page's echo cancellation keeps its own out).
            'interruption': {'enabled': True, 'mode': 'vad', 'min_duration': 0.15, 'min_words': 0},
            'preemptive_generation': {'enabled': False},
        },
        user_away_timeout=None,
    )

    pending: dict = {}

    # A turn's total: from the moment the caller stopped talking to the moment the copilot's voice started.
    @session.on('user_state_changed')
    def _user(ev):
        if ev.old_state == 'speaking' and ev.new_state != 'speaking':
            pending['stopped_at'] = ev.created_at

    @session.on('agent_state_changed')
    def _agent(ev):
        if ev.new_state != 'speaking' or 'stopped_at' not in pending:
            return
        since = round((ev.created_at - pending['stopped_at']) * 1000)
        if not agent.turn:
            # "Let me check the tax guides." while a search runs: the caller's first audio of this turn.
            pending.setdefault('filler_ms', since)
            return
        row = {**agent.turn, 'tts_first_ms': tts_.first_ms, 'total_ms': since, **({'filler_ms': pending['filler_ms']} if 'filler_ms' in pending else {})}
        row['end_of_turn_ms'] = since - (row.get('stt_ms') or 0) - row['decide_ms'] - (row.get('tts_first_ms') or 0)
        log_turn(row)
        agent.turn = {}
        pending.clear()

    # Something the copilot says outside a turn (a form that opens after a page change): the page asks the agent to say it.
    def agent_say(data: rtc.RpcInvocationData) -> str:
        text = str(json.loads(data.payload or '{}').get('text', '')).strip()
        if text:
            session.say(text, allow_interruptions=True)
        return '{}'

    ctx.room.local_participant.register_rpc_method('agent.say', agent_say)

    # The caller switched language mid-call (the page's picker, or asking to): the next turn listens and speaks in it.
    @ctx.room.on('participant_attributes_changed')
    def _attrs(changed: dict, p: rtc.Participant):
        if p.identity == caller.identity and 'copilot.language' in changed:
            voice.pick(changed['copilot.language'])
            print('language', voice.picked or 'heard', flush=True)

    ctx.add_shutdown_callback(http.close)
    await session.start(agent=agent, room=ctx.room)


if __name__ == '__main__':
    cli.run_app(server)
