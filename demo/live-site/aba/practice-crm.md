# Add Brindlewick's staff app (/staff) and client portal (/tax/portal): a practice-management CRM over a real backend

This app already holds the Website Copilot marketing page, six demo sites and the call panel. Keep all of that exactly
as it is: every page, route, form, `data-testid`, the copilot contract, the call bar, the source viewer,
`scripts/check-copilot-contract.mjs` (already updated for this change; keep it exactly as it is) and the `build` script
that runs it. This change **adds two things to the Brindlewick Tax & Accounting site**:

1. **`/staff`**: the firm's own practice-management app (a CRM for an accounting firm), used by its 14 staff.
2. **`/tax/portal`**: the client portal, where a client sees their return status, documents, invoices, messages,
   appointments and organizer checklist.

Both are fictional: the firm, its 5,000 clients, 900 businesses and every record are made-up sample data. But they
must look and behave like a real, polished product that an accounting firm pays for. The audience is tax
professionals: within two minutes of clicking around, nothing should feel like a template or a toy.

## The backend is real (read this first)

Every screen reads from and writes to the practice API, a Node backend over a Postgres database with about 150,000
rows. Use **only** the routes below, through one small typed client in `src/lib/practice.ts` (`fetch` with
`Authorization: Bearer <token>` where a session is needed). **No mock data, no fixtures, no local JSON, no
placeholder rows, nothing hard-coded that the API returns.** While a request runs, show skeleton rows; when it fails,
show the API's `error` text in a calm inline message with a Retry button; when a list is empty, a short empty state
("No notices due in the next 7 days."). In the builder's preview there is no backend, so pages will show their error
state there. That is expected; do not add fallbacks.

Dates arrive as ISO strings (`"2026-11-02T00:00:00.000Z"` for dates, timestamps for times): show dates as
"Nov 2, 2026" (parse the date part only, no time-zone shift) and times as "9:00 AM". Money arrives either as `*_cents`
integers (format as `$1,234.00`) or already formatted strings. Counts from `counts` arrive as strings.

### Sessions (demo logins, no passwords)

- `POST /api/staff/session {staff?: "st-pra"}` → `{ok, token, staff: {id, name, title}}`. Keep the token in
  `sessionStorage["bw-staff-token"]`. Any 401 from a staff route clears it and returns to `/staff`.
- `POST /api/portal/session {demo: true}` or `{call: "<id>"}` → `{ok, token, household, firstName, sample: true}`. Keep it
  in `sessionStorage["bw-portal-token"]`. Any 401 returns to `/tax/portal`.

### Staff routes (all GET unless marked; all need the staff token)

Paged lists take `page` (1-based) and `size` (default 25) and return `{rows, page, size, total, pages}`.

