// code: a short letters-and-digits code (an IRS notice code like CP2000), read back character by character.
// date: a calendar date said any way ("March 3rd 1985", "3/3/85"), kept as YYYY-MM-DD.
// digits: exactly `length` digits ("the last four of my social", a zip code), read back digit by digit.
export type FieldKind = 'text' | 'name' | 'serial' | 'choice' | 'email' | 'phone' | 'code' | 'date' | 'when' | 'digits';

export interface Field {
  name: string;
  label: string;
  question: string;
  kind: FieldKind;
  options?: string[];
  synonyms?: Record<string, string[]>; // option -> other ways people say it, matched by code before the model
  hint?: string;
  aliases?: string[];
  optional?: boolean; // "none" or "skip" leaves it blank
  spell?: boolean;    // read the answer back spelled out, letter by letter
  risk?: number;      // 1 to 100: how the desk confirms it (decision 0011); defaults by kind in desk.ts
  length?: number;    // digits: how many
  // A value that must never be shown or logged (a date of birth, the last four of an SSN). It is still read back aloud
  // for a yes, but every reply carries it between SECRET marks: forSpeech() keeps it, forDisplay() masks it.
  secret?: boolean;
}

export interface Flow {
  id: string;
  business: string;
  intro: string;
  scope: string; // what to say when the request is off-scope
  doneMessage: string;
  reviewAsk?: string; // what the review card asks; default offers to submit
  typeOffer?: string; // added after a second miss on a read-back field, e.g. "You can also type it with Keyboard."
  fields: Field[];
}

export type Understanding = {
  action: 'fill' | 'change' | 'ask_again' | 'off_scope';
  field?: string;
  value?: string;
};

export interface Model {
  name: string;
  understand(input: { flow: Flow; field: Field; said: string; values: Record<string, string> }): Promise<Understanding>;
}

export interface Hooks {
  submit(values: Record<string, string>): Promise<void> | void;
  // Called as each answer is accepted (a page adapter types it into the form). Return a message to reject the value
  // (for example the page's own validation message); the field is then asked again.
  fill?(field: Field, value: string): Promise<string | void> | string | void;
  // Called before an answer is read back: return the page's own refusal (its pattern, say) without typing anything in.
  check?(field: Field, value: string): Promise<string | void> | string | void;
}
