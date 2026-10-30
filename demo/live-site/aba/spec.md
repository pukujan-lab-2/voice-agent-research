# Website Copilot: marketing site and five live demo websites

## What this is

A public demo of **Website Copilot**: a voice assistant that a business adds to the website it already has. A
visitor taps **Start voice call**, the copilot asks for each form field in plain words, one question at a time, types
each answer into the real form only after the visitor confirms it, answers questions from the business's own manual
(with page numbers) or says "I don't know", and **never presses Submit**: the visitor checks the page and presses the
button themself.

The app has two parts on one site:

1. **A marketing landing page** at `/` that sells the idea, shows the concept video, and sends people into the demos.
2. **Five fictional company websites**, each a believable, well-made normal website (navigation, search, content
   pages, help pages and one real form). On each site the same task can be done two ways: by hand, like any website,
   or with the copilot through a voice call. The comparison must feel fair: the sites are good websites, not
   deliberately bad ones.

Every company, person, product and document is made up. Nothing a visitor types is ever sent anywhere: every form
ends on a "Demo: nothing was sent" page.

Who uses it: prospective customers of Website Copilot, mostly on a phone, opening a link from a message, and some on a
laptop. It must be excellent on a phone first.

## Design direction

The current version was called "awful": plain, generic, cramped, and the call panel felt bolted on. This version must
look like a polished product.

- **Marketing page**: modern, confident and calm. Generous whitespace, a strong headline, a soft gradient or subtle
  pattern, one accent colour (deep violet, around `#4c3bcf`) on a near-white background, rounded cards, real
  typography hierarchy. Light theme. Sections: hero with headline + two buttons ("View the live demos", "Watch the
  concept video"); the concept video; "Safe by design" (four short points); "How it works" (three steps); "Try it live"
  with five demo cards; a short footer. Each demo card has an icon, the company name, one line on what to try, and a
  **View demo** button.
- **Each fictional company site** has its own brand: its own name, logo mark (made with an icon and text, no image
  files), colour palette and tone, as if five different companies built them. Each looks like a credible small-business
  site from 2026: clear header with logo, navigation and search; a hero on its home page; content cards; a footer.
  Suggested palettes: clinic soft teal and warm white; appliances graphite and orange; web studio near-black and lime;
  IT desk navy and sky blue; pension fund forest green and cream, with larger text (its visitors are older).
- **The call panel** is the star. It must feel like a modern voice call, not a chat box:
  - Before a call: a floating bar at the bottom of form pages with a prominent green **Start voice call** button (phone
    icon) and a quieter **Type instead** button.
  - During a call: on a phone, a bottom sheet (rounded top, drag-handle look, at most about 60% of the screen height)
    with a minimise control; on a laptop, a floating card at the bottom right, about 400px wide.
  - A header with the company name, a one-line promise ("Fills only what you confirm. Never presses Submit.") and a
    live status: Listening (animated mic or sound bars), Speaking (animated), Thinking (spinner), Mic off, Text chat.
  - Small chips listing what this copilot can do on this page.
  - When the page offers both, two tabs: "Fill the form with me" and "Walk me through".
  - The conversation as message bubbles (copilot left, visitor right). Page citations in copilot messages, like
    "(page 6)", are links that open the manual at that page in a new tab.
  - What the mic is hearing right now, shown live in light italic text.
  - Controls: a large mic toggle ("Tap to talk" / "Mute"), "Keyboard" (switch to typing), and a red **End** button.
    A text box with a Send button when typing.
  - A tiny footnote: "Fictional demo. Voice uses your browser's own speech service."
  - The form field the copilot is asking about is marked by the copilot with the attribute `data-copilot-active`; give
    it a clear, soft glow ring in the site's accent colour.
- Phone first: works from 360px wide to large desktop, never scrolls sideways, every tap target at least 44px, form
  inputs at least 16px text (no zoom on iPhone), safe-area insets respected. While a call is open on a phone, the page
  scrolls above the sheet, and the form's own submit button can still be reached.
- Accessible: real labels, visible focus, `aria-live` on the conversation, good contrast.

## Pages

Every page except `/` shows a slim **demo banner** at the very top: "**Demo, fictional company.** This business, its
people and its documents are made up. Nothing you type is sent anywhere." Every page carries
`<meta name="robots" content="noindex, nofollow">`.

### Marketing: `/`

The landing page described above. The concept video:

- Landscape on wide screens: `/media/copilot-demo-720p.mp4`, poster `/media/copilot-demo-720p.jpg`.
- Vertical on phones held upright: `/media/copilot-demo-vertical-720p.mp4`, poster `/media/copilot-demo-vertical-720p.jpg`.
- Controls, `playsinline`, `preload="none"`, no autoplay. A small "Concept video" tag and the caption: "A scripted
  concept video: five fictional people on five fictional websites, first without and then with a copilot. The live
  demos below are the real thing." These files are served by the host at those paths; they are not part of the app.

The five demo cards link to (each with `?guest=1`): `/clinic/book?guest=1`, `/appliance/support?guest=1`,
`/pricing/quote?guest=1`, `/itdesk/new?guest=1`, `/pension/forms/r17?guest=1`. "Safe by design" points: Fills only
what you confirm; Never presses Submit; Answers from your documents (quotes your own manual with the page number, or
says "I don't know"); Your data stays in house. Footer: "Website Copilot, a concept by Design Bakery. The video is a
scripted concept; the demos are live."

### Guest entry

There is no real sign-in and no password field anywhere. The form pages (`/clinic/book`, `/appliance/support`,
`/pricing/quote`, `/itdesk/new`, `/pension/forms/r17`) need a guest session: without one they show a friendly card
"Sign in to continue" with one button **Continue as guest** (`data-testid="guest-enter"`), which remembers the guest in
the browser and shows the page. Opening any page with `?guest=1` enters as guest straight away. The header shows
"Guest" and a **Leave** link that forgets the guest.

### The five sites

Each site has a home page, a header with its navigation and a search box (searching that site's own pages by title and
keywords, results in a dropdown), believable content, and the form page. Use the names and facts below exactly; the
copilot's manuals depend on them.

1. **Tumbleberry Children's Clinic** (paediatric clinic). `/clinic` home (opening hours, services, "Book a visit"
   call to action), `/clinic/doctors` (Dr. Amara Okafor, Dr. Henrik Lind, short bios), `/clinic/help` (FAQ: what to
   bring, cancelling, vaccinations), `/clinic/book` the **booking form** (three steps).
