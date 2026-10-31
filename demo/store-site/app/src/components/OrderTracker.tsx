import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OrderStep } from "@/lib/types";

export function OrderTracker({
  steps,
  compact = false,
}: {
  steps: OrderStep[];
  compact?: boolean;
}) {
  if (!steps?.length) return null;
  return (
    <ol
      className={cn(
        "flex w-full items-start gap-0",
        compact ? "text-[10px]" : "text-[11px]",
      )}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={`${step.status}-${index}`} className="relative flex-1">
            <div className="flex items-center">
              <span
                className={cn(
                  "z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  step.done
                    ? "border-brand bg-brand text-white"
                    : "border-sage-border bg-white text-sage",
                )}
              >
                {step.done ? (
                  <Check className="h-3 w-3" strokeWidth={3} />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-sage-border" />
                )}
              </span>
              {!isLast && (
                <span
                  className={cn(
                    "h-[2px] w-full",
                    step.done ? "bg-brand" : "bg-sage-border",
                  )}
                />
              )}
            </div>
            <p
              className={cn(
                "mt-1 pr-1 leading-tight",
                step.done ? "font-semibold text-ink" : "text-sage",
              )}
            >
              {step.status}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
