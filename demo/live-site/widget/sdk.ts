// The copilot a site adds with one script tag, with no UI of its own: the site draws the call panel and drives it
// through window.copilot. The v2 desk runs here in the page: LFM3 talks and picks actions through tools, and code owns
// the form, every read-back, every fill and every quote. The backend only lends it the model turn (LFM3), Jev (which
// passage answers?) and Octo search. Voice runs on LiveKit Agents with open
// models on our server (speech/agent.py); browser speech is not used. If the mic is blocked, the call carries on as text.
//
//   copilot.mount(config)        on a page with a form or a manual, once it is on screen (config: see Config)
//   copilot.unmount()            when leaving that page
//   copilot.start({ voice })     from the person's tap: "Start voice call" (voice: true) or "Type instead" (false)
//   copilot.send(text)           a typed message
//   copilot.toggleMic()          from a tap: "Tap to talk" / "Mute"
//   copilot.setLanguage(code)    the caller's language, from the picker by the call button or during the call ('' = ask)
//   copilot.setStack(id)         the visitor's voice stack, from those the business allows (snapshot.voiceStacks)
//   copilot.setMode(m)           'form' or 'guide' (walk through the manual), when both exist
//   copilot.setCovered(px)       how much of the bottom of the window the panel covers, so the asked field stays visible
//   copilot.end()                hang up
//   copilot.showSource(id) / copilot.closeSource()   open the source of an earlier answer / close the source viewer
//   copilot.onNavigate(fn)       the site's client-side navigate, so the copilot can change page without ending the call
//   copilot.subscribe(fn) / copilot.getSnapshot()   the state to draw (works with React's useSyncExternalStore)
import { Desk, type ChatModel } from '../../../copilot-engine/src/desk.ts';
import { Guide, shortQuote, type Manual, NO_ANSWER } from '../../../copilot-engine/src/guide.ts';
import { Dialogue, ownQuestion, type Offer } from '../../../copilot-engine/src/dialogue.ts';
import { flowFromPage, readInPage, type PageForm } from '../../../copilot-engine/src/page.ts';
import type { Flow, Model } from '../../../copilot-engine/src/types.ts';
import { forDisplay, forSpeech } from '../../../copilot-engine/src/guard.ts';
import { Verifier, WANTS_VERIFY, type ReturnCard } from '../../../copilot-engine/src/verify.ts';
import { DomFiller } from './dom-filler.ts';
import { stackForLanguage } from './voice-choice.ts';
import { API_BASE } from './config.ts';
import { callId, newCall, RemoteDeskModel, RemoteJudge, RemoteModel, RemoteRetriever, RemoteVerify, report, setDeskStack, setReplyLanguage, toReplyLanguage, warmUp } from './remote.ts';
import { beginCall, endCall, failure, happened, logTurn, markDesk, notePage, noteVoice, type DeskMark } from './calllog.ts';

export type Config = {
  business: string;
  form?: string; // the form's name in the copilot's intro; leave out on a page with no form
  can?: string[];
  large?: boolean;
  manual?: { label: string; title: string; doc?: string; steps: Manual['steps']; unknown?: string };
  // A question desk over a document library (no steps to walk through): every answer is quoted from the library with
  // its source linked; a question about the visitor's own situation is never answered, it is offered a consultation.
  desk?: { greeting: string; advice: string; book?: { text: string; href: string }; offers?: Offer[] };
  note?: string;   // one short clause said once per call, inside the greeting ("this is a demo site, so no real details please")
  pages?: { path: string; title: string; also?: string[]; form?: boolean }[]; // the site's pages, for "take me to pricing"
  guidePage?: string; // the site's page for one guide: `${guidePage}/${doc}` (?page=N for a PDF, #anchor for an article)
  // Caller verification on a desk page ("check on my return"): the server compares, the copilot only hears the result.
  // handoff: what to offer when a caller can't be verified or asks for a person.
  verify?: { handoff: string };
  // The voice stacks this business lets visitors pick from, and its default (speech/stacks.json, docs/decisions/0012).
  // The owner can still force one for every call on the server.
  voice?: { stacks?: string[]; default?: string };
};
export type Language = { code: string; name: string; native: string };
export type VoiceStack = { id: string; label: string; languages: Language[] };
// The document an answer was quoted from, shown by the site's source viewer while snapshot.source is set. doc is the
// library id (GET /api/library/doc?doc=…); page is the printed PDF's page (PDF sources), anchor the section (articles).
export type Source = { label: string; title: string; credit: string; doc: string; page?: number; anchor?: string; href: string; quote: string[]; found: boolean | null };
// waiting: asking the caller for the microphone, or joining the call; nothing is said until they have answered
export type Status = 'idle' | 'waiting' | 'speaking' | 'listening' | 'thinking' | 'muted' | 'text';
// links: parts of the text to show as links (a manual page "(page 3)", a cited source, a booking page)
export type Message = { id: number; who: 'bot' | 'user'; text: string; links: { text: string; href: string; page?: number }[]; source?: Source };
export type Snapshot = {
  mounted: boolean;
  open: boolean;                       // a call is on
  voice: boolean;                      // speaking and listening (false: text chat)
  mic: 'on' | 'off' | 'unavailable';   // unavailable: this browser can't use a microphone
  textInput: boolean;                  // show the text box
  status: Status;
  busy: boolean;
  heard: string;                       // what the mic is hearing right now
  mode: Mode;
  modes: Mode[];
  business: string;
  can: string[];
  large: boolean;
  messages: Message[];
  startedAt: number;                   // when the call started (ms since the epoch), for the call timer; 0 when no call
  wait: { text: string; until: number } | null; // a slow model call: what to show, and when it should be done (ms)
  source: Source | null;               // the source viewer's document, or null when it is closed
  account: ReturnCard | null;          // the verified caller's return status card (fictional sample data), or null
  voiceStacks: VoiceStack[];           // the stacks the picker offers (one when the business or the owner fixes it)
  stack: string;                       // the stack the next or current call runs on
  language: string;                    // the caller's pick ('' = not picked: the agent asks and goes by what it hears)
  languages: Language[];               // what the picker offers: every allowed stack's before a call, the call's stack's during one
  spokenLanguage: string;              // the language the recogniser last heard on this call ('' before the first turn)
};

type Mode = 'form' | 'guide' | 'ask';
const canHear = (): boolean => !!navigator.mediaDevices?.getUserMedia && typeof RTCPeerConnection !== 'undefined';

let cfg: Config | null = null;
let snap: Snapshot = blank();
const subs = new Set<() => void>();
function blank(): Snapshot {
  return { mounted: false, open: false, voice: false, mic: canHear() ? 'off' : 'unavailable', textInput: false, status: 'idle', busy: false,
    heard: '', mode: 'form', modes: [], business: '', can: [], large: false, messages: [], startedAt: 0, wait: null, source: null, account: null,
    voiceStacks: [], stack: '', language: '', languages: [], spokenLanguage: '' };
}
function set(p: Partial<Snapshot>) {
  snap = { ...snap, ...p };
  snap.mic = !canHear() ? 'unavailable' : snap.voice && !muted ? 'on' : 'off';
  subs.forEach(f => { try { f(); } catch (e) { report('subscriber', (e as Error).message); } });
}

let msgId = 0;
let noted = false;
// "Hi, I'm X's assistant. Ask me…" -> "Hi, I'm X's assistant, and this is a demo site, so no real details please. Ask me…"
function withNote(text: string, note: string): string {
  const i = text.search(/[.!?](\s|$)/);
  return i > 0 ? `${text.slice(0, i)}, and ${note}${text.slice(i)}` : `${text} Quick note: ${note}.`;
}
// Text may carry secret values (a date of birth, a last four) between SECRET marks: they are spoken, never shown.
function add(who: 'bot' | 'user', raw: string, say = true, extra: Message['links'] = [], source?: Source) {
  let text = forDisplay(raw);
  const links = who === 'bot' && cfg?.manual?.doc
    ? [...text.matchAll(/\(page (\d+)\)/g)].map(m => ({ text: m[0], page: +m[1], href: `${cfg!.manual!.doc}#page-${m[1]}` })) : [];
  // The demo note is said once per call, inside the first greeting.
  if (who === 'bot' && cfg?.note && !noted) { noted = true; text = withNote(text, cfg.note); raw = withNote(raw, cfg.note); }
  set({ messages: [...snap.messages, { id: ++msgId, who, text, links: [...links, ...extra.filter(l => text.includes(l.text))], ...(source ? { source } : {}) }] });
  if (who === 'bot' && snap.voice && say) spoken(raw);
}
// The first thing said on a call is one short line, about three seconds; the full greeting stays on screen.
// "Hi, I'm Brindlewick's assistant, and this is a demo… Ask me… I can also…" -> "Hi, I'm Brindlewick's assistant. What can I help with?"
let introSaid = false;
function spokenPart(raw: string): string {
  if (introSaid) return raw;
  introSaid = true;
  const sentences = raw.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length <= 1 && raw.length < 90) return raw;
  const first = sentences[0].replace(/,\s*and [^.?!]*/, '');
  const last = sentences[sentences.length - 1];
  const ask = sentences.length > 1 && /\?$/.test(last) && last.length < 80 ? last : 'What can I help with?';
  return `${first.length < 60 ? first : `Hi, this is ${cfg?.business ?? 'the'} assistant.`} ${ask}`;
}

