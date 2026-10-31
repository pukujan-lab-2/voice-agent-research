// Preview stand-in for the Website Copilot SDK.
// The host replaces this file with the real copilot at the same path on deploy.
// This version implements the same API with canned replies so the preview works.
// It says it is a preview stand-in and fills nothing.

/** @typedef {{ n: number; page?: number; text: string }} ManualStep */
/** @typedef {{ label: string; title: string; doc?: string; steps: ManualStep[] }} Manual */
/** @typedef {{ business: string; form?: string; can?: string[]; large?: boolean; manual?: Manual }} Config */
/** @typedef {{ id: number; who: 'bot' | 'user'; text: string; links: { page: number; href: string }[] }} Message */
/** @typedef {{
 *   mounted: boolean; open: boolean; voice: boolean;
 *   mic: 'on' | 'off' | 'unavailable';
 *   textInput: boolean;
 *   status: 'idle' | 'speaking' | 'listening' | 'thinking' | 'muted' | 'text';
 *   busy: boolean; heard: string;
 *   mode: 'form' | 'guide'; modes: ('form' | 'guide')[];
 *   business: string; can: string[]; large: boolean;
 *   messages: Message[];
 * }} Snapshot */

function noop() {}

class CopilotStub {
  constructor() {
    this._listeners = new Set();
    this._snapshot = this._fresh();
  }

  /** @returns {Snapshot} */
  _fresh() {
    return {
      mounted: false,
      open: false,
      voice: false,
      mic: 'off',
      textInput: false,
      status: 'idle',
      busy: false,
      heard: '',
      mode: 'form',
      modes: ['form'],
      business: '',
      can: [],
      large: false,
      messages: [],
      source: null,
      account: null,
    };
  }

  _emit() {
    this._snapshot = { ...this._snapshot, messages: [...this._snapshot.messages] };
    for (const fn of this._listeners) {
      try { fn(); } catch (_) { /* noop */ }
    }
  }

  /**
   * @param {Config} config
   */
  mount(config) {
    const modes = config.manual ? ['form', 'guide'] : ['form'];
    this._snapshot = {
      ...this._fresh(),
      mounted: true,
      modes,
      mode: 'form',
      business: config.business || '',
      can: config.can || [],
      large: !!config.large,
    };
    this._config = config;
    this._emit();
  }

  unmount() {
    this._snapshot = this._fresh();
    this._config = null;
    this._emit();
  }

  /**
   * @param {{ voice: boolean }} opts
   */
  start(opts) {
    if (!this._snapshot.mounted) return;
    this._snapshot = {
      ...this._snapshot,
      open: true,
      voice: !!opts.voice,
      mic: opts.voice ? 'on' : 'off',
      status: opts.voice ? 'listening' : 'text',
      textInput: !opts.voice,
    };
    this._emit();
    const intro = opts.voice
      ? `Hi, I'm the ${this._snapshot.business} copilot. This is a preview stand-in, so I won't actually fill the form — but the real copilot will. ${this._snapshot.can.length ? 'I can ' + this._snapshot.can.join(', ').toLowerCase() + '.' : ''}`
      : `Hi, I'm the ${this._snapshot.business} copilot (preview stand-in — I won't fill anything in this build). ${this._snapshot.can.length ? 'I can ' + this._snapshot.can.join(', ').toLowerCase() + '.' : ''}`;
    this._bot(intro, this._config && this._config.manual);
  }

  /**
   * @param {string} text
   */
  send(text) {
    if (!text || !text.trim()) return;
    const id = Date.now();
    this._snapshot = {
      ...this._snapshot,
      messages: [...this._snapshot.messages, { id, who: 'user', text, links: [] }],
      status: 'thinking',
      busy: true,
    };
    this._emit();
    setTimeout(() => this._reply(text), 350);
  }