2. **Kettlewisp Appliances** (HDW-500 dishwasher support). `/appliance` home (product support hub),
   `/appliance/manuals` (links to the HDW-500 manual at `/docs/hdw500-manual.html`), `/appliance/help` (error code table:
   E11 water comes in too slowly; E15 leak; E24 water not draining, clean the filter and check the drain hose; E25
   drain pump blocked; E09 heater fault), `/appliance/support` the **service request form**, with a short "Error E24?
   Try the fix first" panel above it.
3. **Larchmoss Studio** (small web design studio). `/pricing` plans page (Starter $900, Growth $2,400 with booking and
   payments, Scale $6,500), `/pricing/faq`, `/pricing/quote` the **quote request form**.
4. **Cobblefin IT Desk** (internal IT help desk). `/itdesk` home (service status, popular articles), `/itdesk/kb`
   (knowledge base: VPN, password reset, printers), `/itdesk/new` the **new ticket form**.
5. **Saltmere Pension Fund**. `/pension` home, `/pension/forms` (list of forms; R-17 "Beneficiary nomination" opens
   the form), `/pension/help`, `/pension/forms/r17` the **form R-17**, with a link to the guide
   `/docs/r17-guide.html`. Larger text on this site.

`/docs/hdw500-manual.html` and `/docs/r17-guide.html` are served by the host, not by the app: link to them with plain
links that open in a new tab.

### The "sent" page: `/sent`

