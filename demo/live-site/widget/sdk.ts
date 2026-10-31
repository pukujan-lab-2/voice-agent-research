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
//   copilot.showSource(id) / copilot.closeSource()   open the source of an earlier answer / close the source viewer
//   copilot.onNavigate(fn)       the site's client-side navigate, so the copilot can change page without ending the call
//   copilot.subscribe(fn) / copilot.getSnapshot()   the state to draw (works with React's useSyncExternalStore)
import { Copilot } from '../../../copilot-engine/src/engine.ts';
import { Guide, type Manual } from '../../../copilot-engine/src/guide.ts';
import { flowFromPage, readInPage, type PageForm } from '../../../copilot-engine/src/page.ts';
import type { Flow, Model } from '../../../copilot-engine/src/types.ts';
import { forDisplay, forSpeech } from '../../../copilot-engine/src/guard.ts';
import { Verifier, WANTS_VERIFY, type ReturnCard } from '../../../copilot-engine/src/verify.ts';
import { DomFiller } from './dom-filler.ts';
import { RemoteJudge, RemoteModel, RemoteRetriever, RemoteVerify, report, warmUp } from './remote.ts';

export type Config = {
  business: string;
  form?: string; // the form's name in the copilot's intro; leave out on a page with no form
  can?: string[];
  large?: boolean;
  manual?: { label: string; title: string; doc?: string; steps: Manual['steps']; unknown?: string };
  // A question desk over a document library (no steps to walk through): every answer is quoted from the library with
  // its source linked; a question about the visitor's own situation is never answered, it is offered a consultation.
  desk?: { greeting: string; advice: string; book?: { text: string; href: string } };
  note?: string;   // one short clause said once per call, inside the greeting ("this is a demo site, so no real details please")
  pages?: { path: string; title: string; also?: string[]; form?: boolean }[]; // the site's pages, for "take me to pricing"
  guidePage?: string; // the site's page for one guide: `${guidePage}/${doc}` (?page=N for a PDF, #anchor for an article)
  // Caller verification on a desk page ("check on my return"): the server compares, the copilot only hears the result.
  // handoff: what to offer when a caller can't be verified or asks for a person.
  verify?: { handoff: string };
};
// The document an answer was quoted from, shown by the site's source viewer while snapshot.source is set. doc is the
// library id (GET /api/library/doc?doc=…); page is the printed PDF's page (PDF sources), anchor the section (articles).
export type Source = { label: string; title: string; credit: string; doc: string; page?: number; anchor?: string; href: string; quote: string[]; found: boolean | null };
export type Status = 'idle' | 'speaking' | 'listening' | 'thinking' | 'muted' | 'text';
// links: parts of the text to show as links (a manual page "(page 3)", a cited source, a booking page)
export type Message = { id: number; who: 'bot' | 'user'; text: string; links: { text: string; href: string; page?: number }[]; source?: Source };
export type Snapshot = {
  mounted: boolean;
  open: boolean;                       // a call is on
  voice: boolean;                      // speaking and listening (false: text chat)
  mic: 'on' | 'off' | 'unavailable';   // unavailable: this browser has no speech recognition
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
};

type Mode = 'form' | 'guide' | 'ask';
const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;

