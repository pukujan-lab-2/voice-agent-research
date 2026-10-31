# Add a sixth demo site: Brindlewick Tax & Accounting (a fictional firm with a real tax library)

This app already holds the Website Copilot marketing page, five fictional demo sites and the call panel. Keep all of
that exactly as it is: every page, route, form, `data-testid`, the copilot contract, the compact call bar and its
timer, `scripts/check-copilot-contract.mjs` and the `build` script that runs it. This change **adds one complete new
site under `/tax`**, the most realistic of the demos, plus two things the call panel needs for it (a source chip and
a source viewer).

The old `/tax` pages have been removed from `src/pages/tax/` and their routes from `App.tsx`; build the site new.

## What this is, and who sees it

Brindlewick Tax & Accounting is a **fictional** small tax and accounting firm. The firm, its people, prices, address
and phone numbers are made up. Its **Tax Guides** library is real: 296 IRS.gov pages (publications, form
instructions, Tax Topics, the IRS FAQ), which are U.S. government works in the public domain.

The audience is **tax professionals** judging whether a voice assistant could work on their own firm's website. If the
site looks like a toy or a template, the demo fails. It must look and read like a real, well-run, modern private
practice: real copy, real services, a real pricing structure, a believable team and a calm booking flow. Mostly opened
on a phone from a link; also on laptops.

## Design direction

- A polished, modern **private firm**: confident and calm, generous whitespace, strong type hierarchy, real
  photography-free imagery (illustration, subtle patterns, icons), rounded cards, light theme.
- **It must not look like the IRS or any government site.** No eagle, seal or flag, no IRS logo, no government-style
  blue-and-white layout, no ".gov" feel, and never the word "official". The IRS is a *source* the firm quotes, not a
  brand on the page.
- An **original brand**: the wordmark "Brindlewick" with "Tax & Accounting" beneath, a simple logo mark built from
  shapes and type (no image file), and its own palette. Suggested: deep ink green or aubergine as the primary, warm
  sand or ivory background, one warm accent (terracotta or brass). A refined serif for headings and a clean sans for
  text. Avoid navy plus white as the main scheme.
- Phone first: 360px to large desktop, never scrolls sideways, tap targets at least 44px, inputs at least 16px.

## Demo labelling: clear, but tasteful

Nobody may mistake this for a real business, but the labels must not cheapen the look. No red warning boxes.

- **One slim bar pinned to the top of every `/tax` page** (sticky, always visible, also at 375px), in the brand's own
  colours, small type, carrying `data-testid="demo-banner"`. Its text, exactly: "Demo site: Brindlewick is a fictional
  firm built to show a voice assistant. Not a real business. Don't enter real personal or tax information." On narrow
  screens it may wrap to two short lines; it must stay readable and slim.
- The same notice in small, calm type in the footer (`data-testid="tax-disclaimer"`, with the line below), on the
  About page, and just above the intake form.
- The footer also says, once: "Tax guides are IRS.gov publications (U.S. government works, public domain). Not
  affiliated with or endorsed by the IRS. Not tax advice."
- Next to the intake form's button: "Demo: nothing is sent or stored."
- Every `/tax` page sets `document.title` to "<Page> · Brindlewick Tax & Accounting (Demo)". `index.html` keeps
  `<meta name="robots" content="noindex, nofollow">`.
- Phone numbers are 555-01xx only (main line (555) 010-2210), emails are `@example.com`, the address is
  "1180 Larkspur Avenue, Suite 300, Harrow Falls (fictional)". Form placeholders are obviously fake
  ("e.g. Jordan Example", "e.g. (555) 010-0199", "e.g. jordan@example.com").

## Pages and routes

All internal links use client-side routing (`react-router` `Link`/`navigate`), never full page loads: the voice call
lives in the page and must stay connected while the visitor, or the copilot, moves between pages.

- `/tax` **Home**: hero ("Calm, careful tax work for households and small businesses" or better), the services,
  how a first consultation works (three steps), a short testimonial-style quote from a fictional client marked as
  such, an "Ask a tax question" card with six suggested questions (below), and calls to action to book.
- `/tax/services` **Services** overview, and one page per service at `/tax/services/individual-returns`,
  `/tax/services/bookkeeping`, `/tax/services/payroll`, `/tax/services/irs-notices`, `/tax/services/planning`. Each
  has real copy: who it is for, what is included, what to bring, typical timeline, a "from" price, and a Book button.