| Route | Query | Returns |
|---|---|---|
| `/api/staff/me` | | `{staff: {id, name, title, credentials, role, office, avatar}}` |
| `/api/staff/staff` | | `{staff: [same]}` (for preparer pickers and filters) |
| `/api/staff/dashboard` | | `{counts: {households, businesses, people, open_engagements, overdue, docs_requested, new_submissions}, pipeline: [{stage, label, n}], tasks: {open, late}, notices: {due_week, past_due}, appointments: [{id, starts, minutes, kind, mode, client_name, client_ref}], unread, billing: {overdue, collectedThisMonth}, queue: [{id, client_ref, client_name, form, tax_year, stage, due, priority}]}` |
| `/api/staff/clients` | `q, kind (household\|business), preparer, office, tag, stage, industry, sort (name\|since\|due), page, size` | paged `{id, kind, name, city, state, preparer, preparer_name, office, since, tags[], industry, detail, people, stage, next_due}` (`detail`: filing status for a household, entity type for a business; `people`: household size or employee count) |
| `/api/staff/find` | `q` | `{matches: [{id, kind, name, city}]}` (name search for pickers) |
| `/api/staff/client` | `id` (`HH-20042` or `BZ-30151`) | `{kind, client, people[], engagements[], documents[], invoices[], notices[], threads[], appointments[], tasks[], activity[], related[], payroll[], totals: {billed, paid, outstanding, openNotices, missingDocs}}` |
| `/api/staff/engagements` | `stage, year, preparer, q, form, due_within (days), sort (due\|updated), page, size` | paged engagements `{id, client_kind, client_ref, client_name, kind, form, tax_year, stage, preparer, preparer_name, reviewer, due, extended, fee_cents, refund_cents, balance_cents, priority, updated, missing}` |
| `/api/staff/pipeline` | `year (default 2025), preparer` | `{year, columns: [{stage, label, total, cards: [{id, client_ref, client_name, form, due, priority, updated, preparer, missing}]}]}` (30 cards per column, `total` is the full count) |
| `/api/staff/queue` | `preparer, days (default 60), page, size` | paged `{id, client_ref, client_name, form, tax_year, stage, due, priority, preparer_name, days_late, missing}` |
| `/api/staff/documents` | `status (requested\|received), q, page, size` | paged `{id, engagement_id, client_ref, client_name, name, form, issuer, status, requested, received, size_kb, source, engagement_form, tax_year, days_waiting}` |
| `/api/staff/notices` | `status (open\|new\|in progress\|waiting on IRS\|response sent\|resolved), due_within, q, page, size` | paged `{id, client_ref, client_name, code, title, tax_year, notice_date, received, response_due, amount_cents, status, assigned_name, summary, days_left}` |
| `/api/staff/calendar` | `from (YYYY-MM-DD), days (1-31), staff` | `{from, days, appointments: [{id, staff_id, staff_name, client_ref, client_name, starts, minutes, kind, mode, status, location, notes}]}` |
| `/api/staff/invoices` | `status (open\|overdue\|partial\|paid), q, page, size` | paged `{id, number, client_ref, client_name, engagement_id, issued, due, amount_cents, paid_cents, status, lines: [{description, amount_cents}]}` |
| `/api/staff/threads` | `mine=1, unread=1, q, page, size` | paged `{id, client_ref, client_name, subject, staff_id, staff_name, updated, status, unread_staff}` |
| `/api/staff/thread` | `id` | `{thread, messages: [{id, sender, sender_name, sent, body}]}` (a sender starting `st-` is staff) |
| `/api/staff/tasks` | `assignee (me\|st-xxx), status (open\|in progress\|waiting\|done), page, size` | paged `{id, title, assignee, assignee_name, client_ref, client_name, engagement_id, due, status, priority}` |
| `/api/staff/submissions` | `form, page, size` | paged `{id, form, ref, created, status, client_ref, data}` (forms people sent from the public site) |
| `/api/staff/reports` | | `{byPreparer: [{id, name, open, done_2025, overdue}], revenueByMonth: [{month, collected, cents, payments}], aging: [{bucket, invoices, outstanding}], mix: [{form, engagements, fees}], notices: [{code, n}]}` |
| `/api/staff/audit` | `actor, entity, action, page, size` | paged `{id, at, actor, actor_name, actor_kind, action, entity, entity_id, detail, ip}` |
| POST `/api/staff/engagement` | `{client_ref, kind, form, tax_year, preparer, reviewer, due, fee, notes}` | `{ok, id, message}` |
| POST `/api/staff/task` | `{title, assignee, client_ref?, due, priority}` | `{ok, id}` |
| POST `/api/staff/task-status` | `{id, status}` | `{ok}` |
| POST `/api/staff/stage` | `{id, stage}` | `{ok}` |
| POST `/api/staff/doc-request` | `{engagement_id, name, form}` | `{ok, id}` |
| POST `/api/staff/message` | `{thread?, client_ref?, subject?, body}` | `{ok, thread}` |

Every POST may answer **422** `{error: "invalid", errors: {field: "message"}}`: show each message under its field
(`aria-invalid`, `aria-describedby`) and a summary box at the top of the form (`data-testid="staff-form-errors"`). On
success show a toast and, where it makes sense, the new record (`data-testid="staff-saved"` on the confirmation).
429 means "slow down": show the error text.

Pipeline stages, in order: `organizer_sent` Organizer sent, `docs_in` Documents in, `in_prep` In preparation,
`review` In review, `efiled` E-filed, `accepted` Accepted. Priorities: high, normal, low.

