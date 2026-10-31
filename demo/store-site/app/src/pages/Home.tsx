import { Link } from "react-router-dom";
import { Mic, Sparkles, Truck, Undo2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useDocumentTitle, useRecent } from "@/lib/hooks";
import { money, number } from "@/lib/format";
import { productHref } from "@/lib/types";
import { ErrorState, LoadingState, SkeletonCard } from "@/components/States";
import { ProductImage, ProductRow } from "@/components/ProductCard";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { Stars } from "@/components/Stars";

function startVoice() {
  window.copilot?.start?.({ voice: true });
}

function HomeHero({
  deal,
  counts,
}: {
  deal?: {
    id: number;
    slug: string;
    title: string;
    image: string;
    price: number;
    list_price: number | null;
    deal: number;
    brand: string;
  };
  counts?: { products: number; variants: number; reviews: number };
}) {
  return (
    <section className="overflow-hidden rounded-2xl bg-brand text-white">
      <div className="grid gap-0 md:grid-cols-[1.15fr_0.85fr]">
        <div className="px-5 py-7 sm:px-8 sm:py-10">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-saffron/20 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-saffron">
            <Sparkles className="h-3.5 w-3.5" />
            This week's deals
          </p>
          <h1 className="mt-3 font-display text-[1.75rem] font-semibold leading-[1.15] tracking-[-0.01em] sm:text-[2.6rem]">
            The good everyday stuff,
            <br className="hidden sm:block" /> priced like a good week.
          </h1>
          <p className="mt-3 max-w-md text-[15px] leading-relaxed text-white/80">
            {counts
              ? `${number(counts.products)} products across every department, with fresh markdowns each morning.`
              : "Fresh markdowns across every department, every morning."}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <Link
              to="/search?deal=1&sort=discount"
              className="tap inline-flex items-center rounded-lg bg-saffron px-5 text-sm font-bold text-ink transition hover:bg-white"
            >
              Shop today's deals
            </Link>
            <button
              type="button"
              onClick={startVoice}
              className="tap inline-flex items-center gap-2 rounded-lg border border-white/35 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              <Mic className="h-4 w-4" />
              Shop with your voice
            </button>
          </div>
          <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-white/70">
            <div className="flex items-center gap-1.5">
              <Truck className="h-4 w-4 text-saffron" />
              Free standard shipping on $35 or more
            </div>
            <div className="flex items-center gap-1.5">
              <Undo2 className="h-4 w-4 text-saffron" />
              30-day returns
            </div>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-saffron" />
              Demo — nothing is charged
            </div>
          </dl>
        </div>

        {deal && (
          <Link
            to={productHref(deal)}
            className="group relative flex items-center justify-center bg-brand-deeper/60 px-4 py-5 md:px-6"
          >
            <div className="flex w-full max-w-[340px] items-center gap-4">
              <ProductImage
                src={deal.image}
                alt={deal.title}
                className="h-28 w-28 shrink-0 bg-white/95 sm:h-36 sm:w-36"
                imgClassName="p-2.5"
                eager
              />
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-saffron">
                  {deal.brand}
                </p>
                <p className="mt-1 line-clamp-2 text-[15px] font-semibold leading-tight group-hover:underline">
                  {deal.title}
                </p>
                <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
                  <span className="text-xl font-extrabold text-white">
                    {money(deal.price)}
                  </span>
                  {deal.list_price && (
                    <span className="text-sm text-white/60 line-through">
                      {money(deal.list_price)}
                    </span>
                  )}
                </div>
                {deal.deal > 0 && (
                  <span className="mt-1.5 inline-block rounded bg-saffron px-1.5 py-0.5 text-[11px] font-extrabold text-ink">
                    -{Math.round(deal.deal)}% this week
                  </span>
                )}
              </div>
            </div>
          </Link>
        )}
      </div>
    </section>
  );
}

