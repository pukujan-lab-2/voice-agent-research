// The copilot a site adds with one script tag. Off until the visitor starts a voice call (or chooses to type), so the
// page works as a normal website on its own. The engine runs here in the page and makes every decision in code; the
// backend only lends it Jev (is this answer on topic? which manual passage answers?) and Octo search.
// Voice uses the browser's own speech recognition and speech synthesis; if there is no recognition or the mic is
// blocked, the same call carries on as text. The widget lives in a shadow root, so the page adapter never reads it.
import { Copilot } from '../../../copilot-engine/src/engine.ts';
import { Guide, type Manual } from '../../../copilot-engine/src/guide.ts';
import { flowFromPage, readInPage, type PageForm } from '../../../copilot-engine/src/page.ts';
import type { Flow } from '../../../copilot-engine/src/types.ts';
import { DomFiller } from './dom-filler.ts';
import { RemoteJudge, RemoteModel, RemoteRetriever } from './remote.ts';

type Config = {
  business: string;
  form?: string; // the form's name in the copilot's intro; leave out on a page with no form
  can?: string[];
  large?: boolean;
  manual?: { label: string; title: string; doc?: string; steps: Manual['steps'] };
};
const cfg: Config = JSON.parse(document.getElementById('copilot-config')?.textContent || '{}');
const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const canSpeak = 'speechSynthesis' in window;

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
[hidden] { display: none !important; }
button { min-height: 44px; min-width: 44px; border: 0; border-radius: 12px; font-size: 15px; font-weight: 650; cursor: pointer; }
.bar { position: fixed; left: 50%; transform: translateX(-50%); bottom: max(16px, env(safe-area-inset-bottom)); z-index: 2147483000;
  display: flex; gap: 8px; padding: 8px; background: #fff; border-radius: 18px; box-shadow: 0 8px 30px rgba(20,20,60,.25); width: max-content; max-width: calc(100vw - 24px); }
.bar .call { background: #1f9d55; color: #fff; padding: 0 18px; display: flex; align-items: center; gap: 8px; }
.bar .type { background: #eef0f5; color: #1d2230; padding: 0 14px; }
.panel { position: fixed; z-index: 2147483001; right: 16px; bottom: 16px; width: 400px; max-height: min(640px, calc(100vh - 32px));
  display: flex; flex-direction: column; background: #fff; color: #1d2230; border-radius: 18px; box-shadow: 0 12px 40px rgba(20,20,60,.3);
  overflow: hidden; font-size: 15px; line-height: 1.45; }
.large .panel { font-size: 17px; }
header { background: #2b2350; color: #fff; padding: 10px 10px 10px 14px; display: flex; gap: 8px; align-items: center; }
header .t { flex: 1; min-width: 0; } header b { display: block; font-size: 15px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
header small { opacity: .8; font-size: 12px; }
.pill { font-size: 12px; font-weight: 650; border-radius: 99px; padding: 4px 10px; background: rgba(255,255,255,.16); white-space: nowrap; }
.pill.listening { background: #1f9d55; } .pill.speaking { background: #7a5af8; } .pill.thinking { background: #b7791f; }
header .min { background: transparent; color: #fff; font-size: 20px; }
.can { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 0; }
.can span { font-size: 12px; background: #efedfd; color: #3a2e9e; border-radius: 99px; padding: 3px 9px; }
.tabs { display: flex; gap: 6px; padding: 8px 12px 0; }
.tabs button { flex: 1; background: #fff; border: 1px solid #d8d4f6; color: #3a2e9e; font-size: 13px; }
.tabs button[aria-selected=true] { background: #4c3bcf; color: #fff; border-color: #4c3bcf; }
.log { flex: 1; min-height: 120px; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; overscroll-behavior: contain; }
.msg { max-width: 88%; padding: 8px 11px; border-radius: 14px; white-space: pre-wrap; word-wrap: break-word; }
.bot { background: #f1f2f6; align-self: flex-start; border-bottom-left-radius: 4px; }
.user { background: #4c3bcf; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
.bot a { color: #3a2e9e; font-weight: 600; }
.heard { color: #6b7080; font-style: italic; font-size: 14px; padding: 0 12px; min-height: 0; }
.text { display: flex; gap: 6px; padding: 8px 12px 0; }
.text input { flex: 1; min-width: 0; min-height: 44px; border: 1px solid #c8cdd6; border-radius: 10px; padding: 8px 10px; font-size: 16px; }
.text button { background: #4c3bcf; color: #fff; padding: 0 14px; }
.controls { display: flex; gap: 8px; padding: 10px 12px calc(10px + env(safe-area-inset-bottom)); border-top: 1px solid #e6e8ee; margin-top: 8px; }
.controls button { flex: 1; background: #eef0f5; color: #1d2230; }
.controls .mic.on { background: #1f9d55; color: #fff; }
.controls .end { background: #d64545; color: #fff; }
.note { font-size: 11px; color: #6b7080; padding: 0 12px 8px; }
.panel.mini .log, .panel.mini .can, .panel.mini .tabs, .panel.mini .note { display: none; }
.panel.mini .last { display: block; }
.last { display: none; padding: 10px 12px 0; font-size: 14px; max-height: 4.5em; overflow: hidden; }
@media (max-width: 640px) {
  .panel { left: 0; right: 0; bottom: 0; width: 100%; max-height: 62vh; border-radius: 18px 18px 0 0; }
  .log { min-height: 80px; }
  .bar { width: calc(100vw - 24px); } .bar .call { flex: 1; justify-content: center; }
}
`;

const host = document.createElement('div');
host.id = 'copilot-widget';
document.body.append(host);
const root = host.attachShadow({ mode: 'open' });
const esc = (s: string) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
root.innerHTML = `<style>${CSS}</style>
<div class="${cfg.large ? 'large' : ''}">
  <div class="bar">
    <button class="call" type="button"><span aria-hidden="true">📞</span> Start voice call</button>
    <button class="type" type="button">Type instead</button>
  </div>
  <section class="panel" hidden role="dialog" aria-label="Copilot">
    <header><div class="t"><b>Copilot · ${esc(cfg.business)}</b><small>Fills only what you confirm. Never presses Submit.</small></div>
      <span class="pill">Ready</span><button class="min" type="button" aria-label="Make smaller">▾</button></header>
    <div class="can">${(cfg.can ?? []).map(c => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="tabs" ${cfg.form && cfg.manual ? '' : 'hidden'}>
      <button type="button" data-mode="form" aria-selected="true">Fill the form with me</button>
      <button type="button" data-mode="guide" aria-selected="false">Walk me through</button>
    </div>
    <div class="log" aria-live="polite"></div>
    <div class="last"></div>
    <div class="heard"></div>
    <form class="text" hidden><input id="copilot-input" autocomplete="off" enterkeyhint="send" placeholder="Type your answer or a question…" aria-label="Message the copilot"><button type="submit">Send</button></form>
    <div class="controls">
      <button class="mic" type="button">Mic</button>
      <button class="kbd" type="button">Keyboard</button>
      <button class="end" type="button">End</button>
    </div>
    <div class="note">Fictional demo. Voice uses your browser's own speech service.</div>
  </section>
</div>`;

const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
const panel = $<HTMLElement>('.panel');
const bar = $<HTMLElement>('.bar');
const log = $<HTMLElement>('.log');
const last = $<HTMLElement>('.last');
const input = $<HTMLInputElement>('#copilot-input');
const textRow = $<HTMLFormElement>('.text');
const heard = $<HTMLElement>('.heard');
const pill = $<HTMLElement>('.pill');
const micBtn = $<HTMLButtonElement>('.mic');

function status(s: 'ready' | 'listening' | 'speaking' | 'thinking' | 'muted' | 'text') {
  pill.className = `pill ${s}`;
  pill.textContent = { ready: 'Ready', listening: 'Listening…', speaking: 'Speaking…', thinking: 'Thinking…', muted: 'Mic off', text: 'Text chat' }[s];
}

function add(who: 'bot' | 'user', text: string) {
  const d = document.createElement('div');
  d.className = `msg ${who}`;
  let html = esc(text);
  // Page citations link to that page of the published (fictional) document.
  if (who === 'bot' && cfg.manual?.doc) html = html.replace(/\(page (\d+)\)/g, (_m, n) => `(<a href="${cfg.manual!.doc}#page-${n}" target="_blank" rel="noopener">page ${n}</a>)`);
  d.innerHTML = html;
  log.append(d);
  log.scrollTop = log.scrollHeight;
  if (who === 'bot') { last.innerHTML = html; if (voice) void speakThenListen(text); }
}

// ---- Voice: speak each reply, then listen for one answer. Never listens while speaking, so it can't hear itself.
let voice = false;   // in a voice call (as opposed to typing)
let muted = false;
let rec: any = null;
let quietTries = 0;
let speechSeq = 0;

function speak(text: string): Promise<void> {
  if (!canSpeak) return Promise.resolve();
  return new Promise(resolve => {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/·/g, ',').replace(/\s+/g, ' '));
    u.lang = 'en-US';
    u.rate = cfg.large ? 0.92 : 1;
    const done = () => { clearTimeout(t); resolve(); };
    // Some mobile browsers never fire onend; don't wait forever.
    const t = setTimeout(done, 1500 + text.length * 80);
    u.onend = done; u.onerror = done;
    speechSynthesis.speak(u);
  });
}

async function speakThenListen(text: string) {
  const seq = ++speechSeq;
  stopListening();
  status('speaking');
  await speak(text);
  if (seq !== speechSeq || !voice) return;
  listen();
}

function stopListening() {
  if (rec) { rec.onend = null; rec.onresult = null; rec.onerror = null; try { rec.abort(); } catch { /* not started */ } rec = null; }
}

function listen() {
  if (!voice || muted || busy || !SR) { if (voice) status(muted ? 'muted' : 'ready'); return; }
  stopListening();
  const r = new SR();
  rec = r;
  r.lang = 'en-US'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
  let final = '';
  r.onresult = (e: any) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript; else interim += e.results[i][0].transcript;
    }
    heard.textContent = (final || interim).trim();
  };
  r.onerror = (e: any) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') {
      // Mic blocked or missing: keep the call going as text.
      rec = null; toText("I can't use the microphone here, so let's carry on by typing. Your answers go in the box below.");
    }
  };
  r.onend = () => {
    if (rec !== r) return;
    rec = null;
    const said = final.trim();
    heard.textContent = '';
    if (said) { quietTries = 0; void send(said); return; }
    // Silence: listen again a couple of times, then wait for a tap on the mic.
    if (voice && !muted && ++quietTries < 3) listen();
    else if (voice) { muted = true; micState(); }
  };
  try { r.start(); status('listening'); micState(); } catch { status('ready'); }
}

function micState() {
  const on = voice && !muted && !!SR;
  micBtn.classList.toggle('on', on);
  micBtn.textContent = !SR ? 'No mic' : on ? 'Mute' : 'Tap to talk';
  micBtn.disabled = !SR;
  if (voice && muted) status('muted');
}

function toText(msg?: string) {
  voice = false; stopListening(); if (canSpeak) speechSynthesis.cancel();
  textRow.hidden = false; status('text'); micState();
  if (msg) add('bot', msg);
  input.focus();
}

// ---- Form mode: the page adapter reads the visible form, the engine asks one question at a time.
const model = new RemoteModel();
let copilot: Copilot | null = null;
let flow: Flow | null = null;
let form: PageForm | null = null;
let firstEl: Element | null = null;
let parts = 0;

function startForm() {
  form = readInPage();
  if (!form.fields.length) { copilot = null; add('bot', "There's nothing left for me to fill in on this page."); return; }
  flow = flowFromPage(form, { business: cfg.business, id: cfg.form });
  if (cfg.form) flow.intro = `Hi, I'm the ${cfg.business} copilot. I can fill in this ${cfg.form} form with you, one question at a time. I'll type your answers in, and you press ${form.submit} yourself at the end.`;
  if (parts++) flow.intro = `Thanks. On to the next part.`;
  firstEl = document.querySelector(`[data-copilot-id="${form.fields[0].id}"]`);
  copilot = new Copilot(flow, model, new DomFiller(form));
  add('bot', copilot.start());
  highlight();
}

// Keep the field being asked in the part of the screen the call panel doesn't cover.
function highlight() {
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
  if (mode !== 'form' || !copilot || !['ask', 'verify'].includes(copilot.state)) return;
  const el = document.querySelector(`[data-copilot-id="${copilot.current()}"]`);
  const box = el && (el as HTMLInputElement).type === 'radio' ? el.closest('fieldset') ?? el : el;
  if (!box) return;
  box.setAttribute('data-copilot-active', '');
  const r = box.getBoundingClientRect();
  const free = panel.hidden ? innerHeight : panel.getBoundingClientRect().top;
  if (r.top < 70 || r.bottom > free - 12) window.scrollBy({ top: r.top - Math.max(70, (free - r.height) * 0.35), behavior: 'smooth' });
}

function currentAsk(): string {
  if (!copilot || !flow) return '';
  if (copilot.state === 'ask') return flow.fields.find(f => f.name === copilot!.current())?.question ?? '';
  if (copilot.state === 'review') return flow.reviewAsk ?? '';
  return '';
}

// A multi-step form shows its next step after the person presses Next; the copilot then carries on with that step.
new MutationObserver(() => {
  if (!copilot || copilot.state !== 'done' || mode !== 'form' || panel.hidden) return;
  setTimeout(() => {
    if (!copilot || copilot.state !== 'done') return;
    const next = readInPage();
    const el = next.fields[0] && document.querySelector(`[data-copilot-id="${next.fields[0].id}"]`);
    if (el && el !== firstEl) startForm();
  }, 150);
}).observe(document.querySelector('form[data-copilot-form]') ?? document.body, { subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });

// ---- Guide mode: walk through the manual's steps; any question is answered only from the manual, or "I don't know".
let guide: Guide | null = null;
const manual: Manual | null = cfg.manual ? { id: cfg.manual.label, title: cfg.manual.title, business: cfg.business, steps: cfg.manual.steps, passages: [] } : null;
const lookup = manual ? new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge()) : null;

let mode: 'form' | 'guide' = cfg.form ? 'form' : 'guide';
function setMode(m: 'form' | 'guide') {
  mode = m;
  root.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.mode === m)));
  if (m === 'guide' && manual) {
    guide ??= new Guide(manual, new RemoteRetriever(manual.id), new RemoteJudge());
    add('bot', guide.log.length ? 'Back to the walk-through. Say "repeat" to hear the step again.' : guide.start());
  } else if (m === 'form') {
    if (!copilot) startForm(); else add('bot', `Back to the form. ${currentAsk()}`.trim());
  }
  highlight();
}
root.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => { b.onclick = () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode as 'form' | 'guide'); }; });

// Spoken questions come without a question mark, so a question word at the start counts too.
const isQuestion = (t: string) => /\?\s*$/.test(t) || /^\s*(what|where|which|how|why|when|who|can i|could i|should i|do i|does|is there|is it|are there|will)\b/i.test(t);

let busy = false;
async function send(text: string) {
  if (busy || !text.trim()) return;
  busy = true; host.dataset.busy = '1'; status('thinking'); stopListening();
  add('user', text);
  let reply = '';
  try {
    if (mode === 'guide') reply = await guide!.turn(text);
    else if (!copilot) startForm();
    else if (copilot.state === 'done') reply = `I've handed the form back to you. Please check it and press ${form!.submit} yourself.`;
    // A side question during a form is answered from the manual (or "I don't know"); then the form carries on.
    else if (lookup && isQuestion(text)) reply = `${await lookup.lookup(text)} Back to the form: ${currentAsk()}`.trim();
    else reply = await copilot.turn(text);
  } catch (e) {
    reply = "Sorry, something went wrong on my side. Nothing was sent. Please try again.";
    console.error(e);
  }
  busy = false; delete host.dataset.busy;
  if (reply) add('bot', reply); else if (voice) listen();
  if (!voice) status('text');
  highlight();
  if (!voice) input.focus();
}

function open(asVoice: boolean) {
  panel.hidden = false; bar.hidden = true; panel.classList.remove('mini');
  voice = asVoice && (canSpeak || !!SR);
  muted = !SR;
  textRow.hidden = voice && !!SR;
  micState();
  document.body.style.paddingBottom = `${panel.getBoundingClientRect().height + 24}px`;
  // Called from the tap itself, so mobile browsers allow the first spoken reply.
  if (!log.children.length) setMode(mode);
  else if (voice) void speakThenListen(last.textContent ?? '');
  if (!voice) { status('text'); input.focus(); }
}

function close() {
  voice = false; stopListening(); if (canSpeak) speechSynthesis.cancel();
  panel.hidden = true; bar.hidden = false; document.body.style.paddingBottom = '';
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
}

textRow.onsubmit = e => { e.preventDefault(); const t = input.value; input.value = ''; void send(t); };
$<HTMLButtonElement>('.call').onclick = () => open(true);
$<HTMLButtonElement>('.type').onclick = () => open(false);
$<HTMLButtonElement>('.end').onclick = close;
$<HTMLButtonElement>('.kbd').onclick = () => { if (textRow.hidden) toText(); else { textRow.hidden = true; voice = true; muted = false; micState(); listen(); } };
micBtn.onclick = () => {
  if (!voice) { voice = true; textRow.hidden = true; }
  muted = !muted; quietTries = 0; micState();
  if (muted) { stopListening(); status('muted'); } else { if (canSpeak) speechSynthesis.cancel(); listen(); }
};
$<HTMLButtonElement>('.min').onclick = () => {
  panel.classList.toggle('mini');
  document.body.style.paddingBottom = `${panel.getBoundingClientRect().height + 24}px`;
};
