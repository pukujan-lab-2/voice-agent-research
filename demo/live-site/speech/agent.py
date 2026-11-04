"""The voice call's agent on LiveKit Agents (docs/decisions/0002): it hears and speaks; the copilot engine decides.

  caller's browser ──WebRTC──► LiveKit server (local, dev mode) ◄──► this worker
    Silero VAD + LiveKit's turn detector end each turn and handle barge-in (the caller talks over the voice);
    LocalSTT / LocalTTS call speech/server.py with the call's voice stack (speech/stacks.json, docs/decisions/0012):
      english-fast  Parakeet to listen, the English turn detector, Pocket TTS to speak
      multilingual  Whisper large-v3-turbo, the multilingual turn detector, Kokoro in the caller's language
      lfm3-audio    LFM3-Audio hears and speaks (one model on llama.cpp), turns end on voice activity alone
    The page puts the stack server.ts picked and the caller's language on the caller's participant attributes
    (copilot.stack, copilot.language); a language changed mid-call takes effect from the next turn;
    the decision step is the copilot engine in the caller's page (widget/sdk.ts), reached over LiveKit RPC:
      copilot.greet  -> the short spoken intro          copilot.turn {text} -> the reply to speak
    so read-backs, never-submit, quote-only answers, verification and page actions all stay in the engine.

Every turn goes to Phoenix through Octo (speech/telemetry.py), in the page's call session: what was heard, and from the
moment the caller stops talking, the end-of-turn wait (VAD and turn detector), STT, the engine's decision (which includes
any library search) and the voice's first audio; barge-ins, failed RPC calls and speech errors too. A watchdog
(stall_watchdog.py) logs a stall (the caller spoke and no turn came of it) as an error span and starts the turn over.

A recorded call (#130): the site names the room call-<id>.<business> when that business records its calls. The session's own
recorder then writes the call's audio (the caller on one channel, the copilot on the other, Ogg/Opus) to the job's temporary
folder, and when the call ends it goes to the site (COPILOT_API_URL), signed with the site's secret. The site locks it with the
call's key before it reaches Octo. Nothing else keeps it.

Run: speech/.venv/bin/python speech/agent.py dev    (server.ts starts it with the speech server)
"""
import asyncio, contextlib, inspect, json, os, re, time, uuid

import aiohttp
from livekit import rtc
from livekit.agents import (
    Agent, AgentServer, AgentSession, APIConnectOptions, JobContext, JobProcess, StopResponse, cli, stt, tts,
)
from livekit.agents.types import DEFAULT_API_CONNECT_OPTIONS
from livekit.plugins import silero
from livekit.plugins.turn_detector.english import EnglishModel
from livekit.plugins.turn_detector.multilingual import MultilingualModel
from stall_watchdog import StallWatchdog
from recording import audio_signature, room_business
from telemetry import CallTelemetry

SPEECH = os.environ.get('SPEECH_URL', 'http://127.0.0.1:8799')
# On the VPS the agent sleeps between calls (#117): the shared Sablier stops it after 10 idle minutes and the site starts it when
# the call button is pressed. Sablier counts it as ready once the container is healthy, which is once this file exists
# (deploy/docker-compose.agent.yml mounts its directory as a tmpfs, so every start begins without it). Without SABLIER_URL (a
# local run) nothing is renewed.
REGISTERED = '/run/agent/registered'
SABLIER_URL, SABLIER_NAME = os.environ.get('SABLIER_URL', ''), os.environ.get('SABLIER_NAME', '')
COPILOT_API, SIGNING = os.environ.get('COPILOT_API_URL', '').rstrip('/'), os.environ.get('SIGNING_SECRET', '')


def recorded_business(room: str) -> str:
    """The business this call is recorded for, or '' when it isn't recorded (or there is nowhere to send it)."""
    return room_business(room) if COPILOT_API and SIGNING else ''


