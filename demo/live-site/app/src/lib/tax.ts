/**
 * Brindlewick Tax & Accounting (fictional firm, demo site).
 * Shared types and small helpers for the /tax pages and the guide reader.
 */

import { useEffect } from "react";

export type TaxGuideKind = "publications" | "instructions" | "taxtopics" | "faqs";

export interface TaxLibraryItem {
  id: string;
  source: string;
  title: string;
  url: string;
  kind: TaxGuideKind;
  sections: string[];
}

export type TaxGuideBlock = { p: string } | { table: string[][] };

export interface TaxGuideSection {
  heading: string;
  level: number;
  anchor: string;
  url: string;
  blocks: TaxGuideBlock[];
}

export interface TaxGuideDoc {
  id: string;
  source: string;
  title: string;
  url: string;
  sections: TaxGuideSection[];
}

export interface TaxFaqItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  url: string;
}

export interface TaxSearchResult {
  doc: string;
  page: number | null;
  anchor: string | null;
  title: string;
  href: string;
  snippet: string;
}

/** One source as the library API returns it (GET /api/library/doc?doc=…), all from Octo: a PDF (read in pdf.js from
 * Octo file storage, `pdf` is its URL) or a web-page source drawn as an article from `body`. */
export interface TaxLibDoc {
  doc: string;
  kind: "pdf" | "article";
  source: string;
  title: string;
  url: string;
  category: string;
  pages: number | null;
  sections: { heading: string; level: number; anchor: string }[];
  body: { sections: TaxGuideSection[] } | null;
  pdf: string | null;
}

/** A row of GET /api/library/docs. */
export type TaxLibItem = Pick<TaxLibDoc, "doc" | "kind" | "source" | "title" | "url" | "category" | "pages">;

/** GET /api/library/stats: what is searchable right now (the counts grow while the library loads). */
export interface TaxLibStats {
  docs: number;
  passages: number;
  collections: { category: string; name: string; docs: number; passages: number }[];
}

const docCache = new Map<string, Promise<TaxLibDoc>>();
/** One source from the library API, cached for the page's life (the viewer and the guide page share it). */
export function fetchLibDoc(id: string): Promise<TaxLibDoc> {
  let d = docCache.get(id);
  if (!d) {
    d = fetch(`/api/library/doc?doc=${encodeURIComponent(id)}`).then((r) => {
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    });
    d.catch(() => docCache.delete(id));
    docCache.set(id, d);
  }
  return d;
}

/** An article source as the guide reader draws it. */
export function articleOf(d: TaxLibDoc): TaxGuideDoc {
  const sections = d.body?.sections ?? [];
  // a first section headed with the page's own title (each Code or CFR section) would repeat the page heading
  const [first, ...rest] = sections;
  const deduped = first && first.heading.trim() === d.title.trim() ? [{ ...first, heading: "" }, ...rest] : sections;
  return { id: d.doc, source: d.source, title: d.title, url: d.url, sections: deduped };
}

export const TAX_KINDS: { kind: TaxGuideKind; label: string; short: string }[] = [
  { kind: "publications", label: "Publications", short: "Publications" },
  { kind: "instructions", label: "Form instructions", short: "Form instructions" },
  { kind: "taxtopics", label: "Tax Topics", short: "Tax Topics" },
  { kind: "faqs", label: "FAQ pages", short: "FAQ pages" },
];

/** "IRS Pub 17" -> "IRS Publication 17"; everything else is already plain words. */
export function sourceName(source: string): string {
  const m = /^IRS Pub (\S+)$/.exec(source.trim());
  return m ? `IRS Publication ${m[1]}` : source;
}

/** "irs.gov", "ecfr.gov", "uscode.house.gov": where a source's original lives, for "Open original on …". */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "irs.gov";
  }
}

/** Every /tax page sets its own title. */
export function useTaxTitle(page: string) {
  useEffect(() => {
    document.title = `${page} · Brindlewick Tax & Accounting (Demo)`;
  }, [page]);
}

/** A suggested question calls the copilot: start it (silently) if needed, then ask. */
export function askAssistant(q: string) {
  const c = window.copilot;
  if (!c) return;
  if (!c.getSnapshot().open) c.start({ voice: false });
  c.send(q);
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function ordinal(n: number) {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** The next `count` weekdays (starting tomorrow) for the preferred-date select. */
export function nextWeekdays(count = 10) {
  const cursor = new Date();
  cursor.setHours(12, 0, 0, 0);
  const days: Date[] = [];
  while (days.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const wd = cursor.getDay();
    if (wd !== 0 && wd !== 6) days.push(new Date(cursor));
  }
  const seen = new Map<string, number>();
  for (const d of days) {
    const name = WEEKDAYS[d.getDay()];
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }
  return days.map((d) => {
    const weekday = WEEKDAYS[d.getDay()];
    const monthDay = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    const also =
      (seen.get(weekday) ?? 0) > 1
        ? `${monthDay}, the ${ordinal(d.getDate())}`
        : `${weekday}, ${monthDay}, the ${ordinal(d.getDate())}`;
    return {
      value: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      label: `${weekday}, ${monthDay}`,
      also,
    };
  });
}
