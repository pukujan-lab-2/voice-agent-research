"""Brindlewick's practice database: a fictional accounting firm's whole book of business, made with Faker (MIT) and
written into the Octo workspace's Postgres (every table starts with bw_). Nothing here is a real person or business:

  bw_staff          14 people: credentials, roles, specialties, office, calendar hours
  bw_locations      3 offices (fictional towns), hours
  bw_clients        5,000 people (name, date of birth, SSN in never-issued areas, last four, zip, 555-01xx phone,
                    example.com email); 500 of them make the caller-verification set, with same-name pairs on purpose
  bw_households     the people grouped into households (spouses, dependants)
  bw_businesses     900 businesses (EIN prefix 00, which the IRS never issues), entity type, industry, owner
  bw_engagements    returns and recurring work, tax years 2023-2025: kind, pipeline stage, preparer, reviewer, due, fee
  bw_returns        the caller-verification card: each person's household's 2025 return (as before)
  bw_documents      20k+ requested / received documents per engagement (W-2, 1099-B, K-1, ...)
  bw_invoices       and bw_payments: time and billing
  bw_appointments   staff calendars, Aug 2026 - Jan 2027 (booked slots disappear from the public booking form)
  bw_notices        IRS notices with response deadlines (CP2000, CP14, CP501, LTR 1058, ...)
  bw_threads        and bw_messages: secure messages between clients and staff
  bw_payroll_runs   semi-monthly payroll for payroll clients
  bw_tasks          staff tasks
  bw_audit          the audit log (seeded history; the app appends to it)
Plus empty tables the site writes to: bw_submissions (every form a person submits), bw_drafts, bw_newsletter,
bw_uploads, bw_sessions_log.

Deterministic (seeded); re-running replaces every bw_ table's rows. Usage:
  uv run --with faker==33.1.0 python tools/bw_crm.py   (then tools/bw_avatars.mjs for the staff portraits)
"""
import datetime as dt, json, pathlib, random, sys, unicodedata, urllib.error, urllib.request

HERE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(HERE.parent.parent / "copilot-engine" / "tools"))
import paddle_passages as pp  # noqa: E402  (reads the Octo key/workspace from ~/Documents/projects/.env, never printed)
from faker import Faker  # noqa: E402

BASE = "https://octodb.design-bakery.com/api"
TODAY = dt.date(2026, 10, 31)
N_PEOPLE = 5000
N_VERIFY = 500  # the first 500 people: the caller-verification set (same-name pairs among them)


def octo(path, body):
    e = pp.env()
    req = urllib.request.Request(BASE + path, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + e["octo_db_chatbots"], "Content-Type": "application/json", "User-Agent": "chatbots-rag/0.1"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"Octo {e.code}: {e.read()[:400]!r} for {body.get('sql', '')[:160]!r}") from None


def sql(text, params=None):
    r = octo(f"/workspaces/{pp.env()['octo_db_chatbots_workspace']}/query", {"sql": text, **({"params": params} if params else {})})
    if isinstance(r, dict) and r.get("error"):
        raise RuntimeError(f"{r['error']}: {text[:120]}")
    return r


def insert(table, rows, chunk=1500):
    if not rows:
        return
    cols = ", ".join(rows[0].keys())
    for i in range(0, len(rows), chunk):
        sql(f"insert into {table} ({cols}) select {cols} from json_populate_recordset(null::{table}, $1::json)", [json.dumps(rows[i:i + chunk], default=str)])


