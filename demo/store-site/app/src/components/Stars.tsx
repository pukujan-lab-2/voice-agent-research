import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { number } from "@/lib/format";

export function Stars({
  rating,
  size = 14,
  className,
}: {
  rating: number;
  size?: number;
  className?: string;
}) {
  const rounded = Math.round(rating * 2) / 2;
  return (
    <span
      className={cn("inline-flex items-center gap-[1px]", className)}
      aria-hidden="true"
    >
      {[1, 2, 3, 4, 5].map((index) => {
        const filled = rounded >= index;
        const half = !filled && rounded >= index - 0.5;
        return (
          <span
            key={index}
            className="relative inline-block"
            style={{ width: size, height: size }}
          >
            <Star
              size={size}
              className="absolute inset-0 text-saffron/40"
              strokeWidth={1.6}
            />
            {(filled || half) && (
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: half ? size / 2 : size }}
              >
                <Star
                  size={size}
                  className="text-saffron"
                  fill="#e9a23b"
                  strokeWidth={1.4}
                />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function RatingLine({
  rating,
  reviewCount,
  className,
  size = 13,
}: {
  rating: number | null;
  reviewCount: number;
  className?: string;
  size?: number;
}) {
  if (!rating) {
    return (
      <span className={cn("text-xs text-sage", className)}>
        No reviews yet
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <Stars rating={rating} size={size} />
      <span className="text-xs font-semibold text-ink">
        {rating.toFixed(1)}
      </span>
      <span className="text-xs text-sage">({number(reviewCount)})</span>
    </span>
  );
}
