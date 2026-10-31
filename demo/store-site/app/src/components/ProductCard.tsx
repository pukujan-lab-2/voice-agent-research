import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { money, number, lowStockLabel } from "@/lib/format";
import { productHref, type Card } from "@/lib/types";
import { RatingLine } from "./Stars";

export function ProductImage({
  src,
  alt,
  className,
  imgClassName,
  eager = false,
}: {
  src: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-lg bg-sage-tile",
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={cn("h-full w-full object-contain", imgClassName)}
      />
    </div>
  );
}

interface ProductCardProps {
  card: Card;
  compare?: {
    selected: boolean;
    disabled: boolean;
    onToggle: (id: number) => void;
  };
  compareSelected?: boolean;
  compact?: boolean;
}

export function ProductCard({
  card,
  compare,
  compareSelected,
  compact,
}: ProductCardProps) {
  const href = productHref(card);
  const low = lowStockLabel(card.in_stock);
  const outOfStock = card.in_stock === false || card.in_stock === 0;
  const from = card.max_price > card.price;

  return (
    <article
      data-testid="product-card"
      data-product-id={card.id}
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-xl border border-sage-border bg-white transition hover:border-brand/40 hover:shadow-[0_6px_20px_rgba(15,76,74,0.10)]",
      )}
    >
      <div className="relative">
        <Link to={href} className="block" tabIndex={-1} aria-hidden="true">
          <ProductImage
            src={card.image}
            alt=""
            className={cn("rounded-none", compact ? "aspect-square" : "aspect-square")}
            imgClassName="p-3 transition duration-200 group-hover:scale-[1.03]"
          />
        </Link>
        {card.deal > 0 && (
          <span className="absolute left-2 top-2 rounded-md bg-saffron px-1.5 py-0.5 text-[11px] font-extrabold leading-tight text-ink shadow-sm">
            -{Math.round(card.deal)}%
          </span>
        )}
        {outOfStock && (
          <span className="absolute inset-x-2 bottom-2 rounded-md bg-white/95 py-1 text-center text-[11px] font-semibold text-sage">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2.5 pb-2.5 pt-2 sm:px-3 sm:pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sage">
          {card.brand}
        </p>
        <Link
          to={href}
          className="line-clamp-2 min-h-[2.5rem] text-[13px] font-medium leading-tight text-ink hover:text-brand hover:underline sm:text-sm"
        >
          {card.title}
        </Link>

        <div className="mt-0.5">
          <RatingLine rating={card.rating} reviewCount={card.review_count} />
        </div>

        <div className="mt-auto flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 pt-1">
          {from && (
            <span className="text-[11px] font-medium text-sage">from</span>
          )}
          <span className="text-base font-extrabold tracking-tight text-ink">
            {money(card.price)}
          </span>
          {card.list_price !== null && card.list_price > card.price && (
            <span className="text-xs text-sage line-through">
              {money(card.list_price)}
            </span>
          )}
        </div>

        {low && (
          <p className="text-[11px] font-semibold text-saffron-dark">{low}</p>
        )}

        {compare && (
          <label className="mt-1 inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-medium text-sage">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 accent-[#0f4c4a]"
              checked={compareSelected ?? false}
              disabled={!compareSelected && compare.disabled}
              onChange={() => compare.onToggle(card.id)}
              aria-label={`Compare ${card.title}`}
            />
            Compare
          </label>
        )}
      </div>
    </article>
  );
}

/** Sideways-scrolling row of cards that stays inside the page on a phone. */
export function ProductRow({
  title,
  items,
  action,
}: {
  title: string;
  items: Card[];
  action?: { label: string; to: string };
}) {
  if (!items?.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-brand sm:text-2xl">
          {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="shrink-0 text-sm font-semibold text-brand hover:underline"
          >
            {action.label}
          </Link>
        )}
      </div>
      <div className="-mx-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 no-scrollbar sm:mx-0 sm:px-0">
        {items.map((card) => (
          <div
            key={card.id}
            className="w-[46%] shrink-0 snap-start sm:w-[31%] md:w-[23%] lg:w-[19%] xl:w-[15.5%]"
          >
            <ProductCard card={card} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function ProductGrid({
  items,
  compare,
  selectedIds,
}: {
  items: Card[];
  compare?: ProductCardProps["compare"];
  selectedIds?: number[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((card) => (
        <ProductCard
          key={card.id}
          card={card}
          compare={compare}
          compareSelected={selectedIds?.includes(card.id)}
        />
      ))}
    </div>
  );
}

export function ResultCount({
  from,
  to,
  total,
  query,
}: {
  from: number;
  to: number;
  total: number;
  query?: string;
}) {
  return (
    <p className="text-sm text-sage">
      <span className="font-semibold text-ink">
        {number(from)}–{number(to)}
      </span>{" "}
      of <span className="font-semibold text-ink">{number(total)}</span>{" "}
      {total === 1 ? "result" : "results"}
      {query ? (
        <>
          {" "}
          for <span className="font-semibold text-ink">“{query}”</span>
        </>
      ) : null}
    </p>
  );
}
