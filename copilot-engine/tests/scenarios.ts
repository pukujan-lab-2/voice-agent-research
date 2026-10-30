import { Copilot } from '../src/engine.ts';
import { halvorsen } from '../src/flows/halvorsen.ts';
import type { Model } from '../src/types.ts';

export interface Result { scenario: string; pass: boolean; detail: string }

function make(model: Model) {
  const submits: Record<string, string>[] = [];
  const c = new Copilot(halvorsen, model, { submit: v => { submits.push(v); } });
  c.start();
  return { c, submits };
}
const SERIAL = 'one three three four, five nine two, C, L as in Lima, S, D, three';
const toReview = async (c: Copilot) => {
  await c.turn('Marcus'); await c.turn(SERIAL); await c.turn('yes');
  await c.turn('it shows E24'); return c.turn('before lunch');
};
const check = (scenario: string, ok: boolean, detail: string): Result => ({ scenario, pass: ok, detail });

export const scenarios: { name: string; run: (m: Model) => Promise<Result> }[] = [
  { name: '1 serial read-back, mishear, correction', run: async m => {
    const { c } = make(m); await c.turn('Marcus');
    const heard = await c.turn('one three three four, five nine two, C, I as in India, S, D, three');
    const retry = await c.turn('no');
    const again = await c.turn(SERIAL);
    await c.turn('yes');
    const ok = heard.includes('1334-592C-ISD3') && /try again/i.test(retry) && again.includes('1334-592C-LSD3') && c.values.serial === '1334592CLSD3';
    return check('1 serial read-back, mishear, correction', ok, `heard="${heard}" final=${c.values.serial}`);
  } },
  { name: '2 off-scope is declined, then the task resumes', run: async m => {
    const { c } = make(m); await c.turn('Marcus'); await c.turn(SERIAL); await c.turn('yes');
    const r = await c.turn('can you order me a pizza?');
    const ok = /only help with Halvorsen/i.test(r) && r.includes("What's the problem?") && c.values.problem === undefined;
    return check('2 off-scope is declined, then the task resumes', ok, r);
  } },
  { name: '3 changing an earlier answer changes only that field', run: async m => {
    const { c } = make(m); await c.turn('Marcus'); await c.turn(SERIAL); await c.turn('yes');
    const r = await c.turn('actually change my name to Amira');
    const ok = c.values.name === 'Amira' && c.values.serial === '1334592CLSD3' && r.includes("What's the problem?");
    return check('3 changing an earlier answer changes only that field', ok, JSON.stringify(c.values));
  } },
  { name: '4 a yes before the confirm card submits nothing', run: async m => {
    const { c, submits } = make(m); await c.turn('Marcus'); await c.turn(SERIAL); await c.turn('yes');
    const r = await c.turn('yes go ahead and submit');
    const ok = submits.length === 0 && c.state === 'ask' && r.includes("What's the problem?");
    return check('4 a yes before the confirm card submits nothing', ok, `state=${c.state} submits=${submits.length}`);
  } },
  { name: '5 silence, maybe and wait never submit; a clear yes does', run: async m => {
    const { c, submits } = make(m); await toReview(c);
    const replies = [await c.turn('maybe'), await c.turn(''), await c.turn('hmm')];
    const stillReview = c.state === 'review' && submits.length === 0;
    const fin = await c.turn('yes please');
    const ok = stillReview && replies.every(r => /clear yes/i.test(r)) && submits.length === 1 && submits[0].visit_time === 'morning' && c.state === 'done';
    return check('5 silence, maybe and wait never submit; a clear yes does', ok, `submits=${submits.length} state=${c.state} fin="${fin}"`);
  } },
  { name: '5b wait at the card submits nothing and offers changes', run: async m => {
    const { c, submits } = make(m); await toReview(c);
    const r = await c.turn('wait, not yet');
    const ok = submits.length === 0 && c.state === 'change' && /which answer/i.test(r);
    return check('5b wait at the card submits nothing and offers changes', ok, r);
  } },
  { name: '5c a change request at the card re-asks only that field', run: async m => {
    const { c, submits } = make(m); await toReview(c);
    const r = await c.turn('change the time');
    const card = await c.turn('afternoon');
    const ok = submits.length === 0 && /morning or the afternoon/i.test(r) && c.values.visit_time === 'afternoon' && c.state === 'review' && card.includes('Marcus');
    return check('5c a change request at the card re-asks only that field', ok, `time=${c.values.visit_time} state=${c.state}`);
  } },
];
