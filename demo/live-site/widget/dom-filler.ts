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

export class DomFiller implements Hooks {
  handedBack = false;
  private form: PageForm;
  constructor(form: PageForm) { this.form = form; }

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
    if (p.tag === 'select') { setValue(el, p.options!.find(o => o.label === value)!.value); return; }
    setValue(el, value);
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