async def send_audio(path, room: str, call: str) -> None:
    """The call's recording to the site, which locks it. A failed send is logged; the recording is not kept anywhere else."""
    try:
        audio = path.read_bytes() if path and path.exists() else b''
        if not audio:
            print('recording: nothing was recorded', flush=True)
            return
        headers = {'content-type': 'audio/ogg', 'x-call-room': room, 'x-call-id': call, 'x-call-sig': audio_signature(SIGNING, room, call, audio)}
        async with aiohttp.ClientSession() as h, h.post(f'{COPILOT_API}/api/call-audio', data=audio, headers=headers,
                                                         timeout=aiohttp.ClientTimeout(total=120)) as r:
            print('recording:', len(audio), 'bytes sent,', r.status, (await r.text())[:200], flush=True)
    except Exception as e:  # noqa: BLE001 - the call is over; say what happened and go on
        print('recording: not sent:', e, flush=True)


with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'stacks.json')) as f:
    STACKS = json.load(f)


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
        self.last_confidence: float | None = None  # the model's mean token probability for the last turn, 0 to 1
        self.last_language = 'en'
        self.on_request = lambda: None  # told when a turn's audio reaches the recogniser (the stall watchdog)

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
        self.on_request()
        frame = rtc.combine_audio_frames(buffer)
        t = time.perf_counter()
        v = self._voice
        async with self._http.post(f'{SPEECH}/stt', params={'sr': frame.sample_rate, 'stack': v.stack, 'lang': v.picked}, data=_pcm_float(frame),
                                   headers={'content-type': 'application/octet-stream'},
                                   timeout=aiohttp.ClientTimeout(total=self._timeout(conn_options))) as r:
            r.raise_for_status()
            j = await r.json()
        text = j.get('text', '')
        self.last_confidence = j.get('confidence')
        # The language the recogniser heard (or was told): the turn detector, the voice and the turn's record go by it.
        if text and j.get('language'):
            v.heard = j['language']
        self.last_language = j.get('language') or v.language
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


# "Hmm.", "uh", "um", "like": thinking aloud at the start of a turn is not part of the question (copilot-engine's stripFillers).
FILLER = re.compile(r'^(?:(?:hmm+|hm+|uh+|um+|umm+|er+|erm|ah+|oh|well|like|so|okay so|you know|i mean)(?=[\s,.…-]|$)[\s,.…-]*)+', re.I)
JOIN_WITHIN_S = 10.0  # more speech this soon after a reply was handed over, before it began, joins the earlier words

class Copilot(Agent):
    """No LLM of its own: each finished turn goes to the copilot engine in the caller's page, and its reply is spoken."""

    def __init__(self, room: rtc.Room, caller: str, stt_: LocalSTT, tts_: LocalTTS, tel: CallTelemetry, voice: Voice):
        super().__init__(instructions='The copilot engine in the page decides every reply.')
        self._room, self._caller, self._stt, self._tts, self._tel, self._voice = room, caller, stt_, tts_, tel, voice
        self.turn: dict = {}
        # The reply last handed to the voice and the words behind it: a reply that has not begun when more speech arrives is
        # dropped, and the two pieces are one question (a pause in the middle of a sentence ends a turn too early).
        self._speech = None
        self._said = ''
        self._said_at = 0.0

    async def _rpc(self, method: str, payload: dict, timeout: float = 45.0) -> dict:
        t = time.perf_counter()
        try:
            r = await self._room.local_participant.perform_rpc(
                destination_identity=self._caller, method=method, payload=json.dumps(payload), response_timeout=timeout)
        except Exception as e:
            self._tel.failure('rpc', str(e), method=method, ms=round((time.perf_counter() - t) * 1000), timeout_s=timeout)
            raise
        r = json.loads(r or '{}')
        self._tel.link(r.get('call', ''))  # the page's call id: this call's Phoenix session
        return r

    async def on_enter(self) -> None:
        # Wake the speech-to-text model while the intro plays: after a while idle, its first turn is seconds slower.
        self._warming = asyncio.create_task(self._stt.warm())
        # The page asked for the microphone before it joined, so the caller already answered that prompt.
        r = await self._rpc('copilot.greet', self._tel.stack)
        if r.get('say'):
            self.session.say(r['say'], allow_interruptions=True)

    async def on_user_turn_completed(self, turn_ctx, new_message) -> None:
        said = FILLER.sub('', (new_message.text_content or '').strip()).strip()
        if not said:
            raise StopResponse()  # "hmm", "uh…": someone thinking, not a turn
        t = time.perf_counter()
        sp = self._speech
        if sp is not None and not sp.done() and self._tts.first_ms is None and t - self._said_at < JOIN_WITHIN_S:
            sp.interrupt()  # the earlier reply never started: this is the rest of the same question
            said = f'{self._said} {said}'.strip()
        turn = uuid.uuid4().hex
        heard = {'turn': turn, 'stt_ms': self._stt.last_ms, 'confidence': self._stt.last_confidence, 'language': self._stt.last_language}
        try:
            # The language goes with the words, so the reply is written in it (a pick, or what the recogniser heard).
            r = await self._rpc('copilot.turn', {'text': said, **heard, 'language': self._voice.language, 'heard': self._voice.heard})
        except Exception as e:  # noqa: BLE001 - a page that went away or timed out: say so, don't hang
            print('copilot.turn failed:', e, flush=True)
            r = {'say': "Sorry, something went wrong on my side. Could you say that again?"}
        self.turn = {**heard, 'decide_ms': round((time.perf_counter() - t) * 1000), 'heard': said, 'reply': r.get('say', ''),
                     'kind': r.get('kind', ''), 'search_ms': r.get('searchMs')}
        if r.get('say'):
            self._tts.first_ms = None
            self._speech = self.session.say(r['say'], allow_interruptions=True)
            self._said, self._said_at = said, time.perf_counter()
        else:  # nothing to say, so no first audio will close this turn's span: record it now
            self._tel.turn({**self.turn, 'total_ms': round((time.perf_counter() - t) * 1000), 'end_of_turn_ms': 0}, time.time() - (time.perf_counter() - t), time.time())
            self.turn = {}
        # The engine's reply is the whole response: no LLM runs after it.
        raise StopResponse()


