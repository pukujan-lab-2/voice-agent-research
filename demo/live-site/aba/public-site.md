# Grow Brindlewick's public site into a full firm website, with ten working forms over the real backend

This app holds the Website Copilot marketing page, the demo sites, the Brindlewick public site (`/tax`), its staff app
(`/staff`) and client portal (`/tax/portal`). Keep every existing page, route, form, `data-testid`, the copilot
contract, the call bar, the source chip and viewer, the staff app, the portal, `scripts/check-copilot-contract.mjs`
(already updated for this change; keep it exactly as it is) and the `build` script. **Keep `/tax/book` (the
consultation request) and its exact form markup**: only its submit changes (see Forms).

The goal: a tax professional who browses `/tax` for two minutes can't tell it from a real, well-run firm's site. Real
form numbers, deadlines and fees, specific copy, no filler, no lorem ipsum, no "Lorem", no stock phrases like
"we're passionate about". The firm and its people are fictional; the demo labelling stays (the slim demo bar, the
footer notice).

## Content comes from the backend (read this first)

All firm content lives in the practice database and comes from these routes, through `src/lib/practice.ts` (the typed
client the staff app already uses; add functions to it). **No content in the code: no hard-coded services, staff,
reviews, articles, deadlines, rates or checklist items, no fixtures, no fallbacks.** Show skeletons while loading, the
`error` text with Retry on failure, and a short empty state. (The builder's preview has no backend; error states there
are expected.) Remove `src/lib/taxServices.ts` and anything else that hard-codes firm content, after moving every page
to the API.

