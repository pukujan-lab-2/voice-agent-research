import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useApi, useCartSignal, useDocumentTitle, notifyCartChanged } from "@/lib/hooks";
import { money, number } from "@/lib/format";
import type { CartLine } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { ProductRow } from "@/components/ProductCard";

export default function Cart() {
  useDocumentTitle("Cart");
  const tick = useCartSignal();
  const { data, error, loading, reload } = useApi(
    (signal) => api.cart(signal),
    [tick],
  );
  const deals = useApi((signal) => api.home(signal), []);
  const [busySku, setBusySku] = useState<string | null>(null);
  const [lineErrors, setLineErrors] = useState<Record<string, string>>({});

  const setQty = async (line: CartLine, qty: number) => {
    setBusySku(line.sku);
    setLineErrors((prev) => ({ ...prev, [line.sku]: "" }));
    try {
      if (qty <= 0) await api.removeFromCart(line.sku);
      else await api.addToCart(line.sku, qty, "set");
      notifyCartChanged();
    } catch (err) {
      setLineErrors((prev) => ({ ...prev, [line.sku]: errorMessage(err) }));
    } finally {
      setBusySku(null);
    }
  };

  const remove = async (line: CartLine) => {
    setBusySku(line.sku);
    setLineErrors((prev) => ({ ...prev, [line.sku]: "" }));
    try {
      await api.removeFromCart(line.sku);
      notifyCartChanged();
    } catch (err) {
      setLineErrors((prev) => ({ ...prev, [line.sku]: errorMessage(err) }));
    } finally {
      setBusySku(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="bw-container py-8">
        <LoadingState label="Loading your cart…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bw-container py-8">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) return null;

  if (data.lines.length === 0) {
    return (
      <div className="bw-container py-6">
        <h1 className="font-display text-2xl font-semibold text-brand">
          Your cart
        </h1>
        <div className="mt-4">
          <EmptyState title="Your cart is empty" icon="none">
            <p>
              Nothing here yet. Have a look at today's deals — or ask the
              copilot to find something for you.
            </p>
            <Link
              to="/search?deal=1&sort=discount"
              className="tap mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white"
            >
              <ShoppingBag className="h-4 w-4" />
              Shop today's deals
            </Link>
          </EmptyState>
        </div>
        {deals.data && (
          <ProductRow
            title="Today's deals"
            items={deals.data.deals ?? []}
            action={{ label: "See all", to: "/search?deal=1&sort=discount" }}
          />
        )}
      </div>
    );
  }

  const freeShippingAt = data.freeShippingAt ?? 0;
  const remaining = Math.max(0, freeShippingAt - data.subtotal);
  const progress = freeShippingAt
    ? Math.min(100, Math.round((data.subtotal / freeShippingAt) * 100))
    : 100;

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand">
        Your cart
        <span className="ml-2 text-sm font-normal text-sage">
          {number(data.count)} {data.count === 1 ? "item" : "items"}
        </span>
      </h1>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <div className="rounded-xl border border-sage-border bg-white">
          <div className="border-b border-sage-border px-4 py-3">
            {remaining > 0 ? (
              <p className="text-[13px] text-ink">
                Add{" "}
                <span className="font-bold text-brand">{money(remaining)}</span>{" "}
                for free standard shipping
              </p>
            ) : (
              <p className="text-[13px] font-semibold text-[#2c7a4b]">
                Your order ships free with standard delivery.
              </p>
            )}
            <div
              className="mt-1.5 h-2 overflow-hidden rounded-full bg-sage-light"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label="Free shipping progress"
            >
              <div
                className="h-full rounded-full bg-saffron transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <ul>
            {data.lines.map((line) => (
              <li
                key={line.sku}
                className="flex gap-3 border-b border-sage-border p-3 last:border-b-0 sm:p-4"
              >
                <Link
                  to={`/p/${line.product_id}/${line.slug}`}
                  className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-sage-tile"
                >
                  <img
                    src={line.image}
                    alt=""
                    className="h-full w-full object-contain p-1.5"
                    loading="lazy"
                  />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/p/${line.product_id}/${line.slug}`}
                    className="line-clamp-2 text-[13.5px] font-medium leading-tight text-ink hover:text-brand hover:underline"
                  >
                    {line.title}
                  </Link>
                  <p className="mt-0.5 text-[11.5px] text-sage">
                    {[line.color, line.size].filter(Boolean).join(" · ") ||
                      line.brand}
                  </p>
                  <p className="mt-0.5 text-[11.5px] text-sage">
                    {line.stock <= 4 && line.stock > 0
                      ? `Only ${line.stock} left`
                      : line.stock <= 0
                        ? "Out of stock"
                        : "In stock"}
                  </p>

                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center rounded-lg border border-sage-border">
                      <button
                        type="button"
                        aria-label="Decrease quantity"
                        onClick={() => setQty(line, line.qty - 1)}
                        disabled={busySku === line.sku}
                        className="flex h-9 w-9 items-center justify-center text-brand disabled:opacity-40"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[28px] text-center text-[13px] font-semibold">
                        {line.qty}
                      </span>
                      <button
                        type="button"
                        aria-label="Increase quantity"
                        onClick={() => setQty(line, Math.min(10, line.qty + 1))}
                        disabled={busySku === line.sku || line.qty >= 10}
                        className="flex h-9 w-9 items-center justify-center text-brand disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => remove(line)}
                      disabled={busySku === line.sku}
                      className="inline-flex items-center gap-1 text-[12px] font-semibold text-sage hover:text-destructive"
                    >
                      {busySku === line.sku ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Remove
                    </button>
                  </div>
                  {lineErrors[line.sku] && (
                    <p className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[11.5px] font-semibold text-destructive">
                      {lineErrors[line.sku]}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[14px] font-extrabold text-ink">
                    {money(line.line_total)}
                  </p>
                  <p className="text-[11px] text-sage">{money(line.price)} each</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <aside className="rounded-xl border border-sage-border bg-white p-4 lg:sticky lg:top-[122px]">
          <div className="flex items-baseline justify-between">
            <span className="text-[13px] text-sage">Subtotal</span>
            <span className="text-lg font-extrabold text-ink">
              {money(data.subtotal)}
            </span>
          </div>
          <p className="mt-1 text-[11.5px] text-sage">
            Tax and shipping are calculated at checkout.
          </p>

          <div className="mt-3 border-t border-sage-border pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-sage">
              Shipping options
            </p>
            <ul className="mt-1 space-y-1">
              {(data.shipping ?? []).map((option) => (
                <li
                  key={option.id}
                  className="flex items-baseline justify-between gap-2 text-[12.5px]"
                >
                  <span className="text-ink">
                    {option.label}{" "}
                    <span className="text-sage">· {option.days}</span>
                  </span>
                  <span className="font-semibold text-ink">
                    {option.cost === 0 ? "Free" : money(option.cost)}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Link
            to="/checkout"
            className="tap mt-4 inline-flex w-full items-center justify-center rounded-lg bg-brand text-[14px] font-bold text-white hover:bg-brand-dark"
          >
            Proceed to checkout
          </Link>
          <Link
            to="/search"
            className="tap mt-2 inline-flex w-full items-center justify-center rounded-lg border border-sage-border text-[13px] font-semibold text-brand"
          >
            Keep shopping
          </Link>
          <p className="mt-3 text-center text-[11px] text-sage">
            Demo: nothing is charged or shipped.
          </p>
        </aside>
      </div>
    </div>
  );
}
