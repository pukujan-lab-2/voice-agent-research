/**
 * Website Copilot shared types and helpers.
 * The app draws the call panel and drives it only through this API;
 * it never makes the copilot's decisions itself and never calls the backend.
 */

export type CopilotStatus =
  | "idle"
  | "waiting"
  | "speaking"
  | "listening"
  | "thinking"
  | "muted"
  | "text";

/** A part of a message shown as a link: a manual page "(page 3)", a cited source, a booking page. */
export interface CopilotLink {
  text: string;
  href: string;
  page?: number;
}

/** The document a copilot answer was quoted from. The app shows it in the source viewer when snapshot.source is set. */
export interface CopilotSource {
  /** Chip text: "IRS Pub 17 · p. 9" for a PDF source, "IRS Tax Topic 501 · Section" for a web-page source. */
  label: string;
  /** The document's name, e.g. "IRS Publication 17". */
  title: string;
  /** The credit line to show under the title, e.g. "Source: IRS Publication 17 (public domain)". */
  credit: string;
  /** The library id; load it with GET /api/library/doc?doc=<doc> (kind "pdf": render its pdf in pdf.js; "article": its body). */
  doc: string;
  /** PDF sources: the printed page the quote is on. Show it (and the next page) in pdf.js with the text layer on. */
  page?: number;
  /** The cited section's anchor in that document (its heading's id), if any. */
  anchor?: string;
  /** The original on irs.gov (open in a new tab). */
  href: string;
  /** The exact sentences quoted; the copilot highlights them itself once the viewer shows the document. */
  quote: string[];
  /** null while the copilot looks for the quote in the viewer, then true (highlighted) or false (not found on the page). */
  found: boolean | null;
}

export interface CopilotMessage {
  id: number;
  who: "bot" | "user";
  text: string;
  links: CopilotLink[];
  /** The source this answer was quoted from: show a chip (label) that calls copilot.showSource(id). */
  source?: CopilotSource;
}

/** A page the copilot can take the visitor to by voice ("take me to pricing"). */
export interface CopilotPage {
  path: string;
  title: string;
  also?: string[];
  /** The page with the form the copilot fills ("back to the form" goes here). */
  form?: boolean;
}

export interface ManualStep {
  n: number;
  page?: number;
  text: string;
}

export interface CopilotManual {
  label: string;
  title: string;
  doc?: string;
  steps: ManualStep[];
  /** What to say when the library has no answer. */
  unknown?: string;
}

/** A question desk over a document library: cited answers; personal-advice questions are offered a consultation. */
export interface CopilotDesk {
  greeting: string;
  advice: string;
  book?: { text: string; href: string };
}

export interface CopilotConfig {
  business: string;
  /** One short clause the copilot says once at the start of a call, inside its greeting. */
  note?: string;
  /** The site's pages, for spoken navigation. */
  pages?: CopilotPage[];
  /** The page for one guide: `${guidePage}/${doc}` (?page=N opens a PDF guide at that page, #anchor an article at a section). */
  guidePage?: string;
  form?: string;
  can?: string[];
  large?: boolean;
  manual?: CopilotManual;
  desk?: CopilotDesk;
  /** Caller verification ("check on my return"): handoff is what to offer when a caller can't be verified. */
  verify?: { handoff: string };
  /** The voice stacks visitors may pick from, and the business default (speech/stacks.json, decision 0012). */
  voice?: { stacks?: string[]; default?: string };
}

export interface CopilotLanguage {
  code: string;
  name: string;
  native: string;
}

export interface CopilotVoiceStack {
  id: string;
  label: string;
  languages: CopilotLanguage[];
}

/** The verified caller's return status (fictional sample data; never any identity details). */
export interface CopilotReturnCard {
  taxYear: number;
  status: string;
  updated: string;
  nextStep: string;
  preparer: string;
  amount: string | null;
  sample: true;
}

export interface CopilotSnapshot {
  mounted: boolean;
  open: boolean;
  voice: boolean;
  mic: "on" | "off" | "unavailable";
  textInput: boolean;
  status: CopilotStatus;
  busy: boolean;
  heard: string;
  mode: "form" | "guide" | "ask";
  modes: ("form" | "guide" | "ask")[];
  business: string;
  can: string[];
  large: boolean;
  messages: CopilotMessage[];
  /** When the call started (ms since the epoch); 0 when no call. */
  startedAt?: number;
  /** A slow model call: what to show, and when it should be done (ms since the epoch). */
  wait?: { text: string; until: number } | null;
  /** The source viewer: shown (side panel on desktop, bottom sheet on a phone) while this is set. */
  source?: CopilotSource | null;
  /** Shown as a card while set: the verified caller's return status. */
  account?: CopilotReturnCard | null;
  /** The voice stacks the picker offers, and the one the next or current call runs on. */
  voiceStacks?: CopilotVoiceStack[];
  stack?: string;
  /** The caller's language ("" = not picked: the agent asks), and what the picker offers. */
  language?: string;
  languages?: CopilotLanguage[];
  /** The language the recogniser last heard on this call. */
  spokenLanguage?: string;
}

