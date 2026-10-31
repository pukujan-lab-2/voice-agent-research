import { Link } from "react-router-dom";
import { X } from "lucide-react";

export function CompareTray({
  ids,
  onRemove,
  onClear,
}: {
  ids: number[];
  onRemove: (id: number) => void;
  onClear: () => void;
}) {
  if (ids.length === 0) return null;
  return (
    <div className="sticky bottom-2 z-30 mt-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/25 bg-white p-2.5 shadow-[0_6px_24px_rgba(15,76,74,0.16)]">
        <span className="pl-1 text-[13px] font-semibold text-brand">
          Compare ({ids.length}/4)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {ids.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onRemove(id)}
              className="inline-flex items-center gap-1 rounded-full bg-sage-light px-2 py-1 text-[11.5px] font-medium text-ink"
              aria-label={`Remove product ${id} from comparison`}
            >
              #{id}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onClear}
            className="tap rounded-md px-2 text-[12.5px] font-semibold text-sage hover:text-ink"
          >
            Clear
          </button>
          <Link
            to={`/compare?ids=${ids.join(",")}`}
            aria-disabled={ids.length < 2}
            onClick={(event) => {
              if (ids.length < 2) event.preventDefault();
            }}
            className={
              ids.length < 2
                ? "tap inline-flex cursor-not-allowed items-center rounded-md bg-sage-light px-4 text-[13px] font-bold text-sage"
                : "tap inline-flex items-center rounded-md bg-brand px-4 text-[13px] font-bold text-white hover:bg-brand-dark"
            }
          >
            Compare {ids.length < 2 ? "(pick 2+)" : ""}
          </Link>
        </div>
      </div>
    </div>
  );
}
