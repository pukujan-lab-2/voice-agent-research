import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, RefreshCw, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { count, fmtDate, stageLabel } from "@/lib/practice";
import { pageRange } from "@/hooks/useApi";

/* ---------- page header ---------- */

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="bw-page-head">
      <div className="bw-page-head-text">
        <h1 className="bw-page-title">{title}</h1>
        {subtitle ? <p className="bw-page-sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="bw-page-actions">{actions}</div> : null}
    </div>
  );
}

/* ---------- states ---------- */

/** Skeleton rows while a request runs: the table keeps its shape so nothing jumps. */
export function SkeletonTable({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bw-skel" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div className="bw-skel-row" key={r}>
          {Array.from({ length: cols }).map((__, c) => (
            <span
              className="bw-skel-bar"
              key={c}
              style={{ width: `${[46, 24, 18, 12, 14, 10][c % 6]}%`, animationDelay: `${(r * 6 + c) * 40}ms` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({ n = 6 }: { n?: number }) {
  return (
    <div className="bw-skel-cards" aria-hidden="true">
      {Array.from({ length: n }).map((_, i) => (
        <div className="bw-skel-card" key={i} style={{ animationDelay: `${i * 60}ms` }}>
          <span className="bw-skel-bar" style={{ width: "62%" }} />
          <span className="bw-skel-bar" style={{ width: "38%" }} />
          <span className="bw-skel-bar" style={{ width: "48%" }} />
        </div>
      ))}
    </div>
  );
}

export function SkeletonBlock({ h = 96 }: { h?: number }) {
  return <div className="bw-skel-block" style={{ height: h }} aria-hidden="true" />;
}

/** A failed request: the API's own text, calmly, with a Retry. */
export function ErrorState({
  message,
  onRetry,
  compact = false,
}: {
  message: string;
  onRetry?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("bw-error", compact && "bw-error-compact")} role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="bw-btn bw-btn-quiet bw-btn-sm" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" /> Retry
        </button>
      ) : null}
    </div>
  );
}

/** A list with nothing in it. */
export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="bw-empty">{children}</p>;
}

/* ---------- buttons ---------- */

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      type="button"
      className={cn("bw-btn", `bw-btn-${variant}`, size === "sm" && "bw-btn-sm", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------- chips ---------- */

const STAGE_TONE: Record<string, string> = {
  organizer_sent: "slate",
  docs_in: "amber",
  in_prep: "blue",
  review: "violet",
  efiled: "teal",
  accepted: "green",
};

export function StageChip({ stage, label }: { stage: string | null | undefined; label?: string }) {
  if (!stage) return <span className="bw-chip bw-chip-none">—</span>;
  return (
    <span className={cn("bw-chip", `bw-chip-${STAGE_TONE[stage] ?? "slate"}`)}>
      <span className="bw-chip-dot" aria-hidden="true" />
      {label ?? stageLabel(stage)}
    </span>
  );
}

const STATUS_TONE: Record<string, string> = {
  open: "amber",
  overdue: "red",
  partial: "blue",
  paid: "green",
  requested: "amber",
  received: "green",
  resolved: "green",
  new: "red",
  "in progress": "blue",
  "waiting on irs": "violet",
  "response sent": "teal",
  done: "green",
  waiting: "violet",
};

export function StatusChip({ status }: { status: string | null | undefined }) {
  if (!status) return <span className="bw-chip bw-chip-none">—</span>;
  const key = status.toLowerCase();
  return (
    <span className={cn("bw-chip", `bw-chip-${STATUS_TONE[key] ?? "slate"}`)}>{status}</span>
  );
}

export function CodeChip({ code }: { code: string }) {
  return <code className="bw-code">{code}</code>;
}

const PRIORITY_COLOR: Record<string, string> = {
  high: "hsl(0 62% 52%)",
  normal: "hsl(158 24% 46%)",
  low: "hsl(220 8% 68%)",
};

export function PriorityDot({ priority }: { priority?: string | null }) {
  const p = priority ?? "normal";
  return (
    <span
      className="bw-priority"
      title={`${p.charAt(0).toUpperCase()}${p.slice(1)} priority`}
      style={{ background: PRIORITY_COLOR[p] ?? PRIORITY_COLOR.normal }}
      aria-label={`${p} priority`}
    />
  );
}

export function MissingDocs({ n }: { n?: number | null }) {
  if (!n) return null;
  return (
    <span className="bw-missing" title={`${n} missing document${n === 1 ? "" : "s"}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
        <path d="M21.4 11.05 12.25 20.2a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
      {n}
    </span>
  );
}

/** A due date that goes red once it is past. */
export function DueDate({ iso, past }: { iso?: string | null; past?: boolean }) {
  if (!iso) return <span className="bw-muted">—</span>;
  return <span className={cn("bw-due", past && "bw-due-past")}>{fmtDate(iso)}</span>;
}

/* ---------- pagination ---------- */

export function Pagination({
  page,
  size,
  total,
  pages,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  pages: number;
  onPage: (n: number) => void;
}) {
  return (
    <div className="bw-pagination" data-testid="staff-pagination">
      <span className="bw-pagination-range">
        {pageRange(page, size, total)} {total === 1 ? "item" : "items"}
      </span>
      <div className="bw-pagination-controls">
        <button
          type="button"
          className="bw-page-btn"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={15} />
        </button>
        <label className="bw-page-label">
          <span className="bw-visually-hidden">Page</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, pages)}
            value={page}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (Number.isFinite(next) && next >= 1) onPage(Math.min(next, Math.max(1, pages)));
            }}
            className="bw-page-input"
            aria-label="Page number"
          />
          <span className="bw-page-of">of {count(pages)}</span>
        </label>
        <button
          type="button"
          className="bw-page-btn"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

/* ---------- filter controls ---------- */

export function SearchField({
  value,
  onChange,
  placeholder,
  label,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
  testId?: string;
}) {
  return (
    <div className="bw-search" data-testid={testId}>
      <Search size={15} aria-hidden="true" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        autoComplete="off"
      />
      {value ? (
        <button type="button" className="bw-search-clear" onClick={() => onChange("")} aria-label="Clear the search">
          <X size={13} />
        </button>
      ) : null}
    </div>
  );
}

export function SelectField({
  value,
  onChange,
  label,
  options,
  testId,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
  testId?: string;
}) {
  return (
    <label className="bw-select">
      <span className="bw-visually-hidden">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} aria-label={label}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; n?: number }[];
  label: string;
}) {
  return (
    <div className="bw-segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cn("bw-segment", value === o.value && "active")}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.n !== undefined ? <span className="bw-segment-n">{count(o.n)}</span> : null}
        </button>
      ))}
    </div>
  );
}

/* ---------- layout helpers ---------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("bw-card", className)}>{children}</div>;
}

export function CardHead({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="bw-card-head">
      <h2 className="bw-card-title">{title}</h2>
      {aside}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "plain",
  to,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "plain" | "warn" | "good" | "accent";
  to?: string;
}) {
  const body = (
    <>
      <span className="bw-stat-label">{label}</span>
      <span className="bw-stat-value">{value}</span>
      {hint ? <span className="bw-stat-hint">{hint}</span> : null}
    </>
  );
  const cls = cn("bw-stat", `bw-stat-${tone}`, to && "bw-stat-link");
  if (to) {
    return (
      <Link className={cls} to={to}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Tabular numbers everywhere they matter. */
export function Num({ children }: { children: ReactNode }) {
  return <span className="bw-num">{children}</span>;
}

/** The aria wiring for a field with an inline error, so the message is announced with the input. */
export function fieldAria(id: string, error?: string, hint?: string) {
  const ids = [error ? `${id}-error` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ");
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": ids || undefined,
  } as const;
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("bw-field", error && "bw-field-invalid", className)}>
      <label htmlFor={htmlFor}>{label}</label>
      {children}
      {hint ? (
        <p className="bw-field-hint" id={`${htmlFor}-hint`}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="bw-field-error" id={`${htmlFor}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** The 422 summary at the top of a form. */
export function FormErrorSummary({ errors }: { errors: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (entries.length === 0) return null;
  return (
    <div className="bw-form-errors" data-testid="staff-form-errors" role="alert">
      <strong>{entries.length === 1 ? "One thing needs fixing" : `${entries.length} things need fixing`}</strong>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="bw-toast" role="status">
      {message}
    </div>
  );
}