SCHEMA = """
create table if not exists bw_staff (id text primary key, name text not null, first_name text not null, role text not null,
  credentials text, title text not null, email text not null, phone text not null, office text not null, bio text not null,
  specialties text[] not null, years int not null, languages text[] not null, avatar text not null, sort int not null,
  hours jsonb not null, accepts_new boolean not null default true);
create table if not exists bw_locations (id text primary key, name text not null, street text not null, city text not null,
  state text not null, zip text not null, phone text not null, hours jsonb not null, parking text not null, note text);
create table if not exists bw_clients (id text primary key, full_name text not null, first_name text not null, last_name text not null,
  dob date not null, ssn text not null unique, ssn4 text not null, zip text not null, phone text not null, email text not null,
  sample boolean not null default true);
alter table bw_clients add column if not exists household_id text;
alter table bw_clients add column if not exists relation text;
alter table bw_clients add column if not exists occupation text;
alter table bw_clients add column if not exists street text;
alter table bw_clients add column if not exists city text;
alter table bw_clients add column if not exists state text;
alter table bw_clients add column if not exists since int;
alter table bw_clients add column if not exists portal boolean default false;
create index if not exists bw_clients_exact on bw_clients (dob, ssn4, zip);
create index if not exists bw_clients_name on bw_clients (lower(last_name), lower(first_name));
create index if not exists bw_clients_household on bw_clients (household_id);
create table if not exists bw_households (id text primary key, name text not null, primary_client text not null, street text not null,
  city text not null, state text not null, zip text not null, filing_status text not null, dependents int not null,
  preparer text not null, office text not null, since int not null, tags text[] not null, risk text not null, notes text);
create index if not exists bw_households_name on bw_households (lower(name));
create index if not exists bw_households_preparer on bw_households (preparer);
create table if not exists bw_businesses (id text primary key, name text not null, ein text not null unique, entity text not null,
  industry text not null, owner_client text not null, household_id text, street text not null, city text not null, state text not null,
  zip text not null, employees int not null, fiscal_year_end text not null, services text[] not null, preparer text not null,
  since int not null, revenue_band text not null);
create index if not exists bw_businesses_name on bw_businesses (lower(name));
create index if not exists bw_businesses_industry on bw_businesses (industry);
create table if not exists bw_engagements (id text primary key, client_kind text not null, client_ref text not null, client_name text not null,
  kind text not null, form text not null, tax_year int not null, stage text not null, preparer text not null, reviewer text,
  due date not null, extended boolean not null default false, fee_cents int not null, opened date not null, updated date not null,
  efiled date, accepted date, refund_cents int, balance_cents int, priority text not null, notes text);
create index if not exists bw_eng_stage on bw_engagements (stage, due);
create index if not exists bw_eng_client on bw_engagements (client_ref);
create index if not exists bw_eng_preparer on bw_engagements (preparer, due);
create index if not exists bw_eng_year on bw_engagements (tax_year, stage);
create table if not exists bw_returns (client_id text primary key references bw_clients(id) on delete cascade, tax_year int not null,
  status text not null, updated date not null, next_step text not null, preparer text not null, amount text);
create table if not exists bw_documents (id text primary key, engagement_id text not null, client_ref text not null, name text not null,
  form text not null, issuer text, status text not null, requested date not null, received date, file_id text, size_kb int, source text);
create index if not exists bw_docs_eng on bw_documents (engagement_id);
create index if not exists bw_docs_client on bw_documents (client_ref);
create index if not exists bw_docs_status on bw_documents (status, requested);
create table if not exists bw_invoices (id text primary key, number text not null unique, client_ref text not null, client_name text not null,
  engagement_id text, issued date not null, due date not null, amount_cents int not null, paid_cents int not null, status text not null, lines jsonb not null);
create index if not exists bw_inv_client on bw_invoices (client_ref);
create index if not exists bw_inv_status on bw_invoices (status, due);
create table if not exists bw_payments (id text primary key, invoice_id text not null, client_ref text not null, paid date not null,
  amount_cents int not null, method text not null, reference text not null);
create index if not exists bw_pay_invoice on bw_payments (invoice_id);
create table if not exists bw_appointments (id text primary key, staff_id text not null, client_ref text, client_name text,
  starts timestamp not null, minutes int not null, kind text not null, mode text not null, status text not null, location text not null,
  notes text, ref text);
create index if not exists bw_appt_staff on bw_appointments (staff_id, starts);
create index if not exists bw_appt_client on bw_appointments (client_ref);
create index if not exists bw_appt_starts on bw_appointments (starts);
create table if not exists bw_notices (id text primary key, client_ref text not null, client_name text not null, code text not null,
  title text not null, tax_year int not null, received date not null, notice_date date not null, response_due date not null,
  amount_cents int, status text not null, assigned text not null, summary text not null);
create index if not exists bw_notices_due on bw_notices (status, response_due);
create index if not exists bw_notices_client on bw_notices (client_ref);
create table if not exists bw_threads (id text primary key, client_ref text not null, client_name text not null, subject text not null,
  staff_id text not null, updated timestamp not null, status text not null, unread_staff int not null, unread_client int not null);
create index if not exists bw_threads_client on bw_threads (client_ref, updated desc);
create index if not exists bw_threads_updated on bw_threads (updated desc);
create table if not exists bw_messages (id text primary key, thread_id text not null, sender text not null, sender_name text not null,
  sent timestamp not null, body text not null);
create index if not exists bw_messages_thread on bw_messages (thread_id, sent);
create table if not exists bw_payroll_runs (id text primary key, business_id text not null, period_start date not null, period_end date not null,
  pay_date date not null, employees int not null, gross_cents int not null, taxes_cents int not null, net_cents int not null, status text not null);
create index if not exists bw_payroll_business on bw_payroll_runs (business_id, pay_date desc);
create table if not exists bw_tasks (id text primary key, title text not null, assignee text not null, client_ref text, client_name text,
  engagement_id text, due date not null, status text not null, priority text not null, created date not null);
create index if not exists bw_tasks_assignee on bw_tasks (assignee, status, due);
create table if not exists bw_audit (id bigserial primary key, at timestamp not null default now(), actor text not null, actor_kind text not null,
  action text not null, entity text not null, entity_id text, detail text, ip text);
create index if not exists bw_audit_at on bw_audit (at desc);
create index if not exists bw_audit_entity on bw_audit (entity, entity_id);
create table if not exists bw_submissions (id text primary key, form text not null, ref text not null unique, created timestamp not null default now(),
  data jsonb not null, status text not null default 'new', client_ref text, ip text);
create index if not exists bw_submissions_form on bw_submissions (form, created desc);
create table if not exists bw_drafts (id text primary key, form text not null, data jsonb not null, updated timestamp not null default now());
create table if not exists bw_newsletter (email text primary key, created timestamp not null default now(), topics text[] not null default '{}', ip text);
create table if not exists bw_uploads (id text primary key, file_id text not null, name text not null, size_kb int not null, kind text not null,
  created timestamp not null default now(), form text, client_ref text, submission_ref text);
"""

STAFF = [
    # id, name, credentials, role, title, office, specialties, years, languages, bio
    ("st-mva", "Marisol Ventura-Akande", "EA", "partner", "Founder and Managing Partner", "harrow",
     ["IRS representation", "Payment plans and offers", "Small-business owners"], 22, ["English", "Spanish"],
     "Marisol opened Brindlewick in 2009 after twelve years in a regional firm's tax-controversy group. She still takes the hardest notice cases herself and runs the firm's representation practice."),
    ("st-dwh", "Desmond Whitlow", "CPA", "partner", "Partner, Business Tax", "harrow",
     ["S corporations and partnerships", "Multi-state returns", "Entity choice"], 18, ["English"],
     "Desmond leads the business-tax group: 1120-S and 1065 returns, owner compensation reviews and the year-end planning meetings that come with them."),
    ("st-pra", "Priya Raghunathan", "CPA", "manager", "Tax Manager, Individuals", "harrow",
     ["Equity compensation", "Rental real estate", "High-income households"], 12, ["English", "Tamil"],
     "Priya reviews most of the firm's complex 1040s, from RSU and ESPP sales to rental portfolios, and runs the individual-return review process."),
    ("st-tbi", "Tomasz Bielecki", "EA", "manager", "Tax Manager, Representation", "corbel",
     ["CP2000 responses", "Penalty abatement", "Prior-year filings"], 15, ["English", "Polish"],
     "Tomasz handles notices and catch-up filings: matching the IRS's numbers line by line, and getting non-filers back on track one year at a time."),
    ("st-lok", "Lindiwe Okonkwo-Hart", "CPA", "senior", "Senior Accountant, Nonprofits and Trusts", "harrow",
     ["Form 990 and 990-EZ", "Trusts and estates (1041)", "Fiduciary accounting"], 9, ["English"],
     "Lindiwe prepares the firm's 990s and fiduciary returns and sits with executors through their first estate year."),
    ("st-rfe", "Rafael Echeverría-Lund", "EA", "senior", "Senior Preparer", "corbel",
     ["Gig and self-employed", "Contractors", "Schedule C"], 8, ["English", "Spanish"],
     "Rafael works with rideshare drivers, tradespeople and freelancers: mileage logs, quarterly estimates and keeping Schedule C clean."),
    ("st-hna", "Hana Nakashima", "CPA", "senior", "Senior Accountant, Real Estate", "millbrook",
     ["Rental property", "1031 exchanges", "Cost segregation reviews"], 7, ["English", "Japanese"],
     "Hana handles landlords and real-estate partnerships, from depreciation schedules to passive-loss carryovers."),
    ("st-gor", "Gideon Oyelaran", "EA", "preparer", "Tax Preparer", "millbrook",
     ["Families and dependants", "Education credits", "Retirement distributions"], 5, ["English", "Yoruba"],
     "Gideon prepares family returns and is usually the first preparer new individual clients meet."),
    ("st-ebr", "Elspeth Brannigan", None, "bookkeeping", "Bookkeeping Lead", "harrow",
     ["Monthly close", "Restaurant bookkeeping", "Sales tax"], 11, ["English"],
     "Elspeth runs the bookkeeping team's monthly close for about ninety businesses and keeps the books tax-ready all year."),
    ("st-kmo", "Kwame Mensah-Ortiz", None, "bookkeeping", "Bookkeeper", "corbel",
     ["Medical practices", "Accounts payable", "Bank reconciliations"], 4, ["English", "Spanish"],
     "Kwame keeps the books for the firm's medical and dental practices."),
    ("st-sdu", "Saoirse Dunleavy", None, "payroll", "Payroll Specialist", "harrow",
     ["Semi-monthly payroll", "Forms 941 and 940", "New-hire reporting"], 6, ["English"],
     "Saoirse runs payroll for the firm's employer clients and files their quarterly 941s and annual 940s and W-2s."),
    ("st-ivo", "Ines Vogel-Abara", None, "staff", "Staff Accountant", "millbrook",
     ["Organizer follow-up", "Document intake", "Estimated payments"], 2, ["English", "German"],
     "Ines manages document intake and follow-up, so returns move from 'docs in' to 'in prep' without chasing."),
    ("st-afw", "Ada Fairweather", None, "client-services", "Client Services Coordinator", "harrow",
     ["Scheduling", "Portal help", "New-client onboarding"], 6, ["English"],
     "Ada books consultations, sets clients up on the portal and is the voice most callers hear first."),
    ("st-bqu", "Benedikt Quarshie", None, "operations", "Office and Operations Manager", "harrow",
     ["Billing", "Engagement letters", "Office operations"], 10, ["English"],
     "Benedikt runs billing, engagement letters and the three offices."),
]
PREPARERS = [s[0] for s in STAFF if s[3] in ("partner", "manager", "senior", "preparer")]
REVIEWERS = ["st-mva", "st-dwh", "st-pra", "st-tbi"]