### Portal routes (portal token)

| Route | Returns |
|---|---|
| `/api/portal/summary` | `{household: {id, name, street, city, state, zip, filing_status, dependents, preparer, preparer_name, preparer_credentials, since}, people: [{id, first_name, full_name, relation}], returns: [{id, form, tax_year, stage, stage_label, due, extended, efiled, accepted, refund_cents, balance_cents, preparer_name, kind}], documents: {requested, received}, invoices: {open, due}, appointments: [{id, starts, minutes, kind, mode, location, staff_name}], unread, notices: [{id, code, title, response_due, status}], sample: true}` |
| `/api/portal/documents` | `{documents: [{id, engagement_id, name, form, status, requested, received, size_kb, source, has_file}]}` |
| `/api/portal/invoices` | `{invoices: [{id, number, issued, due, amount_cents, paid_cents, status, lines, payments: [{paid, amount_cents, method}]}]}` |
| `/api/portal/messages` | `{threads: [{id, subject, staff_name, updated, status, unread_client}]}` |
| `/api/portal/thread?id=` | `{thread, messages: [{id, sender, sender_name, sent, body}]}` |
| `/api/portal/appointments` | `{appointments: [{id, starts, minutes, kind, mode, status, location, staff_name}]}` |
| `/api/portal/organizer` | `{taxYear, engagement, documents: [{id, name, form, status, received}], checklist: [{id, situation, name, form, why}]}` |
| POST `/api/portal/message` | `{thread?, subject?, body}` → `{ok, thread}` |
| POST `/api/files?name=<file name>&form=portal&document=<DC-id>` | body: the raw file bytes (`fetch(url, {method: 'POST', body: file, headers: {Authorization}})`) → `{ok, id, name, sizeKb}`; marks that requested document received |

## Design

Same brand as the public site (Brindlewick: deep ink green primary, warm ivory, terracotta accent, the serif headings
and sans text already in the app). The staff app is a **dense, quiet, professional work tool**, not a marketing page:
neutral surfaces, the brand colours used sparingly (primary buttons, active nav, status chips), 14px base text in
tables, tabular numbers, sticky table headers, row hover, keyboard focus rings. Light theme. Desktop first for
`/staff` (it must still work at 375px: the sidebar becomes a top menu button and tables become stacked cards); phone
first for `/tax/portal`.

**References for structure only (not clones).** Take layout ideas from well-known products, but copy no text, logos,
icons, colours, illustrations or brand names, and nothing so close it reads as theirs:
- the sidebar + top bar shell, client list with saved filters, and client page with tabs: modern accounting
  practice-management tools (the TaxDome / Karbon / Canopy category);
- the pipeline board: a kanban board in the style of Trello or Linear (columns with counts, compact cards);
- the dashboard: a SaaS admin dashboard in the style of Stripe or Supabase (stat tiles, small charts, recent activity);
- the client portal: a bank or patient-portal home (status card first, then to-dos).
Write these as a short comment at the top of each layout file (for example
`// Structure inspired by practice-management client pages; Brindlewick's own design`).

The demo labelling of the public site applies: the slim sticky `data-testid="demo-banner"` bar on every `/staff` and
`/tax/portal` page, with the text "Demo: Brindlewick is a fictional firm. Every client and record here is made-up
sample data."; `document.title` "<Page> · Brindlewick Practice (Demo)" on `/staff`, "<Page> · Brindlewick Client
Portal (Demo)" on the portal.

## /staff: the practice app

Routes (all client-side, `react-router`; never full page loads, because the voice call lives in the page):

- **`/staff`: sign in.** A clean centered card: the Brindlewick mark, "Practice app", and a staff picker: one large
  button "Continue as Priya Raghunathan, CPA · Tax Manager" (`data-testid="staff-login"`, posts
  `{staff: "st-pra"}`) and a small "Sign in as someone else" select with these five (the staff list needs a session,
  so these are fixed): st-mva Marisol Ventura-Akande (Managing Partner), st-dwh Desmond Whitlow (Partner, Business
  Tax), st-pra Priya Raghunathan (Tax Manager), st-hna Hana Nakashima (Senior Accountant), st-ivo Ines Vogel-Abara
  (Staff Accountant). Under it, small: "Demo sign-in, no password.
  Every record is fictional." If a token is already stored, go straight to `/staff/dashboard`.
