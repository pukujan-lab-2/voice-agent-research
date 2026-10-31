// Brambleway's copilot, added with one script tag and drawn by the site through window.copilot (the same API and
// snapshot as the live-site copilot, so the same call bar draws it). It is on for the whole store: the shopping
// copilot (copilot-engine/src/shop.ts) finds, compares and adds to the cart, and moves between pages with the site's
// own router so the call stays connected; at checkout it hands over to the form copilot (engine.ts + page.ts), which
// asks for each field, reads it back and types it in. Nothing here ever presses Place order.
//
//   copilot.start({ voice })   from the shopper's tap: "Shop with your voice" (voice: true) or typing (false)
//   copilot.send(text)  copilot.toggleMic()  copilot.end()
//   copilot.onNavigate(fn)     the site's client-side navigate
//   copilot.setCovered(px)     how much of the window's bottom the call bar covers, so the asked field stays visible
//   copilot.subscribe(fn) / copilot.getSnapshot()
//   copilot.mount() / unmount() / setMode()   accepted for the shared call bar; the store copilot is always mounted
import { Copilot } from '../../../copilot-engine/src/engine.ts';
import { flowFromPage, readInPage, type PageForm } from '../../../copilot-engine/src/page.ts';
import { PLACE, Shopper, type Reply } from '../../../copilot-engine/src/shop.ts';
import type { Flow, Model } from '../../../copilot-engine/src/types.ts';
import { API_BASE } from './config.ts';
import { DomFiller } from './dom-filler.ts';
import { RemoteModel, report, warmUp } from './remote.ts';
import { HttpStore } from './store.ts';

export type Status = 'idle' | 'speaking' | 'listening' | 'thinking' | 'muted' | 'text';
export type Message = { id: number; who: 'bot' | 'user'; text: string; links: { text: string; href: string }[] };
type Mode = 'shop' | 'form';
export type Snapshot = {
  mounted: boolean; open: boolean; voice: boolean; mic: 'on' | 'off' | 'unavailable'; textInput: boolean; status: Status; busy: boolean; heard: string;
  mode: Mode; modes: Mode[]; business: string; can: string[]; large: boolean; messages: Message[]; startedAt: number;
  wait: { text: string; until: number } | null; source: null;
};

const BUSINESS = 'Brambleway';
const CAN = ['Find products', 'Compare', 'Read reviews', 'Add to cart', 'Fill in checkout', 'Shipping & returns'];
const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;

// The shopper id the site sends as X-Shopper; the copilot's cart is the site's cart.
function shopperId(): string {
  const w = window as any;
  if (typeof w.bwShopper === 'function') return w.bwShopper();
  try {
    let id = localStorage.getItem('bw-shopper');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('bw-shopper', id); }
    return id;
  } catch { return (w.__bwShopper ??= crypto.randomUUID()); }
}
const shopper = new Shopper(new HttpStore(API_BASE, shopperId), { business: BUSINESS });

let snap: Snapshot = blank();
const subs = new Set<() => void>();
function blank(): Snapshot {
  return { mounted: true, open: false, voice: false, mic: SR ? 'off' : 'unavailable', textInput: false, status: 'idle', busy: false, heard: '',
    mode: 'shop', modes: [], business: BUSINESS, can: CAN, large: false, messages: [], startedAt: 0, wait: null, source: null };
}
function set(p: Partial<Snapshot>) {
  snap = { ...snap, ...p };
  snap.mic = !SR ? 'unavailable' : snap.voice && !muted ? 'on' : 'off';
  subs.forEach(f => { try { f(); } catch (e) { report('subscriber', (e as Error).message); } });
}

let msgId = 0;
function add(who: 'bot' | 'user', text: string, say = true, links: Message['links'] = []) {
  set({ messages: [...snap.messages, { id: ++msgId, who, text, links }] });
  if (who === 'bot' && snap.voice && say) void speakThenListen(text);
}

// ---- Voice: speak each reply, then listen for one answer (the same rules as the live-site copilot).
let muted = false;
let rec: any = null;
let quietTries = 0;
let speechSeq = 0;