LOCATIONS = [
    {"id": "harrow", "name": "Harrow Falls (main office)", "street": "1180 Larkspur Avenue, Suite 300", "city": "Harrow Falls", "state": "OR", "zip": "97999",
     "phone": "(555) 010-2210", "parking": "Free two-hour parking behind the building; enter from Quill Street.", "note": "Wheelchair accessible; lift to the third floor.",
     "hours": {"Mon-Thu": "8:30-5:30", "Fri": "8:30-4:00", "Sat (Feb 1 - Apr 15)": "9:00-1:00", "Sun": "Closed"}},
    {"id": "corbel", "name": "Corbel Point", "street": "42 Tidewater Row, Unit 6", "city": "Corbel Point", "state": "OR", "zip": "97998",
     "phone": "(555) 010-2240", "parking": "Street parking on Tidewater Row; the lot across the road is free after 5.", "note": "Ground floor, step-free.",
     "hours": {"Mon-Thu": "9:00-5:00", "Fri": "9:00-3:00", "Sat": "By appointment", "Sun": "Closed"}},
    {"id": "millbrook", "name": "Millbrook Crossing", "street": "915 Orchard Mill Road, Suite B", "city": "Millbrook Crossing", "state": "OR", "zip": "97997",
     "phone": "(555) 010-2270", "parking": "Shared lot with the Millbrook library.", "note": "Tuesday and Thursday evenings until 7 from January to April.",
     "hours": {"Mon-Fri": "9:00-5:00", "Tue and Thu (Jan-Apr)": "9:00-7:00", "Sat-Sun": "Closed"}},
]

INDUSTRIES = {
    "Restaurants and food": ["Bistro", "Taqueria", "Bakery", "Noodle Bar", "Coffee Roasters", "Catering Co."],
    "Construction and trades": ["Builders", "Plumbing", "Electric", "Roofing", "Remodeling", "Concrete"],
    "Real estate": ["Properties", "Realty Holdings", "Rentals", "Property Management"],
    "Medical and dental": ["Family Dental", "Physical Therapy", "Pediatrics", "Chiropractic", "Optometry"],
    "Professional services": ["Design Studio", "Consulting", "Law Office", "Architecture", "Marketing"],
    "Retail": ["Outfitters", "Bookshop", "Hardware", "Florist", "Boutique"],
    "Rideshare and delivery": ["Transport", "Courier", "Logistics"],
    "Nonprofit": ["Community Foundation", "Food Pantry", "Arts Council", "Youth League", "Historical Society"],
    "Crypto and fintech": ["Digital", "Labs", "Analytics"],
    "Trusts and estates": ["Family Trust", "Revocable Trust", "Estate of"],
}
ENTITY_FOR = {"Nonprofit": [("501(c)(3)", "990"), ("501(c)(3) small", "990-EZ")], "Trusts and estates": [("Trust", "1041"), ("Estate", "1041")]}
STAGES = ["organizer_sent", "docs_in", "in_prep", "review", "efiled", "accepted"]
STAGE_TEXT = {"organizer_sent": "Organizer sent", "docs_in": "Documents in", "in_prep": "In preparation", "review": "In review",
              "efiled": "E-filed, waiting for IRS acceptance", "accepted": "Accepted by the IRS"}
NEXT_STEP = {"organizer_sent": "Fill in your organizer and upload your documents in the portal.",
             "docs_in": "We have your documents; your preparer will start on your return soon.",
             "in_prep": "Your preparer is working on your return.",
             "review": "Your return is in final review. You'll get Form 8879 to sign.",
             "efiled": "The IRS usually accepts or rejects an e-filed return within 48 hours.",
             "accepted": "Done. Keep a copy of the return with your records."}
DOCS_1040 = [("W-2", "Form W-2"), ("1099-INT", "Form 1099-INT"), ("1099-DIV", "Form 1099-DIV"), ("1099-B", "Form 1099-B"), ("1098", "Form 1098 mortgage interest"),
             ("1099-NEC", "Form 1099-NEC"), ("1099-K", "Form 1099-K"), ("1099-R", "Form 1099-R"), ("SSA-1099", "Form SSA-1099"), ("1098-T", "Form 1098-T"),
             ("1095-A", "Form 1095-A"), ("K-1", "Schedule K-1"), ("Childcare", "Childcare provider statement"), ("Charity", "Charitable receipts"),
             ("Property tax", "Property tax statement"), ("Prior return", "Prior-year return"), ("Estimates", "Estimated payments record"), ("ID", "Photo ID (both spouses)")]
