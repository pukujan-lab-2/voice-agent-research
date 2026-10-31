import { useSyncExternalStore, useCallback, useEffect, useRef } from "react";
import {
  EMPTY_SNAPSHOT,
  type CopilotSnapshot,
  type CopilotConfig,
} from "@/lib/copilot";

/**
 * useSyncExternalStore needs a stable snapshot.
 * Pass window.copilot.getSnapshot directly once the copilot is ready.
 * Before that, return one module-level constant (EMPTY_SNAPSHOT), never a
 * new object literal per call: React loops forever on that.
 */
function getSnapshot(): CopilotSnapshot {
  if (window.copilot) {
    return window.copilot.getSnapshot();
  }
  return EMPTY_SNAPSHOT;
}

function subscribe(callback: () => void): () => void {
  if (window.copilot) {
    return window.copilot.subscribe(callback);
  }
  // While not ready, subscribe to the copilot:ready event so we pick up changes.
  const handler = () => {
    if (window.copilot) {
      const unsub = window.copilot.subscribe(callback);
      callback();
      // We can't replace ourselves, but the subscribe above will keep working.
      // Store unsub for cleanup via a closure trick.
      (handler as unknown as { _unsub?: () => void })._unsub = unsub;
    }
  };
  window.addEventListener("copilot:ready", handler, { once: true });
  return () => {
    window.removeEventListener("copilot:ready", handler);
    const unsub = (handler as unknown as { _unsub?: () => void })._unsub;
    if (unsub) unsub();
  };
}

export function useCopilot() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const start = useCallback((voice: boolean) => {
    window.copilot?.start({ voice });
  }, []);

  const send = useCallback((text: string) => {
    window.copilot?.send(text);
  }, []);

  const toggleMic = useCallback(() => {
    window.copilot?.toggleMic();
  }, []);

  const setMode = useCallback((mode: "form" | "guide" | "ask") => {
    window.copilot?.setMode(mode);
  }, []);

  const end = useCallback(() => {
    window.copilot?.end();
  }, []);

  return { snapshot, start, send, toggleMic, setMode, end };
}

/**
 * Mounts the copilot with the given config when the component is on screen,
 * and unmounts when it leaves.
 */
export function useCopilotMount(config: CopilotConfig | null) {
  const configRef = useRef(config);
  configRef.current = config;

  useEffect(() => {
    if (!config) return;
    // Wait until copilot is ready, then mount.
    const doMount = () => {
      if (window.copilot && configRef.current) {
        window.copilot.mount(configRef.current);
      }
    };
    if (window.copilot) {
      doMount();
    } else {
      window.addEventListener("copilot:ready", doMount, { once: true });
    }
    return () => {
      window.removeEventListener("copilot:ready", doMount);
      window.copilot?.unmount();
    };
  }, [config]);
}