function speak(text: string): Promise<void> {
  if (!canSpeak) return Promise.resolve();
  return new Promise(resolve => {
    if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/·/g, ',').replace(/\s+/g, ' '));
    u.lang = 'en-US';
    let started = false;
    const done = () => { clearTimeout(t); clearTimeout(s); resolve(); };
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
function listen(fromTap = false) {
  if (!snap.voice || muted || snap.busy || !SR) { if (snap.voice) set({ status: muted ? 'muted' : 'idle' }); return; }
  stopListening();
  const r = new SR();
  rec = r;
  r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let final = '', interim = '';
  r.onresult = (e: any) => {
    if (final) return; // iOS can send a second final for the same words
    interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const tx = e.results[i][0].transcript;
      if (e.results[i].isFinal) { final = tx; break; }
      interim += tx;
    }
    set({ heard: (final || interim).trim() });
    if (final) { try { r.stop(); } catch { /* already stopping */ } }
  };
  r.onerror = (e: any) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    report('speech', `${e.error}${fromTap ? ' (after tap)' : ''}`);
    if (e.error === 'not-allowed' && !fromTap) {
      rec = null; muted = true; set({ textInput: true, status: 'muted' });
      add('bot', 'Tap "Tap to talk" to answer by voice, or type below.', false);
      return;
    }
    if (['not-allowed', 'service-not-allowed', 'audio-capture', 'network', 'language-not-supported'].includes(e.error)) {
      rec = null; toText("I can't use the microphone here, so let's carry on by typing.");
    }
  };
  r.onend = () => {
    if (rec !== r) return;
    rec = null;
    const said = (final || interim).trim();
    set({ heard: '' });
    if (said) { quietTries = 0; void send(said); return; }
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

// ---- Pages: the site's router moves the page; the copilot follows what's on screen.
let navigateFn: ((path: string) => void) | null = null;
const here = () => location.pathname + location.search;
function go(path: string) {
  if (here() === path) return;
  if (navigateFn) navigateFn(path); else location.assign(path);
}
// Waits for something to appear on the new page (the site renders after its data arrives).
async function until<T>(get: () => T | null | undefined | false, ms: number): Promise<T | null> {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const v = get();
    if (v) return v;
    await new Promise(r => setTimeout(r, 100));
  }
  return null;
}

// ---- Checkout: the form copilot fills the checkout form, one question at a time with a read-back, and hands it back.
const IDLE_MS = 290_000;
let modelUsedAt = 0;
const remoteModel = new RemoteModel();
const model: Model = {
  name: 'remote',
  async understand(input) {
    const t0 = Date.now();
    const cold = t0 - modelUsedAt > IDLE_MS;
    const show = setTimeout(() => set({ wait: cold ? { text: 'Warming up the assistant…', until: t0 + 2000 } : { text: 'Thinking…', until: t0 + 3000 } }), 600);
    try { return await remoteModel.understand(input); } finally { clearTimeout(show); modelUsedAt = Date.now(); if (snap.wait) set({ wait: null }); }
  },
};
let copilot: Copilot | null = null;
let flow: Flow | null = null;
let form: PageForm | null = null;
let covered = 0;

async function startCheckout(lead: string): Promise<string> {
  const ok = await until(() => document.querySelector('[data-copilot-form] #fullname'), 8000);
  if (!ok) return `${lead} The checkout form didn't open, so please try again.`;
  form = readInPage();
  flow = flowFromPage(form, { business: BUSINESS, id: 'checkout' });
  flow.intro = `${lead} I'll fill in the checkout form with you, one question at a time, and read each answer back. I won't place the order: you press ${form.submit} yourself.`;
  flow.reviewAsk = `Is that all correct? Say yes and I'll hand it back to you to check the order review and press ${form.submit}, or tell me what to change.`;
  flow.doneMessage = `Everything is filled in. Check the order review, then press ${form.submit} yourself when you're ready. I can't place it for you.`;
  flow.scope = 'checking out at the Brambleway demo store: the delivery address, delivery speed, gift wrap and the demo payment choice';
  copilot = new Copilot(flow, model, new DomFiller(form));
  set({ mode: 'form' });
  const text = copilot.start();
  setTimeout(highlight, 50);
  return text;
}

function highlight() {
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
  if (!snap.open || snap.mode !== 'form' || !copilot || !['ask', 'verify'].includes(copilot.state)) return;
  const el = document.querySelector(`[data-copilot-id="${copilot.current()}"]`);
  const box = el && (el as HTMLInputElement).type === 'radio' ? el.closest('fieldset') ?? el : el;
  if (!box) return;
  box.setAttribute('data-copilot-active', '');
  const r = box.getBoundingClientRect();
  const free = innerHeight - covered;
  if (r.top < 90 || r.bottom > free - 12) window.scrollBy({ top: r.top - Math.max(90, (free - r.height) * 0.35), behavior: 'smooth' });
}
function currentAsk(): string {
  if (!copilot || !flow) return '';
  if (copilot.state === 'ask') return flow.fields.find(f => f.name === copilot!.current())?.question ?? '';
  if (copilot.state === 'review') return flow.reviewAsk ?? '';
  return '';
}

