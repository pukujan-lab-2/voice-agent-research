import { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import { number } from "@/lib/format";
import {
  buildSearchPath,
  emptyFilters,
  readFilters,
  SORT_OPTIONS,
  writeFilters,
  type FilterState,
} from "@/lib/searchParams";
import { CardGridSkeleton, ErrorState, EmptyState } from "@/components/States";
import { ProductGrid, ResultCount } from "@/components/ProductCard";
import { Pagination } from "@/components/Pagination";
import { FilterChips, FilterPanel } from "@/components/Filters";
import { CompareTray } from "@/components/CompareTray";

const PER_PAGE = 24;

export default function Search() {
  const [params, setParams] = useSearchParams();
  const { dept, cat } = useParams<{ dept?: string; cat?: string }>();

  // /d/:dept and /c/:cat are just search pages with the filter pre-applied.
  const state = useMemo(() => {
    const base = readFilters(params);
    if (dept) base.dept = dept;
    if (cat) base.cat = cat;
    return base;
  }, [params, dept, cat]);

  const page = Math.max(1, Number(state.page) || 1);
  const queryKey = JSON.stringify({ ...state, page });

  const { data, error, loading, reload } = useApi(
    (signal) =>
      api.search(
        {
          q: state.q,
          cat: state.cat,
          dept: state.dept,
          brand: state.brand,
          color: state.color,
          size: state.size,
          minPrice: state.minPrice,
          maxPrice: state.maxPrice,
          rating: state.rating,
          inStock: state.inStock,
          deal: state.deal,
          sort: state.sort,
          page,
          per: PER_PAGE,
          exact: state.exact,
          tags: state.tags,
          audience: state.audience,
        },
        signal,
      ),
    [queryKey],
  );

  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const title = state.q
    ? `Search: ${state.q}`
    : state.cat
      ? state.cat.replace(/-/g, " ")
      : state.dept
        ? state.dept.replace(/-/g, " ")
        : "All products";
  useDocumentTitle(
    title.replace(/\b\w/g, (character) => character.toUpperCase()),
  );

  const update = (patch: Partial<FilterState>) => {
    const next = { ...state, ...patch };
    if (!("page" in patch)) next.page = "";
    setParams(writeFilters(next));
  };

  const clearAll = () => {
    const next = { ...emptyFilters(), q: state.q, sort: state.sort, exact: state.exact };
    setParams(writeFilters(next));
  };

  const makeHref = (targetPage: number) => {
    const next = { ...state, page: targetPage > 1 ? String(targetPage) : "" };
    return buildSearchPath(next);
  };

  const toggleCompare = (id: number) => {
    setCompareIds((ids) =>
      ids.includes(id)
        ? ids.filter((entry) => entry !== id)
        : ids.length >= 4
          ? ids
          : [...ids, id],
    );
  };

  const total = data?.total ?? 0;
  const pages = data?.pages ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PER_PAGE + 1;
  const to = Math.min(page * PER_PAGE, total);
  const activeCount = useMemo(() => {
    let count = 0;
    for (const key of ["dept", "cat", "rating", "deal", "inStock"] as const) {
      if (state[key]) count += 1;
    }
    for (const key of ["brand", "color", "size"] as const) {
      if (state[key]) count += state[key].split(",").filter(Boolean).length;
    }
    if (state.minPrice || state.maxPrice) count += 1;
    return count;
  }, [state]);

  return (
    <div className="bw-container py-4 sm:py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-xl font-semibold text-brand sm:text-2xl">
          {state.q ? (
            <>
              Results for <span className="text-ink">“{state.q}”</span>
            </>
          ) : state.dept ? (
            <span className="capitalize">{state.dept.replace(/-/g, " ")}</span>
          ) : (
            "All products"
          )}
        </h1>
        {data && (
          <p className="text-[12.5px] text-sage">
            {number(total)} {total === 1 ? "product" : "products"}
          </p>
        )}
      </div>

      {data?.correctedFrom && (
        <div className="mt-3 rounded-lg border border-saffron/50 bg-saffron-soft px-3.5 py-2.5 text-[13.5px] text-ink">
          Showing results for{" "}
          <strong className="font-bold">{data.query || state.q}</strong>. Search
          instead for{" "}
          <Link
            to={buildSearchPath({
              ...state,
              q: data.correctedFrom,
              exact: "1",
              page: "",
            })}
            className="font-semibold italic underline decoration-saffron-dark underline-offset-2"
          >
            {data.correctedFrom}
          </Link>
        </div>
      )}

      {data?.relaxed && !data.correctedFrom && (
        <div className="mt-3 rounded-lg border border-sage-border bg-sage-light px-3.5 py-2.5 text-[13.5px] text-ink">
          No exact matches. Showing items that match some of your words.
        </div>
      )}

      <div className="mt-4 grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <div className="sticky top-[122px] max-h-[calc(100vh-140px)] overflow-y-auto rounded-xl border border-sage-border bg-white px-3.5 pb-3">
            {data ? (
              <FilterPanel
                facets={data.facets}
                state={state}
                update={update}
                clearAll={clearAll}
              />
            ) : (
              <div className="space-y-3 py-4">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-4 animate-pulse rounded bg-sage-light"
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-sage-border bg-white px-3 text-[13px] font-semibold text-brand lg:hidden"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <span className="rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>

            <label className="ml-auto flex items-center gap-2 text-[12.5px] font-medium text-sage">
              Sort by
              <select
                data-testid="sort"
                value={state.sort || "relevance"}
                onChange={(event) =>
                  update({ sort: event.target.value, page: "" })
                }
                className="h-10 rounded-lg border border-sage-border bg-white px-2 text-base font-semibold text-ink sm:text-[13px]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {data && (
            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
              <ResultCount
                from={from}
                to={to}
                total={total}
                query={state.q || undefined}
              />
            </div>
          )}

          {data && (
            <div className="mt-2">
              <FilterChips
                state={state}
                facets={data.facets}
                update={update}
                clearAll={clearAll}
              />
            </div>
          )}

          <div className="mt-3">
            {loading && !data && <CardGridSkeleton count={12} />}
            {error && !data && <ErrorState message={error} onRetry={reload} />}
            {data && data.items.length === 0 && (
              <EmptyState title="No results found">
                <p>
                  Try checking your spelling, removing a filter or two, or
                  browsing a department.
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {activeCount > 0 && (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="tap inline-flex items-center rounded-lg bg-brand px-4 text-[13px] font-semibold text-white"
                    >
                      Clear filters
                    </button>
                  )}
                  <Link
                    to="/departments"
                    className="tap inline-flex items-center rounded-lg border border-sage-border px-4 text-[13px] font-semibold text-brand"
                  >
                    Browse departments
                  </Link>
                </div>
              </EmptyState>
            )}
            {data && data.items.length > 0 && (
              <>
                <ProductGrid
                  items={data.items}
                  selectedIds={compareIds}
                  compare={{
                    selected: false,
                    disabled: compareIds.length >= 4,
                    onToggle: toggleCompare,
                  }}
                />
                {loading && (
                  <p className="mt-3 text-center text-xs text-sage">
                    Updating results…
                  </p>
                )}
                <Pagination page={page} pages={pages} makeHref={makeHref} />
              </>
            )}
          </div>

          <CompareTray
            ids={compareIds}
            onRemove={(id) =>
              setCompareIds((ids) => ids.filter((entry) => entry !== id))
            }
            onClear={() => setCompareIds([])}
          />
        </div>
      </div>

      {sheetOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close filters"
            className="absolute inset-0 bg-black/40"
            onClick={() => setSheetOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-2xl bg-white px-4 pb-5">
            <div className="sticky top-0 -mx-4 flex items-center justify-between border-b border-sage-border bg-white px-4 py-3">
              <span className="font-display text-lg font-semibold text-brand">
                Filters
              </span>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close filters"
                className="tap -mr-2 flex items-center justify-center px-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {data && (
              <FilterPanel
                facets={data.facets}
                state={state}
                update={update}
                clearAll={clearAll}
              />
            )}
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              className="tap mt-3 w-full rounded-lg bg-brand text-sm font-bold text-white"
            >
              Show {number(total)} results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