- **The shell** (every page after sign-in): a left sidebar (`data-testid="staff-nav"`, 240px, collapsible to icons)
  with sections: Dashboard; Clients; Work (Pipeline, Engagements, Work queue, Documents, IRS notices); Calendar;
  Billing; Messages (with the unread count); Tasks; Reports; Website submissions; Audit log. A top bar with a global
  search box (searches clients through `/api/staff/clients?q=`; Enter opens `/staff/clients?q=…`), a "New" menu (New
  engagement, New task, New message), and the signed-in person (avatar from `staff.avatar`, name, role, "Sign out").
- **`/staff/dashboard`** (`data-testid="staff-dashboard"`): "Good morning, Priya" with today's date; stat tiles (open
  engagements, overdue, documents requested, notices due this week, overdue invoices, collected this month, unread
  messages); the 2025 pipeline as a horizontal stacked bar with each stage's count (click a stage → the pipeline);
  "My queue" (the 10 nearest due with stage chips); "This week" (appointments); "My tasks" (open/late counts with a link).
- **`/staff/clients`**: the client list. Search box (`data-testid="staff-client-search"`), a kind toggle (All,
  Households, Businesses), filter selects (preparer, office, tag, stage, industry) and sort; a table
  (`data-testid="staff-client-row"` on each row): name with a kind icon, ID, city/state, preparer, detail, next due,
  stage chip, tags. Pagination at the bottom (`data-testid="staff-pagination"`: "1-25 of 4,757", previous/next, page
  number input). Above the table a one-line summary (`data-testid="staff-list-summary"`, also carrying the attribute
  `data-copilot-summary`): for example "4,757 clients", "12 clients matching garcia". **Every filter, the search, sort
  and page live in the URL query string** (`/staff/clients?q=garcia&kind=household&page=2`) and the page reads them on
  load, so a link or the copilot can open any filtered view. This rule applies to every list page below.
- **`/staff/clients/:id`** (`data-testid="staff-client-detail"`): a header with the name, ID, kind, address, preparer,
  client since, tags, and quick totals (billed, paid, outstanding, open notices, missing documents); then tabs
  (`data-testid="staff-client-tab"` on each tab trigger, and the active tab in the URL as `?tab=`): Overview (people in
  the household with relation and age, or the business's EIN, entity, industry, employees, fiscal year end, owner;
  related households/businesses as links), Engagements (table with stage chips; each row's stage can be changed with a
  select that posts `/api/staff/stage` after the person picks it), Documents (requested/received, with a "Request
  document" dialog posting `/api/staff/doc-request`), Notices, Billing (invoices with paid/outstanding), Messages (the
  threads; open one inline; reply box), Appointments, Tasks, Payroll (businesses only: pay runs), Activity (the audit
  trail for this client).
- **`/staff/pipeline`** (`data-testid="staff-pipeline"`): the six stage columns (`data-testid="staff-pipeline-column"`)
  side by side (horizontal scroll inside the board on small screens), each with its label and full `total`, and up to
  30 compact cards (`data-testid="staff-pipeline-card"`): client name, form and year, due date (red when past), a
  priority dot, a paperclip with the missing-document count. Filters: year, preparer. A card opens the client. Moving
  a card: a small "Move to…" menu on the card (no drag and drop needed) that posts `/api/staff/stage`.
- **`/staff/engagements`** (`data-testid="staff-engagements"`): the engagement table with filters stage, year, form,
  preparer, due within, search. Title changes with the filter ("Returns waiting on documents" for stage=docs_in,
  "Returns in review" for stage=review). Summary line with `data-copilot-summary`, for example "118 returns waiting on
  documents".
- **`/staff/engagements/new`**: the new-engagement form (exact markup below).
- **`/staff/queue`** (`data-testid="staff-queue"`): the work queue by deadline: grouped "Overdue", "Due this week",
  "Due in 30 days", "Later"; filter by preparer (default: everyone; a "Mine" toggle); days late in red.