// During checkout, a question about shipping or returns, or a wish to go back to shopping, goes to the shopper.
const LEAVE_CHECKOUT = /\b(keep shopping|back to (the )?(cart|shop|store|results|product)|go back to (the )?(cart|shop|store)|change (my |the )?cart|stop (the )?checkout|cancel (the )?checkout|leave (the )?checkout)\b/i;
const SIDE_Q = /\?\s*$|^\s*(what|how|when|where|why|is|are|do|does|can|will|which)\b/i;
const POLICY = /\b(ship|shipping|deliver|delivery|arrive|return|refund|exchange|track|tax|gift wrap|payment|pay with|charge|warranty|guarantee|cancel my order|price match)\b/i;

async function shopTurn(text: string): Promise<Reply> {
  const r = await shopper.turn(text, { path: here() });
  if (r.cartChanged) window.dispatchEvent(new Event('bw:cart-changed'));
  if (r.go) go(r.go);
  return r;
}

async function send(text: string) {
  text = String(text ?? '').trim().replace(/[.!,;:]+$/, '').trim();
  if (snap.busy || !text) return;
  stopListening();
  set({ busy: true, status: 'thinking' });
  add('user', text);
  let reply = '';
  let links: Message['links'] = [];
  try {
    if (snap.mode === 'form' && copilot && location.pathname === '/checkout' && !LEAVE_CHECKOUT.test(text)) {
      if (PLACE.test(text.toLowerCase())) {
        // "place my order": refused by the shopper, at any point in the checkout; the form stays as it is
        const r = await shopTurn(text);
        reply = `${r.text}${copilot.state === 'done' ? '' : ` Back to checkout: ${currentAsk()}`}`.trim();
      } else if (copilot.state !== 'done' && SIDE_Q.test(text) && POLICY.test(text)) {
        const r = await shopTurn(text);
        reply = `${r.text} Back to checkout: ${currentAsk()}`.trim(); links = r.links ?? [];
      } else if (copilot.state === 'done') {
        const r = await shopTurn(text);
        reply = r.text; links = r.links ?? [];
      } else {
        flow!.typeOffer = snap.voice ? 'You can also type it with Keyboard.' : '';
        reply = await copilot.turn(text);
      }
    } else {
      if (snap.mode === 'form') { set({ mode: 'shop' }); copilot = null; }
      const r = await shopTurn(text);
      links = r.links ?? [];
      reply = r.checkout ? await startCheckout(r.text) : r.text;
    }
  } catch (e) {
    reply = 'Sorry, something went wrong on my side. Nothing was changed. Please try again.';
    console.error(e);
    report('send', `${(e as Error).message} @ ${((e as Error).stack ?? '').split('\n')[1]?.trim() ?? ''}`);
  }
  set({ busy: false, status: snap.voice ? snap.status : 'text' });
  if (reply) add('bot', reply, true, links); else if (snap.voice) listen();
  highlight();
}

function start({ voice = false }: { voice?: boolean } = {}) {
  const v = voice && (canSpeak || !!SR);
  muted = !SR;
  set({ open: true, voice: v, textInput: !v || !SR, status: v ? 'idle' : 'text', startedAt: snap.open ? snap.startedAt : Date.now() });
  if (Date.now() - modelUsedAt > IDLE_MS) void warmUp().then(() => { modelUsedAt = Date.now(); });
  // Called from the tap itself, so mobile browsers allow the first spoken reply.
  if (!snap.messages.length) {
    if (location.pathname === '/checkout') {
      set({ busy: true });
      void startCheckout("You're at checkout.").then(t => { set({ busy: false }); add('bot', t); highlight(); });
    } else add('bot', shopper.greeting());
  } else if (v) void speakThenListen([...snap.messages].reverse().find(m => m.who === 'bot')?.text ?? '');
  highlight();
}

function end() {
  stopListening(); if (canSpeak) speechSynthesis.cancel(); speechSeq++;
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

const api = {
  mount: () => {}, unmount: () => {}, setMode: () => {}, showSource: () => null, closeSource: () => {},
  start, end, toggleMic,
  onNavigate: (fn: (path: string) => void) => { navigateFn = fn; return () => { if (navigateFn === fn) navigateFn = null; }; },
  send: (t: string) => { void send(t); },
  setCovered: (px: number) => { covered = Math.max(0, Number(px) || 0); },
  subscribe: (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; },
  getSnapshot: () => snap,
  // for tests: what the shopping copilot would do, without speech
  shopperId,
};
(window as any).copilot = api;
window.dispatchEvent(new Event('copilot:ready'));
