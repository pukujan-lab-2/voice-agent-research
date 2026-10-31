// Page adapter: reads a web form into a Flow and types confirmed answers into it. It never presses Submit.
// The page is driven from outside with Playwright; the engine still makes every decision in code.
import type { Page } from 'playwright-core';
import type { Field, Flow, Hooks } from './types.ts';

export type PageField = {
  id: string; // data-copilot-id set on the element (on every radio of a group)
  tag: 'input' | 'select' | 'textarea' | 'radio';
  type: string;
  label: string;
  name: string;
  required: boolean;
  autocomplete: string;
  ask?: string; // the site's own wording of the question (data-copilot-ask), used instead of one built from the label
  kind?: string; // data-copilot-kind="code": a short letters-and-digits code, read back character by character
  spell?: boolean; // data-copilot-spell: read the answer back spelled out
  options?: { label: string; value: string; also?: string[] }[]; // also: other ways people say it (data-copilot-also)
};
export type PageForm = { fields: PageField[]; yourself: string[]; submit: string };

// Runs inside the page (exported so an in-page widget can call it directly). Visible, enabled fields only; hidden, honeypot, disabled and read-only fields are ignored.
// Things a person must do themselves (consent, passwords, payment, uploads, captchas) are listed, never touched.
export function readInPage(): PageForm {
  const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').replace(/\s*[*:]\s*$/, '').trim();
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('[hidden],[aria-hidden="true"]');
  };
  const labelOf = (el: HTMLElement): string => {
    if (el.id) {
      const l = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) return clean(l.textContent);
    }
    const wrap = el.closest('label');
    if (wrap) {
      const c = wrap.cloneNode(true) as HTMLElement;
      c.querySelectorAll('input,select,textarea').forEach(x => x.remove());
      if (clean(c.textContent)) return clean(c.textContent);
    }
    const by = el.getAttribute('aria-labelledby');
    if (by) return clean(by.split(/\s+/).map(id => document.getElementById(id)?.textContent).join(' '));
    return clean(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('name'));
  };
  const SENSITIVE = /\b(card|cvv|cvc|security code|expir|iban|routing|account number|sort code|ssn|social security|passport|pin)\b/i;
  const CONSENT = /\b(agree|terms|consent|privacy|accept|subscribe|newsletter|marketing)\b/i;
  const also = (el: Element | null | undefined) => (el?.getAttribute('data-copilot-also') ?? '').split(',').map(x => x.trim()).filter(Boolean);
  // Ids from an earlier read (an earlier step of a multi-step form) must not point at fields that are now hidden.
  document.querySelectorAll<HTMLElement>('[data-copilot-id],[data-copilot-submit]').forEach(e => { delete e.dataset.copilotId; delete e.dataset.copilotOption; delete e.dataset.copilotSubmit; });
  const fields: PageField[] = [];
  const yourself: string[] = [];
  const seenRadio = new Set<string>();
  let n = 0;
  // A page can mark its main form, so a site search box or a newsletter field in the header is not read as part of it.
  const scope: ParentNode = document.querySelector('[data-copilot-form]') ?? document;
  const els = Array.from(scope.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input,select,textarea'));
  for (const el of els) {
    const type = el instanceof HTMLInputElement ? el.type.toLowerCase() : el.tagName.toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image'].includes(type)) continue;
    if (el.disabled || (el as HTMLInputElement).readOnly || !visible(el)) continue;
    const label = labelOf(el);
    const auto = (el.getAttribute('autocomplete') ?? '').toLowerCase();
    const nameAttr = el.getAttribute('name') ?? '';
    if (type === 'password') { yourself.push(`fill in "${label}"`); continue; }
    if (type === 'file') { yourself.push(`upload the file for "${label}"`); continue; }
    if (/captcha/i.test(nameAttr + ' ' + el.id + ' ' + label)) { yourself.push('complete the captcha'); continue; }
    if (auto.startsWith('cc-') || SENSITIVE.test(label) || SENSITIVE.test(nameAttr.replace(/[_-]/g, ' '))) { yourself.push(`fill in "${label}"`); continue; }
    // A date box is the person's to pick, unless the page asks the copilot to fill it (data-copilot-ask).
    if (['time', 'datetime-local', 'month', 'week', 'color', 'range'].includes(type) || (type === 'date' && !el.hasAttribute('data-copilot-ask'))) { yourself.push(`pick "${label}"`); continue; }
    if (type === 'checkbox') {
      // Ticks are the person's call. A group of boxes under one heading is listed once by its heading.
      const group = clean(el.closest('fieldset')?.querySelector('legend')?.textContent);
      const item = CONSENT.test(label) ? `read and tick "${label}"` : `decide on "${group || label}"`;
      if (!yourself.includes(item)) yourself.push(item);
      continue;
    }
    if (type === 'radio') {
      const group = nameAttr || el.id;
      if (seenRadio.has(group)) continue;
      seenRadio.add(group);
      const radios = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type=radio][name="${CSS.escape(group)}"]`)).filter(r => !r.disabled && visible(r));
      const id = `c${n++}`;
      const options = radios.map(r => ({ label: labelOf(r), value: r.value, also: also(r) }));
      radios.forEach((r, i) => { r.dataset.copilotId = id; r.dataset.copilotOption = options[i].label; });
      const legend = el.closest('fieldset')?.querySelector('legend');
      const fs = el.closest('fieldset');
      fields.push({ id, tag: 'radio', type, label: clean(legend?.textContent) || group, name: group, required: radios.some(r => r.required), autocomplete: auto, options, ask: fs?.getAttribute('data-copilot-ask') ?? undefined });
      continue;
    }
    const id = `c${n++}`;
    el.dataset.copilotId = id;
    const f: PageField = { id, tag: el.tagName.toLowerCase() as PageField['tag'], type, label, name: nameAttr, required: el.required, autocomplete: auto, ask: el.getAttribute('data-copilot-ask') ?? undefined,
      kind: el.getAttribute('data-copilot-kind') ?? undefined, spell: el.hasAttribute('data-copilot-spell') || undefined };
    if (el instanceof HTMLSelectElement) f.options = Array.from(el.options).filter(o => (o.value !== '' || o.hasAttribute('data-copilot-also')) && !o.disabled).map(o => ({ label: clean(o.textContent), value: o.value, also: also(o) }));
    fields.push(f);
  }
  const form = fields.length ? document.querySelector(`[data-copilot-id="${fields[0].id}"]`)?.closest('form') : null;
  // The visible button: in a multi-step form that is this step's Next, not the final Submit of a hidden step.
  const btn = Array.from((form ?? document).querySelectorAll<HTMLElement>('button[type=submit],input[type=submit],button:not([type])')).find(visible);
  if (btn) btn.dataset.copilotSubmit = '1';
  return { fields, yourself, submit: btn ? clean(btn.textContent || (btn as HTMLInputElement).value) || 'Submit' : 'Submit' };
}

export async function readForm(page: Page): Promise<PageForm> {
  return page.evaluate(readInPage);
}

const or = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);

// Turns the fields into a Flow. Kinds and questions are written by code from the page, not by a model.
export function flowFromPage(form: PageForm, opts: { business: string; id?: string }): Flow {
  const fields: Field[] = form.fields.map(p => ({ ...field(p), ...(p.required ? {} : { optional: true }), ...(p.spell ? { spell: true } : {}) }));
  function field(p: PageField): Field {
    const label = p.label || p.name;
    const low = label.toLowerCase().replace(/^your\s+/, ''); // "Your name" -> "What's your name?", not "your your name"
    const ask = p.ask || (/\?$/.test(label) ? label : '');
    if (p.options) {
      const names = p.options.map(o => o.label);
      const synonyms = Object.fromEntries(p.options.filter(o => o.also?.length).map(o => [o.label, o.also!]));
      // A long list (a whole staff) is not read out; an ask of its own sentences ("…? Say none if not.") is kept whole.
      const question = names.length > 8 ? (ask ? ask.replace(/([^.?!])$/, '$1?') : `Which ${low}?`)
        : ask && /[.?!]\s/.test(ask) ? `${ask} You can say ${or(names)}.`
        : `${ask ? ask.replace(/\?$/, "") : `Which ${low}`}: ${or(names)}?`;
      return { name: p.id, label: low, kind: 'choice', options: names, synonyms, question };
    }
    // data-copilot-kind="future": a date from today on; otherwise a date in the past (a notice date, a date of birth)
    if (p.type === 'date')
      return { name: p.id, label: low, kind: p.kind === 'future' ? 'when' : 'date', question: ask || `What's the ${low}?` };
    if (p.kind === 'code')
      return { name: p.id, label: low, kind: 'code', question: ask || `What's the ${low}? You can read it out letter by letter.` };
    if (/\bserial\b/.test(low))
      return { name: p.id, label: low, kind: 'serial', question: ask || `What's the ${low}? You can read it out letter by letter.` };
    if (p.type === 'email' || p.autocomplete === 'email' || /\be-?mail\b/.test(low))
      return { name: p.id, label: low, kind: 'email', question: ask || "What's your email address? You can say it like name at example dot com." };
    if (p.type === 'tel' || p.autocomplete.startsWith('tel') || /\b(phone|mobile|telephone)\b/.test(low))
      return { name: p.id, label: low, kind: 'phone', question: ask || "What's your phone number?" };
    if (['name', 'given-name', 'family-name'].includes(p.autocomplete) || (/\bname$/.test(low) && !/\b(company|business|user|organi[sz]ation|product|pet|file|street|account|domain)\b/.test(low)))
      return { name: p.id, label: low, kind: 'name', question: ask || `What's your ${low}?` };
    return { name: p.id, label: low, kind: 'text', question: ask || `What should I put for ${low}?` };
  }
  const todo = form.yourself.length ? ` Before you do, please ${or(form.yourself)} yourself.` : '';
  return {
    id: opts.id ?? 'page-form',
    business: opts.business,
    intro: `Hi, I can help you fill in this ${opts.business} form. I'll type your answers in, and you press ${form.submit} yourself at the end.`,
    scope: 'I can only help you fill in this form here.',
    reviewAsk: `Is that all correct? Say yes and I'll hand it back to you to press ${form.submit}, or tell me what to change.`,
    doneMessage: `Everything is filled in. Please check the page and press ${form.submit} yourself.${todo}`,
    fields,
  };
}

