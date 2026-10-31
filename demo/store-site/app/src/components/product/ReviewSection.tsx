import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApi } from "@/lib/hooks";
import { number, shortDate } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/States";
import { Stars } from "@/components/Stars";
import { cn } from "@/lib/utils";
import { ThumbsUp } from "lucide-react";

const SORTS = [
  { value: "helpful", label: "Most helpful" },
  { value: "recent", label: "Most recent" },
  { value: "high", label: "Highest rating" },
  { value: "low", label: "Lowest rating" },
];

export function RatingHistogram({
  dist,
  onPick,
  selected,
}: {
  dist: { stars: number; count: number }[];
  onPick: (stars: number) => void;
  selected?: number | null;
}) {
  const max = Math.max(1, ...dist.map((entry) => entry.count));
  const total = dist.reduce((sum, entry) => sum + entry.count, 0);
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((stars) => {
        const entry = dist.find((row) => row.stars === stars);
        const count = entry?.count ?? 0;
        const share = total ? Math.round((count / total) * 100) : 0;
        return (
          <button
            key={stars}
            type="button"
            onClick={() => onPick(stars)}
            className={cn(
              "flex w-full items-center gap-2 rounded px-1 py-0.5 text-left hover:bg-sage-light",
              selected === stars && "bg-saffron-soft",
            )}
            aria-label={`Filter reviews to ${stars} stars (${count})`}
          >
            <span className="w-8 shrink-0 text-[12px] font-semibold text-ink">
              {stars} ★
            </span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-sage-light">
              <span
                className="block h-full rounded-full bg-saffron"
                style={{ width: `${Math.max(count > 0 ? 3 : 0, (count / max) * 100)}%` }}
              />
            </span>
            <span className="w-11 shrink-0 text-right text-[11.5px] text-sage">
              {share}%
            </span>
            <span className="w-10 shrink-0 text-right text-[11px] text-sage">
              {number(count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function ReviewSection({ product }: { product: Product }) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("helpful");
  const [stars, setStars] = useState<number | null>(null);

  useEffect(() => {
    setPage(1);
  }, [sort, stars]);

  const { data, error, loading, reload } = useApi(
    (signal) =>
      api.reviews(
        product.id,
        { page, sort, ...(stars ? { stars } : {}) },
        signal,
      ),
    [product.id, page, sort, stars],
  );

  const totalReviews = product.review_count || 0;
  const pages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;

  return (
    <section
      id="reviews"
      data-testid="reviews"
      className="mt-6 scroll-mt-24 rounded-xl border border-sage-border bg-white p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-brand">
          Customer reviews
        </h2>
        <label className="flex items-center gap-2 text-[12.5px] text-sage">
          Sort by
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            className="h-10 rounded-lg border border-sage-border bg-white px-2 text-base font-semibold text-ink sm:text-[13px]"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-5 sm:grid-cols-[210px_minmax(0,1fr)]">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-3xl font-semibold text-ink">
              {product.rating ? product.rating.toFixed(1) : "—"}
            </span>
            <div>
              <Stars rating={product.rating ?? 0} size={15} />
              <p className="text-[11.5px] text-sage">
                {number(totalReviews)} {totalReviews === 1 ? "review" : "reviews"}
              </p>
            </div>
          </div>
          <div className="mt-3">
            <RatingHistogram
              dist={product.dist ?? []}
              selected={stars}
              onPick={(value) => setStars((current) => (current === value ? null : value))}
            />
          </div>
          {stars && (
            <button
              type="button"
              onClick={() => setStars(null)}
              className="mt-2 text-[12px] font-semibold text-brand underline underline-offset-2"
            >
              Show all ratings
            </button>
          )}
        </div>

        <div className="min-w-0">
          {loading && !data && <LoadingState label="Loading reviews…" />}
          {error && !data && <ErrorState message={error} onRetry={reload} />}
          {data && (
            <>
              {data.label && (
                <p className="mb-3 rounded-md bg-sage-light px-2.5 py-1.5 text-[11px] leading-snug text-sage">
                  {data.label}
                </p>
              )}
              {data.reviews.length === 0 && (
                <p className="py-6 text-sm text-sage">
                  No reviews match that filter yet.
                </p>
              )}
              <ul className="space-y-4">
                {data.reviews.map((review) => (
                  <li
                    key={review.id}
                    className="border-b border-sage-border pb-4 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <Stars rating={review.stars} size={13} />
                      <span className="text-[13px] font-semibold text-ink">
                        {review.title}
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-sage">
                      {review.author}
                      {review.location ? ` · ${review.location}` : ""} ·{" "}
                      {shortDate(review.date)}
                      {review.variant ? ` · ${review.variant}` : ""}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/90">
                      {review.body}
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] text-sage">
                      <ThumbsUp className="h-3 w-3" />
                      {review.helpful} found this helpful
                    </p>
                  </li>
                ))}
              </ul>

              {pages > 1 && (
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="tap rounded-md border border-sage-border px-3 text-[13px] font-semibold text-brand disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-[12.5px] text-sage">
                    Page {data.page} of {pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pages}
                    onClick={() => setPage((value) => value + 1)}
                    className="tap rounded-md border border-sage-border px-3 text-[13px] font-semibold text-brand disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function QuestionsSection({ product }: { product: Product }) {
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useApi(
    (signal) => api.questions(product.id, { page }, signal),
    [product.id, page],
  );

  const pages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;

  return (
    <section
      id="questions"
      data-testid="questions"
      className="mt-6 scroll-mt-24 rounded-xl border border-sage-border bg-white p-4 sm:p-6"
    >
      <h2 className="font-display text-xl font-semibold text-brand">
        Questions and answers
      </h2>
      {loading && !data && <LoadingState label="Loading questions…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          {data.label && (
            <p className="mt-2 rounded-md bg-sage-light px-2.5 py-1.5 text-[11px] leading-snug text-sage">
              {data.label}
            </p>
          )}
          {data.questions.length === 0 && (
            <p className="mt-3 text-sm text-sage">
              No questions yet for this product.
            </p>
          )}
          <ul className="mt-3 divide-y divide-sage-border">
            {data.questions.map((question) => (
              <li key={question.id} className="py-3 first:pt-0">
                <p className="text-[13.5px] font-semibold text-ink">
                  Q: {question.question}
                </p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink/90">
                  A: {question.answer}
                </p>
                <p className="mt-1 text-[11.5px] text-sage">
                  {question.answered_by} · {shortDate(question.date)} ·{" "}
                  {question.votes} found this helpful
                </p>
              </li>
            ))}
          </ul>
          {pages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className="tap rounded-md border border-sage-border px-3 text-[13px] font-semibold text-brand disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-[12.5px] text-sage">
                Page {data.page} of {pages}
              </span>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((value) => value + 1)}
                className="tap rounded-md border border-sage-border px-3 text-[13px] font-semibold text-brand disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
