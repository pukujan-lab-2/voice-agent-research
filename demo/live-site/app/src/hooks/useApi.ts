import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorText } from "@/lib/practice";

export interface ApiState<T> {
  data: T | null;
  error: string;
  loading: boolean;
  reload: () => void;
}

/**
 * One request, with the three states every screen shows: skeleton while it runs, the API's own error text with a
 * Retry when it fails, and the data when it lands. `load` must be stable for the given `deps`.
 */
export function useApi<T>(load: (() => Promise<T>) | null, deps: unknown[]): ApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(load));
  const [nonce, setNonce] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!loadRef.current) {
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    loadRef.current()
      .then((result) => {
        if (!live) return;
        setData(result);
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(errorText(e));
        setData(null);
        setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, error, loading, reload };
}

/** A value that settles after `ms` of quiet, for search boxes. */
export function useDebounced<T>(value: T, ms = 250): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

/**
 * List state in the URL: every filter, the search, the sort and the page live in the query string, so a link (or the
 * copilot) can open any filtered view, and a reload restores it.
 */
export function useUrlState(defaults: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams();

  const get = useCallback(
    (key: string) => params.get(key) ?? defaults[key] ?? "",
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [params],
  );

  const set = useCallback(
    (patch: Record<string, string | number | undefined | null>, opts: { keepPage?: boolean } = {}) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [key, value] of Object.entries(patch)) {
            if (value === undefined || value === null || value === "" || value === defaults[key]) next.delete(key);
            else next.set(key, String(value));
          }
          if (!opts.keepPage && !("page" in patch)) next.delete("page");
          return next;
        },
        { replace: true },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setParams],
  );

  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const setPage = useCallback(
    (next: number) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next <= 1) p.delete("page");
          else p.set("page", String(next));
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return { get, set, page, setPage, params };
}

/**
 * A search box whose value follows the URL after a short quiet, so typing stays responsive and the URL still holds
 * the query (a link or the copilot can open any filtered view).
 */
export function useUrlSearch(q: string, apply: (value: string) => void, ms = 300): [string, (v: string) => void] {
  const [text, setText] = useState(q);
  useEffect(() => setText(q), [q]);
  const settled = useDebounced(text, ms);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  useEffect(() => {
    if (settled !== q) applyRef.current(settled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settled]);
  return [text, setText];
}

/** "1-25 of 4,757" for the pagination bar. */
export function pageRange(page: number, size: number, total: number): string {
  if (total === 0) return "0 of 0";
  const from = (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return `${from.toLocaleString("en-US")}-${to.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
}
