export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function number(value: number | null | undefined): string {
  if (value === null || value === undefined) return "0";
  return value.toLocaleString("en-US");
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function plural(count: number, singular: string, pluralForm?: string) {
  return `${number(count)} ${count === 1 ? singular : pluralForm ?? `${singular}s`}`;
}

/** Rough, friendly stock sentence for a product card. */
export function lowStockLabel(inStock: boolean | number): string | null {
  if (typeof inStock === "number") {
    if (inStock <= 0) return null;
    if (inStock <= 4) return `Only ${inStock} left`;
  }
  return null;
}

const COLOR_SWATCHES: Record<string, string> = {
  black: "#1f2421",
  white: "#f7f5f0",
  ivory: "#f1e8d8",
  cream: "#f4ecd9",
  grey: "#8d9391",
  gray: "#8d9391",
  charcoal: "#3b3f3d",
  silver: "#c8ccca",
  navy: "#22364f",
  blue: "#3a6ea5",
  teal: "#0f4c4a",
  green: "#4b7355",
  olive: "#6b6f3f",
  sage: "#9db09a",
  mint: "#bcdccb",
  red: "#a63a35",
  crimson: "#8d2b32",
  burgundy: "#6d2b32",
  rust: "#a8542f",
  orange: "#d97a2b",
  mustard: "#c39b2a",
  yellow: "#e3c34a",
  gold: "#c9a227",
  pink: "#dba0ae",
  rose: "#c97f8f",
  purple: "#6a4a78",
  plum: "#4f2f45",
  lavender: "#b9a8d0",
  brown: "#6d4b32",
  tan: "#c9a680",
  beige: "#e2d5bf",
  sand: "#d8c3a2",
  stone: "#b9b3a6",
  coral: "#d9755f",
  turquoise: "#3f9e9a",
  clear: "#e8eef0",
};

export function colorSwatch(name: string | null | undefined): string {
  if (!name) return "#cfc7b7";
  const key = name.toLowerCase().trim();
  if (COLOR_SWATCHES[key]) return COLOR_SWATCHES[key];
  const first = key.split(/[\s/]+/)[0];
  return COLOR_SWATCHES[first] ?? "#cfc7b7";
}

export function isLightColor(hex: string): boolean {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 180;
}

export function titleCase(value: string): string {
  return value.replace(/\b\w/g, (c) => c.toUpperCase());
}
