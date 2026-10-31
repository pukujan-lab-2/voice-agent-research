/**
 * Articles index. Structure after a modern publication's blog: a category filter, a search within titles, and a
 * grid of cards with the category, the summary and the reading time. Every article comes from the API.
 */

import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi, useUrlSearch, useUrlState } from "@/hooks/useApi";
import { siteGet, fmtDate, type SiteArticleSummary } from "@/lib/practice";

export default function TaxBlog() {
  useTaxTitle("Articles");
  const { get, set } = useUrlState();
  const category = get("category");
  const articles = useApi<{ articles: SiteArticleSummary[] }>(
    () => siteGet<{ articles: SiteArticleSummary[] }>("/articles"),
    [],
  );
  const [query, setQuery] = useUrlSearch(get("q"), (v) => set({ q: v }));

  const all = articles.data?.articles ?? [];
  const categories = Array.from(new Set(all.map((a) => a.category))).sort();
  const q = get("q").toLowerCase();
  const shown = all
    .filter((a) => (!category || a.category === category) && (!q || a.title.toLowerCase().includes(q)))
    .sort((a, b) => b.published.localeCompare(a.published));

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Articles"
          title="Notes from the practice."
          lead="What we explain on the phone, written down: the questions that come up every year, and what the IRS publications actually say about them."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Articles" }]}
        />

        <div className="tax-search-box" style={{ marginBottom: "1rem" }}>
          <Search size={18} aria-hidden="true" style={{ color: "hsl(var(--tax-muted))", flex: "none" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the titles"
            aria-label="Search the titles"
            type="search"
          />
        </div>

        {categories.length > 1 && (
          <div className="tax-filters">
            <button
              type="button"
              className={category ? "tax-filter" : "tax-filter active"}
              onClick={() => set({ category: "" })}
            >
              All
            </button>
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                className={category === c ? "tax-filter active" : "tax-filter"}
                onClick={() => set({ category: c })}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {articles.loading && (
          <div className="tax-grid tax-grid-3" aria-busy="true">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="tax-skel tax-skel-card" style={{ height: "11rem" }} />
            ))}
          </div>
        )}
        {articles.error && <ErrorBox error={articles.error} onRetry={articles.reload} />}
        {articles.data && all.length === 0 && <Empty>No articles have been published yet.</Empty>}
        {articles.data && all.length > 0 && shown.length === 0 && (
          <Empty>Nothing matches that filter. Try another word or clear the category.</Empty>
        )}

        {shown.length > 0 && (
          <div className="tax-grid tax-grid-3">
            {shown.map((a) => (
              <Link key={a.slug} to={`/tax/blog/${a.slug}`} className="tax-article-card" data-testid="article-card">
                <span className="cat">{a.category}</span>
                <h3>{a.title}</h3>
                <p>{a.summary}</p>
                <span className="meta">
                  {fmtDate(a.published)} · {a.minutes} min read
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </SitePage>
  );
}
