/**
 * Website Copilot shared types and helpers.
 * The app draws the call panel and drives it only through this API;
 * it never makes the copilot's decisions itself and never calls the backend.
 */

export type CopilotStatus =
  | "idle"
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
}

export interface Copilot {
  mount(config: CopilotConfig): void;
  unmount(): void;
  start(opts: { voice: boolean }): void;
  send(text: string): void;
  toggleMic(): void;
  setMode(mode: "form" | "guide" | "ask"): void;
  setCovered(px: number): void;
  end(): void;
  /** Re-open the source of an earlier answer (its chip). */
  showSource(messageId: number): void;
  /** Close the source viewer. */
  closeSource(): void;
  /** The app's client-side navigate; the copilot calls it to change page without ending the call. Returns unsubscribe. */
  onNavigate(fn: (path: string) => void): () => void;
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
};

/** Copilot configs for each form page. */
export const COPILOT_CONFIGS: Record<string, CopilotConfig> = {
  clinic: {
    business: "Tumbleberry Children's Clinic",
    form: "booking",
    can: [
      "Fill in this booking form with you",
      "Read back phone and email",
      "You press Next and Book yourself",
    ],
  },
  appliance: {
    business: "Kettlewisp Appliances",
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
    form: "quote request",
    can: [
      "Fill the quote request with you",
      "Read back your email",
      "You press Request a quote yourself",
    ],
  },
  itdesk: {
    business: "Cobblefin IT Desk",
    form: "ticket",
    can: [
      "File this ticket with you",
      "Explain the fields",
      "You press Submit ticket yourself",
    ],
  },
  pension: {
    business: "Saltmere Pension Fund",
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
};

// Brindlewick Tax & Accounting (fictional firm; its library is real IRS.gov text, public domain).
function TAX_BASE(): CopilotConfig {
  return {
    business: "Brindlewick Tax & Accounting",
    note: "this is a demo site, so no real details please",
    guidePage: "/tax/guides",
    pages: [
      { path: "/tax", title: "Home", also: ["home", "home page", "start", "main page"] },
      { path: "/tax/services", title: "Services", also: ["services", "what you do", "all services"] },
      { path: "/tax/services/individual-returns", title: "Individual tax returns", also: ["individual returns", "tax returns", "personal returns", "1040"] },
      { path: "/tax/services/bookkeeping", title: "Small-business bookkeeping", also: ["bookkeeping", "accounting", "books"] },
      { path: "/tax/services/payroll", title: "Payroll services", also: ["payroll", "payroll services"] },
      { path: "/tax/services/irs-notices", title: "IRS notice help", also: ["notice help", "irs notices", "notices", "letters"] },
      { path: "/tax/services/planning", title: "Tax planning", also: ["planning", "tax planning", "estimated taxes"] },
      { path: "/tax/pricing", title: "Pricing", also: ["pricing", "prices", "fees", "cost", "costs", "rates"] },
      { path: "/tax/team", title: "Our team", also: ["team", "people", "staff", "preparers", "accountants"] },
      { path: "/tax/about", title: "About this demo", also: ["about", "about us", "about the demo"] },
      { path: "/tax/guides", title: "Tax Guides", also: ["guides", "tax guides", "library", "publications"] },
      { path: "/tax/faq", title: "Tax FAQ", also: ["faq", "questions", "frequently asked questions"] },
      { path: "/tax/book", title: "Book a consultation", also: ["booking", "book", "intake", "intake form", "the form", "consultation", "appointment"], form: true },
    ],
    manual: {
      label: "irs",
      title: "Tax Guides",
      steps: [],
      unknown: "I don't know. I couldn't find that in the tax guides I answer from, and I only answer from them. A preparer can look into it with you at a consultation.",
    },
    desk: {
      greeting:
        "Hi, I'm Brindlewick's assistant. Ask me a tax question and I'll answer from the IRS guides and show you the page it comes from. I can also take you around the site, and fill in the consultation form with you. I can't advise on your own situation, but a preparer can at a consultation.",
      advice:
        "That depends on your own situation, so it's one for a Brindlewick preparer: they'll go through it with you at a consultation. I only answer general questions from the tax guides.",
      book: { text: "Book a consultation", href: "/tax/book" },
    },
  };
}
function TAX_DESK_CONFIG(): CopilotConfig {
  return { ...TAX_BASE(), can: ["Answers from the IRS guides, with the source", "Takes you to any page", "Books a consultation with you"] };
}
function TAX_INTAKE_CONFIG(): CopilotConfig {
  return { ...TAX_BASE(), form: "consultation request", can: ["Fills this form with you", "Reads back your name, phone, email and notice code", "You press Request consultation yourself"] };
}
