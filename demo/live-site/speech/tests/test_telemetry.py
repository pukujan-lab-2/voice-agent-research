import os, sys, types, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
# CI runs these without the OpenTelemetry packages; telemetry.py only needs their names at import.
for name in ('opentelemetry', 'opentelemetry.exporter', 'opentelemetry.exporter.otlp', 'opentelemetry.exporter.otlp.proto',
             'opentelemetry.exporter.otlp.proto.http', 'opentelemetry.exporter.otlp.proto.http.trace_exporter',
             'opentelemetry.sdk', 'opentelemetry.sdk.resources', 'opentelemetry.sdk.trace', 'opentelemetry.sdk.trace.export',
             'opentelemetry.trace'):
    if name not in sys.modules:
        try:
            __import__(name)
        except ImportError:
            m = sys.modules[name] = types.ModuleType(name)
            for attr in ('OTLPSpanExporter', 'Resource', 'TracerProvider', 'BatchSpanProcessor', 'Status', 'StatusCode'):
                setattr(m, attr, object)
from telemetry import CallTelemetry  # noqa: E402


class Span:
    def __init__(self, name, attributes):
        self.name, self.attributes = name, attributes

    def set_status(self, _):
        pass

    def end(self, end_time=None):
        pass


class Tracer:
    def __init__(self):
        self.spans = []

    def start_span(self, name, start_time=None, attributes=None):
        self.spans.append(Span(name, attributes))
        return self.spans[-1]


class TurnSpanTest(unittest.TestCase):
    def test_a_voice_turn_span_keeps_no_words(self):
        # What was said lives only in the call's locked record (#129); the span keeps the turn id that points at it.
        t = CallTelemetry('room-1', {'stt': 'lfm3-audio'})
        t._tracer = Tracer()
        t.link('call-0001')
        t.turn({'turn': 't-1', 'heard': 'my baby has a fever', 'reply': 'I can book you for today', 'stt_ms': 120}, 1.0, 2.0)
        span = t._tracer.spans[-1]
        self.assertEqual(span.name, 'voice.turn')
        self.assertEqual(span.attributes['turn.id'], 't-1')
        self.assertNotIn('fever', repr(span.attributes))
        self.assertNotIn('book you', repr(span.attributes))
        self.assertNotIn('input.value', span.attributes)
        self.assertNotIn('output.value', span.attributes)


if __name__ == '__main__':
    unittest.main()