// Engine hooks for a page: type each confirmed answer in, reject what the page itself rejects, never submit.
export class PageFiller implements Hooks {
  handedBack = false;
  private page: Page;
  private form: PageForm;
  constructor(page: Page, form: PageForm) {
    this.page = page;
    this.form = form;
  }

  // The page's own check (pattern, type, length) on a copy of the box, so nothing is typed in before the yes.
  async check(field: Field, value: string): Promise<string | void> {
    const p = this.form.fields.find(x => x.id === field.name);
    if (!p || p.tag === 'radio' || p.tag === 'select') return;
    const msg = await this.page.$eval(`[data-copilot-id="${p.id}"]`, (el, v) => {
      const c = el.cloneNode() as HTMLInputElement;
      c.value = v;
      // minlength is only enforced on text a person typed, so a copy given a value passes it: check it here.
      const min = (el as HTMLInputElement).minLength;
      if (min > 0 && v.length < min) return `Please lengthen this text to ${min} characters or more (you are currently using ${v.length} characters).`;
      return c.checkValidity() ? '' : c.validationMessage;
    }, value);
    if (msg) return `The page didn't accept that: ${msg.replace(/\s+/g, ' ').trim()}`;
  }

  async fill(field: Field, value: string): Promise<string | void> {
    const p = this.form.fields.find(x => x.id === field.name);
    if (!p) return "I can't find that box on the page any more.";
    const sel = `[data-copilot-id="${p.id}"]`;
    if (p.tag === 'radio') {
      await this.page.check(`${sel}[data-copilot-option="${value.replace(/"/g, '\\"')}"]`);
      return;
    }
    if (p.tag === 'select') {
      const opt = p.options!.find(o => o.label === value)!;
      await this.page.selectOption(sel, opt.value);
      return;
    }
    await this.page.fill(sel, value);
    const msg = await this.page.$eval(sel, el => ((el as HTMLInputElement).checkValidity() ? '' : (el as HTMLInputElement).validationMessage));
    if (msg) {
      await this.page.fill(sel, '');
      return `The page didn't accept that: ${msg.replace(/\s+$/, '')}`;
    }
  }

  // Never clicks. Points at the button so the person can check the page and press it.
  async submit(): Promise<void> {
    this.handedBack = true;
    await this.page.evaluate(() => {
      const b = document.querySelector<HTMLElement>('[data-copilot-submit]');
      if (b) { b.style.outline = '3px solid #e8a400'; b.style.outlineOffset = '3px'; b.scrollIntoView({ block: 'center' }); }
    });
  }
}