let cfg: Config | null = null;
let snap: Snapshot = blank();
const subs = new Set<() => void>();
function blank(): Snapshot {
  return { mounted: false, open: false, voice: false, mic: SR ? 'off' : 'unavailable', textInput: false, status: 'idle', busy: false,
    heard: '', mode: 'form', modes: [], business: '', can: [], large: false, messages: [], startedAt: 0, wait: null, source: null, account: null };
}
function set(p: Partial<Snapshot>) {
  snap = { ...snap, ...p };
  snap.mic = !SR ? 'unavailable' : snap.voice && !muted ? 'on' : 'off';
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
  if (who === 'bot' && snap.voice && say) void speakThenListen(forSpeech(raw));
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
    set({ heard: verifier?.secretOpen() ? '••••' : (final || interim).trim() });
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
// The server's local model unloads after about five idle minutes. A call wakes it while the greeting plays, and a model
// call that takes a while shows how long it should take: about 2 s while the model loads, about 3 s once it is loaded.
const IDLE_MS = 290_000;
let modelUsedAt = 0;
const remoteModel = new RemoteModel();
const model: Model = {
  name: 'remote',
  async understand(input) {
    const t0 = Date.now();
    const cold = t0 - modelUsedAt > IDLE_MS;
    const show = setTimeout(() => set({ wait: cold
      ? { text: 'Warming up the assistant…', until: t0 + 2000 }
      : { text: 'Thinking…', until: t0 + 3000 } }), 600);
    try { return await remoteModel.understand(input); }
    finally { clearTimeout(show); modelUsedAt = Date.now(); if (snap.wait) set({ wait: null }); }
  },
};
function warm() {
  if (Date.now() - modelUsedAt < IDLE_MS) return;
  void warmUp().then(() => { modelUsedAt = Date.now(); });
}
let copilot: Copilot | null = null;
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
  if (!form.fields.length) { copilot = null; add('bot', "There's nothing left for me to fill in on this page."); return; }
  flow = flowFromPage(form, { business: cfg!.business, id: cfg!.form });
  if (cfg!.form) flow.intro = `Hi, I'm the ${cfg!.business} copilot. I can fill in this ${cfg!.form} form with you, one question at a time. I'll type your answers in, and you press ${form.submit} yourself at the end.`;
  if (parts++) flow.intro = `Thanks. On to the next part.`;
  firstEl = document.querySelector(`[data-copilot-id="${form.fields[0].id}"]`);
  const filler = new DomFiller(form);
  copilot = new Copilot(flow, model, filler);
  const draft = takeDraft();
  if (draft) {
    // Back on a form left half filled during this call: its answers go back in and the open question is asked.
    for (const f of flow.fields) if (draft[f.name] !== undefined) void filler.fill(f, draft[f.name]);
    add('bot', copilot.restore(draft, 'Back to the form. Your earlier answers are still filled in.'));
  } else if (Object.keys(prefilledValues(form)).length) {
    const pre = prefilledValues(form);
    const lead = carried ? `Here's the ${cfg!.form} form, with ${Object.keys(pre).length === 1 ? 'one answer' : 'some answers'} already in. I'll fill in the rest with you, and you press ${form.submit} yourself at the end.` : flow.intro;
    add('bot', copilot.restore(pre, lead));
  } else {
    if (carried) flow.intro = `Here's the ${cfg!.form} form. I'll fill it in with you, one question at a time, and you press ${form.submit} yourself at the end.`;
    add('bot', copilot.start());
  }
  highlight();
}

