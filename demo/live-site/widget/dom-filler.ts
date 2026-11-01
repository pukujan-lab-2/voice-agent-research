// The page adapter's hooks for a copilot that lives inside the page: the same rules as PageFiller (type each confirmed
// answer in, give back the page's own validation message, never submit), done with the DOM instead of Playwright.
import type { PageForm } from '../../../copilot-engine/src/page.ts';
import type { Field, Hooks } from '../../../copilot-engine/src/types.ts';

type Box = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

// Sets a value the way typing would, so pages built with frameworks that watch input events see it too.
function setValue(el: Box, value: string) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value')?.set;
  if (setter) setter.call(el, value); else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

// The desk writes a phone number as 555-010-4422; a page box that takes digits only gets 5550104422 instead.
const accepted = (el: Box, field: Field, value: string): string => {
  if (field.kind !== 'phone') return value;
  const c = el.cloneNode() as Box;
  c.value = value;
  return c.checkValidity() ? value : value.replace(/\D/g, '');
};

export class DomFiller implements Hooks {
  handedBack = false;
  private form: PageForm;
  constructor(form: PageForm) { this.form = form; }

  // The page's own check (pattern, type, length) on a copy of the box, so nothing is typed in before the yes.
  check(field: Field, value: string): string | void {
    const p = this.form.fields.find(x => x.id === field.name);
    if (!p || p.tag === 'radio' || p.tag === 'select') return;
    const el = document.querySelector<Box>(`[data-copilot-id="${p.id}"]`);
    if (!el) return;
    value = accepted(el, field, value);
    const c = el.cloneNode() as Box;
    c.value = value;
    // minlength is only enforced on text a person typed, so a copy given a value passes it: check it here.
    const min = (el as HTMLInputElement).minLength;
    if (min > 0 && value.length < min) return `The page didn't accept that: Please lengthen this text to ${min} characters or more (you are currently using ${value.length} characters).`;
    if (!c.checkValidity()) return `The page didn't accept that: ${c.validationMessage.replace(/\s+/g, ' ').trim()}`;
  }

  async fill(field: Field, value: string): Promise<string | void> {
    const p = this.form.fields.find(x => x.id === field.name);
    const gone = "I can't find that box on the page any more.";
    if (!p) return gone;
    const sel = `[data-copilot-id="${p.id}"]`;
    if (p.tag === 'radio') {
      const r = Array.from(document.querySelectorAll<HTMLInputElement>(sel)).find(x => x.dataset.copilotOption === value);
      if (!r) return gone;
      // A click, as a person would: frameworks that track radios through click events see it too.
      if (!r.checked) r.click();
      return;
    }
    const el = document.querySelector<Box>(sel);
    if (!el) return gone;
    if (p.tag === 'select') { setValue(el, p.options!.find(o => o.label === value)?.value ?? ''); return; } // a skipped optional list goes back to its blank choice
    setValue(el, accepted(el, field, value));
    if (!el.checkValidity()) {
      const msg = el.validationMessage.replace(/\s+/g, ' ').trim();
      setValue(el, '');
      return `The page didn't accept that: ${msg}`;
    }
  }

  // Never clicks. Points at the button so the person can check the page and press it.
  submit(): void {
    this.handedBack = true;
    const b = document.querySelector<HTMLElement>('[data-copilot-submit]');
    if (b) { b.style.outline = '3px solid #e8a400'; b.style.outlineOffset = '3px'; b.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }
}
