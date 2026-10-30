// The copilot a site adds with one script tag, with no UI of its own: the site draws the call panel and drives it
// through window.copilot. The engine runs here in the page and makes every decision in code; the backend only lends it
// Jev (is this answer on topic? which manual passage answers?) and Octo search. Voice uses the browser's own speech
// recognition and synthesis; if there is no recognition or the mic is blocked, the same call carries on as text.
//
//   copilot.mount(config)        on a page with a form or a manual, once it is on screen (config: see Config)
//   copilot.unmount()            when leaving that page
//   copilot.start({ voice })     from the person's tap: "Start voice call" (voice: true) or "Type instead" (false)
//   copilot.send(text)           a typed message
//   copilot.toggleMic()          from a tap: "Tap to talk" / "Mute"
//   copilot.setMode(m)           'form' or 'guide' (walk through the manual), when both exist
//   copilot.setCovered(px)       how much of the bottom of the window the panel covers, so the asked field stays visible
//   copilot.end()                hang up
//   copilot.subscribe(fn) / copilot.getSnapshot()   the state to draw (works with React's useSyncExternalStore)
import { Copilot } from '../../../copilot-engine/src/engine.ts';
import { Guide, type Manual } from '../../../copilot-engine/src/guide.ts';
import { flowFromPage, readInPage, type PageForm } from '../../../copilot-engine/src/page.ts';
import type { Flow } from '../../../copilot-engine/src/types.ts';
import { DomFiller } from './dom-filler.ts';
import { RemoteJudge, RemoteModel, RemoteRetriever, report } from './remote.ts';

export type Config = {
  business: string;
  form?: string; // the form's name in the copilot's intro; leave out on a page with no form
  can?: string[];
  large?: boolean;
  manual?: { label: string; title: string; doc?: string; steps: Manual['steps'] };
};
export type Status = 'idle' | 'speaking' | 'listening' | 'thinking' | 'muted' | 'text';
export type Message = { id: number; who: 'bot' | 'user'; text: string; links: { page: number; href: string }[] };
export type Snapshot = {
  mounted: boolean;
  open: boolean;                       // a call is on
  voice: boolean;                      // speaking and listening (false: text chat)
  mic: 'on' | 'off' | 'unavailable';   // unavailable: this browser has no speech recognition
  textInput: boolean;                  // show the text box
  status: Status;
  busy: boolean;
  heard: string;                       // what the mic is hearing right now
  mode: 'form' | 'guide';
  modes: ('form' | 'guide')[];
  business: string;
  can: string[];
  large: boolean;
  messages: Message[];
};

const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;

let cfg: Config | null = null;
let snap: Snapshot = blank();
const subs = new Set<() => void>();
function blank(): Snapshot {
  return { mounted: false, open: false, voice: false, mic: SR ? 'off' : 'unavailable', textInput: false, status: 'idle', busy: false,
    heard: '', mode: 'form', modes: [], business: '', can: [], large: false, messages: [] };
}
function set(p: Partial<Snapshot>) {
  snap = { ...snap, ...p };
  snap.mic = !SR ? 'unavailable' : snap.voice && !muted ? 'on' : 'off';
  subs.forEach(f => { try { f(); } catch (e) { report('subscriber', (e as Error).message); } });
}

let msgId = 0;
function add(who: 'bot' | 'user', text: string, say = true) {
  const links = who === 'bot' && cfg?.manual?.doc
    ? [...text.matchAll(/\(page (\d+)\)/g)].map(m => ({ page: +m[1], href: `${cfg!.manual!.doc}#page-${m[1]}` })) : [];
  set({ messages: [...snap.messages, { id: ++msgId, who, text, links }] });
  if (who === 'bot' && snap.voice && say) void speakThenListen(text);
}

// ---- Voice: speak each reply, then listen for one answer. Never listens while speaking, so it can't hear itself.
let muted = false;
let rec: any = null;
let quietTries = 0;
let speechSeq = 0;

function speak(text: string): Promise<void> {
  if (!canSpeak) return Promise.resolve();
  return new Promise(resolve => {
    // Cancelling an idle synthesizer right before speaking can drop the next utterance on iOS.
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/·/g, ',').replace(/\s+/g, ' '));
    u.lang = 'en-US';
    u.rate = cfg?.large ? 0.92 : 1;
    let started = false;
    const done = () => { clearTimeout(t); clearTimeout(s); resolve(); };
    // Some mobile browsers never fire onend, or never start at all; don't wait forever.
    const t = setTimeout(done, 1500 + text.length * 80);
    const s = setTimeout(() => { if (!started) { report('tts', 'speech never started'); done(); } }, 3000);
    u.onstart = () => { started = true; };
    u.onend = done;
    u.onerror = (e: any) => { if (!['interrupted', 'canceled'].includes(e.error)) report('tts', e.error); done(); };
    speechSynthesis.speak(u);
  });
}