- **`/staff/documents`** (`data-testid="staff-documents"`): outstanding and received documents; status tabs
  (Requested, Received); days waiting; client links.
- **`/staff/notices`** (`data-testid="staff-notices"`): IRS notices with code (monospace chip, e.g. CP2000), title,
  client, tax year, amount, response due with days left (amber under 14, red under 7 or past), status, assignee.
  Filters status and due within (This week = 7, 30 days). Summary line with `data-copilot-summary`, for example
  "9 notices due in the next 7 days".
- **`/staff/calendar`** (`data-testid="staff-calendar"`): a week view (Mon-Fri, 8 AM-6 PM grid) of appointments,
  coloured by kind; staff filter (default: the signed-in person; "Everyone"); previous/next week and Today; on a phone,
  an agenda list. `from` and `staff` in the URL.
- **`/staff/billing`** (`data-testid="staff-billing"`): invoices with status tabs (All, Open, Overdue, Partial,
  Paid), search by client or invoice number, totals row; clicking an invoice opens a side sheet with its lines and
  payments.
- **`/staff/messages`** (`data-testid="staff-messages"`): two-pane inbox (thread list | conversation,
  `data-testid="staff-thread"`), filters Mine/Unread, reply box that posts `/api/staff/message`.
- **`/staff/tasks`** (`data-testid="staff-tasks"`): my tasks by default (`assignee=me`), status tabs, a checkbox or
  status select that posts `/api/staff/task-status`, a "New task" dialog posting `/api/staff/task`.
- **`/staff/reports`** (`data-testid="staff-reports"`): charts with the app's existing chart library (recharts if
  present): collections by month (bar), receivables aging (bar), 2025 return mix (table with fees), open and overdue
  work by preparer (table), most common notices (list).
- **`/staff/submissions`** (`data-testid="staff-submissions"`): forms people sent from the public website (newest
  first): reference, form, received, and a readable view of the fields.
- **`/staff/audit`** (`data-testid="staff-audit"`): the audit log, filter by person, entity and action; monospace
  timestamps.

### The new-engagement form (exact markup the copilot reads)

