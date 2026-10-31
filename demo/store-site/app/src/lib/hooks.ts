import { useEffect, useState } from "react";
import { api, isAbort } from "./api";

interface State<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Minimal data loader with abort + retry. Every page gets a calm error and a
 * Retry button out of the same shape.
 */
export function useApi<T>(
  loader: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): State<T> & { reload: () => void } {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let alive = true;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    loader(controller.signal)
      .then((data) => {
        if (!alive) return;
        setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!alive || isAbort(error)) return;
        setState({
          data: null,
          error:
            error instanceof Error ? error.message : "Something went wrong.",
          loading: false,
        });
      });
    return () => {
      alive = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { ...state, reload: () => setNonce((n) => n + 1) };
}

export function useDocumentTitle(page: string) {
  useEffect(() => {
    document.title = page ? `${page} · Brambleway (Demo)` : "Brambleway (Demo)";
  }, [page]);
}

const RECENT_KEY = "bw-recently-viewed";
const RECENT_LIMIT = 12;

export interface RecentItem {
  id: number;
  slug: string;
  title: string;
  image: string;
  price: number;
}

export function readRecent(): RecentItem[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentItem[];
    return Array.isArray(parsed) ? parsed.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem) {
  const existing = readRecent().filter((entry) => entry.id !== item.id);
  const next = [item, ...existing].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore storage failures */
  }
  window.dispatchEvent(new CustomEvent("bw:recent-changed"));
}

export function useRecent() {
  const [items, setItems] = useState<RecentItem[]>(() => readRecent());
  useEffect(() => {
    const handler = () => setItems(readRecent());
    window.addEventListener("bw:recent-changed", handler);
    return () => window.removeEventListener("bw:recent-changed", handler);
  }, []);
  return items;
}

export function useCartSignal() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((n) => n + 1);
    window.addEventListener("bw:cart-changed", handler);
    return () => window.removeEventListener("bw:cart-changed", handler);
  }, []);
  return tick;
}

export function notifyCartChanged() {
  window.dispatchEvent(new CustomEvent("bw:cart-changed"));
}

export function useCart() {
  const tick = useCartSignal();
  const state = useApi<import("./types").Cart>(
    (signal) => api.cart(signal),
    [tick],
  );
  return state;
}

export function useWishlistCount() {
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const handler = () => setTick((value) => value + 1);
    window.addEventListener("bw:wishlist-changed", handler);
    return () => window.removeEventListener("bw:wishlist-changed", handler);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    api
      .wishlist(controller.signal)
      .then((res) => setCount(res.items?.length ?? 0))
      .catch(() => setCount(0));
    return () => controller.abort();
  }, [tick]);

  return count;
}