// ---- Voice, on LiveKit Agents (docs/decisions/0002). The page asks for the microphone first, then joins a LiveKit room
// where our agent (speech/agent.py) listens and speaks with open models on our server. Silero VAD and the turn detector
// end each turn; the caller can talk over the voice and it stops. Every reply is still decided here, by the engine: the
// agent calls copilot.turn with what it heard and speaks what comes back.
type LiveKit = typeof import('livekit-client');
let muted = false;
let room: import('livekit-client').Room | null = null;
let micTrack: import('livekit-client').LocalAudioTrack | null = null;
let voiceSeq = 0;
// While the agent waits on copilot.turn, what the copilot says is collected for the agent to speak, not said separately.
let collect: string[] | null = null;
let lastSearchMs: number | undefined;

// Until the agent picks up, the caller hears a soft ringback made here (two short tones every 3 s, no audio file, no
// browser speech). With no agent after AGENT_WAIT_MS, the call carries on as text instead of sitting on "Connecting…".
// A cold local worker can take over 20 seconds to register while loading speech models.
const AGENT_WAIT_MS = 45_000;
let ring: { ctx: AudioContext; timer: ReturnType<typeof setInterval> } | null = null;
let agentTimer: ReturnType<typeof setTimeout> | undefined;

function startRing() {
  stopRing();
  let ctx: AudioContext;
  try { ctx = new AudioContext(); } catch { return; }
  void ctx.resume();
  const tone = (at: number) => {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.05, at + 0.02);
    g.gain.setValueAtTime(0.05, at + 0.38);
    g.gain.linearRampToValueAtTime(0, at + 0.4);
    g.connect(ctx.destination);
    for (const f of [400, 450]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      o.connect(g); o.start(at); o.stop(at + 0.4);
    }
  };
  const burst = () => { const t = ctx.currentTime + 0.05; tone(t); tone(t + 0.6); };
  burst();
  ring = { ctx, timer: setInterval(burst, 3000) };
}
function stopRing() {
  clearTimeout(agentTimer); agentTimer = undefined;
  if (!ring) return;
  clearInterval(ring.timer);
  void ring.ctx.close();
  ring = null;
}

const loadLiveKit = (): Promise<LiveKit> => import(/* @vite-ignore */ `${location.origin}/copilot/vendor/livekit-client.esm.mjs`) as Promise<LiveKit>;

function spoken(raw: string) {
  const text = forSpeech(spokenPart(raw)).replace(/·/g, ',').replace(/\s+/g, ' ').trim();
  if (!text) return;
  if (collect) { collect.push(text); return; }
  // Said outside a turn (a form that opens after a page change, for one): the agent says it.
  sayNow(text);
}
function sayNow(text: string) {
  void toReplyLanguage(text).then(sayIt);
}
function sayIt(text: string) {
  const agent = agentIdentity();
  if (room && agent) void room.localParticipant.performRpc({ destinationIdentity: agent, method: 'agent.say', payload: JSON.stringify({ text }) }).catch(e => { report('voice', `agent.say: ${(e as Error).message}`); failure('rpc', `agent.say: ${(e as Error).message}`, { method: 'agent.say', text }); });
}
// A library search can take several seconds: on a call, the caller hears that it is looking rather than silence.
// A search that answers within a moment says nothing first; one that runs on gets a short line that is never the one
// before it (code picks it: a topic line when the question's topic is known, never a claim that anything was found).
const WAIT_MS = 1200;
async function searched(text: string) {
  const t0 = performance.now();
  const timer = room && snap.voice ? setTimeout(() => sayNow(talk().waitLine(text)), WAIT_MS) : undefined;
  try { return await libraryReply(text); } finally { clearTimeout(timer); lastSearchMs = Math.round(performance.now() - t0); }
}

function agentIdentity(): string {
  for (const p of room?.remoteParticipants.values() ?? []) if (p.isAgent) return p.identity;
  return '';
}

// The agent's own state (lk.agent.state) is what the call panel shows: Listening, Thinking, Speaking.
function agentState(state: string | undefined) {
  if (!snap.voice || !room) return;
  if (muted) { set({ status: 'muted' }); return; }
  const s: Status = state === 'speaking' ? 'speaking' : state === 'thinking' ? 'thinking' : state === 'listening' ? 'listening' : 'waiting';
  if (s !== 'waiting') stopRing();
  set({ status: s, ...(s === 'speaking' ? { heard: '' } : {}) });
}

