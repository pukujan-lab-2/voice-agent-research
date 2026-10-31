import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, ShoppingCart, X } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useApi, useDocumentTitle, notifyCartChanged } from "@/lib/hooks";
import { money } from "@/lib/format";
import { productHref } from "@/lib/types";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { ProductImage } from "@/components/ProductCard";
import { Stars } from "@/components/Stars";
import { useState } from "react";

export default function Compare() {
  useDocumentTitle("Compare");
  const [params] = useSearchParams();
  const ids = useMemo(
    () =>
      (params.get("ids") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .slice(0, 4),
    [params],
  );

  const { data, error, loading, reload } = useApi(
    (signal) => (ids.length ? api.compare(ids.join(","), signal) : Promise.resolve(null)),
    [ids.join(",")],
  );

  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const add = async (productId: number, sku: string) => {
    setBusy(sku);
    setNotice(null);
    try {
      await api.addToCart(sku, 1);
      notifyCartChanged();
      setNotice("Added to cart.");
    } catch (err) {
      setNotice(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (ids.length === 0) {
    return (
      <div className="bw-container py-8">
        <EmptyState title="Nothing to compare yet">
          <p>
            Tick “Compare” on up to four products while you browse, then come
            back here to see them side by side.
          </p>
          <Link
            to="/search"
            className="tap mt-4 inline-flex items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white"
          >
            Browse products
          </Link>
        </EmptyState>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="bw-container py-8">
        <LoadingState label="Comparing products…" />
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

  const products = data?.products ?? [];
  const specNames = data?.specNames ?? [];

  const valueFor = (product: (typeof products)[number], name: string) =>
    product.specs?.find((spec) => spec.name === name)?.value ?? "—";

  const differs = (name: string) =>
    new Set(products.map((product) => valueFor(product, name))).size > 1;

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand">
        Compare products
      </h1>
      <p className="mt-1 text-sm text-sage">
        {products.length} of 4 selected. Differences are highlighted.
      </p>
      {notice && (
        <p className="mt-2 inline-block rounded-md bg-saffron-soft px-2.5 py-1.5 text-[12.5px] font-semibold text-ink">
          {notice}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-sage-border bg-white">
        <table className="w-full min-w-[640px] border-collapse text-[13px]">
          <thead>
            <tr>
              <th className="w-[150px] border-b border-sage-border p-2 text-left align-bottom text-[11px] font-bold uppercase tracking-wide text-sage">
                Product
              </th>
              {products.map((product) => (
                <th
                  key={product.id}
                  className="border-b border-l border-sage-border p-2.5 text-left align-top font-normal"
                >
                  <div className="flex items-start justify-between gap-1">
                    <Link to={productHref(product)} className="block flex-1">
                      <ProductImage
                        src={product.image}
                        alt=""
                        className="aspect-square w-full rounded-md"
                        imgClassName="p-2"
                      />
                      <p className="mt-1.5 line-clamp-2 text-[13px] font-semibold leading-tight text-ink hover:text-brand">
                        {product.title}
                      </p>
                    </Link>
                    <Link
                      to={`/compare?ids=${ids.filter((id) => id !== String(product.id)).join(",")}`}
                      aria-label={`Remove ${product.title}`}
                      className="rounded p-1 text-sage hover:text-ink"
                    >
                      <X className="h-4 w-4" />
                    </Link>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-wide text-sage">
                    {product.brand}
                  </p>
                  <p className="mt-1 text-base font-extrabold text-ink">
                    {money(product.price)}
                  </p>
                  <div className="mt-1">
                    <Stars rating={product.rating ?? 0} size={12} />
                    <span className="ml-1 text-[11px] text-sage">
                      {product.rating ? product.rating.toFixed(1) : "—"} (
                      {product.review_count})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      add(
                        product.id,
                        product.variants?.find((variant) => variant.stock > 0)?.sku ??
                          product.variants?.[0]?.sku ??
                          "",
                      )
                    }
                    disabled={!product.variants?.length || busy !== null}
                    className="tap mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-saffron text-[12.5px] font-bold text-ink hover:bg-saffron-dark hover:text-white disabled:opacity-50"
                  >
                    {busy === product.variants?.[0]?.sku ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShoppingCart className="h-3.5 w-3.5" />
                    )}
                    Add to cart
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {specNames.map((name) => {
              const highlight = differs(name);
              return (
                <tr key={name} className="border-b border-sage-border last:border-b-0">
                  <th
                    scope="row"
                    className="p-2 text-left align-top text-[12.5px] font-semibold text-sage"
                  >
                    {name}
                  </th>
                  {products.map((product) => (
                    <td
                      key={`${product.id}-${name}`}
                      className={
                        highlight
                          ? "border-l border-sage-border bg-saffron-soft p-2 align-top font-semibold text-ink"
                          : "border-l border-sage-border p-2 align-top text-ink/90"
                      }
                    >
                      {valueFor(product, name)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