export interface Copilot {
  mount(config: CopilotConfig): void;
  unmount(): void;
  start(opts: { voice: boolean }): void;
  send(text: string): void;
  toggleMic(): void;
  /** The caller's language, before or during a call ("" lets the agent ask). */
  setLanguage?(code: string): void;
  /** The visitor's voice stack, before a call. */
  setStack?(id: string): void;
  setMode(mode: "form" | "guide" | "ask"): void;
  setCovered(px: number): void;
  end(): void;
  /** Re-open the source of an earlier answer (its chip). */
  showSource(messageId: number): void;
  /** Close the source viewer. */
  closeSource(): void;
  /** The app's client-side navigate; the copilot calls it to change page without ending the call. Returns unsubscribe. */
  onNavigate(fn: (path: string) => void): () => void;
  /** Hand the copilot a session token ("staff") so it can look records up on the person's behalf. */
  setAuth?(kind: "staff" | "portal", token: string): void;
  /** The id of the call on which the caller has been verified, or "" when they have not been. */
  verifiedCall?(): string;
  subscribe(fn: () => void): () => void;
  getSnapshot(): CopilotSnapshot;
}

declare global {
  interface Window {
    copilot?: Copilot;
  }
}

/** One module-level constant snapshot, returned before the copilot is ready.
 *  Never create a new object literal per getSnapshot call — React loops forever. */
export const EMPTY_SNAPSHOT: CopilotSnapshot = {
  mounted: false,
  open: false,
  voice: false,
  mic: "off",
  textInput: false,
  status: "idle",
  busy: false,
  heard: "",
  mode: "form",
  modes: [],
  business: "",
  can: [],
  large: false,
  messages: [],
  source: null,
  account: null,
};

/** Every demo site lets visitors try each voice stack; the fast English one is the default (decision 0012). */
const VOICE: CopilotConfig["voice"] = { stacks: ["english-fast", "parakeet-kokoro", "whisper-pocket", "multilingual", "lfm3-audio"], default: "english-fast" };