// Small talk is answered at once and never searched: "can you hear me", "hello?", "are you there", "sorry, what?",
// "wait", "thanks", "can I ask you about taxes?", "what can you help with?". Every part of what was said has to be small talk, so "hello, how do I file an extension" is a question.
const SMALL_TALK: [RegExp, string][] = [
  [/^(hello|hallo|hi|hey|hey there|hi there|hello there|um|uh|hmm|testing|test|testing testing|mic check)$/, 'here'],
  [/^(can|could|do|did) you (hear|here|understand) me( now| ok| okay| alright| at all)?$|^(are|r) you (there|still there|listening|hearing me|with me|on)$|^(is )?(anyone|anybody|somebody|someone) (there|home)$|^is (this|it) (working|on)$|^hello can you hear me$/, 'hear'],
  [/^(sorry|pardon|pardon me|what|what was that|come again|say that again|say again|can you repeat that|could you repeat that|repeat that|repeat|huh|excuse me|i didn't catch that|i didnt catch that|sorry what)$/, 'repeat'],
  [/^(wait|hold on|hang on|one sec|one second|one moment|just a sec|just a second|just a moment|give me a sec|give me a second|wait a second|wait a minute|hold on a sec|hold on a second|sorry wait)$/, 'wait'],
  [/^(can|could|may) i (ask|ask you)( a question| questions| some questions| a few questions| something| anything| stuff)?( about (tax|taxes|my taxes|tax stuff|tax questions|this|that|something|anything))?$|^(can|could) you (help|help me|answer questions|answer tax questions|answer my questions)$|^what can (you|i) (do|ask|help with|help me with|ask you|ask about)$|^what do you (do|know|help with)$|^(who|what) are you$|^how does (this|it) work$|^is this (a|an) (bot|robot|ai|real person|person)$|^are you (a|an) (bot|robot|ai|real person|person|human)$/, 'help'],
  [/^(thanks|thank you|thank you so much|thanks so much|thanks a lot|thank you very much|cheers|ok thanks|okay thanks|ok thank you|okay thank you|great thanks|perfect thanks)$/, 'thanks'],
];
function smallTalk(text: string): string | null {
  const parts = text.toLowerCase().replace(/’/g, "'").split(/[,.!?;]+/).map(p => p.replace(/[^a-z' ]/g, '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!parts.length) return null;
  const kinds = parts.map(p => SMALL_TALK.find(([re]) => re.test(p))?.[1]);
  if (kinds.some(k => !k)) return null;
  const lastBot = [...snap.messages].reverse().find(m => m.who === 'bot')?.text ?? '';
  // What the copilot was waiting for: the open form question, or the last thing it asked.
  const formOpen = snap.mode === 'form' && formOn();
  const asked = (formOpen ? currentAsk() : '') || ([...lastBot.split(/(?<=[.!?])\s+/)].reverse().find(x => /\?$/.test(x)) ?? '');
  const ask = asked || (snap.mode === 'ask' ? "What's your question?" : 'What can I help with?');
  if (kinds.includes('repeat')) return lastBot || ask;
  if (kinds.includes('hear')) return `Yes, I can hear you. ${ask}`;
  if (kinds.includes('wait')) return 'Sure, take your time.';
  if (kinds.includes('help')) return `${helpLine()} ${ask}`;
  if (kinds.includes('thanks')) return formOpen ? `You're welcome. ${ask}` : "You're welcome. Anything else?";
  return `Hi, I'm here. ${ask}`;
}

// "Can I ask you about taxes?" is a question about the assistant, not one for the guides: say what it can do.
function helpLine(): string {
  const d = cfg?.desk;
  if (d) return `Yes, go ahead. I'm the ${cfg?.business ?? 'site'} assistant. I answer from the IRS guides and show you the part I'm quoting${d.book ? `, and I can help you ${d.book.text.toLowerCase()}` : ''}. For advice on your own situation, a preparer can help.`;
  return `Yes. I'm the ${cfg?.business ?? 'site'} assistant: I can fill in this form with you, one question at a time, or take you to another page.`;
}

// From the caller's tap on "Start voice call": the microphone first, and nothing is said until they have answered.
async function startVoice() {
  const seq = ++voiceSeq;
  set({ status: 'waiting' });
  let lk: LiveKit;
  try { lk = await loadLiveKit(); } catch (e) {
    report('voice', `livekit-client: ${(e as Error).message}`);
    toText("Voice isn't available right now, so let's carry on by typing. Your answers go in the box below.");
    return;
  }
  try {
    micTrack = await lk.createLocalAudioTrack({ echoCancellation: true, noiseSuppression: true, autoGainControl: true });
  } catch (e) {
    const name = (e as Error).name;
    report('voice', `microphone: ${name}`);
    toText(name === 'NotAllowedError' || name === 'SecurityError'
      ? "The microphone is blocked, so I can't hear you. You can type below instead, or allow the microphone for this site and start the call again."
      : "I can't find a microphone here, so let's carry on by typing. Your answers go in the box below.");
    return;
  }
  if (seq !== voiceSeq || !snap.open) { micTrack.stop(); micTrack = null; return; }
  let grant: { url: string; token: string; stack: string; language: string };
  try {
    const r = await fetch(`${API_BASE}/api/voice/token`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(voiceAsk()) });
    if (!r.ok) throw new Error(`token ${r.status}`);
    grant = await r.json();
    set({ stack: grant.stack, language: grant.language, languages: allLanguages(), spokenLanguage: '' });
    setDeskStack(grant.stack);
    setReplyLanguage(languageName(grant.language) || 'English');
  } catch (e) {
    report('voice', (e as Error).message);
    toText("Voice isn't available right now, so let's carry on by typing. Your answers go in the box below.");
    return;
  }
  const rm = new lk.Room({ adaptiveStream: false, dynacast: false });
  room = rm;
  // The agent says which speech models it runs; the call id it gets back puts its own spans in this call's session.
  rm.registerRpcMethod('copilot.greet', async data => {
    noteVoice(JSON.parse(data.payload || '{}'));
    collect = [];
    if (!snap.messages.length) setMode(snap.mode);
    else { introSaid = false; spoken([...snap.messages].reverse().find(m => m.who === 'bot')?.text ?? ''); }
    let say = collect.join(' '); collect = null;
    // No language picked on a stack that speaks several: the agent asks, and goes by what it hears meanwhile.
    if (!snap.language && snap.languages.length > 1) { say += ` ${LANGUAGE_ASK}`; add('bot', LANGUAGE_ASK, false); }
    return JSON.stringify({ say: await toReplyLanguage(say), call: callId });
  });
  rm.registerRpcMethod('copilot.turn', async data => {
    // text: what the agent heard; language: the reply's, heard: what the recogniser heard; the rest (turn id, speech
    // model, its confidence, timings so far) goes on the turn's span.
    const { text: said, language, heard, ...voice } = JSON.parse(data.payload || '{}');
    const text = String(said ?? '');
    heardLanguage(String(language ?? ''), String(heard ?? ''));
    collect = []; lastSearchMs = undefined;
    const t0 = performance.now();
    const asked = askedLanguage(text);
    const kind = asked ? 'language' : await send(text, { ...voice, language: heard || language });
    if (asked) { setLanguage(asked.code); collect.push(await toReplyLanguage(`Sure, let's talk in ${asked.name}. What can I help with?`)); }
    const say = await toReplyLanguage(collect.join(' ')); collect = null;
    return JSON.stringify({ say, kind, decideMs: Math.round(performance.now() - t0), searchMs: lastSearchMs, call: callId });
  });
  rm.on(lk.RoomEvent.TrackSubscribed, track => {
    if (track.kind !== lk.Track.Kind.Audio) return;
    stopRing();
    const el = track.attach();
    el.dataset.copilotVoice = '1'; el.style.display = 'none';
    document.body.appendChild(el);
  });
  rm.on(lk.RoomEvent.ParticipantAttributesChanged, (_changed, p) => { if (p.isAgent) agentState(p.attributes['lk.agent.state']); });
  rm.on(lk.RoomEvent.Disconnected, () => { if (room === rm && snap.voice) toText("The voice line dropped, so let's carry on by typing."); });
  // What the agent heard, live on screen ("heard: …"). A secret answer is never shown.
  rm.registerTextStreamHandler('lk.transcription', async (reader, from) => {
    if (from.identity !== rm.localParticipant.identity) return;
    const text = await reader.readAll();
    if (room === rm && snap.voice) set({ heard: verifier?.secretOpen() ? '••••' : text.trim() });
  });
  try {
    startRing();
    agentTimer = setTimeout(() => {
      if (room !== rm || agentIdentity()) return;
      report('voice', `no agent after ${AGENT_WAIT_MS} ms`);
      failure('no-agent', `no agent after ${AGENT_WAIT_MS} ms`, { wait_ms: AGENT_WAIT_MS }, 'agent never answered');
      toText("The voice line isn't answering right now, so let's carry on by typing. Your answers go in the box below.");
    }, AGENT_WAIT_MS);
    await rm.connect(grant.url, grant.token);
    await rm.localParticipant.publishTrack(micTrack, { source: lk.Track.Source.Microphone });
    if (muted) await micTrack.mute();
  } catch (e) {
    report('voice', `connect: ${(e as Error).message}`);
    toText("Voice isn't available right now, so let's carry on by typing. Your answers go in the box below.");
  }
}

// ---- The caller's language (docs/decisions/0012). They can pick it by the call button, answer the agent's question at
// the start, or switch during the call (the picker, or "can we speak Spanish?"). It goes to the agent on the caller's
// participant attributes, so speech to text, the turn detector and the voice all follow it, and LFM3 writes in it.
const LANGUAGE_ASK = 'Which language would you like to talk in? You can just start speaking it.';
function voiceAsk() {
  return { stack: snap.stack, language: snap.language, allowed: cfg?.voice?.stacks, default: cfg?.voice?.default };
}
function stackLanguages(stack: string): Language[] {
  return snap.voiceStacks.find(s => s.id === stack)?.languages ?? snap.languages;
}
// Before a call the picker offers every language the allowed stacks speak; picking one the chosen stack doesn't speak
// moves the call to a stack that does.
function allLanguages(): Language[] {
  const seen = new Map<string, Language>();
  for (const st of snap.voiceStacks) for (const l of st.languages) if (!seen.has(l.code)) seen.set(l.code, l);
  return [...seen.values()];
}
const languageName = (code: string) => allLanguages().find(l => l.code === code)?.name ?? '';
function heardLanguage(language: string, heard: string) {
  if (heard && heard !== snap.spokenLanguage) set({ spokenLanguage: heard });
  setReplyLanguage(languageName(language) || 'English');
}
// "Can we speak Spanish?", "en español por favor", "parlons français": a language this stack speaks, named in a request.
function askedLanguage(text: string): Language | null {
  const t = text.toLowerCase();
  if (!/\b(speak|talk|switch|change|use|language|in)\b|habl|parl|fala|en |por favor|请|说/.test(t)) return null;
  const hit = snap.languages.find(l => l.code !== snap.language && [l.name, l.native].some(n => t.includes(n.toLowerCase())));
  return hit && t.split(/\s+/).length <= 8 ? hit : null;
}
function setLanguage(code: string) {
  if (code && !allLanguages().some(l => l.code === code)) return;
  const language = code;
  const stack = stackForLanguage(snap.voiceStacks, snap.stack, language);
  const reconnect = snap.open && snap.voice && stack !== snap.stack;
  set({ language, stack });
  setReplyLanguage(languageName(language) || 'English');
  // A different listener/voice needs a new room. Keep this call's engine, draft, transcript and timer.
  if (reconnect) {
    // Let an in-flight language-request RPC return before replacing its room.
    const seq = voiceSeq;
    setTimeout(() => {
      if (seq === voiceSeq && snap.open && snap.voice && snap.stack === stack && snap.language === language) {
        stopVoice(); void startVoice();
      }
    }, 1000);
    return;
  }
  void room?.localParticipant.setAttributes({ 'copilot.language': language }).catch(e => report('voice', `language: ${(e as Error).message}`));
}
function setStack(id: string) {
  if (snap.open || !snap.voiceStacks.some(s => s.id === id)) return;
  const languages = stackLanguages(id);
  set({ stack: id, language: languages.some(l => l.code === snap.language) ? snap.language : languages.length === 1 ? languages[0].code : '' });
}
// What the picker offers on this page: asked of the server, which knows the stacks and whether the owner forced one.
async function loadVoiceOptions() {
  try {
    const r = await fetch(`${API_BASE}/api/voice/options`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(voiceAsk()) });
    if (!r.ok) return;
    const o: { stack: string; stacks: VoiceStack[] } = await r.json();
    set({ voiceStacks: o.stacks, stack: o.stack });
    const languages = allLanguages();
    const current = stackLanguages(o.stack);
    set({ languages, language: snap.language || (current.length === 1 ? current[0].code : '') });
  } catch { /* no voice options: the call still starts on the server's default */ }
}

function stopVoice() {
  voiceSeq++;
  stopRing();
  const rm = room; room = null; collect = null;
  void rm?.disconnect();
  micTrack?.stop(); micTrack = null;
  document.querySelectorAll('[data-copilot-voice]').forEach(e => e.remove());
}

function toText(msg?: string) {
  if (msg) failure('voice-fallback', msg, {}, 'fell back to text');
  stopVoice();
  set({ voice: false, textInput: true, status: 'text', heard: '' });
  if (msg) add('bot', msg);
}

// ---- Form mode: the page adapter reads the visible form, the engine asks one question at a time.
// The server's local model unloads after about five idle minutes. A call wakes it while the greeting plays, and a model
// call that takes a while shows how long it should take: about 2 s while the model loads, about 3 s once it is loaded.
const IDLE_MS = 290_000;
let modelUsedAt = 0;
const remoteModel = new RemoteModel();
const remoteDesk = new RemoteDeskModel();
async function timed<T>(call: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const cold = t0 - modelUsedAt > IDLE_MS;
  const show = setTimeout(() => set({ wait: cold
    ? { text: 'Warming up the assistant…', until: t0 + 2000 }
    : { text: 'Thinking…', until: t0 + 3000 } }), 600);
  try { return await call(); }
  finally { clearTimeout(show); modelUsedAt = Date.now(); if (snap.wait) set({ wait: null }); }
}
// Jev's on-topic gate, for caller verification.
const model: Model = { name: 'remote', understand: input => timed(() => remoteModel.understand(input)) };
// The desk's model turn (LFM3).
const deskModel: ChatModel = { name: remoteDesk.name, chat: (m, t, o) => timed(() => remoteDesk.chat(m, t, o)) };
function warm() {
  if (Date.now() - modelUsedAt < IDLE_MS) return;
  void warmUp().then(() => { modelUsedAt = Date.now(); });
}
let desk: Desk | null = null;
// The form desk is done once every field is in (or the caller ended): the form is theirs to check and submit.
const formDone = () => !!desk && (desk.complete || desk.done);
const formOn = () => !!desk && !formDone();
let flow: Flow | null = null;
let form: PageForm | null = null;
let firstEl: Element | null = null;
let parts = 0;
let covered = 0;

// A form still loading its own data (aria-busy, e.g. a client picked from the address or a staff list) is read once
// it is ready, so its options are there and what it filled in itself counts as answered.
let waitingForm = false;
function startForm() {
  const busy = () => !!document.querySelector('[data-copilot-form][aria-busy="true"]');
  if (waitingForm) return;
  if (busy()) {
    waitingForm = true;
    const until = Date.now() + 5000;
    const wait = () => {
      if (busy() && Date.now() < until) { setTimeout(wait, 100); return; }
      waitingForm = false;
      startFormNow();
    };
    setTimeout(wait, 100);
    return;
  }
  startFormNow();
}
// Boxes and lists that already hold a value when the form is read (the page filled them in) count as answered.
function prefilledValues(f: PageForm): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of f.fields) {
    const el = document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-copilot-id="${p.id}"]`);
    if (!el || p.tag === 'radio' || (el as HTMLInputElement).type === 'checkbox') continue;
    if (el instanceof HTMLSelectElement) { const o = el.selectedOptions[0]; if (el.value && o) out[p.id] = (o.textContent ?? '').trim(); }
    else if (el.value.trim()) out[p.id] = el.value.trim();
  }
  return out;
}
function startFormNow() {
  form = readInPage();
  if (!form.fields.length) { desk = null; add('bot', "There's nothing left for me to fill in on this page."); return; }
  flow = flowFromPage(form, { business: cfg!.business, id: cfg!.form });
  if (cfg!.form) flow.intro = `Hi, I'm the ${cfg!.business} copilot. I can fill in this ${cfg!.form} form with you, one question at a time. I'll type your answers in, and you press ${form.submit} yourself at the end.`;
  if (parts++) flow.intro = `Thanks. On to the next part.`;
  firstEl = document.querySelector(`[data-copilot-id="${form.fields[0].id}"]`);
  const filler = new DomFiller(form);
  desk = new Desk(flow, { model: deskModel, hooks: filler, answer: answerFor, unknown: manual ? manual.unknown ?? NO_ANSWER : undefined, finish: flow.doneMessage });
  const draft = takeDraft();
  if (draft) {
    // Back on a form left half filled during this call: its answers go back in and the open question is asked.
    for (const f of flow.fields) if (draft[f.name]) void filler.fill(f, draft[f.name]);
    add('bot', desk.prefill(draft, 'Back to the form. Your earlier answers are still filled in.'));
  } else if (Object.keys(prefilledValues(form)).length) {
    const pre = prefilledValues(form);
    const lead = carried ? `Here's the ${cfg!.form} form, with ${Object.keys(pre).length === 1 ? 'one answer' : 'some answers'} already in. I'll fill in the rest with you, and you press ${form.submit} yourself at the end.` : flow.intro;
    add('bot', desk.prefill(pre, lead));
  } else {
    if (carried) flow.intro = `Here's the ${cfg!.form} form. I'll fill it in with you, one question at a time, and you press ${form.submit} yourself at the end.`;
    add('bot', desk.start());
  }
  highlight();
}

// ---- Drafts: a form left mid-call (the caller asked for another page) keeps its answers for this browser tab.
const draftKey = () => `copilot-draft:${location.pathname}`;
function saveDraft() {
  if (!form || !desk || !flow) return;
  const values: Record<string, string> = { ...desk.values };
  // Boxes the person typed into themselves count as answered too.
  for (const p of form.fields) {
    if (values[p.id] !== undefined || p.tag === 'radio' || p.tag === 'select') continue;
    const v = document.querySelector<HTMLInputElement>(`[data-copilot-id="${p.id}"]`)?.value?.trim();
    if (v) values[p.id] = v;
  }
  try {
    if (Object.keys(values).length && !formDone()) sessionStorage.setItem(draftKey(), JSON.stringify(values));
    else sessionStorage.removeItem(draftKey());
  } catch { /* storage off: the form starts over */ }
}
function takeDraft(): Record<string, string> | null {
  try {
    const raw = sessionStorage.getItem(draftKey());
    sessionStorage.removeItem(draftKey());
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// Mark the field being asked ([data-copilot-active], for the site to style) and keep it above the panel.
function highlight() {
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
  if (!snap.open || snap.mode !== 'form' || !desk || !formOn()) return;
  const el = document.querySelector(`[data-copilot-id="${desk.pending?.field ?? desk.current}"]`);
  const box = el && (el as HTMLInputElement).type === 'radio' ? el.closest('fieldset') ?? el : el;
  if (!box) return;
  box.setAttribute('data-copilot-active', '');
  const r = box.getBoundingClientRect();
  const free = innerHeight - covered;
  if (r.top < 70 || r.bottom > free - 12) window.scrollBy({ top: r.top - Math.max(70, (free - r.height) * 0.35), behavior: 'smooth' });
}

function currentAsk(): string {
  if (!desk || !flow || !formOn()) return '';
  return desk.pending?.text ?? flow.fields.find(f => f.name === desk!.current)?.question ?? '';
}

function stepNext(): HTMLButtonElement | null {
  const b = document.querySelector<HTMLButtonElement>('[data-copilot-form] button[data-copilot-next]');
  if (!b || b.type !== 'button' || b.disabled || b.closest('[hidden]') || !b.getClientRects().length) return null;
  return b;
}

// A multi-step form shows its next step after the person presses Next (a step may be unhidden or newly rendered);
// the copilot then carries on with that step.
let observer: MutationObserver | null = null;
let stepTimer: ReturnType<typeof setTimeout> | undefined;
function watchForm() {
  observer?.disconnect();
  const el = document.querySelector('[data-copilot-form]');
  if (!el) return;
  observer = new MutationObserver(() => {
    if (!formDone() || snap.mode !== 'form' || !snap.open) return;
    clearTimeout(stepTimer);
    stepTimer = setTimeout(() => {
      if (!formDone()) return;
      const next = readInPage();
      const first = next.fields[0] && document.querySelector(`[data-copilot-id="${next.fields[0].id}"]`);
      if (first && first !== firstEl) startForm();
    }, 150);
  });
  observer.observe(el, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden', 'disabled', 'class', 'style'] });
}

// ---- Guide mode: walk through the manual's steps; any question is answered only from the manual, or "I don't know".
let guide: Guide | null = null;
let manual: Manual | null = null;
let lookup: Guide | null = null;

function setMode(m: Mode) {
  if (!snap.modes.includes(m)) return;
  set({ mode: m });
  if (m === 'ask') {
    if (!snap.messages.length) add('bot', askDesk().start());
  } else if (m === 'guide' && manual) {
    guide ??= new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge());
    add('bot', guide.log.length ? 'Back to the walk-through. Say "repeat" to hear the step again.' : guide.start());
  } else if (m === 'form') {
    if (!desk) startForm(); else add('bot', `Back to the form. ${currentAsk()}`.trim());
  }
  highlight();
}

// ---- Verification: "check on my return" on a desk page. One Verifier per call; the server keeps the tries.
let verifier: Verifier | null = null;
let verifyBackend: RemoteVerify | null = null;
async function verifyReply(text: string): Promise<string | null> {
  if (!cfg?.verify) return null;
  if (verifier?.state === 'collecting') {
    const r = await verifier.turn(text);
    if ((verifier.state as string) === 'verified') set({ account: verifier.card });
    if ((verifier.state as string) === 'cancelled') verifier = null;
    return r || null;
  }
  if (snap.mode !== 'ask' || !WANTS_VERIFY.test(text)) return null;
  if (verifier?.state === 'verified') { if (verifier.card) set({ account: verifier.card }); return "You're already verified on this call. Your return's status is on the card."; }
  if (verifier?.state === 'locked') return verifier.turn(text);
  verifyBackend ??= new RemoteVerify();
  verifier = new Verifier(model, verifyBackend, { handoff: cfg.verify.handoff });
  return verifier.start();
}

// ---- Desk: questions about the visitor's own situation go to a person; anything else is quoted from the library.
const ADVICE = /\b((?<!(what|how|where|when|who) )should (i|we) (?!(do|bring|expect|send|contact|call|mail|include|use|report|keep)\b)|shall (i|we)|how much (will|would|should) (i|we)|(will|would) (i|we) (owe|get back|have to pay|be audited)|what('s| is| will be) (my|our) (refund|tax bill|tax)\b|am i (better|worse) off|are we (better|worse) off|is it (better|worth it|smart|wise) (for me|for us|to)|do you (recommend|think i|think we)|what would you (do|recommend)|(better|best) for (me|us)|can you (do|file|prepare|review) (my|our)|help me (decide|choose)|which is better for)/i;
const BOOK = /\b(book|schedule|set up|make) (a |an |my )?(consult(ation)?|appointment|meeting|call)\b|\b(talk|speak) (to|with) (a|an|someone|somebody|a real) ?(preparer|accountant|person|human|cpa|expert)?\b/i;

// Booking and advice are code's, before the model: a question about the visitor's own situation is never answered.
function deskRoute(text: string): { reply: string; links: Message['links'] } | null {
  const d = cfg!.desk!;
  const book = d.book && !location.pathname.startsWith(d.book.href) ? [{ text: d.book.text, href: d.book.href }] : [];
  if (BOOK.test(text)) {
    return book.length ? { reply: `Happy to. Open ${d.book!.text} and I'll fill in the intake form with you, one question at a time.`, links: book }
      : { reply: `We're on the booking form. ${currentAsk()}`.trim(), links: [] };
  }
  if (ADVICE.test(text)) return { reply: `${d.advice}${book.length ? ` Open ${d.book!.text} to pick a time.` : ''}`, links: book };
  return null;
}