# One local caller at a time on a busy laptop: the machine's CPU load (a library load, the LiveKit VM) must not make the
# worker turn calls away, so it is always available. Modules the agent loop would otherwise import mid-call are loaded first.
# A stop (docker stop, SIGTERM) drains instead of killing: LiveKit Agents 1.8.8 marks the worker full, so new calls go to a newer
# worker, and waits for the calls it holds to end (cli/cli.py runs worker.drain() on the first TERM or INT in `start` mode). Its
# default wait is an hour; this one is shorter, and docker-compose.agent.yml's stop_grace_period must stay longer than it.
server = AgentServer(num_idle_processes=1, load_fnc=lambda: 0.0, load_threshold=1.0, preload_modules=['filelock', 'numpy'],
                     drain_timeout=int(os.environ.get('AGENT_DRAIN_S', 1200)))


def prewarm(proc: JobProcess):
    proc.userdata['vad'] = silero.VAD.load(min_speech_duration=0.15, min_silence_duration=0.3, prefix_padding_duration=0.3)


server.setup_fnc = prewarm


# LiveKit Agents' own HTTP check (port 8081) answers OK before the worker has registered; a woken agent is ready only after this.
@server.on('worker_registered')
def _registered(*_):
    with contextlib.suppress(OSError):  # the directory exists only in the container
        open(REGISTERED, 'w').close()


async def keep_awake(http: aiohttp.ClientSession) -> None:
    """Renew this container's Sablier session every minute while a call is on. Each request to Sablier sets the session to end
    10 minutes from then, and the call button's request is the only other one, so without this a long call would be cut."""
    while True:
        with contextlib.suppress(Exception):
            async with http.get(f'{SABLIER_URL}/api/strategies/poke', params={'names': SABLIER_NAME}, timeout=aiohttp.ClientTimeout(total=5)):
                pass
        await asyncio.sleep(60)


async def load_stack(http: aiohttp.ClientSession, stack: str) -> None:
    """Models are swapped, not run all at once (docs/decisions/0014): the speech server unloads the stack in use before this
    one's load, which can take a few seconds to a minute, so a call waits for it here and not in the middle of its greeting."""
    t = time.perf_counter()
    try:
        async with http.post(f'{SPEECH}/load', params={'stack': stack}, timeout=aiohttp.ClientTimeout(total=300)) as r:
            r.raise_for_status()
            swap = (await r.json()).get('swap') or {}
        print('stack', stack, 'ready in', round(time.perf_counter() - t, 1), 's', 'swap:', swap.get('unloaded') or '-', '->', swap.get('loaded') or '-', flush=True)
    except (aiohttp.ClientError, asyncio.TimeoutError) as e:
        print('stack load failed, the first request will try again:', e, flush=True)


