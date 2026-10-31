import { Link } from "react-router-dom";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { ProductImage } from "./ProductCard";
import type { RecentItem } from "@/lib/hooks";

export function RecentlyViewed({
  items,
  className,
}: {
  items: RecentItem[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <section className={cn(className)}>
      <h2 className="mb-3 font-display text-xl font-semibold text-brand sm:text-2xl">
        Recently viewed
      </h2>
      <div className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-2 no-scrollbar sm:mx-0 sm:px-0">
        {items.map((item) => (
          <Link
            key={item.id}
            to={`/p/${item.id}/${item.slug}`}
            className="w-[124px] shrink-0 rounded-xl border border-sage-border bg-white p-2 transition hover:border-brand/40"
          >
            <ProductImage
              src={item.image}
              alt=""
              className="aspect-square rounded-md"
              imgClassName="p-1.5"
            />
            <p className="mt-1.5 line-clamp-2 text-[12px] leading-tight text-ink">
              {item.title}
            </p>
            <p className="mt-1 text-[13px] font-extrabold text-ink">
              {money(item.price)}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
