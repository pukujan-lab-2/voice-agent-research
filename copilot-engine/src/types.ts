export type FieldKind = 'text' | 'name' | 'serial' | 'choice';

export interface Field {
  name: string;
  label: string;
  question: string;
  kind: FieldKind;
  options?: string[];
  synonyms?: Record<string, string[]>; // option -> other ways people say it, matched by code before the model
  hint?: string;
  aliases?: string[];
}

export interface Flow {
  id: string;
  business: string;
  intro: string;
  scope: string; // what to say when the request is off-scope
  doneMessage: string;
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
}
