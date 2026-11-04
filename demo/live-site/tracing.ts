// Traces to Phoenix through Octo (Pukujan-lab/octo-database #268, #342). Each backend call (understand, search,
// judge, sentences, desk) and each span the widget reports (the call, every turn with its tool calls, confirmations and
// failures) becomes one trace in the workspace's Phoenix project; the widget's call id (x-session-id) groups a call
// into one Phoenix session, and the voice agent (speech/telemetry.py) writes its spans under the same id.
// Nothing is masked: every call is recorded in full, and each business decides what it keeps (#17).
// An outside business with its own workspace (#127) gets its traces in that workspace's Phoenix project, sent with the
// account-wide key (OCTO_ACCOUNT_KEY); without that key they are dropped, never sent to the shared workspace.
// Off without OCTO_KEY and OCTO_WORKSPACE, or with OCTO_TRACES=off. Node only: server.ts passes exportTrace to createApi.
import { context, trace, type Attributes, type Span, type Tracer } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BasicTracerProvider, BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';

export type SpanKind = 'CHAIN' | 'LLM' | 'TOOL' | 'RETRIEVER' | 'EVALUATOR';
export type SpanSpec = {
  name: string; kind: SpanKind; start: number; end: number;
  attributes?: Attributes; error?: boolean; children?: SpanSpec[];
};
// workspace: the business's own workspace, when it has one; otherwise the shared one.
export type ExportTrace = (root: SpanSpec, session?: string | null, workspace?: string) => void;

// The Phoenix OTLP endpoint and auth; speech/telemetry.py builds the same from the env server.ts hands it.
function otlpTarget(env: { OCTO_BASE?: string }, workspace: string, key: string) {
  const base = (env.OCTO_BASE || 'https://octodb.design-bakery.com/api').replace(/\/$/, '');
  return { url: `${base}/workspaces/${workspace}/otel/v1/traces`, headers: { authorization: `Bearer ${key}` } };
}

// How the automated evals (docs/decisions/0005) score a call: POST /api/score with the call id and, for one turn, its
// turn.id (the widget and the voice agent both record it). The score becomes a Phoenix span annotation on that turn's
// span (or the call's span), through Octo's span_annotations route. A span this server did not write since it started
// gets an EVALUATOR span in the call's session instead, so a score is never dropped.
export type EvalScore = { call: string; turn?: string; name: string; score?: number; label?: string; explanation?: string };
type Tracing = { trace: ExportTrace; score: (s: EvalScore, workspace?: string) => Promise<'annotation' | 'span'>; flush: () => Promise<void> };
type Lane = { target: ReturnType<typeof otlpTarget>; provider: BasicTracerProvider; tracer: Tracer };

export function createTracer(env: { OCTO_KEY?: string; OCTO_WORKSPACE?: string; OCTO_ACCOUNT_KEY?: string; OCTO_BASE?: string; OCTO_TRACES?: string }): Tracing | undefined {
  if (!env.OCTO_KEY || !env.OCTO_WORKSPACE || env.OCTO_TRACES === 'off') return undefined;
  // One exporter per workspace, made on first use; the shared workspace's always.
  const lanes = new Map<string, Lane>();
  const lane = (workspace = env.OCTO_WORKSPACE!): Lane | undefined => {
    let l = lanes.get(workspace);
    if (l) return l;
    const key = workspace === env.OCTO_WORKSPACE ? env.OCTO_KEY! : env.OCTO_ACCOUNT_KEY;
    if (!key) return undefined;
    const target = otlpTarget(env, workspace, key);
    const provider = new BasicTracerProvider({ resource: resourceFromAttributes({ 'service.name': 'voice-copilot' }), spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter(target))] });
    l = { target, provider, tracer: provider.getTracer('voice-copilot') };
    lanes.set(workspace, l);
    return l;
  };
  // The span ids of recent turns and calls ("workspace:call:turn" or "workspace:call:call"), for the evals' annotations.
  const spanIds = new Map<string, string>();
  const write = (tracer: Tracer, ws: string, spec: SpanSpec, session: string | null | undefined, parent?: Span) => {
    const attrs: Attributes = { 'openinference.span.kind': spec.kind, ...spec.attributes };
    if (session) attrs['session.id'] = session;
    const span = tracer.startSpan(spec.name, { startTime: spec.start, attributes: attrs }, parent ? trace.setSpan(context.active(), parent) : context.active());
    if (spec.error) span.setStatus({ code: 2 });
    if (!parent && session && (spec.name === 'call' || spec.name === 'turn')) {
      spanIds.set(`${ws}:${session}:${spec.name === 'call' ? 'call' : String(attrs['turn.id'] ?? '')}`, span.spanContext().spanId);
      if (spanIds.size > 5000) spanIds.delete(spanIds.keys().next().value!);
    }
    for (const c of spec.children ?? []) write(tracer, ws, c, session, span);
    span.end(spec.end);
  };
  const exportTrace: ExportTrace = (root, session, workspace) => {
    try {
      const l = lane(workspace);
      if (!l) { console.error('trace: no account-wide Octo key for a business workspace; dropped'); return; }
      write(l.tracer, workspace ?? env.OCTO_WORKSPACE!, root, session);
    } catch (e) { console.error(`trace: ${(e as Error).message}`); }
  };
  async function score(s: EvalScore, workspace?: string): Promise<'annotation' | 'span'> {
    const l = lane(workspace);
    const spanId = spanIds.get(`${workspace ?? env.OCTO_WORKSPACE}:${s.call}:${s.turn ?? 'call'}`);
    if (spanId && l) {
      await l.provider.forceFlush();
      const r = await fetch(l.target.url.replace(/\/v1\/traces$/, '/v1/span_annotations?sync=true'), { method: 'POST',
        headers: { ...l.target.headers, 'content-type': 'application/json' },
        body: JSON.stringify({ data: [{ span_id: spanId, name: s.name, annotator_kind: 'CODE',
          result: { score: s.score ?? null, label: s.label ?? null, explanation: s.explanation ?? null }, metadata: { call: s.call, turn: s.turn ?? '' } }] }) }).catch(() => null);
      if (r?.ok) return 'annotation';
      console.error(`score: span_annotations ${r?.status ?? 'unreachable'}`);
    }
    const at = Date.now();
    const attributes: Attributes = { 'eval.name': s.name, 'call.id': s.call, ...(s.turn ? { 'turn.id': s.turn } : {}) };
    if (s.score !== undefined) attributes['eval.score'] = s.score;
    if (s.label) attributes['eval.label'] = s.label;
    if (s.explanation) attributes['eval.explanation'] = s.explanation;
    exportTrace({ name: `eval.${s.name}`, kind: 'EVALUATOR', start: at, end: at, attributes }, s.call, workspace);
    return 'span';
  }
  // flush: send what is batched before the server stops, so a call's last spans (its call span) are not lost.
  return { trace: exportTrace, score, flush: () => Promise.all([...lanes.values()].map(l => l.provider.forceFlush().catch(() => {}))).then(() => undefined) };
}