  _bot(text, manual) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    const links = [];
    if (manual && manual.steps) {
      for (const s of manual.steps) {
        if (s.page != null && /\(page \d+\)/.test(text)) {
          if (text.includes(`(page ${s.page})`)) {
            links.push({ page: s.page, href: manual.doc || '#' });
          }
        }
      }
    }
    this._snapshot = {
      ...this._snapshot,
      messages: [...this._snapshot.messages, { id, who: 'bot', text, links }],
      busy: false,
      status: this._snapshot.voice ? 'listening' : 'text',
    };
    this._emit();
  }

  /**
   * @param {string} text
   */
  _reply(text) {
    const t = text.toLowerCase();
    const manual = this._config && this._config.manual;
    let reply = '';
    if (manual && manual.steps && manual.steps.length) {
      // Look for a matching step by keyword in its text
      const step = manual.steps.find(s => s.text.split(/\W+/).some(w => w.length > 3 && t.includes(w)));
      if (step) {
        const pageRef = step.page != null ? ` (page ${step.page})` : '';
        reply = `Here's what the guide says: ${step.text}${pageRef}. I won't fill it in this preview, but the real copilot will.`;
        this._bot(reply, manual);
        return;
      }
    }
    // Default canned reply
    reply = `You said: "${text}". This is a preview stand-in, so I won't fill anything. The real copilot would fill the next form field for you after you confirm.`;
    this._bot(reply, manual);
  }

  toggleMic() {
    if (this._snapshot.mic === 'unavailable') return;
    const on = this._snapshot.mic === 'on';
    this._snapshot = {
      ...this._snapshot,
      mic: on ? 'off' : 'on',
      status: on ? 'muted' : 'listening',
      heard: on ? '' : this._snapshot.heard,
    };
    if (!on) {
      // pretend to hear something
      let count = 0;
      const words = ['Listening', 'to', 'your', 'voice', 'in', 'the', 'preview'];
      const tick = () => {
        if (this._snapshot.mic !== 'on') return;
        if (count < words.length) {
          this._snapshot = { ...this._snapshot, heard: words.slice(0, count + 1).join(' ') };
          this._emit();
          count++;
          setTimeout(tick, 400);
        }
      };
      setTimeout(tick, 300);
    }
    this._emit();
  }

  /**
   * @param {'form' | 'guide'} mode
   */
  setMode(mode) {
    if (!this._snapshot.modes.includes(mode)) return;
    this._snapshot = { ...this._snapshot, mode };
    this._emit();
  }

  /**
   * @param {number} px
   */
  setCovered(px) {
    this._covered = px;
  }

  /**
   * The app gives the copilot a session token so it can look records up on the person's behalf.
   * This preview stand-in keeps it and does nothing with it.
   * @param {string} kind
   * @param {string} token
   */
  setAuth(kind, token) {
    this._auth = this._auth || {};
    this._auth[kind] = token;
  }

  /**
   * The id of the call on which the caller has been verified, or '' when they haven't been.
   * The preview stand-in never verifies anyone.
   * @returns {string}
   */
  verifiedCall() {
    return '';
  }

  /**
   * The app's client-side navigate; the copilot calls it to change page without ending the call.
   * @param {(path: string) => void} fn
   * @returns {() => void}
   */
  onNavigate(fn) {
    this._navigate = fn;
    return () => {
      if (this._navigate === fn) this._navigate = null;
    };
  }

  /**
   * Re-open the source of an earlier answer (its chip). The stand-in has no sources.
   * @param {number} messageId
   */
  showSource(messageId) {
    const msg = this._snapshot.messages.find((m) => m.id === messageId);
    if (!msg || !msg.source) return;
    this._snapshot = { ...this._snapshot, source: msg.source };
    this._emit();
  }

  closeSource() {
    this._snapshot = { ...this._snapshot, source: null };
    this._emit();
  }

  end() {
    this._snapshot = {
      ...this._snapshot,
      open: false,
      voice: false,
      mic: 'off',
      textInput: false,
      status: 'idle',
      heard: '',
      messages: [],
    };
    this._emit();
  }

  subscribe(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  getSnapshot() {
    return this._snapshot;
  }
}

const copilot = new CopilotStub();
window.copilot = copilot;
window.dispatchEvent(new Event('copilot:ready'));
