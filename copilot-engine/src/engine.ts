import type { Field, Flow, Hooks, Model } from './types.ts';
import { formatSerial, grounded, isFiller, parseName, spokenToSerial, stripFiller, validSerial, wantsChange, yesNo } from './guard.ts';

type State = 'ask' | 'verify' | 'review' | 'change' | 'done';

// Asks one question at a time, reads back serials, shows a confirm card, and only then calls hooks.submit.
// The model only helps understand free-form answers; every safety decision is made here in code.
export class Copilot {
  values: Record<string, string> = {};
  state: State = 'ask';
  log: { who: 'user' | 'copilot'; text: string }[] = [];
  private idx = 0;
  private pending = '';
  private backToReview = false;
  private flow: Flow;
  private model: Model;
  private hooks: Hooks;

  constructor(flow: Flow, model: Model, hooks: Hooks) {
    this.flow = flow;
    this.model = model;
    this.hooks = hooks;
  }

  start(): string {
    const say = `${this.flow.intro} ${this.question()}`;
    this.log.push({ who: 'copilot', text: say });
    return say;
  }

  async turn(said: string): Promise<string> {
    this.log.push({ who: 'user', text: said });
    const say = await this.step(said);
    this.log.push({ who: 'copilot', text: say });
    return say;
  }

  // Name of the field currently being asked (used by simulators and UIs to show progress).
  current(): string { return this.field().name; }

  private field(): Field { return this.flow.fields[this.idx]; }
  private question(): string { return this.field().question; }
  private show(f: Field): string { return f.kind === 'serial' ? formatSerial(this.values[f.name]) : this.values[f.name]; }

  private async step(said: string): Promise<string> {
    switch (this.state) {
      case 'review': return this.onReview(said);
      case 'verify': return this.onVerify(said);
      case 'change': return this.onChange(said);
      case 'ask': return this.onAsk(said);
      default: return 'This conversation is finished.';
    }
  }

  private findField(said: string): Field | undefined {
    const t = said.toLowerCase();
    return this.flow.fields.find(f => [f.name, f.label, ...(f.aliases ?? [])].some(a => new RegExp(`\\b${a.toLowerCase()}\\b`).test(t)));
  }

  private card(): string {
    const lines = this.flow.fields.map(f => `${f.label}: ${this.show(f)}`).join('. ');
    return `Here's what I have. ${lines}. Shall I submit it? Say yes to submit, or tell me what to change.`;
  }

  private advance(): string {
    if (this.backToReview) { this.backToReview = false; this.state = 'review'; return this.card(); }
    this.idx += 1;
    if (this.idx >= this.flow.fields.length) { this.state = 'review'; return this.card(); }
    this.state = 'ask';
    return this.question();
  }

  // "actually my name is Amira" / "sorry, it's Amira, not Marcus" after the name was already given.
  private nameCorrection(said: string): string {
    const nameField = this.flow.fields.find(f => f.kind === 'name');
    if (!nameField || nameField === this.field() || this.values[nameField.name] === undefined) return '';
    if (!/^\s*(actually|sorry|no,? wait|i meant|i mean|correction|change|make that)\b|\bmy name\b/i.test(said)) return '';
    return parseName(said);
  }

  private async onAsk(said: string): Promise<string> {
    const f = this.field();
    const q = this.question();
    // Silence, filler and small talk are never answers.
    if (isFiller(said)) return `No problem, take your time. ${q}`;
    const fixed = this.nameCorrection(said);
    if (fixed) {
      const nameField = this.flow.fields.find(x => x.kind === 'name')!;
      this.values[nameField.name] = fixed;
      return `Got it, I changed your ${nameField.label} to ${fixed}. ${q}`;
    }
    if (f.kind === 'serial') {
      const s = spokenToSerial(said);
      if (validSerial(s)) { this.pending = s; this.state = 'verify'; return `I heard ${formatSerial(s)}. Is that right?`; }
      return `I didn't catch a full serial number. ${f.hint ?? ''} ${f.question}`.replace(/\s+/g, ' ');
    }
    // A bare yes/no is never an answer to a text, name or choice question, so "yes, submit it" cannot do anything here.
    if (yesNo(said) !== 'unclear' && said.trim().split(/\s+/).length <= 6 && !this.matchesOption(f, said)) {
      return `I haven't submitted anything yet. ${q}`;
    }
    if (f.kind === 'name') {
      const n = parseName(said);
      if (n) { this.values[f.name] = n; return this.advance(); }
      return `Sorry, I didn't catch your ${f.label}. ${q}`;
    }
    if (f.kind === 'choice') {
      // Code decides choices; the model is never allowed to guess one.
      const hit = this.matchChoice(f, said);
      if (hit) { this.values[f.name] = hit; return this.advance(); }
      return `Sorry, I need one of these: ${(f.options ?? []).join(' or ')}. ${q}`;
    }
    const u = await this.model.understand({ flow: this.flow, field: f, said, values: this.values });
    if (u.action === 'off_scope') return `${this.flow.scope} ${q}`;
    if (u.action === 'fill') {
      // Keep the customer's own words: use the model's cleaned value only if it adds nothing the customer did not say.
      const own = stripFiller(said);
      const v = u.value?.trim() && grounded(u.value, said) ? u.value.trim() : own;
      if (v) { this.values[f.name] = v; return this.advance(); }
    }
    return `Sorry, I didn't catch that. ${q}`;
  }

  private matchChoice(f: Field, said: string): string {
    const t = said.toLowerCase();
    const hits = (f.options ?? []).filter(o =>
      [o, ...(f.synonyms?.[o] ?? [])].some(w => new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/\./g, '\\.')}s?($|[^a-z])`).test(t)));
    return hits.length === 1 ? hits[0] : '';
  }

  private matchesOption(f: Field, said: string): boolean {
    return this.matchChoice(f, said) !== '';
  }

  private clean(f: Field, v: string): string {
    const t = v.trim();
    if (f.kind === 'choice') return (f.options ?? []).find(o => o.toLowerCase() === t.toLowerCase()) ?? '';
    return t;
  }

  private onVerify(said: string): string {
    const f = this.field();
    const s = spokenToSerial(said);
    if (validSerial(s) && yesNo(said) === 'unclear') { this.pending = s; return `I heard ${formatSerial(s)}. Is that right?`; }
    const yn = yesNo(said);
    if (yn === 'yes') { this.values[f.name] = this.pending; this.pending = ''; return this.advance(); }
    if (yn === 'no') { this.pending = ''; this.state = 'ask'; return `Okay, let's try again, a little slower. ${f.question}`; }
    return `Sorry, is ${formatSerial(this.pending)} correct? Please say yes or no.`;
  }

  private async onReview(said: string): Promise<string> {
    const target = this.findField(said);
    const yn = yesNo(said);
    if (yn === 'yes') {
      await this.hooks.submit({ ...this.values });
      this.state = 'done';
      return this.flow.doneMessage;
    }
    if (target && yn !== 'yes') return this.reask(target);
    if (yn === 'no' || wantsChange(said)) { this.state = 'change'; return "No problem, I haven't submitted anything. Which answer would you like to change?"; }
    return `I need a clear yes before I submit. ${this.card()}`;
  }

  private onChange(said: string): string {
    const target = this.findField(said);
    if (target) return this.reask(target);
    return `Which one: ${this.flow.fields.map(f => f.label).join(', ')}?`;
  }

  private reask(target: Field): string {
    this.idx = this.flow.fields.indexOf(target);
    this.backToReview = true;
    this.state = 'ask';
    return `Sure. ${this.question()}`;
  }
}