async function speakThenListen(text: string) {
  const seq = ++speechSeq;
  stopListening();
  set({ status: 'speaking' });
  await speak(text);
  if (seq !== speechSeq || !snap.voice) return;
  listen();
}

function stopListening() {
  if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; try { rec.abort(); } catch { /* not started */ } rec = null; }
}

// fromTap: started by the person's own tap. Safari may refuse a microphone that wasn't, so then we ask for a tap.
function listen(fromTap = false) {
  if (!snap.voice || muted || snap.busy || !SR) { if (snap.voice) set({ status: muted ? 'muted' : 'idle' }); return; }
  stopListening();
  const r = new SR();
  rec = r;
  r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let final = '', interim = '';
  r.onresult = (e: any) => {
    // One utterance, one answer: iOS WebKit can send a second final result that re-recognises the same words
    // ("Pooja Bajracharya" then "PUJANBAJRACHARYA"), so the first final is the answer and the rest is ignored.
    if (final) return;
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) { final = t; break; }
      interim += t;
    }
    set({ heard: (final || interim).trim() });
    if (final) { try { r.stop(); } catch { /* already stopping */ } }
  };
  r.onerror = (e: any) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    report('speech', `${e.error}${fromTap ? ' (after tap)' : ''}`);
    if (e.error === 'not-allowed' && !fromTap) {
      // Probably only because no tap started it: one tap on the mic starts it from a tap.
      rec = null; muted = true; set({ textInput: true, status: 'muted' });
      add('bot', 'Tap "Tap to talk" to answer by voice, or type your answer below.', false);
      return;
    }
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(e.error)) {
      // Mic blocked, missing or unusable: keep the call going as text.
      rec = null; toText("I can't use the microphone here, so let's carry on by typing. Your answers go in the box below.");
    }
  };
  r.onend = () => {
    if (rec !== r) return;
    rec = null;
    // Safari sometimes ends without marking the last result final; what it heard is still the answer.
    const said = (final || interim).trim();
    set({ heard: '' });
    if (said) { quietTries = 0; void send(said); return; }
    // Silence: listen again a couple of times, then wait for a tap on the mic.
    if (snap.voice && !muted && ++quietTries < 3) listen();
    else if (snap.voice) { muted = true; set({ status: 'muted' }); }
  };
  try { r.start(); set({ status: 'listening' }); } catch (e) {
    report('speech', `start failed: ${(e as Error).message}`); rec = null; muted = true; set({ textInput: true, status: 'muted' });
  }
}

function toText(msg?: string) {
  stopListening(); if (canSpeak) speechSynthesis.cancel();
  set({ voice: false, textInput: true, status: 'text' });
  if (msg) add('bot', msg);
}

// ---- Form mode: the page adapter reads the visible form, the engine asks one question at a time.
const model = new RemoteModel();
let copilot: Copilot | null = null;
let flow: Flow | null = null;
let form: PageForm | null = null;
let firstEl: Element | null = null;
let parts = 0;
let covered = 0;

function startForm() {
  form = readInPage();
  if (!form.fields.length) { copilot = null; add('bot', "There's nothing left for me to fill in on this page."); return; }
  flow = flowFromPage(form, { business: cfg!.business, id: cfg!.form });
  if (cfg!.form) flow.intro = `Hi, I'm the ${cfg!.business} copilot. I can fill in this ${cfg!.form} form with you, one question at a time. I'll type your answers in, and you press ${form.submit} yourself at the end.`;
  if (parts++) flow.intro = `Thanks. On to the next part.`;
  firstEl = document.querySelector(`[data-copilot-id="${form.fields[0].id}"]`);
  copilot = new Copilot(flow, model, new DomFiller(form));
  add('bot', copilot.start());
  highlight();
}

// Mark the field being asked ([data-copilot-active], for the site to style) and keep it above the panel.
function highlight() {
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
  if (!snap.open || snap.mode !== 'form' || !copilot || !['ask', 'verify'].includes(copilot.state)) return;
  const el = document.querySelector(`[data-copilot-id="${copilot.current()}"]`);
  const box = el && (el as HTMLInputElement).type === 'radio' ? el.closest('fieldset') ?? el : el;
  if (!box) return;
  box.setAttribute('data-copilot-active', '');
  const r = box.getBoundingClientRect();
  const free = innerHeight - covered;
  if (r.top < 70 || r.bottom > free - 12) window.scrollBy({ top: r.top - Math.max(70, (free - r.height) * 0.35), behavior: 'smooth' });
}

