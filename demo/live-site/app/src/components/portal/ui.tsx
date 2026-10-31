import type { ReactNode } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("pt-card", className)}>{children}</section>;
}

export function PortalHead({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="pt-page-head">
      <div>
        <h1 className="pt-page-title">{title}</h1>
        {subtitle ? <p className="pt-page-sub">{subtitle}</p> : null}
      </div>
      {actions}
    </div>
  );
}

export function PortalSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="pt-skel" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div className="pt-skel-row" key={i} style={{ animationDelay: `${i * 60}ms` }}>
          <span className="pt-skel-bar" style={{ width: "58%" }} />
          <span className="pt-skel-bar" style={{ width: "34%" }} />
        </div>
      ))}
    </div>
  );
}

export function PortalError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="pt-error" role="alert">
      <AlertCircle size={16} aria-hidden="true" />
      <p>{message}</p>
      {onRetry ? (
        <button type="button" className="pt-btn pt-btn-quiet pt-btn-sm" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" /> Retry
        </button>
      ) : null}
    </div>
  );
}

export function PortalEmpty({ children }: { children: ReactNode }) {
  return <p className="pt-empty">{children}</p>;
}

export function PortalStatus({ status }: { status: string }) {
  const key = status.toLowerCase();
  const tone =
    key === "paid" || key === "received" || key === "accepted" || key === "resolved"
      ? "green"
      : key === "overdue"
        ? "red"
        : key === "partial"
          ? "blue"
          : "amber";
  return <span className={`pt-chip pt-chip-${tone}`}>{status}</span>;
}
