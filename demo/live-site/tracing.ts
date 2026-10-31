// Traces to Phoenix through Octo (Pukujan-lab/octo-database #268, #342). Each backend call (understand, search,
// judge, sentences) and each span the widget reports (speech to text, voice, turn, call end) becomes one trace
// in the workspace's Phoenix project; the widget's call id (x-session-id) groups a call into one Phoenix session.
// Text is masked (SSN, dates of birth, emails) before it leaves. Off without OCTO_KEY and
// OCTO_WORKSPACE, or with OCTO_TRACES=off. Node only: server.ts passes exportTrace to createApi.
import { context, trace, type Attributes, type Span, type Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { mask } from './widget/mask.ts';

export type SpanSpec = {
  name: string; kind: 'CHAIN' | 'LLM' | 'TOOL' | 'RETRIEVER'; start: number; end: number;
  attributes?: Attributes; error?: boolean; children?: SpanSpec[];
};
export type ExportTrace = (root: SpanSpec, session?: string | null) => void;

export function createTracer(env: { OCTO_KEY?: string; OCTO_WORKSPACE?: string; OCTO_BASE?: string; OCTO_TRACES?: string }): ExportTrace | undefined {
  if (!env.OCTO_KEY || !env.OCTO_WORKSPACE || env.OCTO_TRACES === 'off') return undefined;
  const base = (env.OCTO_BASE || 'https://octodb.design-bakery.com/api').replace(/\/$/, '');
  const exporter = new OTLPTraceExporter({ url: `${base}/workspaces/${env.OCTO_WORKSPACE}/otel/v1/traces`, headers: { authorization: `Bearer ${env.OCTO_KEY}` } });
  const provider = new BasicTracerProvider({ resource: resourceFromAttributes({ 'service.name': 'voice-copilot' }), spanProcessors: [new BatchSpanProcessor(exporter)] });
  const tracer: Tracer = provider.getTracer('voice-copilot');
  const write = (spec: SpanSpec, session: string | null | undefined, parent?: Span) => {
    const attrs: Attributes = { 'openinference.span.kind': spec.kind, ...spec.attributes };
    if (session) attrs['session.id'] = session;
    for (const [k, v] of Object.entries(attrs)) if (typeof v === 'string') attrs[k] = mask(v);
    const span = tracer.startSpan(spec.name, { startTime: spec.start, attributes: attrs }, parent ? trace.setSpan(context.active(), parent) : context.active());
    if (spec.error) span.setStatus({ code: 2 });
    for (const c of spec.children ?? []) write(c, session, span);
    span.end(spec.end);
  };
  return (root, session) => { try { write(root, session); } catch (e) { console.error(`trace: ${(e as Error).message}`); } };
}