function VoicePanel() {
  return (
    <section className="mt-9 rounded-2xl border border-sage-border bg-white p-5 sm:p-7">
      <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-saffron-dark">
            <Mic className="h-3.5 w-3.5" />
            Shop with your voice
          </p>
          <h2 className="mt-1.5 font-display text-xl font-semibold text-brand sm:text-2xl">
            Say what you need. Keep your hands free.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-sage">
            The Brambleway copilot can search the catalogue, narrow by price,
            colour or size, read out specs and reviews, add things to your cart
            and walk you through checkout — all out loud. Try “hiking boots under
            eighty dollars, size ten” or “what's on sale in the kitchen aisle?”
          </p>
        </div>
        <button
          type="button"
          onClick={startVoice}
          className="tap inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-saffron px-6 text-sm font-bold text-ink transition hover:bg-saffron-dark hover:text-white"
        >
          <Mic className="h-4 w-4" />
          Start voice shopping
        </button>
      </div>
    </section>
  );
}

export default function Home() {
  useDocumentTitle("Home");
  const { data, error, loading, reload } = useApi(
    (signal) => api.home(signal),
    [],
  );
  const recent = useRecent();

  return (
    <div className="bw-container py-4 sm:py-6">
      {loading && !data && (
        <div className="space-y-4">
          <div className="h-[260px] animate-pulse rounded-2xl bg-brand/20" />
          <LoadingState label="Loading today's shop…" />
        </div>
      )}

      {error && !data && <ErrorState message={error} onRetry={reload} />}

      {data && (
        <>
          <HomeHero deal={data.deals?.[0]} counts={data.counts} />

          <section className="mt-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="font-display text-xl font-semibold text-brand sm:text-2xl">
                Shop by department
              </h2>
              <Link
                to="/departments"
                className="shrink-0 text-sm font-semibold text-brand hover:underline"
              >
                All {data.departments?.length} departments
              </Link>
            </div>
            <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 lg:grid-cols-6 xl:grid-cols-7">
              {(data.departments ?? []).map((department) => (
                <Link
                  key={department.slug}
                  to={`/d/${department.slug}`}
                  className="group w-[104px] shrink-0 sm:w-auto"
                >
                  <div className="overflow-hidden rounded-xl border border-sage-border bg-white transition group-hover:border-brand/40 group-hover:shadow-sm">
                    <ProductImage
                      src={department.image}
                      alt=""
                      className="aspect-square rounded-none"
                      imgClassName="p-2 transition group-hover:scale-[1.04]"
                    />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-center text-[12.5px] font-semibold leading-tight text-ink group-hover:text-brand">
                    {department.name}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          <ProductRow
            title="Today's deals"
            items={data.deals ?? []}
            action={{ label: "See all deals", to: "/search?deal=1&sort=discount" }}
          />
          <ProductRow
            title="Top rated"
            items={data.topRated ?? []}
            action={{ label: "See top rated", to: "/search?sort=rating" }}
          />
          <ProductRow
            title="New arrivals"
            items={data.newArrivals ?? []}
            action={{ label: "See what's new", to: "/search?sort=newest" }}
          />

          <VoicePanel />

          {recent.length > 0 && (
            <RecentlyViewed items={recent} className="mt-9" />
          )}

          <section className="mt-9 rounded-2xl bg-sage-tile p-5 sm:p-6">
            <h2 className="font-display text-lg font-semibold text-brand">
              {data.counts
                ? `${number(data.counts.products)} products across ${data.departments?.length} departments`
                : "A big catalogue, ready to browse"}
            </h2>
            <p className="mt-1 text-sm text-sage">
              {data.counts
                ? `${number(data.counts.variants)} buyable variants and ${number(
                    data.counts.reviews,
                  )} customer reviews, all fictional and generated for this demo.`
                : "Every product, brand and review in Brambleway is fictional and generated for this demo."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: "Biggest discounts", to: "/search?sort=discount" },
                { label: "Best sellers", to: "/search?sort=popular" },
                { label: "Most reviewed", to: "/search?sort=reviews" },
                { label: "Under $25", to: "/search?maxPrice=25&sort=price_asc" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="tap inline-flex items-center rounded-lg border border-sage-border bg-white px-3.5 text-[13px] font-semibold text-brand hover:border-brand/40"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </section>
        </>
      )}

      {!data && !loading && !error && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      )}
    </div>
  );
}

export { Stars };