// ---- Drafts: a form left mid-call (the caller asked for another page) keeps its answers for this browser tab.
const draftKey = () => `copilot-draft:${location.pathname}`;
function saveDraft() {
  if (!form || !copilot || !flow) return;
  const values: Record<string, string> = { ...copilot.values };
  // Boxes the person typed into themselves count as answered too.
  for (const p of form.fields) {
    if (values[p.id] !== undefined || p.tag === 'radio' || p.tag === 'select') continue;
    const v = document.querySelector<HTMLInputElement>(`[data-copilot-id="${p.id}"]`)?.value?.trim();
    if (v) values[p.id] = v;
  }
  try {
    if (Object.keys(values).length && copilot.state !== 'done') sessionStorage.setItem(draftKey(), JSON.stringify(values));
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

function setMode(m: Mode) {
  if (!snap.modes.includes(m)) return;
  set({ mode: m });
  if (m === 'ask') {
    if (!snap.messages.length) add('bot', cfg!.desk!.greeting);
  } else if (m === 'guide' && manual) {
    guide ??= new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge());
    add('bot', guide.log.length ? 'Back to the walk-through. Say "repeat" to hear the step again.' : guide.start());
  } else if (m === 'form') {
    if (!copilot) startForm(); else add('bot', `Back to the form. ${currentAsk()}`.trim());
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

async function deskReply(text: string): Promise<{ reply: string; links: Message['links']; source?: Source }> {
  const d = cfg!.desk!;
  const book = d.book && !location.pathname.startsWith(d.book.href) ? [{ text: d.book.text, href: d.book.href }] : [];
  if (BOOK.test(text)) {
    return book.length ? { reply: `Happy to. Open ${d.book!.text} and I'll fill in the intake form with you, one question at a time.`, links: book }
      : { reply: `We're on the booking form. ${currentAsk()}`.trim(), links: [] };
  }
  if (ADVICE.test(text)) return { reply: `${d.advice}${book.length ? ` Open ${d.book!.text} to pick a time.` : ''}`, links: book };
  const reply = await lookup!.lookup(text);
  const p = lookup!.last;
  if (!p?.cite) return { reply, links: [] };
  const links = [{ text: p.cite.title, href: p.cite.url }];
  const src = sourceOf(p.cite, lookup!.lastQuote, p.page);
  if (!src) return { reply, links };
  // The site shows the source next to the answer: open it, find the quoted words, highlight them, then say so.
  const found = await openSource(src);
  const quote = reply.slice(reply.indexOf('says: ') + 6);
  if (found === null) return { reply, links, source: src }; // this page has no viewer
  return {
    reply: found ? `I've opened ${src.title}${src.page ? `, page ${src.page}` : sectionOf(p.cite.title) ? `, ${sectionOf(p.cite.title)}` : ''}. The highlighted part says: ${quote}`
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
let navigated = false;
function go(path: string) {
  closeSource();
  navigated = true;
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
    if (location.pathname === form.path) { closeSource(); return snap.mode === 'form' && copilot ? `Back to the form. ${currentAsk()}`.trim() : null; }
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
  if (!NAV.test(text) && want && pageFor(want[1]) && !(snap.mode === 'form' && copilot && copilot.state !== 'done')) {
    const p = pageFor(want[1])!;
    if (location.pathname !== p.path) { go(p.path); return `Here's the ${p.title} page.`; }
  }
  // a bare page name is an answer, not a request, while a form question is open ("payroll" for "what do they need help with")
  const asking = snap.mode === 'form' && !!copilot && copilot.state !== 'done';
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

async function send(text: string) {
  // Dictation adds a full stop ("SPF-204118."), which a page's own format check would refuse. A "?" stays: it marks a question.
  text = String(text ?? '').trim().replace(/[.!,;:]+$/, '').trim();
  if (!cfg || snap.busy || !text) return;
  stopListening();
  set({ busy: true, status: 'thinking' });
  // a form still loading (see startForm) is read before this answer goes in
  for (let i = 0; waitingForm && i < 60; i++) await new Promise(r => setTimeout(r, 100));
  // What a caller says to a secret question (date of birth, last four, zip) is never shown on screen.
  add('user', verifier?.secretOpen() ? '••••' : text);
  let reply = '';
  let links: Message['links'] = [];
  let source: Source | undefined;
  navigated = false;
  try {
    const ver = await verifyReply(text);
    const nav = ver === null ? await navReply(text) : null;
    if (ver !== null) {
      reply = ver;
      if (verifier?.state === 'verified' && verifyBackend?.call && !location.pathname.startsWith('/tax/portal')) links = [{ text: 'Open your client portal', href: '/tax/portal' }];
    } else if (nav !== null) reply = nav;
    else if (snap.mode === 'ask') ({ reply, links, source } = await deskReply(text));
    else if (snap.mode === 'guide') reply = await guide!.turn(text);
    else if (!copilot) startForm();
    else if (copilot.state === 'done') reply = `I've handed the form back to you. Please check it and press ${form!.submit} yourself.`;
    // A side question during a form is answered from the manual (or "I don't know"); then the form carries on.
    else if (lookup && cfg.desk && (isQuestion(text) || ADVICE.test(text))) {
      const r = await deskReply(text);
      reply = `${r.reply} Back to the form: ${currentAsk()}`.trim(); links = r.links; source = r.source;
    } else if (lookup && isQuestion(text)) reply = `${await lookup.lookup(text)} Back to the form: ${currentAsk()}`.trim();
    else {
      // After two misses on a serial, email or phone, a caller is offered the keyboard (the call panel's button).
      flow!.typeOffer = snap.voice ? 'You can also type it with Keyboard.' : '';
      closeSource();
      reply = await copilot.turn(text);
      // A multi-step form: when this step's answers are all in, the copilot may press the step's Next button
      // (data-copilot-next, a type="button" that only moves on; never the form's submit). The next step then starts.
      const next = (copilot.state as string) === 'done' ? stepNext() : null;
      if (next) { reply = ''; next.click(); }
    }
  } catch (e) {
    reply = "Sorry, something went wrong on my side. Nothing was sent. Please try again.";
    console.error(e);
    report('send', `${(e as Error).message} @ ${((e as Error).stack ?? '').split('\n')[1]?.trim() ?? ''}`);
  }
  set({ busy: false, status: snap.voice ? snap.status : 'text' });
  if (reply) add('bot', reply, true, links, source); else if (snap.voice && !navigated) listen();
  highlight();
}

function start({ voice = false }: { voice?: boolean } = {}) {
  if (!cfg) return;
  const v = voice && (canSpeak || !!SR);
  muted = !SR;
  set({ open: true, voice: v, textInput: !v || !SR, status: v ? 'idle' : 'text', startedAt: snap.open ? snap.startedAt : Date.now() });
  warm();
  // Called from the tap itself, so mobile browsers allow the first spoken reply.
  if (!snap.messages.length) setMode(snap.mode);
  else if (v) void speakThenListen([...snap.messages].reverse().find(m => m.who === 'bot')?.text ?? '');
  highlight();
}

function end() {
  stopListening(); if (canSpeak) speechSynthesis.cancel(); speechSeq++;
  noted = false;
  verifier = null; verifyBackend = null; // a new call starts verification over (the server still counts failures per visitor)
  set({ account: null });
  set({ open: false, voice: false, heard: '', status: 'idle', startedAt: 0, wait: null });
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
}

function toggleMic() {
  if (!SR || !snap.open) return;
  if (!snap.voice) set({ voice: true, textInput: false });
  muted = !muted; quietTries = 0;
  set({});
  if (muted) { stopListening(); set({ status: 'muted' }); } else { if (canSpeak) speechSynthesis.cancel(); listen(true); }
}

// A page change mid-call (the site's router unmounts one page and mounts the next) keeps the call: the old page's
// form is saved as a draft, and the new page's config takes over the same conversation.
let carried = false;
let leaving: ReturnType<typeof setTimeout> | undefined;
function mount(c: Config) {
  carried = !!leaving && snap.open;
  clearTimeout(leaving); leaving = undefined;
  if (carried) detach(); else unmount(true);
  cfg = c;
  manual = c.manual ? { id: c.manual.label, title: c.manual.title, business: c.business, steps: c.manual.steps, passages: [], unknown: c.manual.unknown } : null;
  lookup = manual ? new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge()) : null;
  // A desk page with a form fills the form (questions are still answered); a desk page without one only answers.
  const modes: Mode[] = [...(c.form ? ['form' as const] : []), ...(manual?.steps.length ? ['guide' as const] : []), ...(c.desk && !c.form ? ['ask' as const] : [])];
  const page = { mounted: true, business: c.business, can: c.can ?? [], large: !!c.large, modes, mode: modes[0] ?? 'form' } as const;
  set(carried ? page : { ...blank(), ...page });
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
  copilot = null; flow = null; form = null; firstEl = null; parts = 0; guide = null;
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
  end();
  detach();
  cfg = null; manual = null; lookup = null; muted = false; quietTries = 0;
  set(blank());
}

const api = {
  mount, unmount: () => unmount(), start, end, toggleMic, setMode, showSource, closeSource,
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
