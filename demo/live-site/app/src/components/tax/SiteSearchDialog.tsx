/**
 * The site search: a command-palette dialog over /api/site/search. Results come back grouped as Pages, Articles,
 * Tax Guides and People; the arrow keys move through them and Enter opens the highlighted one.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Search, X } from "lucide-react";
import { useDebounced } from "@/hooks/useApi";
import { errorText, siteGet, type SiteSearchResults } from "@/lib/practice";

interface Hit {
  key: string;
  group: string;
  title: string;
  note: string;
  to: string;
}

const EMPTY: SiteSearchResults = { pages: [], articles: [], guides: [], team: [] };

export function SiteSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SiteSearchResults>(EMPTY);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const settled = useDebounced(query.trim(), 220);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!settled) {
      setResults(EMPTY);
      setError("");
      setLoading(false);
      return;
    }
    let live = true;
    setLoading(true);
    setError("");
    siteGet<SiteSearchResults>("/search", { q: settled })
      .then((r) => {
        if (!live) return;
        setResults(r);
        setActive(0);
        setLoading(false);
      })
      .catch((e) => {
        if (!live) return;
        setError(errorText(e));
        setResults(EMPTY);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [settled]);

  const hits: Hit[] = useMemo(() => {
    const out: Hit[] = [];
    for (const p of results.pages ?? [])
      out.push({ key: `p-${p.path}`, group: "Pages", title: p.title, note: p.summary || p.section, to: p.path });
    for (const a of results.articles ?? [])
      out.push({ key: `a-${a.slug}`, group: "Articles", title: a.title, note: a.summary, to: `/tax/blog/${a.slug}` });
    for (const g of results.guides ?? [])
      out.push({
        key: `g-${g.doc}`,
        group: "Tax Guides",
        title: g.title,
        note: g.category,
        to: `/tax/guides/${encodeURIComponent(g.doc)}`,
      });
    for (const t of results.team ?? [])
      out.push({ key: `t-${t.id}`, group: "People", title: t.name, note: t.title, to: "/tax/team" });
    return out;
  }, [results]);

  const groups = useMemo(() => {
    const order = ["Pages", "Articles", "Tax Guides", "People"];
    return order
      .map((g) => ({ name: g, items: hits.filter((h) => h.group === g) }))
      .filter((g) => g.items.length);
  }, [hits]);

  const go = (hit: Hit) => {
    onClose();
    navigate(hit.to);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((n) => (n + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((n) => (n - 1 + hits.length) % hits.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[active];
      if (hit) go(hit);
    }
  };

  let index = -1;

  return (
    <div className="tax-search-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tax-search-dialog" role="dialog" aria-modal="true" aria-label="Search the site">
        <div className="tax-search-field">
          <Search size={18} aria-hidden="true" style={{ color: "hsl(var(--tax-muted))", flex: "none" }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, articles, tax guides and people"
            aria-label="Search the site"
            aria-controls="site-search-list"
            autoComplete="off"
          />
          {loading && <Loader2 size={16} className="tax-spin" aria-hidden="true" />}
          <button type="button" className="tax-icon-btn" aria-label="Close search" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="tax-search-list" id="site-search-list" role="listbox" aria-label="Results">
          {error && <p className="tax-search-empty">{error}</p>}
          {!error && !settled && <p className="tax-search-empty">Type to search the site.</p>}
          {!error && settled && !loading && hits.length === 0 && (
            <p className="tax-search-empty">Nothing matches “{settled}”. Try a shorter word.</p>
          )}
          {groups.map((group) => (
            <div key={group.name}>
              <div className="tax-search-group">{group.name}</div>
              {group.items.map((hit) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={hit.key}
                    type="button"
                    role="option"
                    aria-selected={active === i}
                    data-active={active === i}
                    className="tax-search-hit"
                    data-testid="site-search-result"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(hit)}
                  >
                    <strong>{hit.title}</strong>
                    {hit.note && <span>{hit.note}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
