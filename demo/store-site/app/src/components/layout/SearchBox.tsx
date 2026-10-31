import { useEffect, useId, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { api, isAbort } from "@/lib/api";
import type { SuggestResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SearchBox({
  initialQuery = "",
  className,
  onDone,
}: {
  initialQuery?: string;
  className?: string;
  onDone?: () => void;
}) {
  const navigate = useNavigate();
  const listId = useId();
  const [value, setValue] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<SuggestResponse | null>(null);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setValue(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    const term = value.trim();
    if (term.length < 1) {
      setData(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .suggest(term, controller.signal)
        .then((res) => {
          setData(res);
          setActive(-1);
        })
        .catch((error) => {
          if (!isAbort(error)) setData(null);
        });
    }, 150);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value]);

  useEffect(() => {
    const onDocDown = (event: MouseEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const categories = data?.categories ?? [];
  const products = (data?.products ?? []).slice(0, 6);
  const rows = [
    ...categories.map((c) => ({ type: "category" as const, item: c })),
    ...products.map((p) => ({ type: "product" as const, item: p })),
  ];
  const showPanel = open && value.trim().length > 0 && data !== null;

  const go = (to: string) => {
    setOpen(false);
    inputRef.current?.blur();
    onDone?.();
    navigate(to);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const term = value.trim();
    setOpen(false);
    onDone?.();
    navigate(term ? `/search?q=${encodeURIComponent(term)}` : "/search");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showPanel) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, rows.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, -1));
    } else if (event.key === "Enter" && active >= 0 && rows[active]) {
      event.preventDefault();
      const row = rows[active];
      if (row.type === "category") {
        go(`/search?q=${encodeURIComponent(row.item.label)}`);
      } else {
        go(`/search?q=${encodeURIComponent(row.item.title)}`);
      }
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className={cn("relative w-full", className)}>
      <form onSubmit={submit} role="search" className="relative">
        <label htmlFor={`${listId}-input`} className="sr-only">
          Search Brambleway
        </label>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage"
          aria-hidden="true"
        />
        <input
          id={`${listId}-input`}
          ref={inputRef}
          data-testid="search-input"
          type="search"
          name="q"
          value={value}
          placeholder="Search products, brands, departments"
          autoComplete="off"
          enterKeyHint="search"
          aria-autocomplete="list"
          aria-controls={showPanel ? `${listId}-list` : undefined}
          aria-expanded={showPanel}
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-11 w-full rounded-lg border border-white/25 bg-white/95 pl-9 pr-16 text-base text-ink placeholder:text-sage focus:border-saffron focus:bg-white focus:outline-none focus:ring-2 focus:ring-saffron/70 sm:h-12 sm:text-[15px]"
        />
        {value && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setValue("");
              setData(null);
              inputRef.current?.focus();
            }}
            className="absolute right-[68px] top-1/2 -translate-y-1/2 rounded-full p-1 text-sage hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <button
          type="submit"
          className="absolute right-1 top-1/2 h-9 -translate-y-1/2 rounded-md bg-saffron px-3 text-[13px] font-bold text-ink transition hover:bg-saffron-dark hover:text-white sm:h-10"
        >
          Search
        </button>
      </form>

      {showPanel && (
        <div
          id={`${listId}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-sage-border bg-white p-1.5 shadow-xl"
        >
          {rows.length === 0 && (
            <p className="px-3 py-4 text-sm text-sage">
              No suggestions. Press Search to look for “{value.trim()}”.
            </p>
          )}
          {categories.length > 0 && (
            <p className="px-2 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-sage">
              Categories
            </p>
          )}
          {categories.map((category, index) => (
            <button
              key={`cat-${category.value}-${index}`}
              type="button"
              role="option"
              aria-selected={active === index}
              onMouseEnter={() => setActive(index)}
              onClick={() =>
                go(`/search?q=${encodeURIComponent(category.label)}`)
              }
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm",
                active === index ? "bg-sage-light" : "hover:bg-sage-light",
              )}
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="h-3.5 w-3.5 shrink-0 text-sage" />
                <span className="truncate font-medium">{category.label}</span>
              </span>
              <span className="shrink-0 text-xs text-sage">
                {category.count?.toLocaleString?.("en-US") ?? category.count}
              </span>
            </button>
          ))}
          {products.length > 0 && (
            <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-sage">
              Products
            </p>
          )}
          {products.map((product, index) => {
            const rowIndex = categories.length + index;
            return (
              <button
                key={`prod-${product.id}`}
                type="button"
                role="option"
                aria-selected={active === rowIndex}
                onMouseEnter={() => setActive(rowIndex)}
                onClick={() =>
                  go(`/search?q=${encodeURIComponent(product.title)}`)
                }
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left",
                  active === rowIndex ? "bg-sage-light" : "hover:bg-sage-light",
                )}
              >
                <span className="h-9 w-9 shrink-0 overflow-hidden rounded bg-sage-tile">
                  <img
                    src={product.image}
                    alt=""
                    className="h-full w-full object-contain p-0.5"
                    loading="lazy"
                  />
                </span>
                <span className="line-clamp-2 text-[13px] leading-tight">
                  {product.title}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
