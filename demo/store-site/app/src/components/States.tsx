import { Link } from "react-router-dom";
import { AlertTriangle, Loader2, RefreshCw, SearchX } from "lucide-react";
import { cn } from "@/lib/utils";

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-sage-border bg-white px-5 py-10 text-center",
        className,
      )}
    >
      <AlertTriangle className="mx-auto h-7 w-7 text-saffron-dark" />
      <p className="mx-auto mt-3 max-w-sm text-[15px] font-medium text-ink">
        {message}
      </p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-sage">
        Brambleway couldn't load this just now.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="tap mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white transition hover:bg-brand-dark"
      >
        <RefreshCw className="h-4 w-4" />
        Retry
      </button>
    </div>
  );
}

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-16 text-sm text-sage",
        className,
      )}
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  icon = "search",
}: {
  title: string;
  children?: React.ReactNode;
  icon?: "search" | "none";
}) {
  return (
    <div className="rounded-xl border border-sage-border bg-white px-5 py-12 text-center">
      {icon === "search" && (
        <SearchX className="mx-auto h-8 w-8 text-sage" />
      )}
      <p className="mt-3 font-display text-lg font-semibold text-brand">
        {title}
      </p>
      {children && (
        <div className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-sage">
          {children}
        </div>
      )}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-sage-border bg-white">
      <div className="aspect-square animate-pulse bg-sage-tile" />
      <div className="space-y-2 p-3">
        <div className="h-3 w-4/5 animate-pulse rounded bg-sage-light" />
        <div className="h-3 w-3/5 animate-pulse rounded bg-sage-light" />
        <div className="h-4 w-1/3 animate-pulse rounded bg-sage-light" />
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} />
      ))}
    </div>
  );
}

export function RetryLink({ onRetry }: { onRetry: () => void }) {
  return (
    <button
      type="button"
      onClick={onRetry}
      className="tap mt-3 inline-flex items-center gap-1.5 rounded-md border border-sage-border px-3 text-xs font-semibold text-brand"
    >
      <RefreshCw className="h-3.5 w-3.5" /> Retry
    </button>
  );
}

export function InlineError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-white p-4 text-sm text-destructive">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1 font-semibold underline"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

export function TextLink({
  to,
  children,
  className,
}: {
  to: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "font-semibold text-brand underline decoration-saffron decoration-2 underline-offset-2 hover:text-brand-light",
        className,
      )}
    >
      {children}
    </Link>
  );
}