// The desk's lookup (its answer_question tool): the library's answer, quoted, with its source opened in the site's
// viewer, or the manual's; null when nothing answers. The links and source go on the reply's message.
let answered: { links: Message['links']; source?: Source } | null = null;
function takeAnswered() { const a = answered; answered = null; return a; }
let saidNow = ''; // what the visitor said this turn, before the desk model rewrote it
async function answerFor(q0: string): Promise<string | null> {
  if (!lookup) return null;
  if (cfg?.desk) {
    // The model chose to look this up. A fragment is attached to the question before it, then code asks back first
    // when the question is too vague to quote an answer to.
    const asking = snap.mode === 'ask';
    const q = asking ? talk().resolve(q0) : q0;
    const ask = asking ? talk().clarify(q) : null;
    if (ask) return ask;
    lookup.also = asking ? ownQuestion(saidNow) : ''; // the visitor's own words are searched too
    let r: Awaited<ReturnType<typeof searched>>;
    try { r = await searched(q); } finally { lookup.also = ''; }
    if (r.asked) return r.reply; // asked which of two meanings: nothing was quoted
    if (!lookup.last) {
      // Nothing answers: the first time the plain "I don't know"; after that something else, never the same line twice.
      const near = lookup.lastNearest;
      return asking ? talk().refusal(q, near && { src: near.cite?.title.split(', ')[0] ?? 'the guides', quote: shortQuote(near.text, q) }) : null;
    }
    answered = { links: r.links, source: r.source };
    return r.reply;
  }
  const reply = await lookup.lookup(q0);
  const p = lookup.last;
  if (!p) return null;
  answered = { links: p.cite ? [{ text: p.cite.title, href: p.cite.url }] : [] };
  return reply;
}

