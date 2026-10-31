/**
 * Small helpers for the public site (/tax): the icon map, citation markers, opening hours and prices.
 * No firm content lives here — every name, figure and quotation comes from the practice API.
 */

import {
  AlertCircle, Archive, ArrowLeftRight, BadgeDollarSign, Banknote, BarChart3, Bitcoin, BookOpen,
  Briefcase, Building2, Calculator, CalendarDays, Car, CheckSquare, ClipboardCheck, Coins,
  CreditCard, DollarSign, FileCheck2, FileSpreadsheet, FileText, Gavel, Globe, GraduationCap,
  HandCoins, Handshake, HardHat, HeartPulse, Home, KeyRound, Landmark, Laptop, LineChart, Lock,
  Mail, MapPin, Package, Percent, PiggyBank, Plane, Receipt, Repeat, Scale, Scissors, Search,
  ShieldAlert, ShieldCheck, ShoppingBag, Smartphone, Sparkles, Stethoscope, Store, TrendingUp,
  Truck, Umbrella, UserCheck, Users, Utensils, Wallet, Warehouse, Wrench, type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  "alert-circle": AlertCircle, archive: Archive, "arrow-left-right": ArrowLeftRight,
  "badge-dollar-sign": BadgeDollarSign, banknote: Banknote, "bar-chart-3": BarChart3, bitcoin: Bitcoin,
  "book-open": BookOpen, briefcase: Briefcase, "building-2": Building2, calculator: Calculator,
  "calendar-days": CalendarDays, car: Car, "check-square": CheckSquare, "clipboard-check": ClipboardCheck,
  coins: Coins, "credit-card": CreditCard, "dollar-sign": DollarSign, "file-check-2": FileCheck2,
  "file-spreadsheet": FileSpreadsheet, "file-text": FileText, gavel: Gavel, globe: Globe,
  "graduation-cap": GraduationCap, "hand-coins": HandCoins, handshake: Handshake, "hard-hat": HardHat,
  "heart-pulse": HeartPulse, home: Home, "key-round": KeyRound, landmark: Landmark, laptop: Laptop,
  "line-chart": LineChart, lock: Lock, mail: Mail, "map-pin": MapPin, package: Package, percent: Percent,
  "piggy-bank": PiggyBank, plane: Plane, receipt: Receipt, repeat: Repeat, scale: Scale, scissors: Scissors,
  search: Search, "shield-alert": ShieldAlert, "shield-check": ShieldCheck, "shopping-bag": ShoppingBag,
  smartphone: Smartphone, sparkles: Sparkles, stethoscope: Stethoscope, store: Store,
  "trending-up": TrendingUp, truck: Truck, umbrella: Umbrella, "user-check": UserCheck, users: Users,
  utensils: Utensils, wallet: Wallet, warehouse: Warehouse, wrench: Wrench,
};

/** An icon name from the API (a lucide-react name) as a component. */
export function siteIcon(name?: string | null): LucideIcon {
  if (!name) return FileText;
  const key = name.trim().toLowerCase().replace(/\s+/g, "-");
  return ICONS[key] ?? FileText;
}

/* ---------- prices ---------- */

/** `from_price` as "From $325". A figure that already carries words is left alone. */
export function fromPrice(value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") return `From $${value.toLocaleString("en-US")}`;
  const text = value.trim();
  if (/[a-z]/i.test(text)) return text;
  const bare = text.replace(/^\$/, "");
  return /^[\d,.]+$/.test(bare) ? `From $${bare}` : text;
}

/* ---------- citations ---------- */

/** Splits body text on its `[1]`, `[2]` markers. Odd entries are markers, even entries are text. */
export function splitCites(text: string): { text: string; marker: number | null }[] {
  const parts: { text: string; marker: number | null }[] = [];
  const re = /\[(\d{1,3})\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ text: text.slice(last, m.index), marker: null });
    parts.push({ text: m[1], marker: Number(m[1]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last), marker: null });
  return parts;
}

/** The citation a marker points at (1-based), or undefined when the body cites nothing. */
export function citeAt<T extends { title: string }>(cites: T[] | undefined, n: number): T | undefined {
  if (!cites) return undefined;
  return cites[n - 1];
}

/* ---------- opening hours ---------- */

export const WEEK_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export const WEEK_LABEL: Record<string, string> = {
  mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
  fri: "Friday", sat: "Saturday", sun: "Sunday",
};

/** The day key for a JS weekday (0 = Sunday), matching the API's `mon`..`sun` keys. */
export function dayKey(weekday: number): string {
  return ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][weekday] ?? "mon";
}

/** A 24-hour number as "9:00 am". */
export function clock(hour: number, minute = 0): string {
  const h = hour % 12 || 12;
  const suffix = hour >= 12 ? "pm" : "am";
  return minute ? `${h}:${String(minute).padStart(2, "0")} ${suffix}` : `${h} ${suffix}`;
}

/** `[9, 17]` as "9 am – 5 pm"; `[0, 0]` as "Closed". */
export function hoursText(range?: [number, number] | number[] | null): string {
  if (!range || range.length < 2) return "Closed";
  const [open, close] = range;
  if (!open && !close) return "Closed";
  return `${clock(open)} – ${clock(close)}`;
}

/* ---------- misc ---------- */

export function rating(value: number | string): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/** The calendar day and time of a slot as one ISO string, for the .ics download. */
export function slotStart(date: string, time: string): string {
  return `${date}T${time}:00`;
}

/** A generated .ics file as a data URL, for "Add to calendar". */
export function icsDataUrl(opts: {
  title: string;
  date: string;
  time: string;
  minutes?: number;
  location?: string;
  description?: string;
}): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${opts.date}T${opts.time}:00`);
  const end = new Date(start.getTime() + (opts.minutes ?? 30) * 60_000);
  const stamp = (d: Date) =>
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Brindlewick Tax & Accounting//Demo//EN",
    "BEGIN:VEVENT",
    `UID:${stamp(start)}-brindlewick@example.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${opts.title.replace(/[\n,;]/g, " ")}`,
    `LOCATION:${(opts.location ?? "").replace(/[\n,;]/g, " ")}`,
    `DESCRIPTION:${(opts.description ?? "").replace(/[\n,;]/g, " ")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(lines.join("\r\n"))}`;
}

/** The three offices and their opening hours, as the footer and contact page show them. */
export function todayKey(): string {
  return dayKey(new Date().getDay());
}