/** Copilot configs for each form page. */
export const COPILOT_CONFIGS: Record<string, CopilotConfig> = {
  clinic: {
    business: "Tumbleberry Children's Clinic",
    voice: VOICE,
    form: "booking",
    can: [
      "Fill in this booking form with you",
      "Read back phone and email",
      "You press Next and Book yourself",
    ],
  },
  appliance: {
    business: "Kettlewisp Appliances",
    voice: VOICE,
    form: "service request",
    can: [
      "Walk you through the E24 fix",
      "Answer from the HDW-500 manual, with pages",
      "Fill the service request with you",
    ],
    manual: {
      label: "demo-hdw500",
      title: "Fixing error E24 (water not draining)",
      doc: "/docs/hdw500-manual.html",
      steps: [
        { n: 1, page: 7, text: "Press and hold Start for 3 seconds to cancel the program. Wait 10 minutes for the water to cool." },
        { n: 2, page: 7, text: "Turn the dishwasher off at the wall switch." },
        { n: 3, page: 7, text: "Pull out the bottom rack and lay a towel in front of the dishwasher." },
        { n: 4, page: 7, text: "Turn the filter a quarter turn to the left, lift it out and rinse it under warm water." },
        { n: 5, page: 7, text: "Check behind the dishwasher that the drain hose is not kinked or squashed." },
        { n: 6, page: 7, text: "Put the filter back until it clicks, turn the power on and run the Rinse program." },
      ],
    },
  },
  pricing: {
    business: "Larchmoss Studio",
    voice: VOICE,
    form: "quote request",
    can: [
      "Fill the quote request with you",
      "Read back your email",
      "You press Request a quote yourself",
    ],
  },
  itdesk: {
    business: "Cobblefin IT Desk",
    voice: VOICE,
    form: "ticket",
    can: [
      "File this ticket with you",
      "Explain the fields",
      "You press Submit ticket yourself",
    ],
  },
  pension: {
    business: "Saltmere Pension Fund",
    voice: VOICE,
    form: "R-17",
    large: true,
    can: [
      "Fill form R-17 with you, one step at a time",
      "Answer from the R-17 guide, with pages",
      "You press Submit yourself",
    ],
    manual: {
      label: "demo-r17",
      title: "Filling in form R-17",
      doc: "/docs/r17-guide.html",
      steps: [
        { n: 1, page: 2, text: "Find your member number on your annual statement. It starts with SPF." },
        { n: 2, page: 2, text: "Decide who your primary beneficiaries are and what share each gets. The shares must add up to 100 percent." },
        { n: 3, page: 3, text: "For each beneficiary, pick the payee code that says how they are related to you." },
        { n: 4, page: 4, text: "Sign Section C in front of one witness who is 18 or older and not a beneficiary." },
      ],
    },
  },
  tax: TAX_DESK_CONFIG(),
  taxIntake: TAX_INTAKE_CONFIG(),
  taxStart: taxForm("new-client", "Fills the new-client form with you, step by step"),
  taxSchedule: taxForm("appointment booking", "Finds an open time and books it with you"),
  taxNotice: taxForm("IRS notice", "Fills in the notice details with you"),
  taxPayroll: taxForm("payroll setup", "Fills the payroll setup with you"),
  taxAddress: taxForm("change of address", "Fills the change of address with you"),
  taxPaymentPlan: taxForm("payment plan request", "Fills the payment plan request with you"),
  taxPriorYear: taxForm("prior-year return request", "Fills the request with you"),
  taxRefer: taxForm("referral", "Fills the referral with you"),
  taxApply: taxForm("job application", "Fills the application with you"),
  taxContact: taxForm("contact", "Writes your message with you"),
  staff: STAFF_CONFIG(),
  staffEngagement: STAFF_ENGAGEMENT_CONFIG(),
};