// The question desk of a page with no form (the tax site's /tax): LFM3 talks, and every fact is quoted by answerFor.
let asker: Desk | null = null;
// The conversation around the answers (vague questions asked back, "yeah", the follow-up offer): one per call.
let talking: Dialogue | null = null;
function talk(): Dialogue { return (talking ??= new Dialogue({ offers: cfg?.desk?.offers, book: cfg?.desk?.book })); }
function askDesk(): Desk {
  if (!asker) {
    asker = new Desk({ id: 'ask', business: cfg!.business, scope: (cfg!.manual?.title ?? 'documents').toLowerCase(), intro: cfg!.desk!.greeting, doneMessage: '', fields: [] },
      { model: deskModel, answer: answerFor, unknown: manual ? manual.unknown ?? NO_ANSWER : undefined });
    asker.start();
  }
  return asker;
}

async function libraryReply(text: string): Promise<{ reply: string; links: Message['links']; source?: Source; asked?: boolean }> {
  const reply = await lookup!.lookup(text);
  const p = lookup!.last;
  if (!p?.cite) return { reply, links: [] };
  const links = [{ text: p.cite.title, href: p.cite.url }];
  // A short question that two different passages answer about equally well can mean two things: ask which, quote nothing yet.
  const split = cfg?.desk && snap.mode === 'ask' && lookup!.lastSplit ? talk().splitAsk(text, lookup!.lastSplit) : null;
  if (split) { lookup!.seen.delete(p.id); return { reply: split, links: [], asked: true }; }
  const src = sourceOf(p.cite, lookup!.lastQuote, p.page);
  if (!src) return { reply, links };
  // The site shows the source next to the answer: open it, find the quoted words, highlight them, then say so.
  const found = await openSource(src);
  const quote = reply.slice(reply.indexOf('says: ') + 6);
  if (found === null) return { reply, links, source: src }; // this page has no viewer
  const where = src.page ? `page ${src.page}` : sectionOf(p.cite.title);
  // On the question desk the answer is worded the way a person would say it, with one follow-up; elsewhere it stays as it was.
  if (cfg?.desk && snap.mode === 'ask') {
    const d = talk();
    const repeated = lookup!.lastRepeat;
    if (!repeated) d.note(text, src.title, quote);
    return { reply: d.phrase({ src: src.title, where, quote, found: !!found, repeated, question: text, closest: lookup!.lastClosest }), links, source: snap.source ?? src };
  }
  return {
    reply: found ? `I've opened ${src.title}${where ? `, ${where}` : ''}. The highlighted part says: ${quote}`
      : `I've opened ${src.title}, but I couldn't find the exact line on that page. ${reply}`,
    links, source: snap.source ?? src,
  };
}

// ---- Sources: each library answer's document, opened in the site's viewer with the quoted words highlighted.
const LONG: Record<string, string> = { 'IRS Pub': 'IRS Publication', 'IRS FAQ': 'the IRS FAQ' };
const sectionOf = (citeTitle: string) => (citeTitle.includes(', ') ? citeTitle.slice(citeTitle.indexOf(', ') + 2) : '');
function sourceOf(cite: { title: string; url: string; doc?: string; anchor?: string }, quote: string[], page?: number): Source | null {
  if (!cfg?.guidePage || !cite.doc) return null;
  const short = cite.title === 'The IRS.gov FAQ' ? 'IRS FAQ' : cite.title.split(', ')[0];
  const title = Object.entries(LONG).reduce((t, [a, b]) => t.startsWith(a) ? b + t.slice(a.length) : t, short);
  const section = sectionOf(cite.title);
  return { label: page ? `${short} · p. ${page}` : section ? `${short} · ${section}` : short, title, credit: `Source: ${title.replace(/^the /, '')} (public domain)`,
    doc: cite.doc, page, anchor: cite.anchor, href: cite.url, quote: quote.filter(Boolean), found: null };
}

const viewerBody = () => document.querySelector<HTMLElement>('[data-copilot-source-body]');