- `/tax/pricing` **Pricing**: a believable structure (individual returns by complexity, bookkeeping monthly tiers,
  payroll per employee, notice response flat fee, planning hourly), what affects the price, and a short pricing FAQ.
- `/tax/team` **Team**: five fictional people with illustrated SVG avatars (no photos of real people), credentials
  (EA, CPA), focus areas and a line about each. Names: Marisol Ventura-Akande (EA, founder), Desmond Whitlow (CPA),
  Priya Raghunathan (CPA), Tomasz Bielecki (EA), Ada Fairweather (client services).
- `/tax/about` **About this demo**: what the site is (a demo of Website Copilot), that the firm is fictional, where the
  guides come from (IRS.gov, public domain), not affiliated with the IRS, not tax advice, nothing is sent or stored.
- `/tax/guides` **Tax Guides**: the library. Two parts:
  1. **Search the library** (`data-testid="tax-guide-search"`): typing a query (debounced, at least 2 characters)
     calls `GET /api/library/search?q=<query>&limit=10` and lists the matching passages (`data-testid=
     "tax-search-result"`): the title, the snippet, a link to the guide page at the section, and a small "irs.gov"
     link (new tab). This searches all 32,000 passages of the library on the server.
  2. **Browse**: every source from `GET /api/library/docs`, grouped and filterable by kind (Publications, Form
     instructions, Tax Topics, FAQ pages), each a card (`data-testid="tax-guide"`) linking to `/tax/guides/<id>`. A
     small count ("296 guides").
- `/tax/guides/:id` **a guide**: loads `GET /api/library/doc?doc=<id>`, then shows the title, a credit line
  "Source: <source name> (public domain)" with a link "Open original on irs.gov" (new tab), and:
  - `kind: "pdf"` (publications, form instructions): the printed PDF in pdf.js (`<PdfPages url={doc.pdf} …/>` from
    `src/components/tax/PdfPages.tsx`), a page at a time with Previous/Next and "Page N of M"; `?page=N` opens page N.
    A table of contents (the `sections` headings) on wide screens.
  - `kind: "article"` (Tax Topics, FAQ pages): `body` rendered as a readable article: every section's heading as an
    `h2`/`h3` **with `id={section.anchor}`** (when it has one), its paragraphs, and tables as real tables. When the
    URL has a `#anchor`, scroll to that heading.
  Name sources in plain words: "IRS Pub 17" → "IRS Publication 17"; never call a page "IRS ..." in navigation.
- `/tax/faq` **Tax FAQ**: every question from `GET /api/library/faq`, word for word, grouped by `category`, as expandable
  items (`data-testid="tax-faq"`), each answer with its irs.gov link and an "Ask the assistant" chip.
- `/tax/book` **Book a consultation**: the intake form below, with the demo notice above it, a short "what happens
  next" panel, and no guest gate or sign-in (the copilot must reach it hands-free).
- Pressing the form's button with a valid form goes to the existing `/sent` page ("Demo: nothing was sent").

### Suggested questions (word for word, from the IRS FAQ)

Show these as chips (`data-testid="tax-chip"`) on the home page. A chip calls `askAssistant(question)` below.

- When are quarterly estimated tax payments due?
- Is there an age limit on claiming my child as a dependent?
- What expenses qualify for an education credit?
- Is the loss on the sale of my home deductible?
- How can I check the status of my amended return?
- Are business gifts deductible?

```ts
function askAssistant(q: string) {
  const c = window.copilot; if (!c) return;
  if (!c.getSnapshot().open) c.start({ voice: false });
  c.send(q);
}
```

## Data the site reads: the library API (everything lives in Octo; no static copies)

- `GET /api/library/docs` → `{ docs: [{ doc, kind: 'pdf'|'article', source, title, url, category:
  'publications'|'instructions'|'taxtopics', pages, sections: [{ heading, level, anchor }] }] }`
- `GET /api/library/faq` → `{ faq: [{ id, question, answer, doc, category, url }] }` (211 items)
- `GET /api/library/doc?doc=<id>` → `{ doc, kind, source, title, url, pages, sections, pdf, body }`: `pdf` is the PDF's
  URL (`/api/library/pdf?doc=<id>`) for `kind: "pdf"`; `body` is `{ sections: [{ heading, level, anchor, url, blocks:
  ({ p: string } | { table: string[][] })[] }] }` for `kind: "article"` (`table[0]` is the header row).