// Brindlewick Tax & Accounting (fictional firm; its library is real IRS.gov text, public domain).
function TAX_BASE(): CopilotConfig {
  return {
    business: "Brindlewick Tax & Accounting",
    voice: VOICE,
    note: "this is a demo site, so no real details please",
    guidePage: "/tax/guides",
    pages: [
      { path: "/tax", title: "Home", also: ["home", "home page", "start", "main page"] },
      { path: "/tax/services", title: "Services", also: ["services", "what you do", "all services"] },
      { path: "/tax/services/individual", title: "Individual tax returns", also: ["individual returns", "tax returns", "personal returns", "1040"] },
      { path: "/tax/services/business", title: "Business tax returns", also: ["business returns", "business taxes", "s corp", "partnership returns", "corporate returns"] },
      { path: "/tax/services/bookkeeping", title: "Small-business bookkeeping", also: ["bookkeeping", "accounting", "books"] },
      { path: "/tax/services/payroll", title: "Payroll services", also: ["payroll", "payroll services"] },
      { path: "/tax/services/irs-notices", title: "IRS notice help", also: ["notice help", "irs notices", "notices", "letters", "irs letters"] },
      { path: "/tax/services/planning", title: "Tax planning", also: ["planning", "tax planning", "estimated taxes"] },
      { path: "/tax/services/prior-year", title: "Prior-year and amended returns", also: ["prior-year returns", "amended returns", "amendments", "back taxes", "late returns"] },
      { path: "/tax/services/state", title: "State returns", also: ["state returns", "state taxes", "multi-state"] },
      { path: "/tax/services/trusts-estates", title: "Trusts and estates", also: ["trusts", "estates", "trusts and estates", "1041", "estate tax"] },
      { path: "/tax/services/nonprofit", title: "Nonprofit returns", also: ["nonprofits", "nonprofit returns", "990", "exempt organizations"] },
      { path: "/tax/industries/rideshare-gig", title: "Rideshare and gig workers", also: ["rideshare", "gig work", "gig workers", "uber drivers", "delivery drivers"] },
      { path: "/tax/industries/real-estate", title: "Real estate", also: ["real estate", "landlords", "rental property", "realtors"] },
      { path: "/tax/industries/restaurants", title: "Restaurants", also: ["restaurants", "food service", "cafes"] },
      { path: "/tax/industries/contractors", title: "Contractors and trades", also: ["contractors", "trades", "construction"] },
      { path: "/tax/industries/medical", title: "Medical and dental practices", also: ["medical", "doctors", "dentists", "medical practices"] },
      { path: "/tax/industries/crypto", title: "Crypto and digital assets", also: ["crypto", "cryptocurrency", "digital assets", "bitcoin"] },
      { path: "/tax/pricing", title: "Pricing", also: ["pricing", "prices", "fees", "cost", "costs", "rates"] },
      { path: "/tax/team", title: "Our team", also: ["team", "people", "staff", "preparers", "accountants"] },
      { path: "/tax/locations", title: "Locations", also: ["locations", "offices", "office hours", "directions", "where are you"] },
      { path: "/tax/careers", title: "Careers", also: ["careers", "jobs", "job openings", "work here", "hiring"] },
      { path: "/tax/reviews", title: "Reviews", also: ["reviews", "testimonials", "what clients say"] },
      { path: "/tax/blog", title: "Articles", also: ["blog", "articles", "news", "insights"] },
      { path: "/tax/tools/calendar", title: "Tax calendar", also: ["tax calendar", "deadlines", "due dates", "calendar"] },
      { path: "/tax/tools/checklist", title: "Document checklist", also: ["checklist", "document checklist", "what to bring", "documents i need"] },
      { path: "/tax/tools/quarterly", title: "Quarterly estimate calculator", also: ["quarterly estimate", "estimated tax calculator", "quarterly calculator"] },
      { path: "/tax/tools/mileage", title: "Mileage calculator", also: ["mileage", "mileage calculator", "mileage rate"] },
      { path: "/tax/tools/se-tax", title: "Self-employment tax calculator", also: ["self-employment tax", "se tax", "self employment calculator"] },
      { path: "/tax/tools/refund-status", title: "Where's my refund", also: ["refund status", "where's my refund", "wheres my refund", "my refund"] },
      { path: "/tax/about", title: "About us", also: ["about", "about us", "about the firm", "about the demo"] },
      { path: "/tax/guides", title: "Tax Guides", also: ["guides", "tax guides", "library", "publications"] },
      { path: "/tax/faq", title: "Tax FAQ", also: ["faq", "questions", "frequently asked questions"] },
      { path: "/tax/contact", title: "Contact us", also: ["contact", "contact us", "send a message", "get in touch"] },
      { path: "/tax/portal", title: "Client portal", also: ["portal", "client portal", "my portal", "client login", "log in", "sign in"] },
      { path: "/tax/start", title: "Become a client", also: ["become a client", "new client", "get started", "sign up", "new client form"] },
      { path: "/tax/schedule", title: "Book an appointment", also: ["book an appointment", "schedule an appointment", "appointment times", "available times", "schedule"] },
      { path: "/tax/notice", title: "Send us an IRS notice", also: ["send a notice", "upload a notice", "i got a letter", "irs notice form"] },
      { path: "/tax/payroll-setup", title: "Payroll setup", also: ["payroll setup", "set up payroll", "start payroll"] },
      { path: "/tax/address-change", title: "Change of address", also: ["change of address", "change my address", "i moved", "new address"] },
      { path: "/tax/payment-plan", title: "Payment plan request", also: ["payment plan", "installment agreement", "pay over time", "i can't pay"] },
      { path: "/tax/prior-year", title: "Prior-year return request", also: ["prior-year return", "copy of my return", "old return", "transcript", "copy of last year's return"] },
      { path: "/tax/refer", title: "Refer a friend", also: ["refer a friend", "referral", "refer someone"] },
      { path: "/tax/book", title: "Book a consultation", also: ["booking", "book", "intake", "intake form", "the form", "consultation", "free consultation", "appointment"], form: true },
    ],
    manual: {
      label: "irs",
      title: "Tax Guides",
      steps: [],
      unknown: "I don't know. I couldn't find that in the tax guides I answer from, and I only answer from them. A preparer can look into it with you at a consultation.",
    },
    desk: {
      greeting:
        "Hi, I'm Brindlewick's assistant. Ask me a tax question and I'll answer from the IRS guides and show you the page it comes from. I can also take you around the site, fill in the consultation form with you, and, if you're a client, check on your return once I've verified who you are. I can't advise on your own situation, but a preparer can at a consultation.",
      advice:
        "That depends on your own situation, so it's one for a Brindlewick preparer: they'll go through it with you at a consultation. I only answer general questions from the tax guides.",
      book: { text: "Book a consultation", href: "/tax/book" },
    },
    verify: {
      handoff: "A Brindlewick team member can help you with that: book a consultation, or call the office at 555-0100 on weekdays.",
    },
  };
}
function TAX_DESK_CONFIG(): CopilotConfig {
  return { ...TAX_BASE(), can: ["Answers from the IRS guides, with the source", "Takes you to any page", "Books a consultation with you"] };
}
// A public form page: the copilot fills it with the visitor and never submits it.
function taxForm(form: string, first: string): CopilotConfig {
  const base = TAX_BASE();
  return { ...base, pages: base.pages!.map(p => ({ ...p, form: false })), form, can: [first, "Reads back names, numbers and emails", "You press the button yourself"] };
}
function TAX_INTAKE_CONFIG(): CopilotConfig {
  return { ...TAX_BASE(), form: "consultation request", can: ["Fills this form with you", "Reads back your name, phone, email and notice code", "You press Request consultation yourself"] };
}