| Route | Returns |
|---|---|
| `GET /api/site/services` | `{services: [{slug, name, short, audience ('individuals'\|'businesses'), from_price, icon (a lucide-react icon name), sort}]}` |
| `GET /api/site/service?slug=` | `{service: {slug, name, short, audience, from_price, icon, body: [{heading, paragraphs[]}], faqs: [{q, a}], forms[], cites[]}}` |
| `GET /api/site/industries` | `{industries: [{slug, name, short, icon, sort}]}` |
| `GET /api/site/industry?slug=` | `{industry: {slug, name, short, icon, body, faqs, cites}}` (same shapes) |
| `GET /api/site/team` | `{team: [{id, name, first_name, role, credentials, title, office, bio, specialties[], years, languages[], avatar, accepts_new}]}` (`avatar` is an image URL: use it as `<img src>`) |
| `GET /api/site/locations` | `{locations: [{id, name, street, city, state, zip, phone, hours ({mon: [9, 17], ...}, hours as numbers, `[0, 0]` closed), parking, note}]}` |
| `GET /api/site/reviews?page=&size=` | paged `{rows: [{id, author, city, service, rating, title, body, date, staff_id}], page, size, total, pages}` |
| `GET /api/site/articles` | `{articles: [{slug, title, summary, category, author_id, published, minutes, tags[]}]}` |
| `GET /api/site/article?slug=` | `{article: {..., body: [{heading?, paragraphs[]}], cites[]}}` |
| `GET /api/site/jobs` | `{jobs: [{id, slug, title, office, type, salary, summary, body: [{heading, paragraphs[] or items[]}]}]}` |
| `GET /api/site/deadlines?from=&to=` | `{deadlines: [{id, date, title, who, form, detail, cite}]}` |
| `GET /api/site/checklist?situations=a,b` | `{situations: [{id, label, hint}], items: [{id, situation, name, form, why}]}` |
| `GET /api/site/rates` | `{rates: [{id, label, value, year, detail, cite}]}` (the calculators' figures: mileage rate, SE tax, wage base) |
| `GET /api/site/pages` | `{pages: [{path, title, section, summary}]}` |
| `GET /api/site/search?q=` | `{pages: [{path, title, section, summary}], articles: [{slug, title, summary}], guides: [{doc, title, category}], team: [{id, name, title}]}` |
| `GET /api/slots/days?office=&staff=` | `{days: [{date: "2026-11-02", open: 14}]}` (the next 15 weekdays and how many times are open) |
| `GET /api/slots?date=&office=&staff=&kind=` | `{date, slots: [{time: "09:00", label: "9:00 AM", staff: [{id, name}]}]}` (booked times are already gone) |
| `GET /api/forms` | each form's fields, labels and allowed values (for reference) |
| `POST /api/forms/draft` | `{form, id?, data}` → `{ok, id}`: save a draft (see Forms) |
| `POST /api/forms/submit` | `{form, data, draft?}` → `{ok, ref, message, ...}` or **422** `{error: "invalid", errors: {field: message}}`, **409** (that time was just booked), **429** |
| `POST /api/files?name=&form=` | body: the raw file → `{ok, id, name, sizeKb}` (8 MB max; PDF, JPG, PNG, HEIC, DOCX, XLSX, CSV, TXT) |
| `POST /api/newsletter` | `{email, topics: [...]}` → `{ok, message}` or 422 |

**Citations.** Service, industry and article bodies carry `[1]`, `[2]` markers that index into `cites` (1-based):
`{passage, doc, title, section, quote, url}`. Render each marker as a small superscript link; at the end of the page
list "Sources" with the IRS document title and section, the quoted words in quotation marks, and two links: "Read it
in our Tax Guides" (`/tax/guides/<doc>`) and "IRS.gov" (`url`, new tab).

## Navigation and layout

- **Header** (sticky under the demo bar): the Brindlewick wordmark; a **mega-menu** with four panels: *Individuals*
  (the individual services, the industry pages that apply to people: rideshare and gig, crypto), *Businesses*
  (business services, all six industries), *Resources* (Tax calendar, Document checklist, the four calculators and
  refund-status explainer, Articles, Tax Guides, FAQ), *About* (Our team, Locations, Careers, Reviews, About us,
  Contact). Each panel: two or three columns of links with one-line descriptions, and a small feature card on the
  right (e.g. "Next deadline: <the next upcoming row from /api/site/deadlines>"). On the right: a **search** button
  (opens a command-palette style dialog over `/api/site/search` with grouped results: Pages, Articles, Tax Guides,
  People; arrow keys and Enter), **Client login** (`/tax/portal`) and a primary **Book a consultation** button
  (`/tax/book`). On a phone: a menu button opening a full-height sheet with the same groups as accordions.
- **Footer**: four link columns (Individuals, Businesses, Resources, Firm), the three offices with phone numbers and
  hours from `/api/site/locations`, a newsletter sign-up (email + topic checkboxes, posts `/api/newsletter`), Privacy
  and Terms links, and the existing demo and IRS notices.
- Reference sites for **structure only (not clones)**: copy no text, logos, images, colours or brand names. The
  mega-menu and home page: large national accounting and tax-prep firms' sites; the service pages: a mid-size CPA
  firm's service page (what's included, process steps, pricing from, FAQ); the article pages: a modern publication
  layout (in the style of Stripe's or Supabase's blog: reading width, author byline, table of contents); the tools: a
  personal-finance site's calculators. Note these in a comment at the top of each page file.

## Pages (all under `/tax`, client-side routing only)

- `/tax` **Home**: hero, the services grid (from the API), "Who we work with" (the industries), how working with us
  goes (three steps), a strip of three sample reviews (labelled "Sample reviews"), the next three deadlines from the
  calendar, the latest three articles, a team teaser (four portraits), and the offices. Keep the existing home page's
  copilot features (suggested questions etc.).
- `/tax/services` and `/tax/services/:slug` (10 services): hero with name, short, from-price; the body sections; the
  forms involved as chips; FAQs (accordion); sources; a sticky side card on desktop: "From $325", "Book a
  consultation", "Talk to <a preparer from /api/site/team whose specialties match>".
- `/tax/industries/:slug` (6): the same layout without a price.
- `/tax/team`: everyone from `/api/site/team`, grouped by role (Partners, Managers, Preparers and accountants,
  Bookkeeping and payroll, Client services and operations), with portrait, credentials, title, office, specialties,
  languages and years; a person opens a profile dialog with the bio and a "Book with <first name>" link
  (`/tax/schedule?staff=<id>`) when `accepts_new`.