function currentAsk(): string {
  if (!copilot || !flow) return '';
  if (copilot.state === 'ask') return flow.fields.find(f => f.name === copilot!.current())?.question ?? '';
  if (copilot.state === 'review') return flow.reviewAsk ?? '';
  return '';
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
    if (!copilot || copilot.state !== 'done' || snap.mode !== 'form' || !snap.open) return;
    clearTimeout(stepTimer);
    stepTimer = setTimeout(() => {
      if (!copilot || copilot.state !== 'done') return;
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

function setMode(m: 'form' | 'guide') {
  if (!snap.modes.includes(m)) return;
  set({ mode: m });
  if (m === 'guide' && manual) {
    guide ??= new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge());
    add('bot', guide.log.length ? 'Back to the walk-through. Say "repeat" to hear the step again.' : guide.start());
  } else if (m === 'form') {
    if (!copilot) startForm(); else add('bot', `Back to the form. ${currentAsk()}`.trim());
  }
  highlight();
}

// Spoken questions come without a question mark, so a question word at the start counts too.
const isQuestion = (t: string) => /\?\s*$/.test(t) || /^\s*(what|where|which|how|why|when|who|can i|could i|should i|do i|does|is there|is it|are there|will)\b/i.test(t);

async function send(text: string) {
  // Dictation adds a full stop ("SPF-204118."), which a page's own format check would refuse. A "?" stays: it marks a question.
  text = String(text ?? '').trim().replace(/[.!,;:]+$/, '').trim();
  if (!cfg || snap.busy || !text) return;
  stopListening();
  set({ busy: true, status: 'thinking' });
  add('user', text);
  let reply = '';
  try {
    if (snap.mode === 'guide') reply = await guide!.turn(text);
    else if (!copilot) startForm();
    else if (copilot.state === 'done') reply = `I've handed the form back to you. Please check it and press ${form!.submit} yourself.`;
    // A side question during a form is answered from the manual (or "I don't know"); then the form carries on.
    else if (lookup && isQuestion(text)) reply = `${await lookup.lookup(text)} Back to the form: ${currentAsk()}`.trim();
    else {
      // After two misses on a serial, email or phone, a caller is offered the keyboard (the call panel's button).
      flow!.typeOffer = snap.voice ? 'You can also type it with Keyboard.' : '';
      reply = await copilot.turn(text);
    }
  } catch (e) {
    reply = "Sorry, something went wrong on my side. Nothing was sent. Please try again.";
    console.error(e);
    report('send', `${(e as Error).message} @ ${((e as Error).stack ?? '').split('\n')[1]?.trim() ?? ''}`);
  }
  set({ busy: false, status: snap.voice ? snap.status : 'text' });
  if (reply) add('bot', reply); else if (snap.voice) listen();
  highlight();
}

function start({ voice = false }: { voice?: boolean } = {}) {
  if (!cfg) return;
  const v = voice && (canSpeak || !!SR);
  muted = !SR;
  set({ open: true, voice: v, textInput: !v || !SR, status: v ? 'idle' : 'text' });
  // Called from the tap itself, so mobile browsers allow the first spoken reply.
  if (!snap.messages.length) setMode(snap.mode);
  else if (v) void speakThenListen([...snap.messages].reverse().find(m => m.who === 'bot')?.text ?? '');
  highlight();
}

function end() {
  stopListening(); if (canSpeak) speechSynthesis.cancel(); speechSeq++;
  set({ open: false, voice: false, heard: '', status: 'idle' });
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
}

function toggleMic() {
  if (!SR || !snap.open) return;
  if (!snap.voice) set({ voice: true, textInput: false });
  muted = !muted; quietTries = 0;
  set({});
  if (muted) { stopListening(); set({ status: 'muted' }); } else { if (canSpeak) speechSynthesis.cancel(); listen(true); }
}

function mount(c: Config) {
  unmount();
  cfg = c;
  manual = c.manual ? { id: c.manual.label, title: c.manual.title, business: c.business, steps: c.manual.steps, passages: [] } : null;
  lookup = manual ? new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge()) : null;
  const modes: ('form' | 'guide')[] = [...(c.form ? ['form' as const] : []), ...(manual ? ['guide' as const] : [])];
  set({ ...blank(), mounted: true, business: c.business, can: c.can ?? [], large: !!c.large, modes, mode: modes[0] ?? 'form' });
  watchForm();
}

function unmount() {
  end();
  observer?.disconnect(); observer = null; clearTimeout(stepTimer);
  cfg = null; copilot = null; flow = null; form = null; firstEl = null; parts = 0; guide = null; manual = null; lookup = null; muted = false; quietTries = 0;
  set(blank());
}

const api = {
  mount, unmount, start, end, toggleMic, setMode,
  send: (t: string) => { void send(t); },
  setCovered: (px: number) => { covered = Math.max(0, Number(px) || 0); },
  subscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; },
  getSnapshot: () => snap,
};
(window as any).copilot = api;
window.dispatchEvent(new Event('copilot:ready'));