// Shows the source and highlights its quote. true: highlighted; false: the document is shown but the words weren't
// found in it (no highlight then, never a guess); null: this page has no source viewer.
async function openSource(src: Source): Promise<boolean | null> {
  if (CSS_HL) CSS_HL.delete('copilot-quote');
  set({ source: { ...src, found: null } });
  const body = await settled(() => viewerBody(), 15000);
  if (!body) { set({ source: null }); return null; }
  const ranges = locate(body, src.quote);
  const found = !!ranges && !!CSS_HL;
  if (found) {
    CSS_HL!.set('copilot-quote', new (window as any).Highlight(...ranges!));
    scrollWithin(body, ranges![0].getBoundingClientRect());
  } else if (src.anchor) {
    const h = body.querySelector(`[id="${CSS.escape(src.anchor)}"]`);
    if (h) scrollWithin(body, h.getBoundingClientRect());
  }
  if (snap.source?.doc === src.doc) set({ source: { ...src, found } });
  return found;
}

// Waits until the viewer has rendered its document: the body exists, nothing in it is still loading (a PDF page's text
// layer marks itself data-loading until pdf.js has drawn it) and its text has stopped changing.
async function settled(get: () => HTMLElement | null, ms: number): Promise<HTMLElement | null> {
  const t0 = Date.now();
  let last = -1, same = 0;
  while (Date.now() - t0 < ms) {
    const el = get();
    const n = el && !el.querySelector('[data-loading]') ? el.textContent?.length ?? -1 : -1;
    if (el && n > 40 && n === last) { if (++same >= 2) return el; } else same = 0;
    last = n;
    await new Promise(r => setTimeout(r, 120));
  }
  const el = get();
  return el && (el.textContent?.length ?? 0) > 40 ? el : null;
}

const CSS_HL: Map<string, unknown> | null = (window as any).CSS?.highlights && (window as any).Highlight ? (CSS as any).highlights : null;
if (CSS_HL && !document.getElementById('copilot-quote-style')) {
  const st = document.createElement('style');
  st.id = 'copilot-quote-style';
  st.textContent = '::highlight(copilot-quote){background-color:rgba(255,214,102,.65);color:inherit}';
  document.head.appendChild(st);
}

// Finds every quoted sentence in the rendered document, word for word: letters and digits must match exactly, while
// spacing, punctuation, line-end hyphens and ligatures (a PDF's text layer has all of these) are ignored. A table row
// quoted as "a | b | c" is found cell by cell. Returns null unless every part is found, in order and close together.
function locate(root: HTMLElement, quote: string[]): Range[] | null {
  const map: [Text, number][] = [];
  let flat = '';
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode() as Text | null; n; n = walker.nextNode() as Text | null) {
    for (let i = 0; i < n.data.length; i++) {
      for (const c of loose(n.data[i])) { flat += c; map.push([n, i]); }
    }
  }
  const parts = quote.flatMap(q => q.split(/\s*\|\s*|\n+/)).map(loose).filter(q => q.length >= 3);
  if (!parts.length) return null;
  const ranges: Range[] = [];
  let from = 0, first = -1;
  for (const part of parts) {
    const at = flat.indexOf(part, from);
    if (at < 0 || (first >= 0 && at - first > 6000)) return null;
    if (first < 0) first = at;
    const [sn, so] = map[at], [en, eo] = map[at + part.length - 1];
    const r = document.createRange();
    r.setStart(sn, so); r.setEnd(en, eo + 1);
    ranges.push(r);
    from = at + part.length;
  }
  return ranges;
}
const loose = (s: string) => s.normalize('NFKC').toLowerCase().replace(/[^a-z0-9]+/g, '');

function scrollWithin(box: HTMLElement, target: DOMRect) {
  const scroller = (el: HTMLElement | null): HTMLElement | null => {
    for (; el; el = el.parentElement) if (el.scrollHeight > el.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(el).overflowY)) return el;
    return null;
  };
  const sc = scroller(box);
  if (sc) sc.scrollBy({ top: target.top - sc.getBoundingClientRect().top - sc.clientHeight * 0.25, behavior: 'smooth' });
  else window.scrollBy({ top: target.top - innerHeight * 0.3, behavior: 'smooth' });
}

function closeSource() {
  if (CSS_HL) CSS_HL.delete('copilot-quote');
  if (snap.source) set({ source: null });
}

function showSource(id?: number) {
  const m = [...snap.messages].reverse().find(x => x.source && (id === undefined || x.id === id));
  if (m?.source) void openSource(m.source);
  return m?.source ?? null;
}

// ---- Navigation: the copilot changes page with the site's own router, so the call stays connected.
let navigateFn: ((path: string) => void) | null = null;
let pendingAnchor = '';
function go(path: string) {
  closeSource();
  const [p, hash] = path.split('#');
  pendingAnchor = hash ?? '';
  if (location.pathname + location.search === p) { scrollToAnchor(); return; }
  saveDraft();
  if (navigateFn) navigateFn(path); else location.assign(path);
}
function scrollToAnchor() {
  const a = pendingAnchor;
  if (!a) return;
  pendingAnchor = '';
  void settled(() => document.getElementById(a)?.closest('main') as HTMLElement ?? (document.getElementById(a) ? document.body : null), 4000)
    .then(() => document.getElementById(a)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter(w => w && !['the', 'a', 'an', 'page', 'my', 'your', 'please', 'to', 'of', 'for', 'about', 'on'].includes(w));
// The site page a spoken name means ("payroll services" -> /tax/services/payroll), or null.
function pageFor(target: string) {
  const t = target.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\b(the|page|section|please)\b/g, ' ').replace(/\s+/g, ' ').trim();
  let best: { path: string; title: string; score: number } | null = null;
  for (const p of cfg?.pages ?? []) {
    for (const name of [p.title, ...(p.also ?? [])].map(n => n.toLowerCase())) {
      const score = t === name ? 100 + name.length : new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(t) ? 50 + name.length : 0;
      if (score && (!best || score > best.score)) best = { path: p.path, title: p.title, score };
    }
  }
  return best;
}
function closeMatches(target: string): string[] {
  const tw = new Set(words(target));
  const tri = (s: string) => new Set(Array.from({ length: Math.max(0, s.length - 2) }, (_, i) => s.slice(i, i + 3)));
  const tt = tri(target.toLowerCase());
  return (cfg?.pages ?? []).map(p => {
    const names = [p.title, ...(p.also ?? [])].map(n => n.toLowerCase());
    const w = Math.max(...names.map(n => words(n).filter(x => tw.has(x)).length));
    const g = Math.max(...names.map(n => { const nt = tri(n); return [...nt].filter(x => tt.has(x)).length / Math.max(1, nt.size + tt.size); }));
    return { title: p.title, score: w * 2 + g };
  }).sort((a, b) => b.score - a.score).slice(0, 3).map(x => x.title);
}

// ---- The staff app (/staff): open a client by name, start an engagement for one, and read out what a list shows.
// It looks clients up with the signed-in staff member's token (copilot.setAuth('staff', token)); it never writes.
let staffToken = '';
let picks: { id: string; kind: string; name: string; city: string }[] = [];
let pickThen = '';
const OPEN_CLIENT = /^(?:ok(?:ay)?,? )?(?:please )?(?:can you |could you )?(?:open|show(?: me)?|pull up|find|bring up|go to|take me to)\s+(?:the\s+)?(.+?)\s*(?:'s)?\s*(household|family|business|company|client|account|file)?$/i;
const NEW_ENGAGEMENT = /\b(?:start|open|create|begin|make|set up|add)\s+(?:a\s+)?new\s+(?:engagement|job|return)\s+(?:for|with)\s+(?:the\s+)?(.+?)\s*(household|family|business|company)?$/i;
async function findClients(q: string) {
  const r = await fetch(`/api/staff/find?q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${staffToken}` } });
  if (!r.ok) return [];
  return ((await r.json()).matches ?? []) as typeof picks;
}
const clientPath = (id: string, then: string) => then === 'engagement' ? `/staff/engagements/new?client=${id}` : `/staff/clients/${id}`;
const clientSaid = (c: (typeof picks)[number]) => `the ${c.name} in ${c.city}`;
// The list a page shows, in its own words ("118 returns waiting on documents"), once it has loaded.
async function listSummary(before: string): Promise<string> {
  const t0 = Date.now();
  while (Date.now() - t0 < 8000) {
    await new Promise(r => setTimeout(r, 150));
    const el = document.querySelector('[data-copilot-summary]') as HTMLElement | null;
    const t = el?.textContent?.trim() ?? '';
    if (el && t && el.getAttribute('aria-busy') !== 'true' && !/^loading\b/i.test(t) && (t !== before || Date.now() - t0 > 2500)) return t;
  }
  return '';
}
async function staffReply(text: string): Promise<string | null> {
  if (!staffToken) return null;
  // the answer to "which one?"
  if (picks.length) {
    const t = text.toLowerCase();
    const ord = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth'].findIndex(w => t.includes(w));
    const hit = ord >= 0 ? picks[ord] : picks.find(c => t.includes(c.city.toLowerCase()) || t.includes(c.id.toLowerCase()));
    if (hit) { const then = pickThen; picks = []; go(clientPath(hit.id, then)); return then === 'engagement' ? '' : `Here's ${clientSaid(hit)}, ${hit.id}.`; }
    if (/\b(never ?mind|cancel|none|neither|stop)\b/.test(t)) { picks = []; return 'OK.'; }
  }
  const eng = NEW_ENGAGEMENT.exec(text);
  const open = eng ? null : OPEN_CLIENT.exec(text);
  const who = (eng?.[1] ?? open?.[1] ?? '').trim();
  if (!who || (open && pageFor(who))) return null;
  const all = await findClients(`${who} ${eng?.[2] ?? open?.[2] ?? ''}`.trim());
  const kind = /household|family/i.test(eng?.[2] ?? open?.[2] ?? '') ? 'household' : /business|company/i.test(eng?.[2] ?? open?.[2] ?? '') ? 'business' : '';
  const ms = kind ? all.filter(c => c.kind === kind) : all;
  if (!ms.length) return open && !open[2] ? null : `I couldn't find a client called ${who}.`;
  const then = eng ? 'engagement' : 'open';
  if (ms.length === 1) { go(clientPath(ms[0].id, then)); return then === 'engagement' ? '' : `Here's ${clientSaid(ms[0])}, ${ms[0].id}.`; }
  picks = ms.slice(0, 5); pickThen = then;
  const list = picks.map(clientSaid);
  return `There are ${ms.length > 5 ? 'several' : ms.length} matches: ${list.slice(0, -1).join(', ')} and ${list.at(-1)}. Which one?`;
}