The copilot reads this form from the DOM and fills it with the person; it never presses the button. Render exactly
these native elements, ids, names, values and attributes (style them, but don't replace them with custom widgets):

```html
<form data-copilot-form id="engagement" data-testid="staff-engagement-form" autocomplete="off">  <!-- onSubmit: preventDefault, POST /api/staff/engagement, show errors or the saved state -->
  <input id="eng_client" name="eng_client" required data-copilot-ask="Which client is this for? Say the household or business name."
         placeholder="Start typing a household or business">
  <!-- as the person or the copilot types (debounce 250ms), GET /api/staff/find?q= and show the matches under the field
       as buttons; picking one sets the hidden client_ref and shows "Garcia household · HH-20388 · Port Alexander".
       When the typed text exactly equals one match's name and there is only one such match, pick it automatically. -->
  <input type="hidden" id="eng_client_ref" name="client_ref">
  <select id="eng_kind" name="kind" required data-copilot-ask="What kind of engagement is it">
    <option value="">Choose one</option>
    <option value="Individual return" data-copilot-also="individual return, personal return, 1040, tax return">Individual return</option>
    <option value="Business return" data-copilot-also="business return, s corp return, partnership return, corporate return">Business return</option>
    <option value="Amended return" data-copilot-also="amended return, amendment, 1040-x, amend">Amended return</option>
    <option value="Prior-year return" data-copilot-also="prior-year return, prior year, back taxes, late return">Prior-year return</option>
    <option value="Tax planning" data-copilot-also="tax planning, planning, projection">Tax planning</option>
    <option value="Notice response" data-copilot-also="notice response, irs notice, notice, letter">Notice response</option>
    <option value="Monthly bookkeeping" data-copilot-also="bookkeeping, monthly bookkeeping, books">Monthly bookkeeping</option>
    <option value="Payroll" data-copilot-also="payroll">Payroll</option>
    <option value="Nonprofit return" data-copilot-also="nonprofit return, 990, exempt organization">Nonprofit return</option>
    <option value="Fiduciary return" data-copilot-also="fiduciary return, trust return, estate return, 1041">Fiduciary return</option>
  </select>
  <select id="eng_form" name="form" required data-copilot-ask="Which form">
    <option value="">Choose one</option>
    <option value="1040" data-copilot-also="1040, ten forty">1040</option>
    <option value="1040-X" data-copilot-also="1040-x, 1040 x, ten forty x">1040-X</option>
    <option value="1120-S" data-copilot-also="1120-s, 1120 s, s corp">1120-S</option>
    <option value="1065" data-copilot-also="1065, partnership">1065</option>
    <option value="1120" data-copilot-also="1120, c corp">1120</option>
    <option value="990" data-copilot-also="990">990</option>
    <option value="990-EZ" data-copilot-also="990-ez, 990 ez">990-EZ</option>
    <option value="1041" data-copilot-also="1041">1041</option>
    <option value="941" data-copilot-also="941">941</option>
    <option value="Planning" data-copilot-also="planning, none, no form">Planning (no form)</option>
    <option value="Bookkeeping" data-copilot-also="bookkeeping">Bookkeeping (no form)</option>
    <option value="Notice" data-copilot-also="notice">Notice (no form)</option>
  </select>
  <select id="eng_year" name="tax_year" required data-copilot-ask="Which tax year">
    <option value="">Choose one</option>
    <option value="2026" data-copilot-also="2026, this year, twenty twenty six">2026</option>
    <option value="2025" data-copilot-also="2025, last year, twenty twenty five">2025</option>
    <option value="2024" data-copilot-also="2024, twenty twenty four">2024</option>
    <option value="2023" data-copilot-also="2023, twenty twenty three">2023</option>
    <option value="2022" data-copilot-also="2022, twenty twenty two">2022</option>
  </select>
  <select id="eng_preparer" name="preparer" required data-copilot-ask="Who's preparing it">
    <option value="">Choose one</option>
    <!-- one option per person from /api/staff/staff: value = id, label = name, data-copilot-also = "first name, full name" (e.g. "priya, priya raghunathan") -->
  </select>
  <select id="eng_reviewer" name="reviewer" data-copilot-ask="And who reviews it? Say none to leave it empty.">
    <option value="" data-copilot-also="none, no one, nobody, skip">No reviewer yet</option>
    <!-- the same people -->
  </select>
  <input id="eng_due" name="due" type="date" required>   <!-- the person picks the due date -->
  <input id="eng_fee" name="fee" inputmode="decimal" required pattern="[0-9,]+(\.[0-9]{2})?" placeholder="e.g. 425"
         data-copilot-ask="What's the fee, in dollars?">
  <textarea id="eng_notes" name="notes" rows="3" data-copilot-ask="Any notes for the preparer? Say none if not."></textarea>
  <button type="submit">Create engagement</button>
</form>
```

Labels: Client, Engagement type, Form, Tax year, Preparer, Reviewer, Due date, Fee, Notes (optional). Group under
"Client", "Work", "Schedule and fee". The field the copilot is asking about carries `data-copilot-active`: give it a
soft glow ring in the brand accent. On success: replace the form with a confirmation card (`data-testid="staff-saved"`)
"Engagement EN-1234567 created for Garcia household" with links "Open client" and "Create another". The page reads
`?client=HH-20388` to prefill the client (the client page's Engagements tab links here with it).

## /tax/portal: the client portal

- **`/tax/portal`: sign in.** A calm card: "Client portal", a short line "Clients sign in with their portal
  credentials. In this demo, either verify on a voice call (the assistant opens your portal) or use the sample
  client." Button "Open the sample client's portal" (`data-testid="portal-login-demo"`, posts `{demo: true}`). When
  the copilot has verified the caller on this call, `window.copilot?.verifiedCall?.()` returns the call's id (a
  string; otherwise empty): then post `{call: id}` instead and go straight in, showing "Verified on your call" for a
  moment. If a token is stored, go to `/tax/portal/home`.
- **`/tax/portal/home`** (`data-testid="portal-dashboard"`): "Welcome back, Vedant" and the household name; a return
  status card first (`data-testid="portal-return-status"`): the newest return's form and year, a six-step progress
  tracker with the pipeline stages in plain words (We sent your organizer → We have your documents → We're preparing
  your return → In review → E-filed → Accepted by the IRS), the date it reached its stage, the refund or balance due,
  and the preparer. Then to-do cards: documents still needed (count, link), invoices due (amount, link), unread
  messages, the next appointment, open IRS notices with respond-by dates. A small "Sample client: every detail is
  fictional" note.
- **`/tax/portal/documents`** (`data-testid="portal-documents"`): "Still needed" first (each with an Upload button:
  a native `<input type="file">`, posts to `/api/files?...&document=<id>`, then shows it as received), then received
  documents by tax year.
- **`/tax/portal/invoices`** (`data-testid="portal-invoices"`): invoices with status chips, lines, payments; a "Pay"
  button that only shows "Online payment is turned off in this demo."
- **`/tax/portal/messages`** (`data-testid="portal-messages"`): threads, open one, reply (posts
  `/api/portal/message`), "New message" with a subject.
- **`/tax/portal/appointments`** (`data-testid="portal-appointments"`): upcoming and past, with a "Book another" link
  to `/tax/book`.
- **`/tax/portal/organizer`** (`data-testid="portal-organizer"`): the tax-year organizer: the documents on file for
  this year's return (received ticks) and the checklist items grouped by situation, each with its form number and why
  it's needed.
- A portal top bar: Brindlewick mark, tabs (Home, Documents, Invoices, Messages, Appointments, Organizer; a bottom tab
  bar on a phone), the first name, Sign out.

## The copilot on these pages

Every `/staff` page mounts the copilot with `useCopilotMount(COPILOT_CONFIGS.staff)`, except
`/staff/engagements/new`, which mounts `COPILOT_CONFIGS.staffEngagement`. Every `/tax/portal` page mounts
`COPILOT_CONFIGS.tax` (both configs are defined in `src/lib/copilot.ts`; use them as they are). Show the same call bar
(**Start voice call** / **Type instead**), the call panel, the source chip and the source viewer as on the public
`/tax` pages (reuse those components). Register the client-side navigate with `window.copilot.onNavigate` in the
staff and portal layouts the same way the tax layout does, so the copilot can change page during a call. Before a
staff page sends its first request, also give the copilot the staff token so it can look clients up:
`window.copilot?.setAuth?.("staff", token)` (call it again after `copilot:ready` if the copilot wasn't there yet).

## Test hooks

All the `data-testid`s named above: `staff-login`, `staff-nav`, `staff-dashboard`, `staff-list-summary`,
`staff-pagination`, `staff-client-search`, `staff-client-row`, `staff-client-detail`, `staff-client-tab`,
`staff-pipeline`, `staff-pipeline-column`, `staff-pipeline-card`, `staff-engagements`, `staff-queue`,
`staff-documents`, `staff-notices`, `staff-calendar`, `staff-billing`, `staff-messages`, `staff-thread`, `staff-tasks`,
`staff-reports`, `staff-audit`, `staff-submissions`, `staff-engagement-form`, `staff-form-errors`, `staff-saved`,
`portal-login-demo`, `portal-dashboard`, `portal-return-status`, `portal-documents`, `portal-invoices`,
`portal-messages`, `portal-appointments`, `portal-organizer`. The contract check fails the build when any is missing,
when an engagement field id is missing, or when the app calls an `/api/` path outside library, site, forms, slots,
portal, staff, files and newsletter.

Update the preview stand-in `public/copilot/sdk.js` so it also implements `setAuth` (a no-op) and `verifiedCall` (returns "").

## Done means

- Every route above exists, reads only the practice API, and shows loading, error and empty states.
- Lists keep their filters, search, sort and page in the URL and restore them on load.
- The new-engagement form renders exactly as specified; errors from a 422 show under their fields.
- The staff app looks like a real product at 1280px and still works at 375px; the portal looks right at 375px.
- All other sites, the public `/tax` pages and the marketing page are unchanged.
- `npm run build` passes, including `scripts/check-copilot-contract.mjs`.
