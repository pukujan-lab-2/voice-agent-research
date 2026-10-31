// Caller verification: the copilot collects who the caller says they are (full name, date of birth, last four of the
// SSN, zip), reads each answer back for a yes, and hands the confirmed answers to the server, which compares them with
// the client list and answers only match / no_match / need_more / locked. The copilot never sees, speaks or shows
// anything on file; it only knows the result. Every decision here is code; no model is asked anything.
// Secret answers (date of birth, last four, zip) travel between SECRET marks: forSpeech() says them, forDisplay() masks
// them, and the log holds only the masked text.
import { Copilot } from './engine.ts';
import { forDisplay, yesNo } from './guard.ts';
import type { Field, Flow, Model } from './types.ts';

export type VerifyResult = { result: 'match' | 'no_match' | 'need_more' | 'locked'; ask?: string; triesLeft?: number };
// What the client's own return looks like once verified (fictional sample data; no identity details in it).
export type ReturnCard = { taxYear: number; status: string; updated: string; nextStep: string; preparer: string; amount: string | null; sample: true };
export type VerifyBackend = {
  check(values: Record<string, string>): Promise<VerifyResult>;
  status(): Promise<ReturnCard | null>; // only after a match
};

export const VERIFY_FIELDS: Field[] = [
  { name: 'name', label: 'full name', question: "What's your full name, as it is on your tax return?", kind: 'name', aliases: ['my name'] },
  { name: 'dob', label: 'date of birth', question: "What's your date of birth?", kind: 'date', secret: true, aliases: ['birthday', 'birth date', 'date of birth'] },
  { name: 'ssn4', label: 'last four', question: 'What are the last four digits of your Social Security number?', kind: 'digits', length: 4, secret: true, aliases: ['social', 'ssn', 'last four', 'last 4'] },
  { name: 'zip', label: 'zip code', question: "And what's the zip code on your return?", kind: 'digits', length: 5, secret: true, aliases: ['zip', 'zip code', 'postal code'] },
];

