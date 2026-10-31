const SHOPPER_KEY = "bw-shopper";

function createId(): string {
  const cryptoObj = window.crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") {
    return cryptoObj.randomUUID();
  }
  return `bw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

let cached: string | null = null;

export function shopperId(): string {
  if (cached) return cached;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(SHOPPER_KEY);
  } catch {
    stored = null;
  }
  if (!stored) {
    stored = createId();
    try {
      window.localStorage.setItem(SHOPPER_KEY, stored);
    } catch {
      /* storage can be blocked; the id still lives for this session */
    }
  }
  cached = stored;
  return cached;
}

/** Installs window.bwShopper so the copilot shares this shopper's cart and orders. */
export function installShopper() {
  window.bwShopper = () => shopperId();
  shopperId();
}
