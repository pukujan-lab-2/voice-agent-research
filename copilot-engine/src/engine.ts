import type { Field, FieldKind, Flow, Hooks, Model } from './types.ts';
import { formatDate, formatSerial, forDisplay, grounded, isFiller, parseName, secret, serialProblem, spellOut, spokenDigits, spokenToCode, spokenToDate, spokenToEmail, spokenToPhone, spokenToSerial, stripFiller, validSerial, wantsChange, yesNo } from './guard.ts';

type State = 'ask' | 'verify' | 'review' | 'change' | 'done';

// Asks one question at a time, reads back serials, shows a confirm card, and only then calls hooks.submit.
// The model only helps understand free-form answers; every safety decision is made here in code.
// Words that attach a condition to a yes, or ask for a person instead of the assistant.
const BUT = /\b(but|except|although|though|however|wait|unless|if|as long as|provided|assuming|only)\b/i;
const WANTS_HUMAN = /\b(real person|human|representative|operator|live agent|someone real)\b/i;
// A reply about an earlier answer rather than the current question. STRONG needs no field name ("you wrote it twice"
// means the last answer); FIX needs one ("fix the name").
const STRONG_FIX = /\b(you (actually |just )?(wrote|put|typed|entered|filled( in)?|spelled|spelt|got)|twice|(that|it)('s| was| is) (wrong|not right|incorrect|misspelled)|(you made|that's) a mistake|typo)\b/i;
// "Go back" steps to the question before the one that is open; said again, it steps back again.
const GO_BACK = /\b(go(ing)? back|back up|previous (one|question|answer|field)|last question|undo)\b|^\W*back\W*$/i;
const FIX = /\b(fix|change|wrong|correct|update|edit|misspel+ed|spelled|spelt|mistake|actually|sorry|i meant|i mean|make that|no,? wait)\b|\bmy name\b/i;
// Answers that are easy to mishear are read back and need a yes before they are kept. `problem` says what was wrong
// with an answer that did not parse, so the caller can fix it instead of just hearing the question again.
// spell: how the read-back says it when every character matters ("CP2000: C, P, 2, 0, 0, 0")
type Readback = { parse: (said: string, f: Field) => string; show: (v: string) => string; miss: string; problem?: (said: string, f: Field) => string; spell?: (v: string) => string };
const READBACK: Partial<Record<FieldKind, Readback>> = {
  name: { parse: parseName, show: v => v, miss: 'name' },
  serial: { parse: s => { const v = spokenToSerial(s); return validSerial(v) ? v : ''; }, show: formatSerial, miss: 'serial number', problem: s => serialProblem(spokenToSerial(s)) },
  email: { parse: spokenToEmail, show: v => v, miss: 'email address' },
  phone: { parse: spokenToPhone, show: v => v, miss: 'phone number' },
  code: { parse: spokenToCode, show: v => v, miss: 'code', spell: v => `${v}: ${spellOut(v)}` },
  date: { parse: s => spokenToDate(s), show: formatDate, miss: 'date', problem: () => 'I need the month, the day and the year, like March 3, 1985.' },
  digits: {
    parse: (s, f) => { const d = spokenDigits(s); return d.length === (f.length ?? 4) ? d : ''; }, show: v => spellOut(v), miss: 'number',
    // Never echoes what was heard: it may be a whole SSN said by mistake.
    problem: (s, f) => { const n = spokenDigits(s).length; return !n ? '' : n > (f.length ?? 4) ? `That's more digits than I need. Just the ${f.length ?? 4} digits, please.` : `That's only ${n} digit${n === 1 ? '' : 's'}; I need ${f.length ?? 4}.`; },
  },
};
// An optional field's "none": left blank. Only ever checked on a field marked optional.
const NONE = /^\s*(no(ne|pe)?|n\/?a|skip( it| that)?|nothing|not applicable|no notice|leave it (blank|empty)|there (isn'?t|is no) (one|code)|i (didn'?t|did not|haven'?t|have not) (get|got|receive[d]?)( one| a notice| any( notice)?)?)\W*$/i;

const escape = (x: string) => x.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');

export class Copilot {
  values: Record<string, string> = {};
  state: State = 'ask';
  log: { who: 'user' | 'copilot'; text: string }[] = [];
  private idx = 0;
  private pending = '';
  private backToReview = false;
  private resume = -1; // the field to go back to after fixing an earlier answer mid-flow
  private lastSet = ''; // the most recently kept field, which "you wrote it twice" refers to
  private misses: Record<string, number> = {};
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

  // What is said back may hold secret values between SECRET marks: speak it with forSpeech(), show it with forDisplay().
  // The log keeps only the masked text, and a caller's answer to a secret question is never logged at all.
  async turn(said: string): Promise<string> {
    const hidden = this.state !== 'done' && this.state !== 'review' && !!this.flow.fields[this.idx]?.secret;
    this.log.push({ who: 'user', text: hidden ? '••••' : said });
    const say = await this.step(said);
    this.log.push({ who: 'copilot', text: forDisplay(say) });
    return say;
  }

  // Picks up a form the person left half filled (they went to another page mid-call): the kept answers stay, and the
  // first field without one is asked, or the review card when every field has one.
  restore(values: Record<string, string>, lead = ''): string {
    for (const f of this.flow.fields) if (values[f.name] !== undefined) this.values[f.name] = values[f.name];
    const i = this.flow.fields.findIndex(f => this.values[f.name] === undefined);
    this.idx = i < 0 ? this.flow.fields.length : i;
    this.state = i < 0 ? 'review' : 'ask';
    const say = `${lead} ${i < 0 ? this.card() : this.question()}`.trim();
    this.log.push({ who: 'copilot', text: say });
    return say;
  }

  // Name of the field currently being asked (used by simulators and UIs to show progress).
  current(): string { return this.field().name; }

  private field(): Field { return this.flow.fields[this.idx]; }
  private question(): string { return this.field().question; }
  private show(f: Field): string {
    const v = this.values[f.name];
    if (v === '') return 'left blank';
    return this.hide(f, READBACK[f.kind]?.show(v) ?? v);
  }
  // A secret field's value is said between SECRET marks, so the caller hears it but no screen or log shows it.
  private hide(f: Field, text: string): string { return f.secret ? secret(text) : text; }

  // Every accepted answer goes through here, so a page adapter can type it in and reject it. Returns '' when kept.
  private async set(f: Field, v: string): Promise<string> {
    const no = await this.hooks.fill?.(f, v);
    if (no) return no;
    this.values[f.name] = v;
    this.lastSet = f.name;
    this.misses[f.name] = 0;
    return '';
  }

  // Every answer is read back and needs a yes before it is typed in. The page may refuse it first (its own pattern).
  private async propose(f: Field, v: string): Promise<string> {
    const no = await this.hooks.check?.(f, v);
    if (no) { this.state = 'ask'; return `${no} ${f.question}`; }
    this.pending = v;
    this.state = 'verify';
    return this.readback(f, v);
  }

  private readback(f: Field, v: string): string {
    const rb = READBACK[f.kind];
    if (rb?.spell) return `I heard ${this.hide(f, rb.spell(v))}. Is that right?`;
    if (rb && f.spell) return `I heard ${this.hide(f, rb.show(v))}, spelled ${this.hide(f, v.split(/\s+/).map(w => spellOut(w, '-')).join(', '))}. Is that right?`;
    if (rb) return `I heard ${this.hide(f, rb.show(v))}. Is that right?`;
    if (f.kind === 'choice') return `${v}, is that right?`;
    return /\?$/.test(f.label) ? `I'll put "${v}". Is that right?` : `I'll put "${v}" for ${f.label}. Is that right?`;
  }

  private async keep(f: Field, v: string): Promise<string> {
    const no = await this.set(f, v);
    if (no) { this.state = 'ask'; return `${no} ${f.question}`; }
    return this.advance();
  }

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
    return `Here's what I have. ${lines}. ${this.flow.reviewAsk ?? 'Shall I submit it? Say yes to submit, or tell me what to change.'}`;
  }

  private advance(): string {
    if (this.resume >= 0) { this.idx = this.resume; this.resume = -1; this.state = 'ask'; return `Thanks, that's fixed. ${this.question()}`; }
    if (this.backToReview) { this.backToReview = false; this.state = 'review'; return this.card(); }
    this.idx += 1;
    if (this.idx >= this.flow.fields.length) { this.state = 'review'; return this.card(); }
    this.state = 'ask';
    return this.question();
  }

  // "You wrote the name twice, can you fix it" / "actually my name is Amira" while another question is open: go back to
  // that field, read back what it holds and ask for the new value (or read back the new value if it was said), then
  // carry on from the question that was open. Code decides; the model is never asked.
  private correction(said: string): string {
    const cur = this.field();
    const answered = (f: Field) => f !== cur && this.values[f.name] !== undefined;
    const t = said.toLowerCase();
    const named = this.flow.fields.filter(answered).filter(f => this.mentions(f, t));
    let target: Field | undefined;
    const back = GO_BACK.test(said) && !named.length;
    if (back) target = this.flow.fields[this.idx - 1];
    else if (named.length && (FIX.test(said) || GO_BACK.test(said))) target = named.find(f => f.name === this.lastSet) ?? named[named.length - 1];
    else if (STRONG_FIX.test(said)) target = this.flow.fields.find(f => f.name === this.lastSet && answered(f));
    if (!target || this.values[target.name] === undefined) return '';
    // "Sick visit, sorry" answers the open question; it is not about an earlier one.
    if (!back && cur.kind === 'choice' && this.matchChoice(cur, said)) return '';
    if (!back && this.state === 'ask' && READBACK[cur.kind]?.parse(said, cur) && cur.kind !== 'name') return '';
    if (this.resume < 0) this.resume = this.idx;
    this.idx = this.flow.fields.indexOf(target);
    this.pending = '';
    // The new value may be in the same sentence: "actually change my name to Amira".
    const v = target.kind === 'name' && !back ? parseName(said) : '';
    if (v && v.toLowerCase() !== this.values[target.name].toLowerCase()) {
      this.pending = v; this.state = 'verify';
      return `Sure. I heard ${v} for the ${target.label}. Is that right?`;
    }
    this.state = 'ask';
    return `${back ? 'Sure, going back.' : "Sure, let's fix that."} I have the ${target.label} as ${this.show(target)}. ${target.question}`;
  }

  // Does the reply name this field? Its name, label, aliases, or the label's last word ("the name" for "child's full name").
  private mentions(f: Field, t: string): boolean {
    const last = f.label.toLowerCase().split(/\s+/).pop() ?? '';
    const words = [f.name, f.label, ...(f.aliases ?? []), ...(last.length > 3 ? [last] : [])];
    return words.some(a => new RegExp(`\\b${escape(a.toLowerCase())}\\b`).test(t));
  }

  // A read-back answer that did not parse: say what was wrong, and after two misses offer the keyboard.
  private missed(f: Field, rb: Readback, said: string): string {
    const n = (this.misses[f.name] = (this.misses[f.name] ?? 0) + 1);
    const offer = n >= 2 && this.flow.typeOffer ? ` ${this.flow.typeOffer}` : '';
    const problem = rb.problem?.(said, f);
    if (problem) return `${problem}${offer} ${f.question}`.replace(/\s+/g, ' ');
    if (f.kind === 'name') return `Sorry, I didn't catch your ${f.label}.${offer} ${f.question}`;
    return `I didn't catch a full ${rb.miss}. ${f.hint ?? ''}${offer} ${f.question}`.replace(/\s+/g, ' ');
  }

  private async onAsk(said: string): Promise<string> {
    if (WANTS_HUMAN.test(said)) return `I'm an automated assistant, so I can't transfer you, but I can finish this with you. ${this.flow.fields[this.idx].question}`;
    const f = this.field();
    const q = this.question();
    // Silence, filler and small talk are never answers.
    if (isFiller(said)) return `No problem, take your time. ${q}`;
    const fixed = this.correction(said);
    if (fixed) return fixed;
    if (f.optional && NONE.test(said)) {
      const no = await this.set(f, '');
      if (no) return `${no} ${q}`;
      const next = this.advance();
      return `Okay, I'll leave the ${f.label} blank. ${next}`;
    }
    const rb = READBACK[f.kind];
    if (rb) {
      // A bare yes or no to a name question is not a name ("Yeah" is nobody's name here), and nothing has been submitted.
      if (f.kind === 'name' && yesNo(said) !== 'unclear' && said.trim().split(/\s+/).length <= 6) return `I haven't submitted anything yet. ${q}`;
      const s = rb.parse(said, f);
      if (s) return this.propose(f, s);
      return this.missed(f, rb, said);
    }
    // A bare yes/no is never an answer to a text, name or choice question, so "yes, submit it" cannot do anything here.
    if (yesNo(said) !== 'unclear' && said.trim().split(/\s+/).length <= 6 && !this.matchesOption(f, said)) {
      return `I haven't submitted anything yet. ${q}`;
    }
    if (f.kind === 'choice') {
      // Code decides choices; the model is never allowed to guess one.
      const hit = this.matchChoice(f, said);
      if (hit) return this.propose(f, hit);
      // "Tuesday" when two Tuesdays are offered: ask between just those, not the whole list again.
      const some = this.partOf(f, said);
      if (some.length === 1) return this.propose(f, some[0]);
      if (some.length > 1) return `Which one: ${some.slice(0, -1).join(', ')} or ${some.at(-1)}?`;
      return `Sorry, I need one of these: ${(f.options ?? []).join(' or ')}. ${q}`;
    }
    const u = await this.model.understand({ flow: this.flow, field: f, said, values: this.values });
    if (u.action === 'off_scope') return `${this.flow.scope} ${q}`;
    if (u.action === 'fill') {
      // Keep the customer's own words: use the model's cleaned value only if it adds nothing the customer did not say.
      const own = stripFiller(said);
      const v = u.value?.trim() && grounded(u.value, said) ? u.value.trim() : own;
      if (v) return this.propose(f, v);
    }
    return `Sorry, I didn't catch that. ${q}`;
  }

  private choiceHits(f: Field, said: string): string[] {
    const t = said.toLowerCase();
    // "not the morning" names an option only to rule it out: ask again rather than guess the other one.
    if (/\b(not|no|don'?t|isn'?t|can'?t|never|nothing in the)\b/.test(t)) return [];
    return (f.options ?? []).filter(o =>
      [o, ...(f.synonyms?.[o] ?? [])].some(w => new RegExp(`(^|[^a-z])${w.toLowerCase().replace(/\./g, '\\.')}s?($|[^a-z])`).test(t)));
  }

  // Options whose wording holds every word that was said ("Tuesday" → both Tuesdays); confirmed by a read-back like any
  // other answer. Only words of three letters or more count, so "the" or "a" alone never picks anything.
  private partOf(f: Field, said: string): string[] {
    const words = stripFiller(said).toLowerCase().match(/[a-z0-9]+/g)?.filter(w => w.length >= 3 && !/^(the|and|one|for|please|that|this|day|time)$/.test(w)) ?? [];
    if (!words.length || /\b(not|no|don'?t|isn'?t|can'?t|never)\b/i.test(said)) return [];
    return (f.options ?? []).filter(o => {
      const text = ` ${[o, ...(f.synonyms?.[o] ?? [])].join(' ').toLowerCase().replace(/[^a-z0-9]+/g, ' ')} `;
      return words.every(w => text.includes(` ${w} `));
    });
  }

  private matchChoice(f: Field, said: string): string {
    const hits = this.choiceHits(f, said);
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

  private async onVerify(said: string): Promise<string> {
    const f = this.field();
    const rb = READBACK[f.kind];
    // "Go back", or "no, you wrote the name wrong" while a different answer is being read back, is about that answer.
    const t = said.toLowerCase();
    if (GO_BACK.test(said) || this.flow.fields.some(x => x !== f && this.values[x.name] !== undefined && this.mentions(x, t))) {
      const fixed = this.correction(said);
      if (fixed) return fixed;
    }
    const yn = yesNo(said);
    // A fresh answer instead of a yes or no is read back in turn.
    if (yn === 'unclear') {
      const s = rb ? rb.parse(said, f) : f.kind === 'choice' ? this.matchChoice(f, said) : '';
      if (s) return this.propose(f, s);
    }
    if (yn === 'yes' && !BUT.test(said)) { const v = this.pending; this.pending = ''; return this.keep(f, v); }
    if (yn === 'no') {
      this.pending = ''; this.state = 'ask';
      const n = (this.misses[f.name] = (this.misses[f.name] ?? 0) + 1);
      const offer = n >= 2 && rb && f.kind !== 'name' && this.flow.typeOffer ? ` ${this.flow.typeOffer}` : '';
      return `${rb ? "Okay, let's try again, a little slower." : 'Okay.'}${offer} ${f.question}`;
    }
    return `Sorry, is ${this.hide(f, rb ? rb.show(this.pending) : this.pending)} correct? Please say yes or no.`;
  }

  private async onReview(said: string): Promise<string> {
    const target = this.findField(said);
    const yn = yesNo(said);
    // A yes only submits when nothing else is attached: "yes but change the time" is a change request.
    if (yn === 'yes' && !target && !wantsChange(said) && !BUT.test(said)) {
      await this.hooks.submit({ ...this.values });
      this.state = 'done';
      return this.flow.doneMessage;
    }
    if (target) return this.reask(target);
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
