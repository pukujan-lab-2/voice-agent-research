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

export interface CopilotLink {
  page: number;
  href: string;
}

export interface CopilotMessage {
  id: number;
  who: "bot" | "user";
  text: string;
  links: CopilotLink[];
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
}

export interface CopilotConfig {
  business: string;
  form?: string;
  can?: string[];
  large?: boolean;
  manual?: CopilotManual;
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
  mode: "form" | "guide";
  modes: ("form" | "guide")[];
  business: string;
  can: string[];
  large: boolean;
  messages: CopilotMessage[];
}

export interface Copilot {
  mount(config: CopilotConfig): void;
  unmount(): void;
  start(opts: { voice: boolean }): void;
  send(text: string): void;
  toggleMic(): void;
  setMode(mode: "form" | "guide"): void;
  setCovered(px: number): void;
  end(): void;
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
};
