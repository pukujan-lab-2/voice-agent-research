import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

function pageNumbers(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current]);
  for (let offset = 1; offset <= 1; offset += 1) {
    if (current - offset > 1) pages.add(current - offset);
    if (current + offset < total) pages.add(current + offset);
  }
  if (current <= 3) [2, 3, 4].forEach((p) => p < total && pages.add(p));
  if (current >= total - 2)
    [total - 3, total - 2, total - 1].forEach((p) => p > 1 && pages.add(p));

  const sorted = [...pages].sort((a, b) => a - b);
  const output: (number | "gap")[] = [];
  sorted.forEach((page, index) => {
    if (index > 0 && page - (sorted[index - 1] as number) > 1) output.push("gap");
    output.push(page);
  });
  return output;
}

export function Pagination({
  page,
  pages,
  makeHref,
}: {
  page: number;
  pages: number;
  makeHref: (page: number) => string;
}) {
  if (pages <= 1) return null;
  const items = pageNumbers(page, pages);
  const button =
    "tap inline-flex min-w-[40px] items-center justify-center rounded-md border px-2.5 text-sm font-semibold";

  return (
    <nav
      data-testid="pagination"
      aria-label="Pagination"
      className="mt-7 flex flex-wrap items-center justify-center gap-1.5"
    >
      {page > 1 ? (
        <Link
          to={makeHref(page - 1)}
          aria-label="Previous page"
          className={cn(button, "border-sage-border bg-white text-brand hover:bg-sage-light")}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(button, "border-sage-border/60 text-sage/50")}>
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {items.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-1 text-sage">
            …
          </span>
        ) : (
          <Link
            key={item}
            to={makeHref(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              button,
              item === page
                ? "border-brand bg-brand text-white"
                : "border-sage-border bg-white text-brand hover:bg-sage-light",
            )}
          >
            {item}
          </Link>
        ),
      )}

      {page < pages ? (
        <Link
          to={makeHref(page + 1)}
          aria-label="Next page"
          className={cn(button, "border-sage-border bg-white text-brand hover:bg-sage-light")}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(button, "border-sage-border/60 text-sage/50")}>
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  );
}