DOCS_BIZ = [("Bank", "Bank statements (12 months)"), ("P&L", "Profit and loss statement"), ("Balance", "Balance sheet"), ("Payroll", "Payroll summary (941s, W-3)"),
            ("Assets", "Fixed asset additions"), ("Loans", "Loan statements"), ("1099s issued", "1099-NEC forms issued"), ("Prior return", "Prior-year return"),
            ("Mileage", "Vehicle mileage log"), ("Inventory", "Year-end inventory count")]
NOTICES = [("CP2000", "Proposed changes to your tax return (unreported income)", 30), ("CP14", "Balance due", 21), ("CP501", "Reminder: balance due", 10),
           ("CP503", "Second reminder: balance due", 10), ("CP504", "Notice of intent to levy", 30), ("CP12", "Changes to your return; refund changed", 60),
           ("CP11", "Changes to your return; you owe tax", 60), ("LTR1058", "Final notice of intent to levy and your right to a hearing", 30),
           ("CP75", "Earned Income Credit audit: documents requested", 30), ("CP90", "Final notice: intent to seize", 30), ("CP161", "Business balance due", 21),
           ("CP2501", "Income discrepancy: please explain", 30), ("LTR12C", "We need more information to process your return", 30), ("CP59", "We haven't received your return", 30)]
SUBJECTS = ["Question about my 1099-B", "Uploaded my W-2s", "Estimated payment for Q4", "Signed 8879 attached", "CP2000 letter: what now?",
            "Change of address", "Can we move my appointment?", "Rental property depreciation", "Missing K-1", "Payment plan question",
            "Childcare provider's EIN", "Invoice question", "New baby: dependant for 2026", "Sold our house in June", "Payroll for new hire",
            "Quarterly 941 copy", "Organizer questions", "HSA contributions", "Amended return status", "Crypto transactions export"]
TASK_TITLES = ["Call client about missing {doc}", "Review {form} for {name}", "Send engagement letter to {name}", "Prepare Form 8879 for {name}",
               "Draft CP2000 response for {name}", "Follow up on {doc} from {name}", "Reconcile {name} bank accounts", "File extension for {name}",
               "Set up portal access for {name}", "Calculate Q4 estimate for {name}", "Update depreciation schedule for {name}", "Invoice {name}"]