// Asking to verify, or asking about one's own return or account.
export const WANTS_VERIFY = /\b(verify|verification|identify|identity)\b|\b(my|our) (tax )?(account|return status|refund status)\b|\b(status|update|news) (of|on|about) (my|our) (tax )?(return|refund|filing)\b|\b(where('s| is)|what('s| is) happening with|check on|did you (file|send)|have you (filed|sent)|has .{0,20}(filed|accepted)) (my|our) (tax )?(return|refund)\b|\bmy refund\b/i;
// Fishing for what is on file, in any words.
const FISH = /\b(what|which|tell me|read( me| out| back)?|say|give me|remind me( of)?|confirm|show me|do you have|have you got)\b.{0,40}\b(on file|you have|in (the|your) (system|records?|file)|birthday|date of birth|dob|social|ssn|last (four|4)|zip|address|phone|email)\b/i;
const FISH_HINT = /\b(first (digit|number|two|three)|starts? with|begins? with|ends? (in|with)|close|warmer|hint|which (one|digits?) (is|are) wrong|what did i get wrong|which (part|detail|one) (was|is) wrong)\b/i;
const THIRD_PARTY = /\b(i'?m|i am|this is) (their|his|her|the client'?s|my (client|mother|mom|father|dad|wife|husband|spouse|son|daughter)'?s?) ?(accountant|lawyer|attorney|assistant|bookkeeper|preparer|representative|spouse|wife|husband|son|daughter|caregiver)?\b|\bon (their|his|her|behalf of)\b|\b(for|calling for) my (client|mother|mom|father|dad|wife|husband|spouse|son|daughter|boss)\b|\b(power of attorney|poa)\b/i;
const INJECT = /\b(ignore|disregard|forget|override|bypass|skip) (all |any |your |the |previous |prior )*(rules|instructions|check|checks|verification|steps?)\b|\b(mark|set|treat) (me|this (call|caller)) (as )?verified\b|\b(system|admin|developer|debug|test) (override|mode)\b|\byou are now\b|\bverified\s*=\s*true\b|\bi('?m| am) (the )?(admin|developer|owner|it|from brindlewick)\b/i;
const CANCEL = /^\W*(cancel|stop|never ?mind|forget it|skip (it|this|verification)|not now|no thanks?)\W*$/i;
const HUMAN = /\b(real person|human|representative|operator|live agent|someone real|talk to (a|an|someone)|speak (to|with) (a|an|someone))\b/i;

export type VerifyCopy = { handoff: string };

export class Verifier {
  state: 'collecting' | 'verified' | 'locked' | 'cancelled' = 'collecting';
  card: ReturnCard | null = null;
  log: { who: 'user' | 'copilot'; text: string }[] = [];
  private cp!: Copilot;
  private kept: Record<string, string> = {};
  private model: Model;
  private backend: VerifyBackend;
  private copy: VerifyCopy;

  constructor(model: Model, backend: VerifyBackend, copy: VerifyCopy) {
    this.model = model; this.backend = backend; this.copy = copy;
  }

  // The read-back flow for some of the fields; the review card is never shown (the server checks instead).
  private ask(fields: Field[], intro: string): string {
    const flow: Flow = { id: 'verify', business: 'Brindlewick', intro, scope: "I'm checking who you are first.", doneMessage: '', fields };
    this.cp = new Copilot(flow, this.model, { submit: () => {} });
    return this.cp.start().trim();
  }

  start(): string {
    const say = this.ask(VERIFY_FIELDS.slice(0, 3), "Sure. Before I can look at your return I need to check who you are: your full name, date of birth, the last four digits of your Social Security number and your zip code. I'll read each one back. I can't read out anything we have on file.");
    this.log.push({ who: 'copilot', text: forDisplay(say) });
    return say;
  }

  // The question that is open, for repeating it after a side remark.
  current(): string { return this.state === 'collecting' && this.cp.state === 'ask' ? VERIFY_FIELDS.find(f => f.name === this.cp.current())?.question ?? '' : ''; }
  // True while the caller is answering a secret question (the UI masks what they say).
  secretOpen(): boolean { return this.state === 'collecting' && ['ask', 'verify'].includes(this.cp.state) && !!VERIFY_FIELDS.find(f => f.name === this.cp.current())?.secret; }

  async turn(said: string): Promise<string> {
    const hidden = this.secretOpen();
    this.log.push({ who: 'user', text: hidden ? '••••' : said });
    const say = await this.step(said);
    this.log.push({ who: 'copilot', text: forDisplay(say) });
    return say;
  }

  private again(): string {
    const q = this.current();
    if (q) return q;
    return this.cp.state === 'verify' ? 'Is what I read back right? Please say yes or no.' : '';
  }

  private async step(said: string): Promise<string> {
    if (this.state === 'locked') return `I can't verify you on this call any more. ${this.copy.handoff}`;
    if (this.state === 'verified') {
      if (FISH.test(said) || FISH_HINT.test(said)) return "I can't read out anything we have on file. Your return's status is on the card.";
      return '';
    }
    if (FISH.test(said) || FISH_HINT.test(said)) return `I can't read out or hint at anything we have on file, not even part of it. I can only check what you tell me. ${this.again()}`.trim();
    if (INJECT.test(said)) return `I can't skip or change the check. ${this.again()}`.trim();
    if (THIRD_PARTY.test(said)) return `I can only verify the client themselves on this call, so I can't take details on someone else's behalf. ${this.copy.handoff}`;
    if (HUMAN.test(said)) return `${this.copy.handoff} Or we can carry on: ${this.again()}`.trim();
    if (CANCEL.test(said) && yesNo(said) !== 'yes') { this.state = 'cancelled'; return "Okay, I've stopped the check. Ask me anything else."; }
    const reply = await this.cp.turn(said);
    if (this.cp.state !== 'review') return reply;
    // Every field asked so far has a confirmed answer: the server decides.
    Object.assign(this.kept, this.cp.values);
    return this.decide();
  }

  private async decide(): Promise<string> {
    const r = await this.backend.check({ ...this.kept });
    if (r.result === 'need_more') {
      const f = VERIFY_FIELDS.find(x => x.name === r.ask && this.kept[x.name] === undefined);
      if (f) return this.ask([f], 'Thanks.');
      r.result = 'no_match';
    }
    if (r.result === 'match') {
      this.state = 'verified';
      this.card = await this.backend.status();
      const c = this.card;
      return c ? `Thanks, you're verified. Your ${c.taxYear} return: ${c.status}. ${c.nextStep} It's on the card on your screen.` : "Thanks, you're verified.";
    }
    if (r.result === 'locked' || (r.triesLeft ?? 0) <= 0) { this.state = 'locked'; this.kept = {}; return `Sorry, I couldn't verify you, so I've stopped verification for this call. ${this.copy.handoff}`; }
    this.kept = {};
    // Never says which answer was wrong.
    return this.ask(VERIFY_FIELDS.slice(0, 3), `Sorry, I couldn't verify you with those details. Let's go through them once more${r.triesLeft === 1 ? '; this is the last try' : ''}.`);
  }
}
