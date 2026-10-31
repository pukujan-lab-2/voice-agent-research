import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search, ExternalLink, Loader2 } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { hostOf, sourceName, useTaxTitle, type TaxLibItem, type TaxLibStats, type TaxSearchResult } from "@/lib/tax";

// Hand edit: ABA's page loaded a static library.json of ~300 guides. The library is now tens of thousands of sources in
// Octo, so this page reads live counts (GET /api/library/stats, polled while the library loads) and one page of a
// collection at a time (GET /api/library/docs).
const PAGE = 60;
const fmt = (n: number) => n.toLocaleString("en-US");

export default function TaxGuides() {
  useTaxTitle("Tax Guides");

  const [stats, setStats] = useState<TaxLibStats | null>(null);
  const [filter, setFilter] = useState<string>("");
  const [docs, setDocs] = useState<TaxLibItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [names, setNames] = useState<Record<string, string>>({});
  const [listFailed, setListFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<TaxSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState(false);
  const requestId = useRef(0);

  // Live counts: the library is still being loaded into Octo, so they grow while you watch.
  useEffect(() => {
    let live = true;
    const load = () =>
      fetch("/api/library/stats")
        .then((r) => (r.ok ? r.json() : null))
        .then((json: TaxLibStats | null) => {
          if (live && json) setStats(json);
        })
        .catch(() => {});
    load();
    const t = window.setInterval(load, 30_000);
    return () => {
      live = false;
      window.clearInterval(t);
    };
  }, []);

  const loadDocs = (category: string, offset: number) =>
    fetch(`/api/library/docs?category=${encodeURIComponent(category)}&offset=${offset}&limit=${PAGE}`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((json: { docs: TaxLibItem[]; total: number; categories: Record<string, string> }) => {
        setDocs((prev) => (offset ? [...(prev ?? []), ...json.docs] : json.docs));
        setTotal(json.total);
        setNames(json.categories);
        setListFailed(false);
      })
      .catch(() => {
        if (!offset) setDocs([]);
        setListFailed(true);
      });

  useEffect(() => {
    setDocs(null);
    void loadDocs(filter, 0);
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce the query: at least two characters before we search the server.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (debounced.length < 2) {
      setResults(null);
      setSearching(false);
      setError(false);
      return;
    }
    const id = ++requestId.current;
    setSearching(true);
    setError(false);
    fetch(`/api/library/search?q=${encodeURIComponent(debounced)}&limit=10`)
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((json: { results: TaxSearchResult[] }) => {
        if (id !== requestId.current) return;
        setResults(json.results ?? []);
        setSearching(false);
      })
      .catch(() => {
        if (id !== requestId.current) return;
        setResults([]);
        setError(true);
        setSearching(false);
      });
  }, [debounced]);

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">Tax Guides</span>
        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          The library we answer from.
        </h1>
        <p className="tax-lead">
          IRS publications, forms and instructions, Tax Topics, the Internal Revenue Code, Treasury
          regulations, the Internal Revenue Manual and the Internal Revenue Bulletins, reproduced in
          full. Search every passage, or browse by collection.
        </p>
        <p className="tax-small tax-muted" data-testid="tax-library-count" style={{ margin: "0.25rem 0 0" }}>
          {stats
            ? `${fmt(stats.docs)} documents and ${fmt(stats.passages)} passages searchable now. The library is still growing.`
            : "Counting the library…"}
        </p>

        <div className="tax-search-box" data-testid="tax-guide-search">
          <Search size={18} aria-hidden="true" style={{ color: "hsl(var(--tax-muted))", flex: "none" }} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the guides, e.g. estimated tax payments"
            aria-label="Search the tax guides"
            autoComplete="off"
          />
          {searching && <Loader2 size={16} className="tax-spin" aria-hidden="true" />}
        </div>

        <div aria-live="polite">
          {debounced.length >= 2 && results && (
            <div style={{ marginTop: "1rem" }}>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.5rem" }}>
                {error
                  ? "The search couldn't be reached. You can still browse the guides below."
                  : results.length === 0
                    ? `No passages match “${debounced}”. Try fewer or different words.`
                    : `${results.length} passage${results.length === 1 ? "" : "s"} matching “${debounced}”`}
              </p>
              <div className="tax-search-results">
                {results.map((r, i) => (
                  <div
                    key={`${r.doc}-${r.anchor}-${i}`}
                    className="tax-result"
                    data-testid="tax-search-result"
                  >
                    <p className="tax-result-title">
                      {r.title}
                      {r.page ? <span className="tax-muted"> · p. {r.page}</span> : null}
                    </p>
                    <p className="tax-result-snippet">{r.snippet}</p>
                    <div className="tax-result-foot">
                      <Link
                        to={`/tax/guides/${r.doc}${r.page ? `?page=${r.page}` : r.anchor ? `#${r.anchor}` : ""}`}
                        style={{ color: "hsl(var(--tax-accent))", fontWeight: 600, textDecoration: "none" }}
                      >
                        Open in the guide →
                      </Link>
                      <a
                        className="tax-ext"
                        href={r.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {hostOf(r.href)} <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {debounced.length > 0 && debounced.length < 2 && (
            <p className="tax-small tax-muted" style={{ marginTop: "0.5rem" }}>
              Type at least two characters to search.
            </p>
          )}
        </div>

        <hr className="tax-rule" />

        <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
          <h2 className="tax-h2 tax-h2-lead">Browse the library</h2>
          <span className="tax-small tax-muted">{docs ? `${fmt(total)} document${total === 1 ? "" : "s"}` : "loading…"}</span>
        </div>

        <div className="tax-filters" role="group" aria-label="Filter by collection">
          <button
            type="button"
            className={filter === "" ? "tax-filter active" : "tax-filter"}
            aria-pressed={filter === ""}
            onClick={() => setFilter("")}
          >
            All
          </button>
          {(stats?.collections ?? [])
            .filter((c) => c.category !== "faqs")
            .map((c) => (
              <button
                key={c.category}
                type="button"
                className={filter === c.category ? "tax-filter active" : "tax-filter"}
                aria-pressed={filter === c.category}
                onClick={() => setFilter(c.category)}
                data-testid="tax-collection"
              >
                {c.name} ({fmt(c.docs)})
              </button>
            ))}
        </div>

        {!docs && <p className="tax-empty">Loading the library…</p>}
        {docs && docs.length === 0 && (
          <p className="tax-empty">
            {listFailed ? "The library couldn't be loaded. Try again in a moment." : "Nothing in this collection yet."}
          </p>
        )}

        {docs && docs.length > 0 && (
          <div className="tax-guide-list">
            {docs.map((item) => (
              <GuideCard key={item.doc} item={item} kind={names[item.category] ?? item.category} />
            ))}
          </div>
        )}

        {docs && docs.length < total && (
          <div className="tax-btn-row" style={{ marginTop: "1rem" }}>
            <button type="button" className="tax-btn tax-btn-outline" onClick={() => void loadDocs(filter, docs.length)}>
              Show more ({fmt(total - docs.length)} left)
            </button>
          </div>
        )}

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2rem" }}>
          <h2 className="tax-h3">Where these come from</h2>
          <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
            Every guide is a document published by the Internal Revenue Service (irs.gov), the Office
            of the Law Revision Counsel (Title 26 of the U.S. Code) or the eCFR (26 CFR), reproduced in
            full with a link to the original. They are U.S. government works and in the public
            domain. Brindlewick is not affiliated with or endorsed by the IRS, and nothing here is
            tax advice.
          </p>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}

function GuideCard({ item, kind }: { item: TaxLibItem; kind: string }) {
  return (
    <Link to={`/tax/guides/${item.doc}`} className="tax-guide-card" data-testid="tax-guide">
      <span className="tax-guide-kind">{kind}</span>
      <span className="tax-guide-title">{item.title}</span>
      <span className="tax-guide-src">
        {sourceName(item.source)}
        {item.kind === "pdf" && item.pages ? ` · PDF, ${item.pages} pages` : ""}
      </span>
    </Link>
  );
}