def ascii_(s):
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def main():
    fake = Faker(["en_US", "es_MX", "en_IN", "en_GB"])  # names: a mix, as in a real client list
    Faker.seed(20261031)
    us = Faker("en_US")  # addresses: US only
    us.seed_instance(20261101)
    rnd = random.Random(20261031)
    used_ssn, used_ein = set(), set()

    def ssn():
        while True:
            area = rnd.choice([rnd.randint(900, 999), 0, 666])
            s = f"{area:03d}-{rnd.randint(1, 99):02d}-{rnd.randint(1, 9999):04d}"
            if s not in used_ssn:
                used_ssn.add(s)
                return s

    def ein():
        while True:
            e = f"00-{rnd.randint(1000000, 9999999)}"
            if e not in used_ein:
                used_ein.add(e)
                return e

    def person(first=None, last=None, dob=None, last4=None, zip_=None, minage=19, maxage=88):
        first = first or ascii_(fake.first_name())
        last = last or ascii_(fake.last_name())
        s = ssn()
        if last4:
            s = s[:-4] + last4
            used_ssn.add(s)
        dob = dob or fake.date_of_birth(minimum_age=minage, maximum_age=maxage)
        tag = rnd.randint(10, 99)
        return {"first_name": first, "last_name": last, "full_name": f"{first} {last}", "dob": dob.isoformat(), "ssn": s, "ssn4": s[-4:],
                "zip": zip_ or f"{rnd.randint(1001, 99950):05d}", "phone": f"555-01{rnd.randint(0, 99):02d}",
                "email": f"{first.lower()}.{last.lower()}{tag}@example.com".replace(" ", "").replace("'", "")}

    # --- the caller-verification set first, exactly as before (same seed, same order), then everyone else
    people = [person() for _ in range(N_VERIFY - 30)]
    for _ in range(10):
        a = person(); people += [a, person(a["first_name"], a["last_name"])]
    for _ in range(3):
        a = person(); people += [a, person(a["first_name"], a["last_name"], dt.date.fromisoformat(a["dob"]))]
    for _ in range(2):
        a = person()
        people += [a, person(a["first_name"], a["last_name"], dt.date.fromisoformat(a["dob"]), a["ssn4"])]
    for i, p in enumerate(people):
        p["id"] = f"BW-{10001 + i}"

    # --- households: each verification person heads one; the rest are spouses and adult dependants, or head their own
    households, hh_of = [], {}
    staff_by_office = {loc["id"]: [s[0] for s in STAFF if s[5] == loc["id"] and s[0] in PREPARERS] for loc in LOCATIONS}

    def new_household(head):
        hid = f"HH-{20001 + len(households)}"
        office = rnd.choices(["harrow", "corbel", "millbrook"], [5, 3, 2])[0]
        street = ascii_(us.street_address())
        city = ascii_(us.city())
        state = rnd.choice(["OR", "OR", "OR", "WA", "WA", "CA", "ID", "NV"])
        h = {"id": hid, "name": f"{head['last_name']} household", "primary_client": head["id"], "street": street, "city": city, "state": state,
             "zip": head["zip"], "filing_status": rnd.choices(["single", "mfj", "mfs", "hoh", "qss"], [36, 44, 4, 14, 2])[0],
             "dependents": 0, "preparer": rnd.choice(staff_by_office[office] or PREPARERS), "office": office, "since": rnd.randint(2009, 2026),
             "tags": [], "risk": rnd.choices(["low", "medium", "high"], [80, 16, 4])[0], "notes": None}
        households.append(h)
        hh_of[head["id"]] = h
        head.update(household_id=hid, relation="primary", street=street, city=city, state=state, since=h["since"])
        return h

    for p in people:
        new_household(p)
    while len(people) < N_PEOPLE:
        p = person()
        p["id"] = f"BW-{10001 + len(people)}"
        people.append(p)
        h = households[rnd.randrange(len(households))] if rnd.random() < 0.42 else None
        if h and h["filing_status"] in ("mfj", "mfs") and not any(q.get("relation") == "spouse" and q["household_id"] == h["id"] for q in people[-60:]):
            p.update(household_id=h["id"], relation="spouse", street=h["street"], city=h["city"], state=h["state"], zip=h["zip"], since=h["since"],
                     last_name=p["last_name"] if rnd.random() < 0.3 else h["name"].replace(" household", ""))
            p["full_name"] = f"{p['first_name']} {p['last_name']}"
        elif h and rnd.random() < 0.25:
            p.update(household_id=h["id"], relation="dependant", street=h["street"], city=h["city"], state=h["state"], zip=h["zip"], since=h["since"])
            h["dependents"] += 1
        else:
            new_household(p)
    for p in people:
        p["occupation"] = ascii_(fake.job())[:60]
        p["portal"] = rnd.random() < 0.62
    for h in households:
        if h["filing_status"] == "hoh" and h["dependents"] == 0:
            h["dependents"] = rnd.randint(1, 3)
        h["tags"] = rnd.sample(["rental", "self-employed", "equity comp", "crypto", "retired", "multi-state", "new client", "extension", "estimates", "HSA", "education"], rnd.randint(0, 3))
    people_by_id = {p["id"]: p for p in people}

    # --- businesses
    businesses = []
    owners = rnd.sample([p for p in people if p["relation"] == "primary"], 900)
    for i, o in enumerate(owners):
        ind = rnd.choices(list(INDUSTRIES), [12, 14, 13, 8, 12, 8, 9, 6, 4, 4])[0]
        if ind in ENTITY_FOR:
            entity, form = rnd.choice(ENTITY_FOR[ind])
        else:
            entity, form = rnd.choices([("S corporation", "1120-S"), ("Partnership", "1065"), ("Single-member LLC", "Schedule C"), ("C corporation", "1120")], [44, 24, 26, 6])[0]
        word = rnd.choice(INDUSTRIES[ind])
        base = rnd.choice([o["last_name"], ascii_(fake.last_name()), ascii_(us.city()).split()[0], rnd.choice(["Cedar", "Harbor", "Juniper", "Northgate", "Riverbend", "Summit", "Copperline", "Fernhill", "Larkspur", "Tidewater"])])
        name = f"Estate of {o['first_name']} {o['last_name']}" if word == "Estate of" else f"{base} {word}" + (rnd.choice([" LLC", " Inc.", ""]) if entity not in ("Trust", "Estate", "501(c)(3)", "501(c)(3) small") else "")
        h = hh_of.get(o["id"])
        services = ["tax"] + (["bookkeeping"] if rnd.random() < 0.45 else []) + (["payroll"] if entity not in ("Trust", "Estate") and rnd.random() < 0.38 else [])
        businesses.append({"id": f"BZ-{30001 + i}", "name": name, "ein": ein(), "entity": entity, "industry": ind, "owner_client": o["id"],
                           "household_id": h["id"] if h else None, "street": ascii_(us.street_address()), "city": h["city"] if h else ascii_(us.city()),
                           "state": h["state"] if h else "OR", "zip": h["zip"] if h else o["zip"], "employees": 0 if "payroll" not in services else rnd.randint(2, 48),
                           "fiscal_year_end": "12-31" if rnd.random() < 0.9 else rnd.choice(["06-30", "09-30", "03-31"]), "services": services,
                           "preparer": rnd.choice(["st-dwh", "st-lok", "st-hna", "st-rfe", "st-tbi"]) if form not in ("990", "990-EZ", "1041") else "st-lok",
                           "since": rnd.randint(2010, 2026), "revenue_band": rnd.choice(["under $250k", "$250k-$1M", "$1M-$5M", "over $5M"]), "_form": form})

    # --- engagements: 1040 per household per year (2023-2025), business returns, bookkeeping, plus extras
    eng, n = [], 0

    def due_for(form, year, extended):
        y = year + 1
        if form in ("1065", "1120-S"):
            return dt.date(y, 9, 15) if extended else dt.date(y, 3, 16 if y == 2026 else 15)
        if form in ("990", "990-EZ"):
            return dt.date(y, 11, 16 if y == 2026 else 15) if extended else dt.date(y, 5, 15)
        if form == "1041":
            return dt.date(y, 9, 30) if extended else dt.date(y, 4, 15)
        return dt.date(y, 10, 15) if extended else dt.date(y, 4, 15)

    def add_eng(kind, form, year, ref, ckind, cname, preparer, fee):
        nonlocal n
        n += 1
        extended = rnd.random() < (0.22 if year == 2025 else 0.15)
        due = due_for(form, year, extended)
        if year < 2025:
            stage = "accepted"
        else:
            # where TY2025 work stands on Oct 31, 2026
            if form in ("990", "990-EZ"):
                stage = rnd.choices(STAGES, [6, 10, 18, 14, 12, 40])[0]
            elif extended:
                stage = rnd.choices(STAGES, [5, 6, 9, 8, 10, 62])[0]
            else:
                stage = rnd.choices(STAGES, [1, 1, 2, 2, 3, 91])[0]
        opened = dt.date(year + 1, 1, rnd.randint(5, 28))
        efiled = accepted = None
        if stage in ("efiled", "accepted"):
            efiled = min(due, opened + dt.timedelta(days=rnd.randint(20, 200)))
            if stage == "efiled":
                efiled = TODAY - dt.timedelta(days=rnd.randint(0, 2))
            accepted = efiled + dt.timedelta(days=rnd.randint(1, 2)) if stage == "accepted" else None
        updated = accepted or efiled or (TODAY - dt.timedelta(days=rnd.randint(0, 40)))
        refund = rnd.randint(150, 9800) * 100 if form == "1040" and rnd.random() < 0.68 else None
        balance = None if refund or form in ("990", "990-EZ") else rnd.randint(80, 24000) * 100
        overdue = stage not in ("efiled", "accepted") and due < TODAY
        eng.append({"id": f"EN-{40000 + n}", "client_kind": ckind, "client_ref": ref, "client_name": cname, "kind": kind, "form": form, "tax_year": year,
                    "stage": stage, "preparer": preparer, "reviewer": rnd.choice([r for r in REVIEWERS if r != preparer] or REVIEWERS),
                    "due": due, "extended": extended, "fee_cents": fee * 100, "opened": opened, "updated": updated, "efiled": efiled, "accepted": accepted,
                    "refund_cents": refund, "balance_cents": balance, "priority": "high" if overdue or (due - TODAY).days < 21 else rnd.choice(["normal", "normal", "low"]),
                    "notes": None})
        return eng[-1]

    for h in households:
        for y in (2023, 2024, 2025):
            if y >= h["since"] - 1:
                complexity = len(h["tags"])
                add_eng("Individual return", "1040", y, h["id"], "household", h["name"], h["preparer"], rnd.choice([425, 495, 575, 650, 780, 950, 1250]) + 150 * complexity)
    for b in businesses:
        for y in (2023, 2024, 2025):
            if y >= b["since"] - 1 and b["_form"] != "Schedule C":
                fee = {"1120-S": 2400, "1065": 2600, "1120": 3200, "990": 2200, "990-EZ": 1100, "1041": 1500}[b["_form"]]
                add_eng({"990": "Nonprofit return", "990-EZ": "Nonprofit return", "1041": "Fiduciary return"}.get(b["_form"], "Business return"), b["_form"], y,
                        b["id"], "business", b["name"], b["preparer"], fee + rnd.randint(0, 12) * 100)
        if "bookkeeping" in b["services"]:
            e = add_eng("Monthly bookkeeping", "Bookkeeping", 2026, b["id"], "business", b["name"], rnd.choice(["st-ebr", "st-kmo"]), rnd.choice([350, 450, 650, 900]))
            e.update(stage="in_prep", due=dt.date(2026, 11, 15), priority="normal", efiled=None, accepted=None, refund_cents=None, balance_cents=None, extended=False, opened=dt.date(2026, 1, 2))
        if "payroll" in b["services"]:
            e = add_eng("Payroll", "941", 2026, b["id"], "business", b["name"], "st-sdu", 40 + 6 * b["employees"])
            e.update(stage="in_prep", due=dt.date(2026, 11, 2), priority="high", efiled=None, accepted=None, refund_cents=None, balance_cents=None, extended=False, opened=dt.date(2026, 1, 2))
    for h in rnd.sample(households, 140):  # amended returns and prior-year catch-up filings
        e = add_eng(rnd.choice(["Amended return", "Prior-year return"]), rnd.choice(["1040-X", "1040"]), rnd.choice([2022, 2023, 2024]), h["id"], "household", h["name"], rnd.choice(["st-tbi", "st-gor", "st-rfe"]), rnd.choice([450, 600, 750]))
        e.update(stage=rnd.choice(STAGES[:5]), due=TODAY + dt.timedelta(days=rnd.randint(-10, 45)), efiled=None, accepted=None, extended=False)
    for h in rnd.sample(households, 220):  # 2026 planning and Q4 estimates
        e = add_eng("Tax planning", "Planning", 2026, h["id"], "household", h["name"], h["preparer"], rnd.choice([350, 500, 750]))
        e.update(stage=rnd.choice(["organizer_sent", "docs_in", "in_prep", "review"]), due=dt.date(2026, 12, 15), efiled=None, accepted=None, extended=False, refund_cents=None, balance_cents=None)

    # --- the caller-verification card: each person's household's 2025 return
    returns = []
    by_ref_year = {}
    for e in eng:
        if e["form"] == "1040" and e["tax_year"] == 2025:
            by_ref_year[e["client_ref"]] = e
    staff_name = {s[0]: f"{s[1]}, {s[2]}" if s[2] else s[1] for s in STAFF}
    for p in people:
        e = by_ref_year.get(p["household_id"])
        if not e:
            continue
        amt = f"Refund ${e['refund_cents'] // 100:,}" if e["refund_cents"] else (f"Balance due ${e['balance_cents'] // 100:,}" if e["balance_cents"] else None)
        returns.append({"client_id": p["id"], "tax_year": 2025, "status": STAGE_TEXT[e["stage"]], "updated": e["updated"], "next_step": NEXT_STEP[e["stage"]],
                        "preparer": staff_name[e["preparer"]], "amount": amt})

    # --- documents
    docs, dn = [], 0
    for e in eng:
        if e["form"] in ("Planning", "941", "Bookkeeping"):
            continue
        pool = DOCS_BIZ if e["client_kind"] == "business" else DOCS_1040
        k = rnd.randint(1, 4) if e["client_kind"] == "household" else rnd.randint(1, 3)
        for form, name in rnd.sample(pool, k):
            dn += 1
            requested = e["opened"] + dt.timedelta(days=rnd.randint(0, 5))
            received_status = e["stage"] != "organizer_sent" and (e["stage"] != "docs_in" or rnd.random() < 0.8)
            got = received_status and rnd.random() < 0.97
            issuer = ascii_(fake.company()) if form in ("W-2", "1099-INT", "1099-DIV", "1099-B", "1098", "1099-NEC", "1099-K", "1099-R", "K-1", "Bank", "Loans") else None
            docs.append({"id": f"DC-{500000 + dn}", "engagement_id": e["id"], "client_ref": e["client_ref"], "name": f"{name}{' - ' + issuer if issuer else ''} ({e['tax_year']})",
                         "form": form, "issuer": issuer, "status": "received" if got else "requested", "requested": requested,
                         "received": (requested + dt.timedelta(days=rnd.randint(1, 60))) if got else None, "file_id": None,
                         "size_kb": rnd.randint(60, 2400) if got else None, "source": rnd.choice(["portal upload", "email", "dropped off", "IRS transcript"]) if got else None})

    # --- invoices and payments
    invoices, payments, inv_n = [], [], 0
    for e in eng:
        if e["stage"] in ("organizer_sent", "docs_in") and e["form"] not in ("Bookkeeping", "941"):
            continue
        months = list(range(1, 11)) if e["form"] in ("Bookkeeping", "941") else [None]
        for m in months:
            inv_n += 1
            issued = dt.date(2026, m, 1) if m else (e["efiled"] or e["updated"])
            due = issued + dt.timedelta(days=30)
            amount = e["fee_cents"]
            lines = [{"desc": f"{e['kind']} ({e['form']}{', ' + str(e['tax_year']) if not m else ''}){' - ' + dt.date(2026, m, 1).strftime('%B') if m else ''}", "cents": amount}]
            if not m and rnd.random() < 0.18:
                extra = rnd.choice([("Additional state return", 18500), ("Form 8949 detail (over 50 trades)", 12500), ("Rental property schedule", 15000), ("Extension filing", 7500)])
                lines.append({"desc": extra[0], "cents": extra[1]})
                amount += extra[1]
            paid = amount if (due < TODAY - dt.timedelta(days=rnd.randint(-5, 25)) and rnd.random() < 0.93) or rnd.random() < 0.4 else (amount // 2 if rnd.random() < 0.1 else 0)
            status = "paid" if paid >= amount else ("overdue" if due < TODAY else ("partial" if paid else "open"))
            iid = f"IV-{600000 + inv_n}"
            invoices.append({"id": iid, "number": f"BW-{issued.year}-{inv_n:06d}", "client_ref": e["client_ref"], "client_name": e["client_name"], "engagement_id": e["id"],
                             "issued": issued, "due": due, "amount_cents": amount, "paid_cents": paid, "status": status, "lines": lines})
            if paid:
                payments.append({"id": f"PY-{700000 + inv_n}", "invoice_id": iid, "client_ref": e["client_ref"], "paid": min(TODAY, issued + dt.timedelta(days=rnd.randint(0, 40))),
                                 "amount_cents": paid, "method": rnd.choice(["card", "ACH", "ACH", "check"]), "reference": f"{rnd.choice(['CH', 'AC', 'CK'])}{rnd.randint(100000, 999999)}"})

    # --- appointments on staff calendars: Aug 3, 2026 - Jan 29, 2027, weekdays, 30/60-min slots
    appts, an = [], 0
    hh_list = households
    kinds = [("Consultation", 30), ("Return review", 60), ("Planning meeting", 60), ("Notice review", 30), ("Signing", 30), ("Onboarding", 60), ("Payroll setup", 60)]
    d = dt.date(2026, 8, 3)
    while d <= dt.date(2027, 1, 29):
        if d.weekday() < 5:
            for s in STAFF:
                if s[3] in ("operations",):
                    continue
                density = 0.55 if d < TODAY else max(0.08, 0.5 - 0.004 * (d - TODAY).days)
                for hour in range(9, 17):
                    for minute in (0, 30):
                        if hour == 12 or rnd.random() > density * 0.5:
                            continue
                        kind, mins = rnd.choice(kinds)
                        h = hh_list[rnd.randrange(len(hh_list))]
                        start = dt.datetime(d.year, d.month, d.day, hour, minute)
                        if any(a["staff_id"] == s[0] and abs((a["starts"] - start).total_seconds()) < 3600 for a in appts[-12:]):
                            continue
                        an += 1
                        appts.append({"id": f"AP-{800000 + an}", "staff_id": s[0], "client_ref": h["id"], "client_name": h["name"], "starts": start, "minutes": mins,
                                      "kind": kind, "mode": rnd.choice(["office", "office", "video", "phone"]), "status": ("completed" if rnd.random() < 0.93 else "no-show") if start < dt.datetime(2026, 10, 31, 12) else "booked",
                                      "location": s[5], "notes": None, "ref": f"BK-{rnd.randint(100000, 999999)}"})
        d += dt.timedelta(days=1)

    # --- notices
    notices = []
    targets = rnd.sample(households, 520) + rnd.sample(businesses, 160)
    for i, t in enumerate(targets):
        code, title, days = rnd.choice(NOTICES if "household" in t.get("name", "") else [x for x in NOTICES if x[0] in ("CP161", "CP14", "CP2000", "LTR12C", "CP504", "CP2501")] or NOTICES)
        notice_date = TODAY - dt.timedelta(days=rnd.randint(0, 120))
        received = notice_date + dt.timedelta(days=rnd.randint(3, 12))
        due = notice_date + dt.timedelta(days=days)
        status = "resolved" if due < TODAY - dt.timedelta(days=10) and rnd.random() < 0.8 else rnd.choice(["new", "in progress", "in progress", "response sent", "waiting on IRS"])
        amount = rnd.randint(85, 18000) * 100 if code not in ("LTR12C", "CP59", "CP75") else None
        notices.append({"id": f"NT-{900000 + i}", "client_ref": t["id"], "client_name": t["name"], "code": code, "title": title, "tax_year": rnd.choice([2022, 2023, 2024, 2025]),
                        "received": received, "notice_date": notice_date, "response_due": due, "amount_cents": amount, "status": status,
                        "assigned": rnd.choice(["st-tbi", "st-tbi", "st-mva", "st-rfe"]),
                        "summary": f"{title}. {'Amount shown: $' + format(amount // 100, ',') + '.' if amount else ''} Respond by {due.strftime('%B %-d, %Y')}."})

    # --- secure messages
    threads, messages, mn = [], [], 0
    for i in range(2600):
        h = hh_list[rnd.randrange(len(hh_list))]
        head = people_by_id[h["primary_client"]]
        subj = rnd.choice(SUBJECTS)
        staff = h["preparer"] if rnd.random() < 0.7 else rnd.choice(["st-afw", "st-ivo", "st-bqu"])
        t0 = dt.datetime(2026, rnd.randint(1, 10), rnd.randint(1, 28), rnd.randint(8, 18), rnd.randint(0, 59))
        k = rnd.randint(1, 6)
        last = t0
        for j in range(k):
            mn += 1
            from_client = j % 2 == 0
            last = last + dt.timedelta(hours=rnd.randint(1, 50))
            body = (rnd.choice([f"Hi, {subj.lower()}. Can you take a look when you get a chance?", "I've uploaded it to the portal just now.", "Thanks, that makes sense.",
                                "Quick question before our meeting: do you need last year's return too?", "Is there anything else you need from me?"]) if from_client else
                    rnd.choice(["Thanks, got it. I'll add it to your file today.", "We still need your 1099-B from your broker before we can finish.",
                                "I've sent Form 8879 for e-signature. Once it's signed we'll e-file.", "Good question: I've booked 30 minutes on Thursday to go through it.",
                                "Your estimated payment for the fourth quarter is due January 15, 2027."]))
            messages.append({"id": f"MS-{1100000 + mn}", "thread_id": f"TH-{1000000 + i}", "sender": head["id"] if from_client else staff,
                             "sender_name": head["full_name"] if from_client else staff_name[staff].split(",")[0], "sent": min(last, dt.datetime(2026, 10, 31, 9)), "body": body})
        threads.append({"id": f"TH-{1000000 + i}", "client_ref": h["id"], "client_name": h["name"], "subject": subj, "staff_id": staff, "updated": min(last, dt.datetime(2026, 10, 31, 9)),
                        "status": "open" if last > dt.datetime(2026, 10, 1) else "closed", "unread_staff": 1 if k % 2 == 1 and last > dt.datetime(2026, 10, 20) else 0,
                        "unread_client": 1 if k % 2 == 0 and last > dt.datetime(2026, 10, 20) else 0})

    # --- payroll runs (semi-monthly, Jan - Oct 2026)
    runs = []
    for b in businesses:
        if "payroll" not in b["services"]:
            continue
        rate = rnd.randint(1700, 3600)
        for m in range(1, 11):
            for half in (0, 1):
                ps = dt.date(2026, m, 1 if half == 0 else 16)
                pe = dt.date(2026, m, 15) if half == 0 else (dt.date(2026, m + 1, 1) - dt.timedelta(days=1) if m < 12 else dt.date(2026, 12, 31))
                emp = max(1, b["employees"] + rnd.randint(-1, 1))
                gross = emp * rate * 100 + rnd.randint(0, 90000)
                taxes = int(gross * rnd.uniform(0.2, 0.27))
                runs.append({"id": f"PR-{b['id'][3:]}-{m:02d}{half}", "business_id": b["id"], "period_start": ps, "period_end": pe, "pay_date": pe + dt.timedelta(days=5),
                             "employees": emp, "gross_cents": gross, "taxes_cents": taxes, "net_cents": gross - taxes, "status": "paid"})

    # --- tasks
    tasks = []
    open_eng = [e for e in eng if e["stage"] not in ("accepted",)]
    for i in range(3200):
        e = rnd.choice(open_eng) if rnd.random() < 0.8 else rnd.choice(eng)
        tpl = rnd.choice(TASK_TITLES)
        title = tpl.format(doc=rnd.choice(DOCS_1040)[1], form=e["form"], name=e["client_name"])
        due = TODAY + dt.timedelta(days=rnd.randint(-20, 40))
        status = "done" if due < TODAY - dt.timedelta(days=3) and rnd.random() < 0.85 else rnd.choice(["open", "open", "in progress", "waiting"])
        tasks.append({"id": f"TK-{1200000 + i}", "title": title, "assignee": e["preparer"] if rnd.random() < 0.75 else rnd.choice([s[0] for s in STAFF]), "client_ref": e["client_ref"],
                      "client_name": e["client_name"], "engagement_id": e["id"], "due": due, "status": status, "priority": rnd.choice(["high", "normal", "normal", "low"]),
                      "created": due - dt.timedelta(days=rnd.randint(3, 30))})

    # --- audit log history
    audit = []
    actions = [("engagement.stage", "engagement"), ("document.received", "document"), ("invoice.sent", "invoice"), ("payment.recorded", "payment"),
               ("message.sent", "thread"), ("client.viewed", "household"), ("notice.logged", "notice"), ("appointment.booked", "appointment"), ("staff.login", "staff")]
    for _ in range(30000):
        a, ent = rnd.choice(actions)
        at = dt.datetime(2026, 10, 31, 9) - dt.timedelta(minutes=rnd.randint(1, 60 * 24 * 120))
        s = rnd.choice(STAFF)
        audit.append({"at": at, "actor": s[0], "actor_kind": "staff", "action": a, "entity": ent,
                      "entity_id": {"engagement": rnd.choice(eng)["id"], "document": f"DC-{500001 + rnd.randrange(dn)}", "household": rnd.choice(households)["id"]}.get(ent, ""),
                      "detail": None, "ip": f"10.20.{rnd.randint(0, 3)}.{rnd.randint(2, 250)}"})
    audit.sort(key=lambda r: r["at"])

    # --- staff and locations
    def hours(s):
        return {"mon": [9, 17], "tue": [9, 17], "wed": [9, 17], "thu": [9, 17], "fri": [9, 15 if s[5] != "millbrook" else 17]}
    staff_rows = [{"id": s[0], "name": s[1], "first_name": s[1].split()[0], "role": s[3], "credentials": s[2], "title": s[4],
                   "email": f"{s[1].split()[0].lower()}@brindlewick.example.com", "phone": f"(555) 010-22{10 + i:02d}", "office": s[5], "bio": s[9],
                   "specialties": s[6], "years": s[7], "languages": s[8], "avatar": f"/api/site/avatar?id={s[0]}", "sort": i, "hours": json.dumps(hours(s)),
                   "accepts_new": s[3] not in ("operations", "bookkeeping")} for i, s in enumerate(STAFF)]
    for loc in LOCATIONS:
        loc["hours"] = json.dumps(loc["hours"])

    for b in businesses:
        b.pop("_form")

    # --- write
    for stmt in SCHEMA.split(";"):
        if stmt.strip():
            sql(stmt)
    for t in ["bw_returns", "bw_documents", "bw_payments", "bw_invoices", "bw_appointments", "bw_notices", "bw_messages", "bw_threads", "bw_payroll_runs",
              "bw_tasks", "bw_audit", "bw_engagements", "bw_businesses", "bw_households", "bw_clients", "bw_staff", "bw_locations"]:
        sql(f"delete from {t}")
    assert all(int(p["ssn"][:3]) >= 900 or p["ssn"][:3] in ("000", "666") for p in people)
    for p in people:
        p.setdefault("relation", "primary")
    insert("bw_staff", staff_rows)
    insert("bw_locations", LOCATIONS)
    insert("bw_clients", people)
    insert("bw_households", households)
    insert("bw_businesses", businesses)
    insert("bw_engagements", eng)
    insert("bw_returns", returns)
    insert("bw_documents", docs)
    insert("bw_invoices", invoices)
    insert("bw_payments", payments)
    insert("bw_appointments", appts)
    insert("bw_notices", notices)
    insert("bw_threads", threads)
    insert("bw_messages", messages)
    insert("bw_payroll_runs", runs)
    insert("bw_tasks", tasks)
    insert("bw_audit", audit, chunk=3000)
    for t in ["bw_clients", "bw_households", "bw_businesses", "bw_engagements", "bw_documents", "bw_invoices", "bw_payments", "bw_appointments",
              "bw_notices", "bw_threads", "bw_messages", "bw_payroll_runs", "bw_tasks", "bw_audit"]:
        sql(f"analyze {t}")
    counts = sql("select (select count(*) from bw_clients) clients, (select count(*) from bw_households) households, (select count(*) from bw_businesses) businesses, "
                 "(select count(*) from bw_engagements) engagements, (select count(*) from bw_documents) documents, (select count(*) from bw_invoices) invoices, "
                 "(select count(*) from bw_payments) payments, (select count(*) from bw_appointments) appointments, (select count(*) from bw_notices) notices, "
                 "(select count(*) from bw_threads) threads, (select count(*) from bw_messages) messages, (select count(*) from bw_payroll_runs) payroll_runs, "
                 "(select count(*) from bw_tasks) tasks, (select count(*) from bw_audit) audit, (select count(*) from bw_returns) returns, "
                 "(select sum((ssn ~ '^(9|000|666)')::int) from bw_clients) unissued")["rows"][0]
    print(json.dumps(counts))


if __name__ == "__main__":
    main()