- `/tax/locations`: the three offices: address, phone, hours table (today highlighted), parking, a simple
  illustrated map placeholder (no real map tiles), "Book at this office" (`/tax/schedule?office=<id>`).
- `/tax/careers`: why work here, benefits, the openings from `/api/site/jobs`; `/tax/careers/:slug` the job with an
  "Apply" button (`/tax/careers/apply?job=<slug>`).
- `/tax/reviews`: average rating and count from the data, the reviews paged 12 at a time, each with a small "Sample
  review" label; a one-line note at the top: "Sample reviews written for this demo; Brindlewick is fictional."
- `/tax/blog` (filter by category, search within titles) and `/tax/blog/:slug` (byline with the author's portrait
  and title, published date, reading time, table of contents from the headings, citations, "Related articles").
- `/tax/tools/calendar`: the 2026-27 federal deadlines as a month-by-month list with filters (Everyone,
  Individuals, Businesses, Employers, Nonprofits) and a "Next up" card; each row: date, title, form, detail, source.
- `/tax/tools/checklist`: the document checklist builder: the situations as large toggle cards; the list builds
  live from `/api/site/checklist?situations=`; a Print button (print stylesheet).
- `/tax/tools/quarterly` (estimated payment helper: expected income and withholding → a simple estimate with the
  four due dates from the deadlines API, clearly labelled "a rough estimate, not tax advice"), `/tax/tools/mileage`
  (miles × the standard mileage rate from `/api/site/rates`, with the year and source shown), `/tax/tools/se-tax`
  (net earnings × the factor and rates from `/api/site/rates`, showing each step), `/tax/tools/refund-status` (an
  explainer of what each refund status means and typical timing, linking to the IRS "Where's My Refund?" tool;
  copy written plainly, no claims beyond what the library supports). The calculators read every figure from the
  rates API: none hard-coded.
- `/tax/about`: the firm's story (fictional, founded 2009, three offices), values, credentials, and the demo
  explanation (keep the existing About text about the demo).
- `/tax/contact`, `/tax/privacy`, `/tax/terms` (privacy and terms: short, plain, clearly for a demo site; no data
  is sold; forms save sample records in the demo database).
- Keep `/tax/pricing`, `/tax/guides`, `/tax/guides/:id`, `/tax/faq` and `/tax/book` as they are, but link pricing's
  services to the new service pages.

## Forms

Ten forms. General rules, for every one:

- Native elements only, styled (no custom selects, no headless comboboxes): `<input>`, `<select>`, `<textarea>`,
  radio groups inside `<fieldset>` with a `<legend>`, checkboxes, `<input type="date">`, `<input type="file">`.
  Every field has a visible `<label for>`. The exact `id`, `name`, `type`, options (`value` and
  `data-copilot-also`) and `data-copilot-ask` below must be used as written; the visible label text is yours.
- The `<form>` carries `data-copilot-form` and its `id`. Its submit button is a real `type="submit"` button.
- **Multi-step forms** (`/tax/start`): each step is `<fieldset data-step hidden={step !== n} disabled={step !== n}>`
  (use the `hidden` attribute, never a CSS class), a progress bar with the step names above, and on every step but
  the last a **Next** button `<button type="button" data-copilot-next>Next</button>` that checks only that step's
  fields (`reportValidity()` on each) and moves on; a Back button `type="button"` too. The copilot may press Next (it
  never presses submit).
- **Drafts**: while a form is being filled, save a draft at most every 3 seconds when something changed (`POST
  /api/forms/draft {form, id, data}`; keep the returned `id` in `sessionStorage["bw-draft:<form>"]`), and send
  `draft: id` with the submit. A small "Draft saved" note near the button.