- `GET /api/library/search?q=&limit=` → `{ results: [{ doc, page, anchor, title, href, snippet }] }`: link to
  `/tax/guides/<doc>?page=<page>` when `page` is set, else `/tax/guides/<doc>#<anchor>`; `href` is the irs.gov original.

## The intake form: exact markup the copilot reads

The copilot reads this form from the DOM and fills it. Render exactly these native elements, ids, names, values and
attributes (labels may be styled; don't wrap fields in custom components):

```html
<form data-copilot-form id="intake" autocomplete="off">  <!-- onSubmit: preventDefault, reportValidity, then navigate('/sent') -->
  <input id="fullname" name="fullname" autocomplete="name" required data-copilot-spell
         data-copilot-ask="What's your full name, as it appears on your tax return?" placeholder="e.g. Jordan Example">
  <input id="tel" name="tel" type="tel" autocomplete="tel" required minlength="10" placeholder="e.g. (555) 010-0199">
  <input id="mail" name="mail" type="email" autocomplete="email" required placeholder="e.g. jordan@example.com">
  <select id="status" name="status" required data-copilot-ask="What's your filing status">
    <option value="">Choose one</option>
    <option value="single" data-copilot-also="single, not married, unmarried">Single</option>
    <option value="mfj" data-copilot-also="married filing jointly, jointly, joint, married joint, together">Married filing jointly</option>
    <option value="mfs" data-copilot-also="married filing separately, separately, separate">Married filing separately</option>
    <option value="hoh" data-copilot-also="head of household, head of house">Head of household</option>
    <option value="qss" data-copilot-also="qualifying surviving spouse, surviving spouse, widow, widower">Qualifying surviving spouse</option>
  </select>
  <input id="years" name="years" required placeholder="e.g. 2025, or 2024 and 2025" data-copilot-ask="Which tax years do you need help with?">
  <select id="service" name="service" required data-copilot-ask="Which service do you need">
    <option value="">Choose one</option>
    <option value="individual" data-copilot-also="individual return, tax return, my return, 1040, personal return">Individual return</option>
    <option value="bookkeeping" data-copilot-also="bookkeeping, books, accounting">Small-business bookkeeping</option>
    <option value="payroll" data-copilot-also="payroll, pay my employees, w-2s">Payroll</option>
    <option value="notice" data-copilot-also="irs notice, notice, letter from the irs, irs letter, cp2000">IRS notice help</option>
    <option value="planning" data-copilot-also="planning, tax planning, estimates, estimated payments">Planning</option>
  </select>
  <select id="notice" name="notice" required data-copilot-ask="Have you received a letter or notice from the IRS">
    <option value="">Choose one</option>
    <option value="yes" data-copilot-also="yes, yeah, i did, i have, got one, received one">Yes</option>
    <option value="no" data-copilot-also="no, nope, i haven't, none, not yet">No</option>
  </select>
  <input id="noticecode" name="noticecode" data-copilot-kind="code" pattern="[A-Z]{1,4}[0-9]{1,5}[A-Z]?"
         title="Like CP2000 or LTR3172: letters, then numbers" placeholder="e.g. CP2000"
         data-copilot-ask="What's the notice code? It's in the top right corner of the letter, like CP2000. Say none if you didn't get one.">
  <select id="day" name="day" required data-copilot-ask="Which day suits you for the call">
    <option value="">Choose a day</option>
    <!-- the next 10 weekdays from today: value "YYYY-MM-DD", label "Monday, November 2",
         data-copilot-also "Monday, November 2, the 2nd" (leave the weekday out of also when it repeats) -->
  </select>
  <select id="slot" name="slot" required data-copilot-ask="And what time of day">
    <option value="">Choose a time</option>
    <option value="morning" data-copilot-also="morning, am, before noon">Morning (9 to 12)</option>
    <option value="afternoon" data-copilot-also="afternoon, after lunch, pm">Afternoon (12 to 4)</option>
    <option value="evening" data-copilot-also="evening, after work, late">Evening (4 to 6)</option>
  </select>
  <textarea id="notes" name="notes" rows="3" data-copilot-ask="Anything else the preparer should know before the call? Say none if not."></textarea>
  <button type="submit">Request consultation</button>   <!-- next to it: "Demo: nothing is sent or stored." -->
</form>
```

Labels: Full name, Phone, Email, Filing status, Tax years, Service needed, Have you received an IRS notice?, Notice
code (if any), Preferred date, Preferred time, Notes (optional). Group them under small headings (About you, Your
taxes, When to call). The field the copilot is asking about carries `data-copilot-active`: give it a soft glow ring in
the brand accent.

## The copilot on this site

Every `/tax` page mounts the copilot with `useCopilotMount(COPILOT_CONFIGS.tax)`, except `/tax/book`, which mounts
`COPILOT_CONFIGS.taxIntake` (both are defined in `src/lib/copilot.ts`; use them as they are). Every `/tax` page shows
the call bar (**Start voice call** / **Type instead**) and the existing call panel.

The copilot now drives the site itself during a call: it changes page ("take me to pricing"), opens the source of
each answer, and fills the form. The visitor never has to touch the screen after starting the call. The app's part:

1. **Navigation.** Once, inside the router (for example in the root layout), register the app's client-side
   navigate: `useEffect(() => { const reg = () => window.copilot?.onNavigate(p => navigate(p)); ... }, [])` (wait for
   `copilot:ready` if `window.copilot` isn't there yet, and call the returned unsubscribe on cleanup). Never reload the
   page to change route.
2. **Source chip.** A copilot message may carry `source` (`CopilotSource` in `src/lib/copilot.ts`). Under that
   message, show a small chip with `source.label` (`data-testid="call-source-chip"`), for example
   "IRS Pub 17 · Filing Requirements"; tapping it calls `window.copilot.showSource(message.id)`.
3. **Source viewer.** While `snapshot.source` is set, show the viewer (`data-testid="source-viewer"`): a side panel on
   the right on desktop (about 440px wide, full height below the header, the page stays usable on the left) and a
   bottom sheet on a phone (about 55% of the height, sitting above the call bar, with a drag-handle look). It shows:
   the document title, `source.credit` in small type, an "Open original on irs.gov" link to `source.href`
   (`data-testid="source-original"`, new tab), a close button (`data-testid="source-close"`, calls
   `window.copilot.closeSource()`), and the body (`data-testid="source-body"`, with the attribute
   `data-copilot-source-body`), a scrollable container showing `source.doc` (fetch `GET /api/library/doc?doc=`): for a
   PDF, pages `source.page` and `source.page + 1` with `<PdfPages>` (canvas plus pdf.js's text layer, which the copilot
   searches); for an article, the whole body exactly like the guide page: headings with `id={section.anchor}`,
   paragraphs, tables. The copilot itself
   finds the quoted sentences in that body, scrolls to them and highlights them (with the CSS Custom Highlight API,
   name `copilot-quote`). Style `::highlight(copilot-quote)` with the brand's soft highlight colour. Don't add your own
   highlighting, and don't change the text (no truncation, no "read more"), or the copilot can't find the quote. When
   `source.found === false`, show a quiet note at the top of the body: "The quoted line couldn't be located on this
   page." Opening and closing the viewer must not reset the page or the form beneath it.
4. **Call panel.** Keep everything it does now. Copilot messages may contain links (`links`): keep rendering them.

## Test hooks (in addition to the existing ones)

`demo-banner`, `tax-disclaimer`, `tax-chip`, `tax-guide`, `tax-guide-search`, `tax-search-result`, `tax-faq`,
`call-source-chip`, `source-viewer`, `source-body`, `source-close`, `source-original`. The contract check
(`scripts/check-copilot-contract.mjs`, already updated for this site; keep it exactly as it is) fails the build when
any is missing, when an intake field id is missing, when the source body lacks `data-copilot-source-body`, or when the
app doesn't call `window.copilot.onNavigate`. The app may call `GET /api/library/search` and no other `/api/` path.

Update the preview stand-in `public/copilot/sdk.js` so it also implements `showSource`, `closeSource` and
`onNavigate` (canned, as now).

## Done means

- `/tax` and every page above look like a real, high-quality private firm's website on a phone (375px) and on a laptop
  (1280px): no sideways scroll, nothing that looks governmental, the slim demo bar always visible.
- The library search returns results from `/api/library/search`; browsing lists every guide; a guide page renders a
  whole publication with its tables and scrolls to `#anchor`.
- The intake form renders exactly as specified, and its button goes to `/sent` when valid.
- The source viewer opens as a side panel on desktop and a bottom sheet on a phone while `snapshot.source` is set.
- All other sites and the marketing page are unchanged.
- `npm run build` passes, including `scripts/check-copilot-contract.mjs`.
