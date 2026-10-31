import { useState } from "react";
import { Link } from "react-router-dom";
import { Heart, Loader2, ShoppingCart, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import { money } from "@/lib/format";
import { productHref, type Card } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { ProductImage } from "@/components/ProductCard";
import { RatingLine } from "@/components/Stars";

export default function Wishlist() {
  useDocumentTitle("Wishlist");
  const { data, error, loading, reload } = useApi(
    (signal) => api.wishlist(signal),
    [],
  );
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const items: Card[] = data?.items ?? [];

  const remove = async (item: Card) => {
    setBusy(item.id);
    setNotice(null);
    try {
      await api.removeFromWishlist(item.id);
      window.dispatchEvent(new CustomEvent("bw:wishlist-changed"));
      reload();
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const hasOptions = (item: Card) =>
    (item.colors?.length ?? 0) > 1 || (item.sizes?.length ?? 0) > 1;

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        Wishlist
      </h1>
      <p className="mt-1 text-[13px] text-sage">
        Saved for later, kept with your guest shopper.
      </p>

      {notice && (
        <p className="mt-3 inline-block rounded-lg bg-saffron-soft px-3 py-1.5 text-[12.5px] font-semibold text-ink">
          {notice}
        </p>
      )}

      {loading && !data && <LoadingState label="Loading your wishlist…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} className="mt-4" />}

      {data && items.length === 0 && (
        <div className="mt-4">
          <EmptyState title="Your wishlist is empty" icon="none">
            <p>
              Tap “Add to wishlist” on any product to keep it here while you
              decide.
            </p>
            <Link
              to="/search"
              className="tap mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white"
            >
              <Heart className="h-4 w-4" />
              Find something to save
            </Link>
          </EmptyState>
        </div>
      )}

      {items.length > 0 && (
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-xl border border-sage-border bg-white p-3"
            >
              <Link to={productHref(item)} className="shrink-0">
                <ProductImage
                  src={item.image}
                  alt=""
                  className="h-24 w-24"
                  imgClassName="p-1.5"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-semibold uppercase tracking-wide text-sage">
                  {item.brand}
                </p>
                <Link
                  to={productHref(item)}
                  className="line-clamp-2 text-[13px] font-medium leading-tight text-ink hover:text-brand hover:underline"
                >
                  {item.title}
                </Link>
                <div className="mt-0.5">
                  <RatingLine rating={item.rating} reviewCount={item.review_count} />
                </div>
                <p className="mt-0.5 text-[14px] font-extrabold text-ink">
                  {money(item.price)}
                </p>

                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Link
                    to={productHref(item)}
                    className="inline-flex min-h-[36px] items-center gap-1.5 rounded-md bg-saffron px-3 text-[12px] font-bold text-ink hover:bg-saffron-dark hover:text-white"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {hasOptions(item) ? "Choose options" : "Move to cart"}
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove(item)}
                    disabled={busy === item.id}
                    className="inline-flex min-h-[36px] items-center gap-1 text-[12px] font-semibold text-sage hover:text-destructive disabled:opacity-60"
                  >
                    {busy === item.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                    Remove
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
