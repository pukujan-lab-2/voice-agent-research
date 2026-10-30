// The copilot widget a site adds with one script tag. The engine runs here in the page and makes every decision in
// code; the backend only lends it Jev (is this answer on topic? which manual passage answers?) and Octo search.
// The widget lives in a shadow root, so the page adapter never mistakes its own text box for a form field.
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

const CSS = `
:host { all: initial; }
* { box-sizing: border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
.launch { position: fixed; right: 20px; bottom: 20px; z-index: 2147483000; border: 0; border-radius: 999px; padding: 12px 18px;
  background: #4c3bcf; color: #fff; font-size: 15px; font-weight: 650; cursor: pointer; box-shadow: 0 6px 20px rgba(30,20,90,.3); }
.panel { position: fixed; right: 20px; bottom: 20px; z-index: 2147483001; width: min(400px, calc(100vw - 32px)); height: min(620px, calc(100vh - 40px));
  display: flex; flex-direction: column; background: #fff; color: #1d2230; border-radius: 16px; box-shadow: 0 12px 40px rgba(20,20,60,.28);
  overflow: hidden; font-size: 15px; line-height: 1.45; }
.panel[hidden], .launch[hidden] { display: none; }
.large .panel { font-size: 17px; }
header { background: #4c3bcf; color: #fff; padding: 12px 14px; display: flex; gap: 8px; align-items: flex-start; }
header b { display: block; font-size: 15px; } header small { opacity: .85; font-size: 12px; }
header button { margin-left: auto; background: transparent; border: 0; color: #fff; font-size: 20px; cursor: pointer; line-height: 1; }
.can { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 12px 0; }
.can span { font-size: 12px; background: #efedfd; color: #3a2e9e; border-radius: 99px; padding: 2px 9px; }
.tabs { display: flex; gap: 6px; padding: 8px 12px 0; }
.tabs button { flex: 1; border: 1px solid #d8d4f6; background: #fff; color: #3a2e9e; border-radius: 8px; padding: 6px; font-size: 13px; font-weight: 600; cursor: pointer; }
.tabs button[aria-selected=true] { background: #4c3bcf; color: #fff; border-color: #4c3bcf; }
.log { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
.msg { max-width: 88%; padding: 8px 11px; border-radius: 12px; white-space: pre-wrap; word-wrap: break-word; }
.bot { background: #f1f2f6; align-self: flex-start; border-bottom-left-radius: 4px; }
.user { background: #4c3bcf; color: #fff; align-self: flex-end; border-bottom-right-radius: 4px; }
.bot a { color: #3a2e9e; font-weight: 600; }
.typing { color: #6b7080; font-style: italic; font-size: 13px; padding: 0 12px 4px; min-height: 18px; }
form { display: flex; gap: 6px; padding: 10px 12px; border-top: 1px solid #e6e8ee; }
input { flex: 1; min-width: 0; border: 1px solid #c8cdd6; border-radius: 8px; padding: 9px 10px; font-size: 15px; }
form button { border: 0; border-radius: 8px; background: #4c3bcf; color: #fff; padding: 0 14px; font-weight: 650; cursor: pointer; }
footer { display: flex; justify-content: space-between; align-items: center; padding: 0 12px 10px; font-size: 12px; color: #6b7080; }
footer label { display: flex; gap: 4px; align-items: center; cursor: pointer; }
`;

const host = document.createElement('div');
host.id = 'copilot-widget';
document.body.append(host);
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>${CSS}</style>
<div class="${cfg.large ? 'large' : ''}">
  <button class="launch" type="button">Ask the copilot</button>
  <section class="panel" hidden role="dialog" aria-label="Copilot">
    <header><div><b>Copilot · ${esc(cfg.business)}</b><small>Demo. Answers only from this site. Never presses Submit.</small></div>
      <button class="close" type="button" aria-label="Close">×</button></header>
    <div class="can">${(cfg.can ?? []).map(c => `<span>${esc(c)}</span>`).join('')}</div>
    <div class="tabs" ${cfg.form && cfg.manual ? '' : 'hidden'}>
      <button type="button" data-mode="form" aria-selected="true">Fill the form with me</button>
      <button type="button" data-mode="guide" aria-selected="false">Walk me through</button>
    </div>
    <div class="log" aria-live="polite"></div>
    <div class="typing"></div>
    <form><input id="copilot-input" autocomplete="off" placeholder="Type your answer or a question…" aria-label="Message the copilot"><button type="submit">Send</button></form>
    <footer><label><input type="checkbox" class="speak"> Read replies aloud</label><span>Fictional demo</span></footer>
  </section>
