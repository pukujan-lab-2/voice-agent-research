/**
 * Reviews: the average and the count from the data, then the reviews twelve at a time. Every review carries the
 * "Sample review" label, and a note at the top says plainly that they were written for this demo.
 */

import { Star } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi, useUrlState, pageRange } from "@/hooks/useApi";
import { siteGet, fmtDate, type Paged, type SiteReview } from "@/lib/practice";
import { rating } from "@/lib/site";

const SIZE = 12;

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <span className="tax-stars" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} aria-hidden="true" fill={i <= Math.round(n) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export default function TaxReviews() {
  useTaxTitle("Reviews");
  const { page, setPage } = useUrlState();
  const reviews = useApi<Paged<SiteReview>>(
    () => siteGet<Paged<SiteReview>>("/reviews", { page, size: SIZE }),
    [page],
  );

  const rows = reviews.data?.rows ?? [];
  const total = reviews.data?.total ?? 0;
  const pages = reviews.data?.pages ?? 1;
  const average = rows.length ? rows.reduce((n, r) => n + rating(r.rating), 0) / rows.length : 0;

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Reviews"
          title="What clients say, and what we do with it."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Reviews" }]}
        />

        <p className="tax-notice" style={{ maxWidth: "46rem" }}>
          <strong>Sample reviews written for this demo; Brindlewick is fictional.</strong> They are here so
          the page has something real to show. No review is edited and none is paid for, because none is
          real.
        </p>

        <div className="tax-card" style={{ display: "flex", flexWrap: "wrap", gap: "1rem", alignItems: "center", margin: "1rem 0 1.5rem" }}>
          <div className="tax-rating-big">
            <span className="n">{average ? average.toFixed(1) : "—"}</span>
            <div>
              <Stars n={average} size={16} />
              <p className="tax-small tax-muted" style={{ margin: "0.125rem 0 0" }}>
                Average of the {rows.length} shown · {total} in all
              </p>
            </div>
          </div>
          <p className="tax-small tax-muted" style={{ margin: 0, marginLeft: "auto", maxWidth: "26rem" }}>
            Reviews are collected after a return is filed and the invoice is settled. We do not ask people
            to leave one, and we publish what arrives.
          </p>
        </div>

        {reviews.loading && (
          <div className="tax-grid tax-grid-2" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="tax-skel tax-skel-card" style={{ height: "10rem" }} />
            ))}
          </div>
        )}
        {reviews.error && <ErrorBox error={reviews.error} onRetry={reviews.reload} />}
        {reviews.data && rows.length === 0 && <Empty>No reviews have been published yet.</Empty>}

        {rows.length > 0 && (
          <>
            <div className="tax-grid tax-grid-2">
              {rows.map((r) => (
                <figure className="tax-review" key={r.id} data-testid="review-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Stars n={rating(r.rating)} />
                    <span className="tax-sample-tag">Sample review</span>
                  </div>
                  <h3>{r.title}</h3>
                  <p>“{r.body}”</p>
                  <figcaption style={{ fontSize: "0.75rem", color: "hsl(var(--tax-muted))" }}>
                    {r.author}, {r.city} · {r.service} · {fmtDate(r.date)}
                  </figcaption>
                </figure>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginTop: "1.5rem" }}>
              <span className="tax-small tax-muted">{pageRange(page, SIZE, total)}</span>
              <div className="tax-btn-row" style={{ marginLeft: "auto" }}>
                <button
                  type="button"
                  className="tax-btn tax-btn-outline"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  Previous
                </button>
                <span className="tax-small" style={{ minWidth: "5rem", textAlign: "center" }}>
                  Page {page} of {pages}
                </span>
                <button
                  type="button"
                  className="tax-btn tax-btn-outline"
                  disabled={page >= pages}
                  onClick={() => setPage(page + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </SitePage>
  );
}
