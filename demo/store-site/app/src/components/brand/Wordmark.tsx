import { cn } from "@/lib/utils";

/** The Brambleway mark: a leaf-and-path bramble motif drawn from shapes only. */
export function BrambleMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="presentation"
      aria-hidden="true"
      className={cn("h-7 w-7", className)}
    >
      <circle cx="16" cy="16" r="15" fill="#e9a23b" />
      <path
        d="M16 27c0-6.2 0-9.4 0-13.6"
        stroke="#0f4c4a"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M16 17.4c-3.6.2-6.1-1.6-7.2-4.9 3.5-.9 6.1.4 7.2 4.9Z"
        fill="#0f4c4a"
      />
      <path
        d="M16 14.1c3.2.3 5.6-1.1 6.7-4.1-3.3-.9-5.7.2-6.7 4.1Z"
        fill="#0f4c4a"
      />
      <circle cx="16" cy="9.1" r="1.9" fill="#0f4c4a" />
      <circle cx="22.6" cy="20.6" r="1.35" fill="#fdf1dc" />
      <circle cx="10.2" cy="22.1" r="1.15" fill="#fdf1dc" />
    </svg>
  );
}

export function Wordmark({
  className,
  tone = "light",
}: {
  className?: string;
  tone?: "light" | "dark";
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <BrambleMark />
      <span
        className={cn(
          "font-display text-[1.4rem] font-semibold leading-none tracking-[-0.015em] sm:text-[1.6rem]",
          tone === "light" ? "text-white" : "text-brand",
        )}
      >
        Brambleway
      </span>
    </span>
  );
}
