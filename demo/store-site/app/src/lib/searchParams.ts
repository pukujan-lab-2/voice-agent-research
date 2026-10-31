export const SORT_OPTIONS = [
  { value: "relevance", label: "Featured" },
  { value: "popular", label: "Best sellers" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "reviews", label: "Most reviews" },
  { value: "newest", label: "Newest arrivals" },
  { value: "discount", label: "Biggest discount" },
] as const;

export const FILTER_KEYS = [
  "q",
  "cat",
  "dept",
  "brand",
  "color",
  "size",
  "minPrice",
  "maxPrice",
  "rating",
  "inStock",
  "deal",
  "sort",
  "page",
  "exact",
  // set by the copilot for gift ideas ("for my dad who likes camping"); passed through to the API as they are
  "tags",
  "audience",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

export type FilterState = Record<FilterKey, string>;

export function readFilters(params: URLSearchParams): FilterState {
  const state = {} as FilterState;
  for (const key of FILTER_KEYS) state[key] = params.get(key) ?? "";
  return state;
}

export function writeFilters(state: FilterState): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = state[key];
    if (value) params.set(key, value);
  }
  return params;
}

export const MULTI_KEYS: FilterKey[] = ["brand", "color", "size"];

export function valuesOf(value: string): string[] {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function toggleValue(current: string, value: string): string {
  const list = valuesOf(current);
  const next = list.includes(value)
    ? list.filter((entry) => entry !== value)
    : [...list, value];
  return next.join(",");
}

export function hasValue(current: string, value: string): boolean {
  return valuesOf(current).includes(value);
}

export function buildSearchPath(
  state: Partial<FilterState>,
  base = "/search",
): string {
  const params = writeFilters({ ...emptyFilters(), ...state });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

export function emptyFilters(): FilterState {
  return {
    q: "",
    cat: "",
    dept: "",
    brand: "",
    color: "",
    size: "",
    minPrice: "",
    maxPrice: "",
    rating: "",
    inStock: "",
    deal: "",
    sort: "",
    page: "",
    exact: "",
    tags: "",
    audience: "",
  };
}

export function activeFilterCount(state: FilterState): number {
  let count = 0;
  for (const key of ["dept", "cat", "brand", "color", "size", "rating", "deal", "inStock"] as FilterKey[]) {
    if (state[key]) count += key === "brand" || key === "color" || key === "size"
      ? valuesOf(state[key]).length
      : 1;
  }
  if (state.minPrice || state.maxPrice) count += 1;
  return count;
}