</div>`;

const $ = <T extends Element>(s: string) => root.querySelector(s) as T;
const panel = $<HTMLElement>('.panel');
const launch = $<HTMLButtonElement>('.launch');
const log = $<HTMLElement>('.log');
const input = $<HTMLInputElement>('#copilot-input');
const typing = $<HTMLElement>('.typing');

function esc(s: string): string {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
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
  if (who === 'bot' && $<HTMLInputElement>('.speak').checked && 'speechSynthesis' in window) {
    speechSynthesis.cancel();
    speechSynthesis.speak(new SpeechSynthesisUtterance(text));
  }
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
  if (cfg.form) flow.intro = `Hi, I can help you fill in this ${cfg.form} form. I'll type your answers in, and you press ${form.submit} yourself at the end.`;
  if (parts++) flow.intro = `Thanks. On to the next part.`;
  firstEl = document.querySelector(`[data-copilot-id="${form.fields[0].id}"]`);
  copilot = new Copilot(flow, model, new DomFiller(form));
  add('bot', copilot.start());
  highlight();
}

function highlight() {
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
  if (mode !== 'form' || !copilot || !['ask', 'verify'].includes(copilot.state)) return;
  const el = document.querySelector(`[data-copilot-id="${copilot.current()}"]`);
  const box = el && (el as HTMLInputElement).type === 'radio' ? el.closest('fieldset') ?? el : el;
  if (box) { box.setAttribute('data-copilot-active', ''); box.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
}

function currentAsk(): string {
  if (!copilot || !flow) return '';
  if (copilot.state === 'ask') return flow.fields.find(f => f.name === copilot!.current())?.question ?? '';
  if (copilot.state === 'review') return flow.reviewAsk ?? '';
  return '';
}

// A multi-step form shows its next step after the person presses Next; the copilot then carries on with that step.
const watched = document.querySelector('form') ?? document.body;
new MutationObserver(() => {
  if (!copilot || copilot.state !== 'done' || mode !== 'form' || panel.hidden) return;
  setTimeout(() => {
    if (!copilot || copilot.state !== 'done') return;
    const next = readInPage();
    const el = next.fields[0] && document.querySelector(`[data-copilot-id="${next.fields[0].id}"]`);
    if (el && el !== firstEl) startForm();
  }, 150);
}).observe(watched, { subtree: true, attributes: true, attributeFilter: ['hidden', 'disabled'] });

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
    if (!guide.log.length) add('bot', guide.start()); else add('bot', 'Back to the walk-through. Say "repeat" to hear the step again.');
  } else if (m === 'form') {
    if (!copilot) startForm(); else add('bot', `Back to the form. ${currentAsk()}`.trim());
  }
  highlight();
}
root.querySelectorAll<HTMLButtonElement>('.tabs button').forEach(b => { b.onclick = () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode as 'form' | 'guide'); }; });

let busy = false;
async function send(text: string) {
  if (busy || !text.trim()) return;
  busy = true; host.dataset.busy = '1'; typing.textContent = 'Copilot is thinking…';
  add('user', text);
  try {
    let reply: string;
    if (mode === 'guide') reply = await guide!.turn(text);
    else if (!copilot) { startForm(); reply = ''; }
    else if (copilot.state === 'done') reply = `I've handed the form back to you. Please check it and press ${form!.submit} yourself.`;
    // A side question during a form is answered from the manual (or "I don't know"); then the form carries on.
    else if (lookup && /\?\s*$/.test(text)) reply = `${await lookup.lookup(text)} Back to the form: ${currentAsk()}`.trim();
    else reply = await copilot.turn(text);
    if (reply) add('bot', reply);
  } catch (e) {
    add('bot', "Sorry, something went wrong on my side. Nothing was sent. Please try again.");
    console.error(e);
  } finally {
    busy = false; delete host.dataset.busy; typing.textContent = '';
    highlight();
    input.focus();
  }
}

$<HTMLFormElement>('form').onsubmit = e => { e.preventDefault(); const t = input.value; input.value = ''; void send(t); };
launch.onclick = () => {
  panel.hidden = false; launch.hidden = true;
  if (!log.children.length) setMode(mode);
  input.focus();
};
$<HTMLButtonElement>('.close').onclick = () => {
  panel.hidden = true; launch.hidden = false;
  document.querySelectorAll('[data-copilot-active]').forEach(e => e.removeAttribute('data-copilot-active'));
};
