/**
 * Brambleway's copilot, as the app sees it: window.copilot (loaded from /copilot/sdk.js) is always mounted and owns
 * every decision. The app only draws its snapshot (CopilotWidget) and lets it change page (onNavigate).
 */
export type CopilotStatus = "idle" | "speaking" | "listening" | "thinking" | "muted" | "text";

export interface CopilotLink { text: string; href: string; page?: number }

export interface CopilotMessage { id: number; who: "bot" | "user"; text: string; links: CopilotLink[] }

export interface CopilotSnapshot {
  mounted: boolean;
  open: boolean;
  voice: boolean;
  mic: "on" | "off" | "unavailable";
  textInput: boolean;
  status: CopilotStatus;
  busy: boolean;
  heard: string;
  /** "shop" while browsing; "form" while it fills the checkout form with the shopper. */
  mode: "shop" | "form";
  modes: never[];
  business: string;
  can: string[];
  large: boolean;
  messages: CopilotMessage[];
  startedAt?: number;
  wait?: { text: string; until: number } | null;
}

export interface Copilot {
  start(opts: { voice: boolean }): void;
  send(text: string): void;
  toggleMic(): void;
  setCovered(px: number): void;
  end(): void;
  /** The app's client-side navigate; the copilot calls it to change page without ending the call. Returns unsubscribe. */
  onNavigate(fn: (path: string) => void): () => void;
  subscribe(fn: () => void): () => void;
  getSnapshot(): CopilotSnapshot;
}

declare global {
  interface Window { copilot?: Copilot }
}

/** One module-level constant snapshot before the copilot is ready (a new literal per call would loop React). */
export const EMPTY_SNAPSHOT: CopilotSnapshot = {
  mounted: false, open: false, voice: false, mic: "off", textInput: false, status: "idle", busy: false, heard: "",
  mode: "shop", modes: [], business: "", can: [], large: false, messages: [],
};
