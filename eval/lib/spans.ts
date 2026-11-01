// Real calls as the chatbots workspace holds them: Phoenix spans read through Octo, grouped into calls and turns.
// Only the chatbots workspace is read. The nyc-map-agent workspace belongs to another app and is refused by name.
import { key } from './env.ts';
import { octoBase } from './corpus.ts';

export type Span = {
  name: string;
  context: { span_id: string; trace_id?: string };
  parent_id: string | null;
  start_time: string;
  end_time: string;
  status_code?: string;
  attributes: Record<string, any>;
};

export type Search = { q: string; ids: string[]; texts: string[]; ms: number };
export type Judge = { q: string; id: string };
export type Sentences = { q: string; idx: number[] };
export type Turn = {
  call: string;
  id: string;               // the widget/voice turn id; the span id for a chat turn that has none
  n: number;                // 1-based position in the call, by start time
  at: string;               // ISO start
  input: string;
  reply: string;
  quote: string;            // the sentence read out from the library ('' when the reply was not a quote)
  href: string;             // the cited passage's link
  desk: string;             // tool calls the desk model made ('' when it answered in its own words)
  searches: Search[];
  judges: Judge[];
  sentences: Sentences[];
  deskMessages: string;     // the messages the desk model was sent for this turn (JSON), '' when none were recorded
  firstAudioMs?: number;    // voice only: how long the caller waited for the first sound
  searchMs?: number;        // voice only: search time the agent measured
  bargeIns: number;
};
export type Call = {
  id: string;
  at: string;
  channel: string;
  outcome?: string;         // the widget's call.outcome ('finished', ...), when it wrote one
  failures: number;
  failureSpans: string[];   // names of failure.* spans
  turns: Turn[];
};

const WINDOW_SLACK_MS = 1500;   // a backend span that starts just after its turn span closed still belongs to the turn

export function workspace() {
  const ws = key('OCTO_WORKSPACE', 'octo_db_chatbots_workspace');
  const nyc = key('octo_db_nyc_map_workspace');
  if (!ws) throw new Error('no chatbots workspace id (OCTO_WORKSPACE or octo_db_chatbots_workspace)');
  if (nyc && ws === nyc) throw new Error('refusing to read the nyc-map-agent workspace: it is another app');
  return ws;
}

// Newest first, `limit` spans in all, following the cursor. A normal User-Agent is needed or Cloudflare answers 1010.
export async function fetchSpans(limit = 300): Promise<Span[]> {
  const ws = workspace(), auth = `Bearer ${key('OCTO_KEY', 'octo_db_chatbots')}`;
  const out: Span[] = [];
  let cursor: string | null = null;
  while (out.length < limit) {
    const url = `${octoBase()}/workspaces/${ws}/otel/read/spans?limit=${Math.min(300, limit - out.length)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { Authorization: auth, 'User-Agent': 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/120 Safari/537.36' } });
    if (!r.ok) throw new Error(`octo spans ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const body = await r.json() as { data: Span[]; next_cursor: string | null };
    out.push(...body.data);
    if (!body.next_cursor || !body.data.length) break;
    cursor = body.next_cursor;
  }
  return out;
}

const ms = (iso: string) => Date.parse(iso);
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
const session = (s: Span) => str(s.attributes['session.id']) || str(s.attributes['call.id']);

// The passages a search span returned, from its flat retrieval.documents.N.* attributes.
function documents(a: Record<string, any>) {
  const ids: string[] = [], texts: string[] = [];
  for (let i = 0; a[`retrieval.documents.${i}.document.id`] !== undefined; i++) {
    ids.push(str(a[`retrieval.documents.${i}.document.id`]));
    texts.push(str(a[`retrieval.documents.${i}.document.content`]));
  }
  return { ids, texts };
}
function judgeId(output: string) { try { return String(JSON.parse(output).id ?? ''); } catch { return ''; } }
function sentenceIdx(output: string): number[] { try { return JSON.parse(output).idx ?? []; } catch { return []; } }

// Spans in, calls out. Matrix runs and eval spans are test traffic, not calls.
export function buildCalls(spans: Span[]): Call[] {
  const bySession = new Map<string, Span[]>();
  for (const s of spans) {
    const id = session(s);
    if (!id || id.startsWith('voice-matrix') || s.name.startsWith('voice.matrix') || s.name.startsWith('eval.')) continue;
    bySession.set(id, [...(bySession.get(id) ?? []), s]);
  }
  const calls: Call[] = [];
  for (const [id, all] of bySession) {
    all.sort((a, b) => ms(a.start_time) - ms(b.start_time));
    const desk = all.filter(s => s.name === 'turn' && !s.parent_id);
    if (!desk.length) continue;
    const voice = new Map(all.filter(s => s.name === 'voice.turn').map(s => [str(s.attributes['turn.id'] || s.attributes['voice.turn']), s]));
    const turns: Turn[] = desk.map((s, i) => {
      const a = s.attributes, tid = str(a['turn.id']) || s.context.span_id, v = voice.get(tid)?.attributes;
      const fillerMs = num(v?.['voice.filler_ms']), decide = num(v?.['voice.decide_ms']), first = num(v?.['voice.tts_first_ms']);
      return {
        call: id, id: tid, n: i + 1, at: s.start_time, input: str(a['input.value']), reply: str(a['output.value']),
        quote: str(a['guide.quote']), href: str(a['guide.href']), desk: str(a['desk.calls']), searches: [], judges: [], sentences: [], deskMessages: '',
        firstAudioMs: fillerMs ?? (decide !== undefined && first !== undefined ? decide + first : undefined),
        searchMs: num(v?.['voice.search_ms']), bargeIns: num(v?.['voice.barge_ins']) ?? 0,
      };
    });
    // Backend spans carry no turn id: they belong to the turn whose window holds their start.
    for (const s of all) {
      if (!['search', 'judge', 'sentences', 'desk'].includes(s.name)) continue;
      const t0 = ms(s.start_time);
      let owner = -1;
      desk.forEach((d, i) => { if (t0 >= ms(d.start_time) - 50 && t0 <= ms(d.end_time) + WINDOW_SLACK_MS) owner = i; });
      if (owner < 0) continue;
      const a = s.attributes;
      if (s.name === 'search') turns[owner].searches.push({ q: str(a['input.value']), ...documents(a), ms: ms(s.end_time) - t0 });
      else if (s.name === 'judge') turns[owner].judges.push({ q: str(a['input.value']), id: judgeId(str(a['output.value'])) });
      else if (s.name === 'sentences') turns[owner].sentences.push({ q: str(a['input.value']), idx: sentenceIdx(str(a['output.value'])) });
      else if (!turns[owner].deskMessages) turns[owner].deskMessages = str(a['input.value']);
    }
    const call = all.find(s => s.name === 'call' && !s.parent_id)?.attributes;
    const voiceCall = all.find(s => s.name === 'voice.call')?.attributes;
    calls.push({
      id, at: desk[0].start_time, channel: str(call?.['call.channel']) || (voiceCall ? 'voice' : 'chat'),
      outcome: str(call?.['call.outcome']) || undefined,
      failures: num(call?.['call.failures']) ?? num(voiceCall?.['voice.failures']) ?? 0,
      failureSpans: all.filter(s => s.name.startsWith('failure.') || s.name === 'voice.failure').map(s => s.name),
      turns,
    });
  }
  return calls.sort((a, b) => ms(b.at) - ms(a.at));
}
