import { useMemo, useState } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { colorSwatch, isLightColor } from "@/lib/format";
import type { Facets } from "@/lib/types";
import {
  hasValue,
  toggleValue,
  valuesOf,
  type FilterState,
} from "@/lib/searchParams";

type Updater = (patch: Partial<FilterState>) => void;

function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-sage-border py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 py-1 text-left"
      >
        <span className="text-[13px] font-bold uppercase tracking-wide text-ink">
          {title}
        </span>
        <ChevronDown
          className={cn("h-4 w-4 text-sage transition", open && "rotate-180")}
        />
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function CountRow({
  label,
  count,
  checked,
  onChange,
  children,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
  children?: React.ReactNode;
}) {
  return (
    <label className="flex min-h-[36px] cursor-pointer items-center gap-2 py-0.5 text-[13.5px] text-ink">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 shrink-0 accent-[#0f4c4a]"
      />
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {children}
        <span className="truncate">{label}</span>
      </span>
      {count !== undefined && (
        <span className="shrink-0 text-[11.5px] text-sage">
          {count.toLocaleString("en-US")}
        </span>
      )}
    </label>
  );
}

export function FilterPanel({
  facets,
  state,
  update,
  clearAll,
  hideDepartment,
}: {
  facets: Facets;
  state: FilterState;
  update: Updater;
  clearAll: () => void;
  hideDepartment?: boolean;
}) {
  const [brandQuery, setBrandQuery] = useState("");

  const brands = useMemo(() => {
    const list = facets.brands ?? [];
    const selected = valuesOf(state.brand);
    const withSelected = [
      ...list.filter((b) => selected.includes(b.value)),
      ...list.filter((b) => !selected.includes(b.value)),
    ];
    const term = brandQuery.trim().toLowerCase();
    const filtered = term
      ? withSelected.filter((b) => b.label.toLowerCase().includes(term))
      : withSelected;
    return filtered.slice(0, 25);
  }, [facets.brands, state.brand, brandQuery]);

  const dealCount =
    typeof facets.deals === "number" ? facets.deals : facets.deals?.count;
  const inStockCount =
    typeof facets.inStock === "number" ? facets.inStock : facets.inStock?.count;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 pb-1">
        <h2 className="font-display text-base font-semibold text-brand">
          Filters
        </h2>
        <button
          type="button"
          onClick={clearAll}
          className="text-[12.5px] font-semibold text-brand underline underline-offset-2 hover:text-brand-light"
        >
          Clear all
        </button>
      </div>

      {!hideDepartment && (facets.depts?.length ?? 0) > 0 && (
        <Section title="Department">
          <div className="max-h-[220px] space-y-0.5 overflow-y-auto pr-1">
            {facets.depts.slice(0, 19).map((option) => (
              <CountRow
                key={option.value}
                label={option.label}
                count={option.count}
                checked={state.dept === option.value}
                onChange={() =>
                  update({
                    dept: state.dept === option.value ? "" : option.value,
                    cat: "",
                    page: "",
                  })
                }
              />
            ))}
          </div>
        </Section>
      )}

      {(facets.categories?.length ?? 0) > 0 && (
        <Section title="Category">
          <div className="max-h-[220px] space-y-0.5 overflow-y-auto pr-1">
            {facets.categories.slice(0, 30).map((option) => (
              <CountRow
                key={`${option.value}-${option.label}`}
                label={option.label}
                count={option.count}
                checked={state.cat === option.value}
                onChange={() =>
                  update({
                    cat: state.cat === option.value ? "" : option.value,
                    page: "",
                  })
                }
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Price">
        <div className="space-y-0.5">
          {(facets.prices ?? []).map((bucket) => {
            const active =
              state.minPrice === String(bucket.min) &&
              state.maxPrice === (bucket.max === null ? "" : String(bucket.max));
            return (
              <CountRow
                key={bucket.label}
                label={bucket.label}
                count={bucket.count}
                checked={active}
                onChange={() =>
                  update({
                    minPrice: active ? "" : String(bucket.min),
                    maxPrice:
                      active || bucket.max === null ? "" : String(bucket.max),
                    page: "",
                  })
                }
              />
            );
          })}
        </div>
        <form
          className="mt-2 flex items-center gap-1.5"
          onSubmit={(event) => event.preventDefault()}
        >
          <input
            aria-label="Minimum price"
            inputMode="decimal"
            placeholder="Min"
            value={state.minPrice}
            onChange={(event) =>
              update({ minPrice: event.target.value, page: "" })
            }
            className="h-10 w-full rounded-md border border-sage-border bg-white px-2 text-base sm:text-[13px]"
          />
          <span className="text-sage">–</span>
          <input
            aria-label="Maximum price"
            inputMode="decimal"
            placeholder="Max"
            value={state.maxPrice}
            onChange={(event) =>
              update({ maxPrice: event.target.value, page: "" })
            }
            className="h-10 w-full rounded-md border border-sage-border bg-white px-2 text-base sm:text-[13px]"
          />
        </form>
      </Section>

      {(facets.ratings?.length ?? 0) > 0 && (
        <Section title="Customer rating">
          <div className="space-y-0.5">
            {facets.ratings.map((option) => (
              <CountRow
                key={option.value}
                label={option.label}
                count={option.count}
                checked={state.rating === String(option.value)}
                onChange={() =>
                  update({
                    rating:
                      state.rating === String(option.value)
                        ? ""
                        : String(option.value),
                    page: "",
                  })
                }
              />
            ))}
          </div>
        </Section>
      )}

      <Section title="Brand">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-sage" />
          <input
            aria-label="Search brands"
            placeholder="Search brands"
            value={brandQuery}
            onChange={(event) => setBrandQuery(event.target.value)}
            className="h-10 w-full rounded-md border border-sage-border bg-white pl-7 pr-2 text-base sm:text-[13px]"
          />
        </div>
        <div className="mt-1.5 max-h-[260px] space-y-0.5 overflow-y-auto pr-1">
          {brands.length === 0 && (
            <p className="py-2 text-[13px] text-sage">No brands match.</p>
          )}
          {brands.map((option) => (
            <CountRow
              key={option.value}
              label={option.label}
              count={option.count}
              checked={hasValue(state.brand, option.value)}
              onChange={() =>
                update({
                  brand: toggleValue(state.brand, option.value),
                  page: "",
                })
              }
            />
          ))}
        </div>
      </Section>

      {(facets.colors?.length ?? 0) > 0 && (
        <Section title="Colour">
          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
            {facets.colors.map((option) => {
              const checked = hasValue(state.color, option.value);
              const swatch = colorSwatch(option.label);
              return (
                <label
                  key={option.value}
                  className={cn(
                    "flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded px-1 text-[13px]",
                    checked && "bg-sage-light",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() =>
                      update({
                        color: toggleValue(state.color, option.value),
                        page: "",
                      })
                    }
                    className="h-3.5 w-3.5 shrink-0 accent-[#0f4c4a]"
                  />
                  <span
                    className="h-3.5 w-3.5 shrink-0 rounded-full border"
                    style={{
                      backgroundColor: swatch,
                      borderColor: isLightColor(swatch)
                        ? "#cfc7b7"
                        : "transparent",
                    }}
                  />
                  <span className="truncate">{option.label}</span>
                </label>
              );
            })}
          </div>
        </Section>
      )}

      {(facets.sizes?.length ?? 0) > 0 && (
        <Section title="Size">
          <div className="flex flex-wrap gap-1.5">
            {facets.sizes.slice(0, 40).map((option) => {
              const checked = hasValue(state.size, option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    update({
                      size: toggleValue(state.size, option.value),
                      page: "",
                    })
                  }
                  aria-pressed={checked}
                  className={cn(
                    "min-h-[36px] min-w-[42px] rounded-md border px-2 text-[12.5px] font-medium",
                    checked
                      ? "border-brand bg-brand text-white"
                      : "border-sage-border bg-white text-ink hover:border-brand/50",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section title="More filters">
        <div className="space-y-0.5">
          <CountRow
            label="Deals only"
            count={dealCount}
            checked={state.deal === "1"}
            onChange={() => update({ deal: state.deal === "1" ? "" : "1", page: "" })}
          />
          <CountRow
            label="In stock only"
            count={inStockCount}
            checked={state.inStock === "1"}
            onChange={() =>
              update({ inStock: state.inStock === "1" ? "" : "1", page: "" })
            }
          />
        </div>
      </Section>
    </div>
  );
}

export function FilterChips({
  state,
  facets,
  update,
  clearAll,
}: {
  state: FilterState;
  facets: Facets;
  update: Updater;
  clearAll: () => void;
}) {
  const labelFor = (
    key: "brand" | "color" | "size",
    value: string,
  ): string => {
    const pool =
      key === "brand"
        ? facets.brands
        : key === "color"
          ? facets.colors
          : facets.sizes;
    return pool?.find((option) => option.value === value)?.label ?? value;
  };

  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (state.dept) {
    const label =
      facets.depts?.find((option) => option.value === state.dept)?.label ??
      state.dept;
    chips.push({
      key: `dept`,
      label: `Department: ${label}`,
      onRemove: () => update({ dept: "", cat: "", page: "" }),
    });
  }
  if (state.cat) {
    const label =
      facets.categories?.find((option) => option.value === state.cat)?.label ??
      state.cat;
    chips.push({
      key: `cat`,
      label: `Category: ${label}`,
      onRemove: () => update({ cat: "", page: "" }),
    });
  }
  for (const value of valuesOf(state.brand)) {
    chips.push({
      key: `brand-${value}`,
      label: labelFor("brand", value),
      onRemove: () => update({ brand: toggleValue(state.brand, value), page: "" }),
    });
  }
  for (const value of valuesOf(state.color)) {
    chips.push({
      key: `color-${value}`,
      label: labelFor("color", value),
      onRemove: () => update({ color: toggleValue(state.color, value), page: "" }),
    });
  }
  for (const value of valuesOf(state.size)) {
    chips.push({
      key: `size-${value}`,
      label: `Size ${labelFor("size", value)}`,
      onRemove: () => update({ size: toggleValue(state.size, value), page: "" }),
    });
  }
  if (state.minPrice || state.maxPrice) {
    chips.push({
      key: "price",
      label: `$${state.minPrice || "0"} – ${state.maxPrice ? `$${state.maxPrice}` : "any"}`,
      onRemove: () => update({ minPrice: "", maxPrice: "", page: "" }),
    });
  }
  if (state.rating) {
    const label =
      facets.ratings?.find((option) => String(option.value) === state.rating)
        ?.label ?? `${state.rating} stars & up`;
    chips.push({
      key: "rating",
      label,
      onRemove: () => update({ rating: "", page: "" }),
    });
  }
  if (state.deal) {
    chips.push({
      key: "deal",
      label: "Deals only",
      onRemove: () => update({ deal: "", page: "" }),
    });
  }
  if (state.inStock) {
    chips.push({
      key: "inStock",
      label: "In stock only",
      onRemove: () => update({ inStock: "", page: "" }),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={chip.onRemove}
          className="inline-flex min-h-[32px] items-center gap-1 rounded-full border border-brand/25 bg-brand-tint px-2.5 text-[12px] font-medium text-brand"
        >
          {chip.label}
          <X className="h-3 w-3" />
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="min-h-[32px] px-1 text-[12px] font-semibold text-sage underline underline-offset-2 hover:text-ink"
      >
        Clear all
      </button>
    </div>
  );
}
