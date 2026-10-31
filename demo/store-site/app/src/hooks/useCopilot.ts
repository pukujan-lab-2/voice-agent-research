import { useSyncExternalStore, useCallback } from "react";
import { EMPTY_SNAPSHOT, type CopilotSnapshot } from "@/lib/copilot";

function getSnapshot(): CopilotSnapshot {
  return window.copilot ? window.copilot.getSnapshot() : EMPTY_SNAPSHOT;
}

function subscribe(callback: () => void): () => void {
  if (window.copilot) return window.copilot.subscribe(callback);
  let unsub: (() => void) | undefined;
  const ready = () => { unsub = window.copilot?.subscribe(callback); callback(); };
  window.addEventListener("copilot:ready", ready, { once: true });
  return () => { window.removeEventListener("copilot:ready", ready); unsub?.(); };
}

export function useCopilot() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const start = useCallback((voice: boolean) => window.copilot?.start({ voice }), []);
  const send = useCallback((text: string) => window.copilot?.send(text), []);
  const toggleMic = useCallback(() => window.copilot?.toggleMic(), []);
  const end = useCallback(() => window.copilot?.end(), []);
  return { snapshot, start, send, toggleMic, end };
}
