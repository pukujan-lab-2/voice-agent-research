"""Write one `deploy` span to Phoenix through Octo, as speech/telemetry.py does for a call: what a deploy waited for and for how
many calls (#76), so a call that was cut is visible next to the deploy that cut it. Run inside the agent image, which has the
OpenTelemetry packages and (from copilot.env) the Octo key: `docker run --rm -i --env-file ... IMAGE python - < deploy-span.py`
with DEPLOY_ATTRS (JSON) and DEPLOY_STARTED (epoch seconds). Prints what it did; off without OCTO_KEY and OCTO_WORKSPACE."""
import json
import os
import time

from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

key, ws = os.environ.get('OCTO_KEY'), os.environ.get('OCTO_WORKSPACE')
if not key or not ws or os.environ.get('OCTO_TRACES') == 'off':
    print('no span: Octo is not configured here')
else:
    attrs = json.loads(os.environ['DEPLOY_ATTRS'])
    base = os.environ.get('OCTO_BASE', 'https://octodb.design-bakery.com/api').rstrip('/')
    provider = TracerProvider(resource=Resource.create({'service.name': 'copilot-deploy'}))
    provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint=f'{base}/workspaces/{ws}/otel/v1/traces', headers={'authorization': f'Bearer {key}'})))
    # session.id matches tests/voice-call.ts's eval span for the same deploy (call id deploy-<sha>).
    span = provider.get_tracer('copilot-deploy').start_span('deploy', start_time=int(float(os.environ['DEPLOY_STARTED']) * 1e9),
                                                            attributes={'openinference.span.kind': 'CHAIN', 'session.id': f"deploy-{attrs['deploy.sha']}", **attrs})
    span.end(end_time=int(time.time() * 1e9))
    provider.force_flush()
    print('span sent')