// Brindlewick's staff app (/staff): the practice-management CRM. The copilot opens clients and filtered lists by voice,
// reads out what a list shows, answers from the IRS library and fills staff forms with a read-back. It never saves,
// submits, moves a stage or deletes anything: a staff member presses the button.
function STAFF_BASE(): CopilotConfig {
  return {
    business: "Brindlewick Practice",
    voice: VOICE,
    note: "everything here is fictional sample data",
    guidePage: "/tax/guides",
    pages: [
      { path: "/staff/dashboard", title: "Dashboard", also: ["dashboard", "home", "overview", "my day"] },
      { path: "/staff/clients", title: "Clients", also: ["clients", "client list", "households", "businesses"] },
      { path: "/staff/pipeline", title: "Pipeline", also: ["pipeline", "board", "returns board", "kanban"] },
      { path: "/staff/engagements?stage=docs_in", title: "Returns waiting on documents", also: ["returns waiting on documents", "waiting on documents", "waiting for documents", "documents in", "docs in"] },
      { path: "/staff/engagements?stage=review", title: "Returns in review", also: ["returns in review", "in review", "review queue", "ready for review"] },
      { path: "/staff/queue", title: "Work queue", also: ["work queue", "queue", "my queue", "what's due", "deadlines"] },
      { path: "/staff/documents?status=requested", title: "Missing documents", also: ["missing documents", "outstanding documents", "requested documents", "documents"] },
      { path: "/staff/notices?due_within=7", title: "Notices due this week", also: ["notices due this week", "which notices are due this week", "notices this week", "notice deadlines"] },
      { path: "/staff/notices", title: "IRS notices", also: ["notices", "irs notices", "letters"] },
      { path: "/staff/calendar", title: "Calendar", also: ["calendar", "appointments", "schedule", "my schedule"] },
      { path: "/staff/billing?status=overdue", title: "Overdue invoices", also: ["overdue invoices", "who owes us", "unpaid invoices", "overdue"] },
      { path: "/staff/billing", title: "Billing", also: ["billing", "invoices", "payments", "time and billing"] },
      { path: "/staff/messages", title: "Messages", also: ["messages", "inbox", "secure messages"] },
      { path: "/staff/tasks", title: "Tasks", also: ["tasks", "my tasks", "to do", "to-do list"] },
      { path: "/staff/reports", title: "Reports", also: ["reports", "dashboards", "numbers", "revenue"] },
      { path: "/staff/submissions", title: "Website submissions", also: ["submissions", "website forms", "new leads", "leads"] },
      { path: "/staff/audit", title: "Audit log", also: ["audit log", "audit", "activity log", "history"] },
      { path: "/staff/engagements/new", title: "New engagement", also: ["new engagement", "start a new engagement", "open an engagement", "the form"], form: true },
    ],
    manual: {
      label: "irs",
      title: "Tax Guides",
      steps: [],
      unknown: "I couldn't find that in the IRS library I answer from.",
    },
    desk: {
      greeting:
        "Hi, I'm the practice assistant. I can open a client, show filtered lists like returns waiting on documents or notices due this week, answer from the IRS library with the source, and fill in a new engagement with you. I never save or submit anything; you press the button.",
      advice: "That's a judgement call for you or the reviewer. I only answer from the IRS library, with the source.",
    },
  };
}
function STAFF_CONFIG(): CopilotConfig {
  return { ...STAFF_BASE(), can: ["Opens any client or list", "Answers from the IRS library, with the source", "Fills a new engagement with you"] };
}
function STAFF_ENGAGEMENT_CONFIG(): CopilotConfig {
  return { ...STAFF_BASE(), form: "new engagement", can: ["Fills this form with you", "Reads back the client, year and fee", "You press Create engagement yourself"] };
}