const CLOSE = /^(ok(ay)?,? )?(please )?(close|hide|dismiss) (that|this|it|the (source|guide|panel|document|viewer))\b/i;
const SHOW_SOURCE = /^(ok(ay)?,? )?(show me( that| it| the source| where)?|where did you (get|find) (that|this|it)|where('s| is| does) (that|this|it) (from|come from)|what('s| is) (the|your) source)\b/i;
const BACK_TO_FORM = /\b(back to|return to|take me (back )?to|go (back )?to|open) (the |my )?(form|booking( form)?|intake( form)?|consultation form|questions)\b/i;
const NAV = /^(?:ok(?:ay)?,? )?(?:please )?(?:can you |could you )?(?:take me to|go to|navigate to|bring up|open|show(?: me)?)\s+(?:the\s+)?(.+?)\s*(?:page)?\s*(?:please)?$/i;
const WANT = /^(?:ok(?:ay)?,? )?(?:i (?:need|want|would like|'d like)(?: to (?:see|get|make|set up|request|send|start))?|i'm looking for|where (?:are|is|do i find)) (?:a |an |the |your |my )?(.+?)\s*(?:please)?$/i;
const GUIDE = /\b(?:guide|publication|article|topic)s? (?:about|on|for|covering) (.+)$/i;

// A spoken request to change page, show or close a source; null when the words are something else (an answer).
async function navReply(text: string): Promise<string | null> {
  if (snap.source && CLOSE.test(text)) { closeSource(); return `Closed it.${snap.mode === 'form' && currentAsk() ? ` Back to the form: ${currentAsk()}` : ''}`; }
  if (CLOSE.test(text)) return null;
  const navTo = NAV.exec(text)?.[1];
  if (SHOW_SOURCE.test(text) && !navTo?.match(/\b(page|services?|pricing|team|guides?|faq|form)\b/) && !(navTo && pageFor(navTo))) {
    const src = showSource();
    if (!src) return "I haven't quoted a source yet. Ask me a tax question and I'll show you where the answer comes from.";
    return `Here it is: ${src.title}${src.label.includes(' · ') ? `, ${src.label.split(' · ')[1]}` : ''}, with the part I quoted highlighted.`;
  }
  const form = cfg?.pages?.find(p => p.form);
  if (form && BACK_TO_FORM.test(text)) {
    if (location.pathname === form.path) { closeSource(); return snap.mode === 'form' && desk ? `Back to the form. ${currentAsk()}`.trim() : null; }
    go(form.path);
    return ''; // the form page's own greeting carries on from the open question
  }
  const g = GUIDE.exec(text);
  if (g && cfg?.guidePage && lookup) {
    const hits = await new RemoteRetriever(cfg.manual!.label).search(g[1], 3);
    const top = hits.find(h => h.cite?.doc);
    if (!top?.cite?.doc) return `I couldn't find a guide about ${g[1]}. The Tax Guides page lists them all.`;
    go(`${cfg.guidePage}/${top.cite.doc}${top.page ? `?page=${top.page}` : top.cite.anchor ? `#${top.cite.anchor}` : ''}`);
    const src = sourceOf(top.cite, [], top.page);
    return `Here's ${src?.title ?? 'that guide'}${top.page ? `, page ${top.page}` : ''}${sectionOf(top.cite.title) ? `, at ${sectionOf(top.cite.title)}` : ''}.`;
  }
  const staff = await staffReply(text);
  if (staff !== null) return staff;
  // The whole request is a page's name ("which notices are due this week"): open it, even without "take me to".
  const whole = pageFor(text.replace(/\?$/, ''));
  // "I need a payment plan", "where are your offices": a page only when one is named, else it's a question or an answer
  const want = WANT.exec(text);
  if (!NAV.test(text) && want && pageFor(want[1]) && !(snap.mode === 'form' && formOn())) {
    const p = pageFor(want[1])!;
    if (location.pathname !== p.path) { go(p.path); return `Here's the ${p.title} page.`; }
  }
  // a bare page name is an answer, not a request, while a form question is open ("payroll" for "what do they need help with")
  const asking = snap.mode === 'form' && formOn();
  const m = NAV.exec(text) ?? (whole && whole.score >= 100 && !asking ? [text, text] as unknown as RegExpExecArray : null);
  if (!m || !cfg?.pages?.length) return null;
  const target = m[1];
  const page = pageFor(target);
  if (page) {
    if (page.path === form?.path && location.pathname !== form.path) { go(page.path); return ''; }
    const before = (document.querySelector('[data-copilot-summary]') as HTMLElement | null)?.textContent?.trim() ?? '';
    go(page.path);
    const said = `Here's ${page.title === 'Home' ? 'the home page' : `the ${page.title} page`}.`;
    // a list page says what it shows ("9 notices due in the next 7 days")
    const summary = staffToken && page.path.startsWith('/staff/') ? await listSummary(before) : '';
    return summary ? `${said} ${summary.replace(/\.?$/, '.')}` : said;
  }
  if (/^(open|show)/i.test(text.replace(/^(ok(ay)?,? )?(please )?(can you |could you )?/i, '')) && words(target).length > 4) return null;
  const close = closeMatches(target);
  return `I couldn't find a page called "${target}". The closest are ${close.slice(0, -1).join(', ')} and ${close.at(-1)}. Which one?`;
}


// Spoken questions come without a question mark, so a question word at the start counts too.
const isQuestion = (t: string) => /\?\s*$/.test(t) || /^\s*(what|where|which|how|why|when|who|can i|could i|should i|do i|does|is there|is it|are there|will)\b/i.test(t);

async function send(text: string, voice?: Record<string, unknown>): Promise<string> {
  // Dictation adds a full stop ("SPF-204118."), which a page's own format check would refuse. A "?" stays: it marks a question.
  text = String(text ?? '').trim().replace(/[.!,;:]+$/, '').trim();
  if (!cfg || snap.busy || !text) return '';
  set({ busy: true, status: 'thinking' });
  const turnAt = Date.now();
  saidNow = text;
  // a form still loading (see startForm) is read before this answer goes in
  for (let i = 0; waitingForm && i < 60; i++) await new Promise(r => setTimeout(r, 100));
  // What a caller says to a secret question (date of birth, last four, zip) is never shown on screen.
  add('user', verifier?.secretOpen() ? '••••' : text);
  let reply = '';
  let links: Message['links'] = [];
  let source: Source | undefined;

  let kind = 'form', why = '', error: string | undefined;
  // The desks' state before this turn, so the call log can tell what this turn did (tool calls, confirmations, corrections).
  const marks = new Map<Desk, DeskMark>();
  for (const d of [desk, asker]) if (d) marks.set(d, markDesk(d)!);
  try {
    // "Can you hear me?", "hello?", "wait", "thanks": answered at once, never searched (not while a secret is asked).
    const small = verifier?.secretOpen() ? null : smallTalk(text);
    const ver = small === null ? await verifyReply(text) : null;
    const nav = ver === null ? await navReply(text) : null;
    const routed = small === null && ver === null && nav === null && cfg.desk && (snap.mode === 'ask' || isQuestion(text) || ADVICE.test(text)) ? deskRoute(text) : null;
    takeAnswered();
    if (small !== null) { reply = small; kind = 'small-talk'; why = 'every part was small talk, answered by code'; } else if (ver !== null) {
      reply = ver; kind = 'verify'; why = `caller verification (${verifier?.state ?? 'done'})`;
      if (cfg.verify && reply.includes(cfg.verify.handoff)) happened('handed to a person');
      if (verifier?.state === 'verified' && verifyBackend?.call && !location.pathname.startsWith('/tax/portal')) links = [{ text: 'Open your client portal', href: '/tax/portal' }];
    } else if (nav !== null) { reply = nav; kind = 'nav'; why = 'a page change or the source viewer, by code'; } else if (routed) {
      ({ reply, links } = routed); kind = 'ask';
      why = BOOK.test(text) ? 'asked to book: offered the booking form, by code' : 'advice about their own situation: offered a person, by code';
      if (!BOOK.test(text)) happened('handed to a person');
    }
    else if (snap.mode === 'ask') {
      // Short answers ("yeah", "no thanks"), the answer to a question we asked back, and "is it gonna take long?" are code's.
      const said = talk().before(text);
      if (said) {
        if (said.go) go(said.go);
        reply = said.ask ? (await answerFor(said.ask)) ?? (manual?.unknown ?? NO_ANSWER) : said.reply ?? '';
        if (said.ask) { const looked = takeAnswered(); if (looked) { links = looked.links; source = looked.source; } }
        askDesk().note(text, reply);
        kind = 'ask'; why = said.ask ? 'asked back, then looked up the visitor\'s answer, by code' : 'a short answer or follow-up, by code';
      } else { reply = await askDesk().turn(text); kind = 'ask'; why = 'question desk (model with tools)'; }
    }
    else if (snap.mode === 'guide') { reply = await guide!.turn(text); kind = 'guide'; why = 'manual walk-through'; }
    else if (!desk) { startForm(); why = 'the form was still loading'; }
    else if (formDone()) { reply = `I've handed the form back to you. Please check it and press ${form!.submit} yourself.`; why = 'the form is done'; }
    else {
      // The desk fills the form, and answers a side question from the library or manual (or says it doesn't know).
      closeSource();
      // After two misses on a serial, email or phone, a caller is offered the keyboard (the call panel's button).
      flow!.typeOffer = snap.voice ? 'You can also type it with Keyboard.' : '';
      reply = await desk.turn(text);
      why = 'form desk (model with tools; code owns the form)';
      if (formDone() && bookPaths.some(h => location.pathname.startsWith(h))) happened('booked');
      // A multi-step form: when this step's answers are all in, the copilot may press the step's Next button
      // (data-copilot-next, a type="button" that only moves on; never the form's submit). The next step then starts.
      const next = formDone() ? stepNext() : null;
      if (next) { reply = ''; next.click(); }
    }
    const looked = takeAnswered();
    if (looked) { links = looked.links; source = looked.source; kind = 'ask'; why = `${why}; quoted from the library`; }
  } catch (e) {
    reply = "Sorry, something went wrong on my side. Nothing was sent. Please try again.";
    console.error(e);
    error = `${(e as Error).message} @ ${((e as Error).stack ?? '').split('\n')[1]?.trim() ?? ''}`;
    report('send', error);
    failure('turn', error, {}, 'error');
  }
  set({ busy: false, status: snap.voice ? snap.status : 'text' });
  const ran = [desk, asker].find(d => d && d.turns.length > (marks.get(d)?.turns ?? 0));
  logTurn({ id: String(voice?.turn ?? crypto.randomUUID()), start: turnAt, heard: text, reply, kind, why, mode: snap.mode, voice, error,
    desk: ran ? marks.get(ran) ?? { desk: ran, turns: 0, events: 0, fills: 0, pending: null, values: {} } : null, quoted: source && { title: source.title, href: source.href, quote: source.quote } });
  if (reply) add('bot', reply, true, links, source);
  highlight();
  return kind;
}

function start({ voice = false }: { voice?: boolean } = {}) {
  if (!cfg) return;
  const v = voice && canHear();
  muted = false;
  if (!snap.open) { newCall(); beginCall(callId, cfg.business, v ? 'voice' : 'text'); }
  set({ open: true, voice: v, textInput: !v, status: v ? 'waiting' : 'text', startedAt: snap.open ? snap.startedAt : Date.now() });
  warm();
  // A voice call asks for the microphone first; the greeting comes once the agent has joined (copilot.greet).
  if (v) { introSaid = false; void startVoice(); } else if (!snap.messages.length) setMode(snap.mode);
  highlight();
}

function end() {
  endCall('ended', formOn());
  stopVoice();
  noted = false;
  verifier = null; verifyBackend = null; // a new call starts verification over (the server still counts failures per visitor)
  asker = null; talking = null; // and a new conversation
  set({ account: null });
  set({ open: false, voice: false, heard: '', status: 'idle', startedAt: 0, wait: null, spokenLanguage: '', languages: allLanguages() });
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
}

function toggleMic() {
  if (!canHear() || !snap.open) return;
  // From text chat, the mic button starts the voice call (it asks for the microphone first).
  if (!snap.voice) { muted = false; set({ voice: true, textInput: false, status: 'waiting' }); void startVoice(); return; }
  muted = !muted;
  set({});
  if (muted) { void micTrack?.mute(); set({ status: 'muted' }); } else { void micTrack?.unmute(); set({ status: 'listening' }); }
}

// A page change mid-call (the site's router unmounts one page and mounts the next) keeps the call: the old page's
// form is saved as a draft, and the new page's config takes over the same conversation.
let carried = false;
// The booking pages the sites link to: a form finished there makes the call's outcome "booked".
const bookPaths: string[] = [];
let leaving: ReturnType<typeof setTimeout> | undefined;
function mount(c: Config) {
  carried = !!leaving && snap.open;
  clearTimeout(leaving); leaving = undefined;
  if (carried) detach(); else unmount(true);
  cfg = c;
  if (c.desk?.book && !bookPaths.includes(c.desk.book.href)) bookPaths.push(c.desk.book.href);
  if (carried) notePage(location.pathname);
  manual = c.manual ? { id: c.manual.label, title: c.manual.title, business: c.business, steps: c.manual.steps, passages: [], unknown: c.manual.unknown } : null;
  lookup = manual ? new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge()) : null;
  // A desk page with a form fills the form (questions are still answered); a desk page without one only answers.
  const modes: Mode[] = [...(c.form ? ['form' as const] : []), ...(manual?.steps.length ? ['guide' as const] : []), ...(c.desk && !c.form ? ['ask' as const] : [])];
  const page = { mounted: true, business: c.business, can: c.can ?? [], large: !!c.large, modes, mode: modes[0] ?? 'form' } as const;
  set(carried ? page : { ...blank(), ...page });
  if (!carried) void loadVoiceOptions();
  watchForm();
  if (carried) {
    if (snap.mode === 'form') startForm();
    scrollToAnchor();
    highlight();
  }
  carried = false;
}

function detach() {
  saveDraft();
  closeSource();
  observer?.disconnect(); observer = null; clearTimeout(stepTimer);
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
  desk = null; asker = null; talking = null; flow = null; form = null; firstEl = null; parts = 0; guide = null;
}

function unmount(now = false) {
  if (!now && snap.open && cfg) {
    // Maybe a page change: wait for the next page to mount before ending the call.
    detach();
    clearTimeout(leaving);
    leaving = setTimeout(() => { leaving = undefined; unmount(true); }, 1500);
    return;
  }
  clearTimeout(leaving); leaving = undefined;
  endCall('left', formOn());
  end();
  detach();
  cfg = null; manual = null; lookup = null; muted = false;
  set(blank());
}

// Closing the tab or leaving the site mid-call: the call is recorded as left (abandoned).
addEventListener('pagehide', () => { if (snap.open) endCall('left', formOn()); });

const api = {
  mount, unmount: () => unmount(), start, end, toggleMic, setMode, showSource, closeSource, setLanguage, setStack,
  // The site's router, so the copilot changes page without a reload (and the call stays on): copilot.onNavigate(p => navigate(p)).
  onNavigate: (fn: (path: string) => void) => { navigateFn = fn; },
  // The staff app's session, so the copilot can look clients up by name (read-only).
  setAuth: (kind: string, token: string) => { if (kind === 'staff') staffToken = String(token ?? ''); },
  // The call id once the caller is verified (the portal exchanges it for a session), else ''.
  verifiedCall: () => (verifier?.state === 'verified' ? verifyBackend?.call ?? '' : ''),
  send: (t: string) => { void send(t); },
  setCovered: (px: number) => { covered = Math.max(0, Number(px) || 0); },
  subscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; },
  getSnapshot: () => snap,
};
(window as any).copilot = api;
window.dispatchEvent(new Event('copilot:ready'));