def voice_parts(http: aiohttp.ClientSession, voice: Voice, rates: dict) -> tuple[LocalSTT, LocalTTS, object]:
    """The stack's listener, voice and turn detector. lfm3-audio is one model that hears and speaks (speech/server.py runs it
    on llama.cpp), so it has no turn detector of its own: the Silero VAD ends a turn after a short silence. The engine's
    turns and decision 0011's code lock stay as they are; the desk's tool calls go to the same model (api.ts)."""
    kind = voice.parts['turns']
    turns = 'vad' if kind == 'vad' else MultilingualModel() if kind == 'multilingual' else EnglishModel()
    return LocalSTT(http, voice), LocalTTS(http, int(rates.get(voice.parts['speaks'], 24000)), voice), turns


@server.rtc_session()
async def entrypoint(ctx: JobContext):
    await ctx.connect()
    caller = await ctx.wait_for_participant()
    http = aiohttp.ClientSession()
    if SABLIER_URL and SABLIER_NAME:
        awake = asyncio.create_task(keep_awake(http))

        async def _let_sleep():
            awake.cancel()

        ctx.add_shutdown_callback(_let_sleep)
    async with http.get(f'{SPEECH}/health') as r:
        health = await r.json()
    rates = health.get('rates') or {'pocket-tts': health.get('rate', 24000)}
    voice = Voice(caller.attributes.get('copilot.stack', ''), caller.attributes.get('copilot.language', ''))
    print('call', ctx.room.name, 'stack', voice.stack, 'language', voice.picked or 'heard', flush=True)
    stt_, tts_, turns = voice_parts(http, voice, rates)
    tel = CallTelemetry(ctx.room.name, {'stack': voice.stack, 'stt': f'{stt_.provider}:{stt_.model}', 'tts': f'{tts_.provider}:{tts_.model}',
                                        'turn_detector': 'silero-vad' if turns == 'vad' else f"livekit-{voice.parts['turns']}", 'vad': 'silero', 'language': voice.picked or 'heard'})
    agent = Copilot(ctx.room, caller.identity, stt_, tts_, tel, voice)
    await load_stack(http, voice.stack)  # this stack's models in and the last stack's out, before the greeting asks the voice for audio
    session = AgentSession(
        vad=ctx.proc.userdata['vad'], stt=stt_, tts=tts_,
        turn_handling={
            'turn_detection': turns,
            # Seven tenths of a second of quiet ends a turn when the turn detector thinks the caller is done; up to 4 s when
            # the sentence sounds unfinished ("my number is 512…", or a pause to think in the middle of a question).
            'endpointing': {'min_delay': 0.7, 'max_delay': 4.0},
            # Barge-in: 0.15 s of the caller's voice stops the copilot's (the page's echo cancellation keeps its own out).
            'interruption': {'enabled': True, 'mode': 'vad', 'min_duration': 0.15, 'min_words': 0},
            'preemptive_generation': {'enabled': False},
        },
        user_away_timeout=None,
    )

    pending: dict = {}
    dog = StallWatchdog()
    stt_.on_request = dog.recognising

    # A turn's total: from the moment the caller stopped talking to the moment the copilot's voice started.
    @session.on('user_state_changed')
    def _user(ev):
        if ev.new_state == 'speaking':
            dog.speech_started()
            if session.agent_state == 'speaking':
                tel.barge_in()  # the caller talked over the copilot's voice
        if ev.old_state == 'speaking' and ev.new_state != 'speaking':
            dog.speech_ended()
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
        tel.turn(row, pending['stopped_at'], ev.created_at)
        agent.turn = {}
        pending.clear()

    # Something the copilot says outside a turn (a form that opens after a page change): the page asks the agent to say it.
    def agent_say(data: rtc.RpcInvocationData) -> str:
        text = str(json.loads(data.payload or '{}').get('text', '')).strip()
        if text:
            session.say(text, allow_interruptions=True)
        return '{}'

    # Speech-to-text and voice errors (a recoverable one is retried by LiveKit), and why the session closed.
    @session.on('error')
    def _error(ev):
        err = getattr(ev, 'error', None)
        tel.failure(type(err).__name__ if err else 'error', str(getattr(err, 'error', err)), source=type(ev.source).__name__,
                    recoverable=bool(getattr(err, 'recoverable', False)))

    closed: dict = {}

    @session.on('close')
    def _close(ev):
        closed['reason'] = str(getattr(ev.reason, 'value', ev.reason)) + (f': {ev.error}' if ev.error else '')
        print('session closed:', closed['reason'], flush=True)

    # Why a call ended (#93): a live call lost its agent about a minute in with nothing in the log to say why. These lines name who
    # left and the reason LiveKit gives, with what the session was doing.
    @ctx.room.on('participant_disconnected')
    def _left(p: rtc.RemoteParticipant):
        print('participant left:', p.identity, 'reason', getattr(p, 'disconnect_reason', None), '| user', session.user_state, '| agent', session.agent_state, flush=True)

    @ctx.room.on('disconnected')
    def _room_gone(reason):
        print('agent disconnected from the room:', reason, '| user', session.user_state, '| agent', session.agent_state, flush=True)

    # The caller spoke and no turn came of it (stall_watchdog.py): the call is not left deaf. Say so in Phoenix, drop the
    # half-made turn and the voice, and listen from the start. The call that stopped hearing its caller looked like this.
    async def watch_for_stalls():
        while True:
            await asyncio.sleep(1)
            try:
                hit = dog.check()
                if not hit:
                    continue
                kind, seen = hit
                print('stall', kind, round(seen, 1), 's; starting the turn over', flush=True)
                tel.failure('stall', f'{kind}: {seen:.0f} s', stall=kind, seconds=round(seen, 1), user_state=str(session.user_state), agent_state=str(session.agent_state))
                agent.turn = {}
                pending.clear()
                # A detector stuck on speech also cuts the voice; a lost turn leaves a reply that is playing alone.
                for reset in ((session.interrupt, session.clear_user_turn) if kind == 'speech-without-end' else (session.clear_user_turn,)):
                    with contextlib.suppress(Exception):
                        done = reset()
                        if inspect.isawaitable(done):
                            await asyncio.wait_for(done, 5)
            except Exception as e:  # noqa: BLE001 - the watchdog must outlive whatever it finds
                print('stall watchdog:', e, flush=True)

    watcher = asyncio.create_task(watch_for_stalls())

    async def _stop_watching():
        watcher.cancel()

    ctx.add_shutdown_callback(_stop_watching)

    ctx.room.local_participant.register_rpc_method('agent.say', agent_say)

    # The caller switched language mid-call (the page's picker, or asking to): the next turn listens and speaks in it.
    @ctx.room.on('participant_attributes_changed')
    def _attrs(changed: dict, p: rtc.Participant):
        if p.identity == caller.identity and 'copilot.language' in changed:
            voice.pick(changed['copilot.language'])
            tel.stack['language'] = voice.picked or 'heard'  # the call's record says the language it ended in
            print('language', voice.picked or 'heard', flush=True)

    ctx.add_shutdown_callback(http.close)

    async def _sent(reason: str):
        print('job shutdown:', reason or '-', '| session:', closed.get('reason', 'still open'), '| user', session.user_state, '| agent', session.agent_state, flush=True)
        await tel.close(closed.get('reason') or reason or 'room closed')

    ctx.add_shutdown_callback(_sent)

    business = recorded_business(ctx.room.name)
    if business:
        async def _send_recording(_reason: str = ''):
            with contextlib.suppress(Exception):
                await session.aclose()  # the recorder finishes the file when the session closes
            await send_audio(ctx.session_directory / 'audio.ogg', ctx.room.name, tel.call or ctx.room.name.split('.')[0])

        ctx.add_shutdown_callback(_send_recording)
    # The session's recorder, audio only: no transcript, traces or logs go to LiveKit (with a self-hosted server nothing is uploaded).
    await session.start(agent=agent, room=ctx.room,
                        record={'audio': True, 'traces': False, 'logs': False, 'transcript': False} if business else False)


if __name__ == '__main__':
    cli.run_app(server)