Every form's submit button, when the visitor presses it and the form is valid, goes to `/sent`, which shows a heading
with exactly the text `Demo: nothing was sent` (element id `sent`), a line explaining that this demo keeps everything in
the browser, and links back to the site and to `/`. No form ever sends data anywhere: no POST, no network call.

## Copilot contract: non-negotiable

The copilot is a separate script that reads and fills the page's real DOM, and an end-to-end test drives it through
the app. The look is yours to design; these points are not. A previous build looked good but broke three of them, and
the copilot stopped working:

1. **Forms render the exact markup below**: every `id`, `name`, option `value`, `required`/`pattern`, label and
   `data-copilot-*` attribute, as native elements. Don't rename, merge or wrap fields in custom components.
2. **Steps are hidden with the HTML `hidden` attribute**, not a CSS class and not conditional rendering. In React:
   `<fieldset data-step hidden={step !== 2} disabled={step !== 2}>`. All three clinic fieldsets are always in the DOM.
   The copilot finds the current step with `fieldset[data-step]:not([hidden])`. A Tailwind `className="hidden"` breaks
   it. (Tailwind's preflight already hides `[hidden]` elements.)
3. **Each step's Next is a `<button type="submit">` inside its own fieldset.** The form's `onSubmit` calls
   `preventDefault()`. If the current step isn't the last, it checks that step's fields with the browser's own
   validation (`fieldset.querySelectorAll('input,select,textarea')` and `reportValidity()`) and moves to the next step.
   On the last step, or on single-step forms, it navigates to `/sent` when the form is valid. It never sends anything.
4. **The app never submits for the visitor, and never calls `/api/*` itself.** Only the copilot script talks to the
   backend.
5. **Every test id in "Test hooks" is rendered.** `call-status` is always shown in the open panel. `call-mode-form`
   and `call-mode-guide` are the two tabs, shown when `snapshot.modes` has both.
6. **`useSyncExternalStore` needs a stable snapshot.** Pass `window.copilot.getSnapshot` directly once the copilot is
   ready. Before that, return one module-level constant (for example `const EMPTY = {...}` defined once), never a new
   object literal per call: React loops forever on that.
7. **`index.html` loads `<script type="module" src="/copilot/sdk.js"></script>`**, and the app waits for
   `window.copilot` or the `copilot:ready` event before mounting.

Include this check as `scripts/check-copilot-contract.mjs`, exactly as written, and make the app's `build` script run it
after the Vite build: `"build": "vite build && node scripts/check-copilot-contract.mjs"`. If it fails, fix the app, not
the check.

```js
// Fails the build when the app breaks the copilot contract (see the spec, "Copilot contract: non-negotiable").
import fs from 'node:fs';
import path from 'node:path';
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p); } };
walk('src');
const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const errors = [];
const testids = ['call-start', 'call-type', 'call-panel', 'call-input', 'call-send', 'call-message', 'call-mic', 'call-keyboard', 'call-end', 'call-mode-form', 'call-mode-guide', 'call-status', 'demo-banner', 'guest-enter'];
for (const t of testids) if (!src.includes(`"${t}"`)) errors.push(`missing data-testid "${t}"`);
const ids = ['child', 'visit', 'tod_am', 'tod_pm', 'slot', 'parent', 'phone', 'email', 'remind', 'serial', 'code', 'name', 'what', 'biz', 'contact', 'p1', 'p2', 'p3', 'budget', 'needs', 'cat', 'svc', 'asset', 'i1', 'i2', 'i3', 'urg', 'desc', 'member', 'bfirst', 'blast', 'share', 't1', 't2', 'replace'];
for (const id of ids) if (!new RegExp(`id=["{]['"]?${id}['"]?`).test(src)) errors.push(`missing form field id="${id}"`);
if (!src.includes('data-copilot-form')) errors.push('no form carries data-copilot-form');
const steps = src.match(/<fieldset[^>]*data-step[^>]*>/g) ?? [];
if (steps.length < 3) errors.push('the clinic form needs three <fieldset data-step> elements');
for (const tag of steps) {
  if (/className=[^>]*\bhidden\b/.test(tag)) errors.push(`step hidden with a CSS class, use the hidden attribute: ${tag.replace(/\s+/g, ' ')}`);
}
if (steps.length >= 3 && steps.filter(t => /\shidden=\{/.test(t)).length < 3) errors.push('every <fieldset data-step> needs hidden={...} and disabled={...}');
if (/fetch\(\s*[`'"][^`'"]*\/api\//.test(src)) errors.push('the app calls /api itself; only the copilot script may');
if (!fs.readFileSync('index.html', 'utf8').includes('/copilot/sdk.js')) errors.push('index.html does not load /copilot/sdk.js');
if (/useSyncExternalStore[\s\S]{0,400}\?\?\s*\{/.test(src)) errors.push('useSyncExternalStore getSnapshot falls back to a new object literal; use one constant');
if (errors.length) { console.error('copilot contract check failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('copilot contract check passed');
```

## The forms: exact markup the copilot reads

The copilot reads the form from the page itself, so each form must render **exactly these fields**: the same `id`,
`name`, `type`, option `value`s, `required`, `pattern`, `min`/`max`/`minlength`, labels (`<label for>`, or `<legend>`
for radio groups) and every `data-copilot-*` attribute, as native `<form>`, `<input>`, `<select>`, `<textarea>`
elements (not custom dropdown or radio components). Style them freely with the site's look. Rules:

- The `<form>` carries `data-copilot-form`. Only one such form per page.
- The copilot fills a field the way browser autofill does: it sets the element's value and fires `input` and `change`
  events (radios: it clicks them). So read the values with `FormData` on submit (uncontrolled inputs), or keep any
  React state in sync from those events.
- Validation is the browser's own (`required`, `pattern`), so the copilot can see the page's own error messages.
- The clinic form has three steps. All three `fieldset[data-step]` stay in the page; only the current one is visible.
  The others carry the `hidden` attribute **and** `disabled`. Pressing Next (a submit button inside the step) validates
  that step, then hides and disables it and shows and enables the next. The last step's button submits the whole form.
  A step indicator shows "1 · Your child", "2 · Time", "3 · Contact".
- Each form page passes a config to the copilot (see "The copilot") when it is on screen.

Clinic, `/clinic/book`:

```html
<form data-copilot-form id="book" autocomplete="off">
  <fieldset data-step>
    <label for="child">Child's full name</label>
    <input id="child" name="child" required data-copilot-ask="What's your child's full name?">
    <label for="visit">Type of visit</label>
    <select id="visit" name="visit" required data-copilot-ask="What kind of visit is it">
      <option value="">Choose one</option>
      <option value="wellchild" data-copilot-also="checkup, check-up, check up, well child">Well-child checkup</option>
      <option value="sick" data-copilot-also="sick, ill, fever, cough">Sick visit</option>
      <option value="vacc" data-copilot-also="vaccine, shot, shots, jab">Vaccination</option>
    </select>
    <button type="submit">Next</button>
  </fieldset>
  <fieldset data-step hidden disabled>
    <fieldset data-copilot-ask="Mornings or afternoons?">
      <legend>Time of day</legend>
      <input type="radio" id="tod_am" name="tod" value="am" required><label for="tod_am">Morning</label>
      <input type="radio" id="tod_pm" name="tod" value="pm"><label for="tod_pm">Afternoon</label>
    </fieldset>
    <label for="slot">Open slot</label>
    <select id="slot" name="slot" required data-copilot-ask="Which day suits you">
      <option value="">Choose a slot</option>
      <option value="tue0940" data-copilot-also="Tuesday, Tue">Tuesday 9:40 AM, Dr. Okafor</option>
      <option value="wed1020" data-copilot-also="Wednesday, Wed">Wednesday 10:20 AM, Dr. Lind</option>
      <option value="thu1415" data-copilot-also="Thursday, Thu">Thursday 2:15 PM, Dr. Okafor</option>
      <option value="fri1530" data-copilot-also="Friday, Fri">Friday 3:30 PM, Dr. Lind</option>
    </select>
    <button type="submit">Next</button>
  </fieldset>
  <fieldset data-step hidden disabled>
    <label for="parent">Parent or guardian name</label>
    <input id="parent" name="parent" autocomplete="off" required data-copilot-ask="And what's your name, as the parent or guardian?">
    <label for="phone">Mobile phone</label>
    <input id="phone" name="phone" type="tel" required placeholder="made up, for the demo">
    <label for="email">Email</label>
    <input id="email" name="email" type="email" required placeholder="made up, for the demo">
    <input type="checkbox" id="remind" name="remind"><label for="remind">Text me a reminder the day before</label>
    <button type="submit">Book visit</button>
  </fieldset>
</form>
```

Config: `{ "business": "Tumbleberry Children's Clinic", "form": "booking", "can": ["Fill in this booking form with you", "Read back phone and email", "You press Next and Book yourself"] }`

Appliance, `/appliance/support`:

```html
<form data-copilot-form id="service" autocomplete="off">
  <label for="serial">Serial number</label>
  <input id="serial" name="serial" required pattern="[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}" placeholder="1334-592C-LSD3"
    data-copilot-ask="Can you read me the serial number? It's on a silver sticker on the right edge of the inner door.">
  <p>On the silver sticker on the right edge of the inner door (manual page 1).</p>
  <label for="code">Error code</label>
  <select id="code" name="code" required data-copilot-ask="Which error code does the display show">
    <option value="">Choose one</option>
    <option value="E11" data-copilot-also="E11, E 11">E11: water comes in too slowly</option>
    <option value="E15" data-copilot-also="E15, E 15">E15: leak</option>
    <option value="E24" data-copilot-also="E24, E 24, twenty four, twenty-four">E24: water not draining</option>
    <option value="E25" data-copilot-also="E25, E 25">E25: drain pump blocked</option>
    <option value="E09" data-copilot-also="E09, E9">E09: heater fault</option>
  </select>
  <label for="name">Your name</label>
  <input id="name" name="name" required>
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required placeholder="made up, for the demo">
  <label for="what">What happened?</label>
  <textarea id="what" name="what" minlength="10" required></textarea>
  <button type="submit">Request visit</button>
</form>
```

Config:

```json
{ "business": "Kettlewisp Appliances", "form": "service request",
  "can": ["Walk you through the E24 fix", "Answer from the HDW-500 manual, with pages", "Fill the service request with you"],
  "manual": { "label": "demo-hdw500", "title": "Fixing error E24 (water not draining)", "doc": "/docs/hdw500-manual.html",
    "steps": [
      { "n": 1, "page": 7, "text": "Press and hold Start for 3 seconds to cancel the program. Wait 10 minutes for the water to cool." },
      { "n": 2, "page": 7, "text": "Turn the dishwasher off at the wall switch." },
      { "n": 3, "page": 7, "text": "Pull out the bottom rack and lay a towel in front of the dishwasher." },
      { "n": 4, "page": 7, "text": "Turn the filter a quarter turn to the left, lift it out and rinse it under warm water." },
      { "n": 5, "page": 7, "text": "Check behind the dishwasher that the drain hose is not kinked or squashed." },
      { "n": 6, "page": 7, "text": "Put the filter back until it clicks, turn the power on and run the Rinse program." } ] } }
```

Pricing, `/pricing/quote`:

```html
<form data-copilot-form id="quote" autocomplete="off">
  <label for="biz">Business name</label>
  <input id="biz" name="biz" required data-copilot-ask="What's your business called?">
  <label for="contact">Your name</label>
  <input id="contact" name="contact" required>
  <label for="email">Email</label>
  <input id="email" name="email" type="email" required placeholder="made up, for the demo">
  <fieldset data-copilot-ask="Which plan would you like">
    <legend>Plan</legend>
    <input type="radio" id="p1" name="plan" value="starter" required><label for="p1">Starter</label>
    <input type="radio" id="p2" name="plan" value="growth" data-copilot-also="booking, payments"><label for="p2">Growth</label>
    <input type="radio" id="p3" name="plan" value="scale"><label for="p3">Scale</label>
  </fieldset>
  <label for="budget">Budget</label>
  <select id="budget" name="budget" required data-copilot-ask="Roughly what budget do you have">
    <option value="">Choose one</option>
    <option value="lt1k" data-copilot-also="under a thousand, less than a thousand">Under $1,000</option>
    <option value="1to3k" data-copilot-also="three thousand, 3000, 3,000, two thousand, 2000, 2,000">$1,000 to $3,000</option>
    <option value="3to7k" data-copilot-also="five thousand, 5000, 5,000">$3,000 to $7,000</option>
    <option value="gt7k" data-copilot-also="ten thousand, more than seven thousand">Over $7,000</option>
  </select>
  <label for="needs">What do you need?</label>
  <textarea id="needs" name="needs" minlength="10" required></textarea>
  <button type="submit">Request a quote</button>
</form>
```

Config: `{ "business": "Larchmoss Studio", "form": "quote request", "can": ["Fill the quote request with you", "Read back your email", "You press Request a quote yourself"] }`

IT desk, `/itdesk/new`:

```html
<form data-copilot-form id="ticket" autocomplete="off">
  <label for="cat">Category</label>
  <select id="cat" name="cat" required data-copilot-ask="What kind of problem is it">
    <option value="">Choose one</option>
    <option value="net" data-copilot-also="vpn, wifi, wi-fi, internet">Network</option>
    <option value="hw" data-copilot-also="laptop, screen, keyboard, printer">Hardware</option>
    <option value="sw" data-copilot-also="app, program">Software</option>
    <option value="acct" data-copilot-also="password, login, locked out">Accounts and access</option>
  </select>
  <label for="svc">Affected service</label>
  <select id="svc" name="svc" required data-copilot-ask="Which service is affected">
    <option value="">Choose one</option>
    <option value="vpn" data-copilot-also="vpn, remote">VPN and remote access</option>
    <option value="mail" data-copilot-also="mail, outlook">Email</option>
    <option value="wifi" data-copilot-also="wifi, wi-fi, wireless">Office Wi-Fi</option>
    <option value="print" data-copilot-also="printer, printing">Printing</option>
  </select>
  <label for="asset">Asset tag</label>
  <input id="asset" name="asset" required pattern="CF-[0-9]{4}" title="Like CF-1234"
    data-copilot-ask="What's the asset tag on your laptop? It looks like CF and four digits.">
  <p>On the sticker under your laptop, like CF-1234.</p>
  <fieldset data-copilot-ask="Who is affected">
    <legend>Impact</legend>
    <input type="radio" id="i1" name="impact" value="me" required data-copilot-also="only me, just me"><label for="i1">Just me</label>
    <input type="radio" id="i2" name="impact" value="team" data-copilot-also="my team, whole team"><label for="i2">My team</label>
    <input type="radio" id="i3" name="impact" value="office" data-copilot-also="everyone, whole office"><label for="i3">Whole office</label>
  </fieldset>
  <label for="urg">Urgency</label>
  <select id="urg" name="urg" required data-copilot-ask="How urgent is it">
    <option value="">Choose one</option>
    <option value="low" data-copilot-also="not urgent, whenever">Low</option>
    <option value="med" data-copilot-also="today, sometime today">Medium</option>
    <option value="high" data-copilot-also="urgent, asap, blocked">High</option>
  </select>
  <label for="desc">Describe the problem</label>
  <textarea id="desc" name="desc" minlength="10" required data-copilot-ask="In a sentence, what's going wrong?"></textarea>
  <label for="email">Your work email</label>
  <input id="email" name="email" type="email" required placeholder="made up, for the demo">
  <button type="submit">Submit ticket</button>
</form>
```

Config: `{ "business": "Cobblefin IT Desk", "form": "ticket", "can": ["File this ticket with you", "Explain the fields", "You press Submit ticket yourself"] }`

Pension, `/pension/forms/r17`:

```html
<form data-copilot-form id="r17" autocomplete="off">
  <h2>Section A: your details</h2>
  <label for="member">Member number</label>
  <input id="member" name="member" required pattern="SPF-[0-9]{6}" title="Like SPF-123456"
    data-copilot-ask="What's your member number? It starts with SPF and has six digits.">
  <h2>Section B: beneficiary</h2>
  <label for="bfirst">Beneficiary first name</label>
  <input id="bfirst" name="bfirst" required data-copilot-ask="What's the beneficiary's first name?">
  <label for="blast">Beneficiary last name</label>
  <input id="blast" name="blast" required data-copilot-ask="And their last name?">
  <label for="code">Payee code</label>
  <p>See Schedule B, §4(c).</p>
  <select id="code" name="code" required data-copilot-ask="How is this person related to you">
    <option value="">Choose one</option>
    <option value="C" data-copilot-also="child, son, daughter, stepson, stepdaughter">C · Child</option>
    <option value="S" data-copilot-also="spouse, wife, husband, partner">S · Spouse or civil partner</option>
    <option value="P" data-copilot-also="parent, mother, father, mom, dad">P · Parent</option>
    <option value="B" data-copilot-also="brother, sister, sibling">B · Brother or sister</option>
    <option value="O" data-copilot-also="friend, other person, niece, nephew">O · Other person</option>
  </select>
  <label for="share">Share (percent)</label>
  <input id="share" name="share" type="number" min="1" max="100" required data-copilot-ask="What share should they get, in percent?">
  <fieldset data-copilot-ask="Is this a primary or a contingent beneficiary">
    <legend>Beneficiary type</legend>
    <input type="radio" id="t1" name="btype" value="primary" required><label for="t1">Primary</label>
    <input type="radio" id="t2" name="btype" value="contingent"><label for="t2">Contingent</label>
  </fieldset>
  <input type="checkbox" id="replace" name="replace" required><label for="replace">I agree this form replaces every earlier R-17</label>
  <button type="submit">Submit form R-17</button>
</form>
```

Config:

```json
{ "business": "Saltmere Pension Fund", "form": "R-17", "large": true,
  "can": ["Fill form R-17 with you, one step at a time", "Answer from the R-17 guide, with pages", "You press Submit yourself"],
  "manual": { "label": "demo-r17", "title": "Filling in form R-17", "doc": "/docs/r17-guide.html",
    "steps": [
      { "n": 1, "page": 2, "text": "Find your member number on your annual statement. It starts with SPF." },
      { "n": 2, "page": 2, "text": "Decide who your primary beneficiaries are and what share each gets. The shares must add up to 100 percent." },
      { "n": 3, "page": 3, "text": "For each beneficiary, pick the payee code that says how they are related to you." },
      { "n": 4, "page": 4, "text": "Sign Section C in front of one witness who is 18 or older and not a beneficiary." } ] } }
```

## The copilot: what the app draws, and what it calls

The copilot's brain is **not part of this app**. The host serves it as one script at `/copilot/sdk.js` (an ES
module). The app loads it from `index.html` with `<script type="module" src="/copilot/sdk.js"></script>`. It defines
`window.copilot` and then fires a `copilot:ready` event on `window`. The app draws the call panel and drives it only
through this API; it never makes the copilot's decisions itself and never calls the copilot's backend directly.

```ts
interface Copilot {
  mount(config: Config): void;        // on a form page, after the form is on screen
  unmount(): void;                    // when leaving that page
  start(opts: { voice: boolean }): void;  // call it inside the tap handler: Start voice call → true, Type instead → false
  send(text: string): void;           // a typed message
  toggleMic(): void;                  // inside the tap handler of the mic button
  setMode(mode: 'form' | 'guide'): void;  // the two tabs
  setCovered(px: number): void;       // how many px at the bottom of the window the panel covers (update when it resizes)
  end(): void;                        // the End button
  subscribe(fn: () => void): () => void;  // returns unsubscribe; use with React's useSyncExternalStore
  getSnapshot(): Snapshot;            // the same object until something changes
}
type Config = { business: string; form?: string; can?: string[]; large?: boolean;
  manual?: { label: string; title: string; doc?: string; steps: { n: number; page?: number; text: string }[] } };
type Snapshot = {
  mounted: boolean;
  open: boolean;                      // a call is on: show the panel instead of the bar
  voice: boolean;
  mic: 'on' | 'off' | 'unavailable';  // mic button: on → "Mute", off → "Tap to talk", unavailable → disabled "No mic"
  textInput: boolean;                 // show the text box
  status: 'idle' | 'speaking' | 'listening' | 'thinking' | 'muted' | 'text';
  busy: boolean;
  heard: string;                      // live transcript
  mode: 'form' | 'guide';
  modes: ('form' | 'guide')[];        // show the tabs only when there are two
  business: string; can: string[]; large: boolean;
  messages: { id: number; who: 'bot' | 'user'; text: string; links: { page: number; href: string }[] }[];
};
```

In copilot messages, turn each "(page N)" into a link to the matching `links` entry's `href` (new tab). When `large`
is true, use larger text in the panel.

So the preview works while the app is being built, include a small stand-in at `public/copilot/sdk.js` that
implements this same API with canned replies (it says it is a preview stand-in and fills nothing). The host replaces
that file with the real one at the same path when it deploys, so the app must not depend on anything else from it.

The host also serves the copilot's backend on the same origin. The app does not call it, but must not shadow these
paths: `POST /api/understand`, `POST /api/search`, `POST /api/judge`, `POST /api/sentences`, `POST /api/log`,
`GET /api/health`, plus `/copilot/*`, `/docs/*` and `/media/*`. The host serves the app's `index.html` for every other
path, so client-side routes work on reload.

## Test hooks

The panel and pages carry these `data-testid`s (end-to-end tests drive the real copilot through them):

- `call-start` (Start voice call), `call-type` (Type instead), `call-panel` (the open panel; it also carries
  `data-busy="true"` while the snapshot is busy), `call-input` (the text box), `call-send`, `call-message` (each
  message bubble, with `data-who="bot"` or `data-who="user"`), `call-mic`, `call-keyboard`, `call-end`,
  `call-mode-form`, `call-mode-guide`, `call-status`.
- `demo-banner` (the banner), `guest-enter` (Continue as guest).

```aba-contract
testids: call-start, call-type, call-panel, call-input, call-send, call-message, call-mic, call-keyboard, call-end, call-mode-form, call-mode-guide, call-status, demo-banner, guest-enter
```

## Done means

- `/` is a polished marketing page with the video and five working **View demo** buttons.
- The five sites each look like a different real company, with working navigation, search and content pages.
- Each form page renders its form exactly as specified, mounts the copilot with its config, and offers **Start voice
  call** and **Type instead**; the panel shows the conversation, live status, the mic/keyboard/end controls, and the
  tabs where there is a manual.
- Pressing a valid form's own submit button lands on `/sent` with "Demo: nothing was sent", and nothing is sent.
- It looks right and works at 375px, 768px and 1280px wide.
- `npm run build` passes, including `scripts/check-copilot-contract.mjs`.
- The host's end-to-end test passes. It opens each form page with `?guest=1`, presses **Type instead**, types answers
  into `call-input` and presses `call-send`, and checks that the copilot fills the fields. On the clinic form it presses
  the visible step's Next (`fieldset[data-step]:not([hidden]) button[type=submit]`) and expects the copilot to carry on
  with the next step. At the end it presses the form's own submit button and expects `/sent`. In a voice call it
  presses `call-start`; `call-end` closes the panel.