- **Submit**: `onSubmit` → `preventDefault`, the browser's own validity check, then `POST /api/forms/submit {form,
  data, draft}` with every field by its `name` (checkbox groups as arrays). On **422** show each message under its
  field (`aria-invalid`, `aria-describedby`) and a summary box at the top (`data-testid="form-errors"`) listing them
  as links that focus the field; on **409** show the message at the time field; on **429** the message. On success,
  replace the form with a confirmation (`data-testid="form-confirmation"`): a check icon, the `message`, the
  reference number large and copyable (`data-testid="form-ref"`), what happens next (two or three specific lines per
  form), and links back. A line beside every submit button: "Demo: this saves a sample record in the demo database.
  Don't enter real personal or tax information."
- The field the copilot is asking about carries `data-copilot-active`: the soft glow ring in the brand accent.
- Each form page mounts its copilot config with `useCopilotMount(COPILOT_CONFIGS.<key>)` (keys below; defined in
  `src/lib/copilot.ts`; use them as they are). Every other `/tax` page keeps `COPILOT_CONFIGS.tax`.

Common building blocks used below:
- *name*: `<input id="X" name="N" autocomplete="name" required data-copilot-spell data-copilot-ask="What's your full name?" placeholder="e.g. Jordan Example">`
- *email*: `<input id="X" name="email" type="email" autocomplete="email" required placeholder="e.g. jordan@example.com">`
- *phone*: `<input id="X" name="phone" type="tel" autocomplete="tel" required minlength="10" placeholder="e.g. (555) 010-0199">`
- *state*: `<select id="X" name="N" required>` with `<option value="">Choose a state</option>` and one option per state
  and DC: `value` = the two-letter code, label = the full name, `data-copilot-also` = "<full name lower case>,
  <code lower case>" (e.g. `value="OR" data-copilot-also="oregon, or"`).
- *notes*: `<textarea id="X" name="notes" rows="3" data-copilot-ask="Anything else we should know? Say none if not.">` (optional)

### 1. `/tax/book`: consultation request (exists; keep its markup) — form `consultation`, config `taxIntake`

Keep every field exactly. Change only: the submit now posts `{form: "consultation", data}` with the fields by name
(fullname, tel, mail, status, years, service, notice, noticecode, day, slot, notes), shows errors and the
confirmation as above (navigate to `/sent` no longer; show the confirmation in place), and the line beside the
button becomes the new demo line.

### 2. `/tax/start`: become a client (4 steps) — form `intake`, config `taxStart`, `<form id="intake-new">`

Progress: About you · Address · Your taxes · Your visit.
1. **About you**: `in_first` name=`first_name` (*name* pattern, autocomplete given-name, ask "What's your first
   name?"), `in_last` name=`last_name` (autocomplete family-name, data-copilot-spell, ask "And your last name?"),
   `in_email` (*email*), `in_phone` (*phone*). Next.
2. **Address**: `in_street` name=`street` required autocomplete street-address ask "What's your street address?";
   `in_city` name=`city` required ask "Which city?"; `in_state` name=`state` (*state*, ask "Which state?");
   `in_zip` name=`zip` required inputmode numeric pattern `[0-9]{5}` ask "And the ZIP code?". Next.
3. **Your taxes**: `in_status` name=`filing_status` select, ask "What's your filing status", options single "Single"
   (also: single, not married), mfj "Married filing jointly" (also: married filing jointly, jointly, joint), mfs
   "Married filing separately" (also: separately), hoh "Head of household" (also: head of household), qss
   "Qualifying surviving spouse" (also: surviving spouse, widow, widower); `in_dependents` name=`dependents` select,
   ask "How many dependants do you claim", options 0 "None" (also: none, zero, no, no kids), 1 "1" (also: one), 2
   "2" (also: two), 3 "3" (also: three), 4 "4" (also: four), 5 "5 or more" (also: five, five or more, more than
   four); a checkbox group `<fieldset>` legend "Income you had (tick all that apply)" name=`income` values w2 "W-2
   wages", self "Self-employment or 1099 work", rental "Rental property", investments "Investments (1099-B,
   1099-DIV)", retirement "Retirement distributions", social-security "Social Security", crypto "Digital assets",
   k1 "Partnership or S corp (K-1)", unemployment "Unemployment", foreign "Foreign income or accounts" (ids
   `in_inc_<value>`); `in_services` name=`services` select ask "What do you need help with", options individual
   "Individual return" (also: individual return, my taxes, tax return, 1040), business "Business return" (also:
   business return, business taxes), bookkeeping "Bookkeeping" (also: bookkeeping, books), payroll "Payroll",
   notice "An IRS notice" (also: irs notice, notice, letter), planning "Tax planning" (also: planning), prior-year
   "Prior-year or amended return" (also: prior year, amended, back taxes), state "State return only" (also: state),
   trust "Trust or estate" (also: trust, estate), nonprofit "Nonprofit (990)" (also: nonprofit, 990); `in_years`
   name=`years` required ask "Which tax years?" placeholder "e.g. 2025, or 2024 and 2025"; a radio group fieldset
   legend "Who prepared your last return?" `data-copilot-ask="Who prepared your last return"` name=`prior_preparer`
   values self "I did, by hand" (also: myself, i did, by hand), software "Tax software" (also: software, turbotax,
   an app, online), preparer "Another preparer or firm" (also: another preparer, an accountant, a cpa, another
   firm), none "I haven't filed before" (also: never, first time, haven't filed), ids `in_prior_<value>`, required.
   Next.
4. **Your visit**: a radio group legend "Which office suits you?" ask "Which office suits you" name=`office`
   values harrow "Harrow Falls" (also: harrow, harrow falls), corbel "Corbel" (also: corbel), millbrook "Millbrook"
   (also: millbrook), remote "Remote, by video" (also: remote, video, online, virtual), ids `in_office_<value>`,
   required; `in_heard` name=`heard` select (optional) ask "How did you hear about us? Say skip if you'd rather
   not." options "" "Choose one (optional)" (also: skip, rather not, prefer not to say), referral "A friend or
   client" (also: friend, referral, word of mouth), search "Search" (also: google, search, online search), review
   "Reviews" (also: reviews), social "Social media" (also: social media, instagram, facebook), event "An event"
   (also: event, workshop), other "Other"; `in_notes` (*notes*). Submit: "Send my details".

### 3. `/tax/schedule`: book an appointment — form `booking`, config `taxSchedule`, `<form id="booking">`

Reads `?office=` and `?staff=` to preselect. `bk_kind` name=`kind` select required ask "What's the appointment
for", options consultation "New-client consultation (30 min, free)" (also: consultation, new client, first meeting,
free consultation), review "Return review (60 min)" (also: review, go over my return, return review), planning
"Planning meeting (60 min)" (also: planning, tax planning), notice "IRS notice review (30 min)" (also: notice,
letter, irs notice), signing "Signing (30 min)" (also: signing, sign, sign my return). A radio group legend "How
would you like to meet?" ask "Would you like to meet in the office, by video or by phone" name=`mode` values office
"In the office" (also: office, in person, in the office), video "Video call" (also: video, zoom, online), phone
"Phone call" (also: phone, call, by phone), ids `bk_mode_<value>`, required. `bk_office` name=`office` select
required ask "Which office", options harrow "Harrow Falls" (also: harrow, harrow falls), corbel "Corbel", millbrook
"Millbrook". `bk_staff` name=`staff` select (optional) ask "Would you like a particular preparer? Say anyone if
not." options "" "Any available preparer" (also: anyone, any, no preference, doesn't matter) and one option per
person from `/api/site/team` who `accepts_new` and is in the chosen office (value id, label "<name>, <credentials>",
also "<first name lower>, <full name lower>"). `bk_day` name=`date` select required ask "Which day suits you",
options from `/api/slots/days?office=&staff=` (refetch when office or staff changes): value the date, label
"Monday, November 2 · 14 times" (or "· fully booked" and `disabled` when open is 0), `data-copilot-also` "monday
november 2, november 2, the 2nd, monday the 2nd" (leave the weekday out of also when the same weekday appears twice
in the list). Then the times as a radio group fieldset legend "Available times" ask "Which time" name=`time`, one
radio per slot from `/api/slots?date=&office=&staff=&kind=` (refetch when the day, office, staff or kind changes):
value "09:00", label "9:00 AM", id `bk_time_0900`, `data-copilot-also` "9, nine, 9 am, nine am, nine o'clock" (and
"half past nine, 9 30, nine thirty" for :30), required; show them as a grid of time chips (the radio visually
hidden but focusable, the chip is its label); a loading state while fetching, "No times left on this day" when
empty. On desktop show the days as a two-week calendar strip next to the select (clicking a day sets the select);
the select stays the real field. Then `bk_name` name=`name` (*name*), `bk_email` (*email*), `bk_phone` (*phone*),
`bk_notes` (*notes*). Submit: "Book this time". The confirmation shows the reference, the day, time, preparer
(`staff` from the response), the office address or "We'll send a video link" / "We'll call you", and an "Add to
calendar" link (a generated `.ics` data URL).

### 4. `/tax/notice`: send us an IRS notice — form `notice`, config `taxNotice`, `<form id="notice-form">`

`nt_name` (*name*), `nt_email` (*email*), `nt_phone` (*phone*), `nt_code` name=`code` required
`data-copilot-kind="code"` pattern `(CP|LTR|LT) ?[0-9]{1,5}[A-Z]?` title "Like CP2000 or LTR 1058" ask "What's the
notice number? It's in the top or bottom right corner, like CP2000." placeholder "e.g. CP2000"; `nt_year`
name=`tax_year` select required ask "Which tax year is it about", options 2025 down to 2019 (also: the year, and
"last year" for 2025); `nt_date` name=`notice_date` type=date required ask "What's the date on the notice?";
`nt_amount` name=`amount` inputmode decimal (optional) ask "What amount does it show, in dollars? Say none if it
doesn't show one." placeholder "e.g. 1,284.00"; `nt_due` name=`response_due` type=date (optional, the person picks
it); a radio group legend "Do you agree with it?" ask "Do you agree with the notice" name=`agree` values agree "Yes"
(also: yes, i agree, it's right), disagree "No" (also: no, i disagree, it's wrong), partly "Partly" (also: partly,
some of it, partially), unsure "Not sure" (also: not sure, don't know, unsure), ids `nt_agree_<value>`, required;
`nt_description` name=`description` textarea required minlength 10 ask "In a sentence or two, what is the notice
about?"; `nt_files` type=file multiple accept ".pdf,.jpg,.jpeg,.png,.heic" label "Photos or a scan of the notice":
each chosen file uploads at once to `/api/files?name=&form=notice` with a progress bar and remove button; the
submit sends `files: [ids]`. Submit: "Send notice".

### 5. `/tax/payroll-setup` — form `payroll`, config `taxPayroll`, `<form id="payroll-form">`

`py_business` name=`business_name` required ask "What's the business's legal name?"; `py_ein` name=`ein` required
`data-copilot-kind="code"` pattern `[0-9]{2}-?[0-9]{7}` title "9 digits, like 12-3456789" ask "What's the
business's EIN? You can read the nine digits." placeholder "e.g. 00-1234567"; `py_entity` name=`entity` select
required ask "What kind of entity is it", options sole "Sole proprietor" (also: sole proprietor, just me), llc "LLC"
(also: llc, limited liability company), scorp "S corporation" (also: s corp, s corporation), ccorp "C corporation"
(also: c corp, corporation), partnership "Partnership" (also: partnership), nonprofit "Nonprofit" (also:
nonprofit, charity); `py_employees` name=`employees` inputmode numeric required pattern `[0-9]{1,3}` ask "How many
employees will be on payroll?"; a radio group legend "How often do you pay?" ask "How often do you pay your team"
name=`frequency` values weekly "Weekly" (also: weekly, every week), biweekly "Every two weeks" (also: every two
weeks, biweekly, every other week), semimonthly "Twice a month" (also: twice a month, semimonthly, 15th and last),
monthly "Monthly" (also: monthly, once a month), ids `py_freq_<value>`, required; `py_first` name=`first_pay_date`
type=date required `data-copilot-kind="future"` ask "What's the first pay date you'd like us to run?"; `py_state`
name=`state` (*state*, ask "Which state do your employees work in?"); `py_contact` name=`contact_name` (*name*, ask
"Who should we talk to about payroll? Their full name."); `py_email` (*email*); `py_phone` (*phone*);
`py_provider` name=`current_provider` (optional) ask "Who runs your payroll now? Say none if no one."; `py_notes`
(*notes*). Submit: "Start payroll setup".

### 6. `/tax/address-change` — form `address`, config `taxAddress`, `<form id="address-form">`

`ad_name` (*name*), `ad_email` (*email*), `ad_phone` (*phone*), `ad_old` name=`old_street` required ask "What was
your old street address?"; `ad_street` name=`street` required ask "And your new street address?"; `ad_city`
name=`city` required ask "New city?"; `ad_state` name=`state` (*state*, ask "New state?"); `ad_zip` name=`zip`
required inputmode numeric pattern `[0-9]{5}` ask "New ZIP code?"; `ad_effective` name=`effective` type=date
required ask "When did you move?"; a radio group legend "Should we file Form 8822 to tell the IRS?" ask "Should we
file Form 8822 to update your address with the IRS" name=`irs` values yes "Yes, please file it" (also: yes, please,
do it), no "No, I'll handle it" (also: no, i will, i'll do it), ids `ad_irs_<value>`, required. Submit: "Update my
address".

### 7. `/tax/payment-plan` — form `payment-plan`, config `taxPaymentPlan`, `<form id="plan-form">`

`pp_name` (*name*), `pp_email` (*email*), `pp_phone` (*phone*), `pp_years` name=`years` required ask "Which tax
years do you owe for?" placeholder "e.g. 2024, or 2023 and 2024"; `pp_owed` name=`owed` inputmode decimal required
ask "About how much do you owe in total, in dollars?"; `pp_monthly` name=`monthly` inputmode decimal required ask
"How much could you pay each month?"; radio groups: legend "Which kind of plan?" ask "Do you want a short-term plan,
a long-term plan, or are you not sure" name=`plan` values short "Short-term (180 days or less)" (also: short, short
term, a few months), long "Long-term (monthly installments)" (also: long, long term, installment agreement,
monthly), unsure "Not sure" (also: not sure, don't know), ids `pp_plan_<value>`; legend "Have you had an IRS notice
about this?" ask "Have you had a notice from the IRS about it" name=`notice` values yes/no (also: yes, i have / no,
not yet), ids `pp_notice_<value>`; legend "Pay by direct debit?" ask "Would you pay by direct debit from your bank
account" name=`debit` values yes/no, ids `pp_debit_<value>`; all required; `pp_notes` (*notes*). Under the title,
a short plain explainer with Form 9465 and a link to the Tax Guides search for "payment plan". Submit: "Request a
payment plan".

### 8. `/tax/prior-year` — form `transcript`, config `taxPriorYear`, `<form id="prior-form">`

`tr_name` (*name*), `tr_email` (*email*), `tr_phone` (*phone*), `tr_year` name=`tax_year` select required ask
"Which tax year do you need", options 2025 down to 2019; radio groups legend "What do you need?" ask "Do you need a
copy of the return, an IRS transcript, or both" name=`what` values copy "A copy of the return we filed" (also:
copy, a copy, the return), transcript "An IRS transcript" (also: transcript, irs transcript), both "Both" (also:
both, both of them), ids `tr_what_<value>`; legend "How should we send it?" ask "Should we put it in your portal or
mail it" name=`delivery` values portal "Client portal" (also: portal, online, upload it), mail "By mail" (also:
mail, post, send it), ids `tr_delivery_<value>`; both required; `tr_purpose` name=`purpose` select required ask
"What do you need it for", options mortgage "A mortgage or loan" (also: mortgage, loan, refinance), aid "Financial
aid" (also: financial aid, fafsa, college), immigration "Immigration" (also: immigration, visa, green card),
records "My records" (also: records, my files, just to keep), other "Something else" (also: other, something else);
`tr_notes` (*notes*). Submit: "Request it".

### 9. `/tax/refer` — form `referral`, config `taxRefer`, `<form id="referral-form">`

`rf_your_name` name=`your_name` (*name*, ask "What's your full name?"), `rf_your_email` name=`your_email` type
email required ask "And your email?"; `rf_friend_name` name=`friend_name` (*name*, ask "What's your friend's full
name?"); `rf_friend_email` name=`friend_email` type email (optional) ask "What's their email? Say none if you don't
have it."; `rf_friend_phone` name=`friend_phone` type tel (optional) ask "And their phone number? Say none if you
don't have it." (the server needs one of the two: its 422 names `friend_email`); `rf_relationship` name=`relationship` select required ask "How do you know them", options family
"Family" (also: family, relative, my brother, my sister, my mother, my father), friend "Friend" (also: friend),
colleague "Colleague" (also: colleague, coworker, work), client "Another client" (also: client, also a client), other
"Other"; `rf_service` name=`service` select required ask "What do they need help with", options individual
"Individual return" (also: tax return, individual), business "Business taxes" (also: business), bookkeeping
"Bookkeeping", payroll "Payroll", notice "An IRS notice" (also: notice, letter), planning "Tax planning"; `rf_notes`
(*notes*). A note: "We'll only contact your friend once, and only to say you referred them." Submit: "Send referral".

### 10. `/tax/careers/apply` — form `application`, config `taxApply`, `<form id="apply-form">`

`ja_job` name=`job` select required ask "Which position are you applying for", options from `/api/site/jobs` (value
slug, label title, also "<title lower>"), preselected from `?job=`; `ja_name` (*name*), `ja_email` (*email*),
`ja_phone` (*phone*); `ja_credentials` name=`credentials` select required ask "Which credentials do you hold",
options cpa "CPA" (also: cpa, certified public accountant), ea "Enrolled agent" (also: ea, enrolled agent), both
"CPA and EA" (also: both), progress "Working toward one" (also: studying, working toward, in progress), none "None
yet" (also: none, no); `ja_years` name=`years` inputmode numeric required pattern `[0-9]{1,2}` ask "How many years
of tax or accounting experience do you have?"; `ja_start` name=`start` type=date required
`data-copilot-kind="future"` ask "When could you start?"; `ja_resume` type=file accept ".pdf,.docx" (uploads at once
like the notice files; sends `resume: [id]`); `ja_cover` name=`cover` textarea required minlength 20 ask "In a few
sentences, why Brindlewick?". Submit: "Send application".

### 11. `/tax/contact` — form `contact`, config `taxContact`, `<form id="contact-form">`

`ct_name` (*name*), `ct_email` (*email*), `ct_phone` (*phone*), `ct_topic` name=`topic` select required ask "What's
it about", options question "A question" (also: question, ask), billing "Billing" (also: billing, invoice, bill),
portal "The client portal" (also: portal, login, sign in), other "Something else" (also: other); `ct_message`
name=`message` textarea required minlength 5 ask "What would you like to say?". The page also shows the three
offices. Submit: "Send message".

## Test hooks

Keep every existing one. Add: `site-megamenu`, `site-search`, `site-search-result`, `client-login`,
`service-page`, `industry-page`, `team-member`, `location-card`, `job-card`, `review-card`, `article-card`,
`article-page`, `cite-ref`, `sources`, `deadline-row`, `checklist-item`, `calc-result`, `newsletter`,
`form-errors`, `form-confirmation`, `form-ref`, `draft-saved`, `slot-day`, `slot-time`, `upload-progress`,
`form-progress`. The contract check fails the build when any is missing or when a form field id from this spec is
missing.

## Done means

- Every page above exists, reads its content from the API, and looks like a real firm's site at 375px and 1280px.
- All ten forms render with exactly these ids, names, options and attributes, save drafts, and submit to the API with
  errors shown per field and a confirmation with the reference number.
- Booking shows only open times; a time that was just taken shows the 409 message.
- Nothing hard-codes firm content; `src/lib/taxServices.ts` is gone.
- Every other site, the staff app, the portal and the marketing page are unchanged.
- `npm run build` passes, including `scripts/check-copilot-contract.mjs`.
