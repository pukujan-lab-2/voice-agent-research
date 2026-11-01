"""The voice agent's side of the call record (#17): OpenTelemetry spans to Phoenix through Octo, with the same OTLP
endpoint and auth as the page's traces (tracing.ts), under the page's call id, so a call is one Phoenix session.

  voice.turn      each turn: what was heard, the speech model and its confidence, the language heard, and the timings
                  from the moment the caller stopped talking (end-of-turn wait, speech to text, deciding, first audio),
                  with the barge-ins since the last turn. turn.id matches the page's span of the same turn.
  voice.failure   an error (speech to text, voice, a failed RPC call to the page), with whether it was retried
  voice.call      when the room closes: the voice stack, the language, turns, barge-ins, failures and why it closed

Nothing is masked (each business decides what it keeps), and Octo is the one store (docs/decisions/0004): there is no
local file. Off without OCTO_KEY and OCTO_WORKSPACE, or with OCTO_TRACES=off; server.ts hands those to the agent.
"""
import asyncio, os, time

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.trace import Status, StatusCode

_provider: TracerProvider | None = None


def _tracer():
    # Our own provider, not the global one: LiveKit Agents keeps its own telemetry, and none of it should go here.
    global _provider
    key, ws = os.environ.get('OCTO_KEY'), os.environ.get('OCTO_WORKSPACE')
    if not key or not ws or os.environ.get('OCTO_TRACES') == 'off':
        return None
    if _provider is None:
        base = os.environ.get('OCTO_BASE', 'https://octodb.design-bakery.com/api').rstrip('/')
        _provider = TracerProvider(resource=Resource.create({'service.name': 'voice-copilot-agent'}))
        _provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter(
            endpoint=f'{base}/workspaces/{ws}/otel/v1/traces', headers={'authorization': f'Bearer {key}'})))
    return _provider.get_tracer('voice-copilot-agent')


def _ns(t: float) -> int:
    return int(t * 1e9)


def _clean(attrs: dict) -> dict:
    return {k: v for k, v in attrs.items() if isinstance(v, (str, int, float, bool))}


class CallTelemetry:
    """One voice call. link() with the page's call id as soon as the page answers; until then spans use the room name."""

    def __init__(self, room: str, stack: dict):
        self.call, self.room, self.stack = '', room, stack
        self.started = time.time()
        self.turns = self.barge_ins = self.failures = 0
        self.barge_ins_since_turn = 0
        self._tracer = _tracer()

    def link(self, call: str):
        if call and not self.call:
            self.call = str(call)[:64]

    def _span(self, name: str, kind: str, start: float, end: float, attrs: dict, inp: str = '', out: str = '', error: bool = False):
        if not self._tracer:
            return
        a = {'openinference.span.kind': kind, 'session.id': self.call or f'room-{self.room}', 'call.id': self.call, 'livekit.room': self.room}
        if inp:
            a['input.value'] = inp
        if out:
            a['output.value'] = out
        a.update(_clean(attrs))
        try:
            span = self._tracer.start_span(name, start_time=_ns(start), attributes=a)
            if error:
                span.set_status(Status(StatusCode.ERROR))
            span.end(end_time=_ns(end))
        except Exception as e:  # noqa: BLE001 - tracing never breaks a call
            print('telemetry:', e, flush=True)

    def barge_in(self):
        self.barge_ins += 1
        self.barge_ins_since_turn += 1

    def turn(self, row: dict, start: float, end: float):
        """row: the turn's id, what was heard and replied, and its timings in ms (see agent.py)."""
        self.turns += 1
        attrs = {f'voice.{k}': v for k, v in row.items() if k not in ('heard', 'reply')}
        attrs.update({'turn.id': row.get('turn', ''), 'turn.n': self.turns, 'voice.barge_ins': self.barge_ins_since_turn,
                      **{f'voice.{k}': v for k, v in self.stack.items()}})
        self.barge_ins_since_turn = 0
        self._span('voice.turn', 'CHAIN', start, end, attrs, row.get('heard', ''), row.get('reply', ''), error=not row.get('reply'))

    def failure(self, kind: str, message: str, **attrs):
        self.failures += 1
        now = time.time()
        self._span('voice.failure', 'CHAIN', now, now, {'failure.kind': kind, **attrs}, out=message, error=True)

    async def close(self, reason: str = ''):
        self._span('voice.call', 'CHAIN', self.started, time.time(), {
            'voice.turns': self.turns, 'voice.barge_ins': self.barge_ins, 'voice.failures': self.failures, 'voice.closed': reason,
            **{f'voice.{k}': v for k, v in self.stack.items()}}, out=reason, error=bool(self.failures and not self.turns))
        if _provider:
            await asyncio.to_thread(_provider.force_flush, 10_000)
