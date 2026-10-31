import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Check,
  ChevronRight,
  Heart,
  Loader2,
  ShieldCheck,
  ShoppingCart,
  Truck,
  Undo2,
} from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useApi, useDocumentTitle, pushRecent, notifyCartChanged } from "@/lib/hooks";
import {
  colorSwatch,
  isLightColor,
  longDate,
  money,
  number,
  shortDate,
} from "@/lib/format";
import type { Variant } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "@/components/States";
import { ProductImage, ProductRow } from "@/components/ProductCard";
import { RatingLine, Stars } from "@/components/Stars";
import { QuestionsSection, ReviewSection } from "@/components/product/ReviewSection";

function deliveryEstimate() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() + 3);
  const end = new Date(today);
  end.setDate(end.getDate() + 6);
  return `${longDate(start.toISOString())} – ${longDate(end.toISOString())}`;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export default function Product() {
  const { id, slug } = useParams<{ id: string; slug?: string }>();
  const [params, setParams] = useSearchParams();
  const skuParam = params.get("sku") ?? "";

  const { data, error, loading, reload } = useApi(
    (signal) => api.product(id!, signal),
    [id],
  );

  useDocumentTitle(data?.title ?? "Product");

  const [quantity, setQuantity] = useState(1);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [cartError, setCartError] = useState<string | null>(null);
  const [wishlistState, setWishlistState] = useState<"idle" | "saved">("idle");
  const [wishlistError, setWishlistError] = useState<string | null>(null);

  const variants = data?.variants ?? [];

  const selected: Variant | undefined = useMemo(() => {
    if (!variants.length) return undefined;
    return (
      variants.find((variant) => variant.sku === skuParam) ??
      variants.find((variant) => variant.stock > 0) ??
      variants[0]
    );
  }, [variants, skuParam]);

  const colors = useMemo(
    () => unique(variants.map((v) => v.color).filter((c): c is string => !!c)),
    [variants],
  );
  const sizes = useMemo(
    () => unique(variants.map((v) => v.size).filter((s): s is string => !!s)),
    [variants],
  );

  const selectVariant = (next: Variant | undefined) => {
    if (!next) return;
    setAdded(false);
    setCartError(null);
    setQuantity(1);
    const nextParams = new URLSearchParams(params);
    nextParams.set("sku", next.sku);
    setParams(nextParams, { replace: true });
  };

  const chooseColor = (color: string) => {
    const sameSize = variants.find(
      (variant) => variant.color === color && variant.size === selected?.size,
    );
    const inStock = variants.find(
      (variant) => variant.color === color && variant.stock > 0,
    );
    const any = variants.find((variant) => variant.color === color);
    selectVariant(sameSize && sameSize.stock > 0 ? sameSize : inStock ?? sameSize ?? any);
  };

  const chooseSize = (size: string) => {
    const match = variants.find(
      (variant) =>
        variant.size === size &&
        (variant.color ?? "") === (selected?.color ?? ""),
    );
    const fallback = variants.find((variant) => variant.size === size);
    selectVariant(match ?? fallback);
  };

  const galleryImages = useMemo(() => {
    if (!data) return [];
    const list = [
      selected?.image ?? data.image,
      data.image,
      ...variants.map((variant) => variant.image),
    ].filter(Boolean);
    return unique(list);
  }, [data, selected, variants]);

  useEffect(() => {
    setGalleryIndex(0);
  }, [selected?.sku]);

  // Keep the selected variant in the URL so a link opens the same one.
  useEffect(() => {
    if (!selected || skuParam === selected.sku) return;
    const nextParams = new URLSearchParams(params);
    nextParams.set("sku", selected.sku);
    setParams(nextParams, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.sku, skuParam]);

  useEffect(() => {
    if (!data) return;
    pushRecent({
      id: data.id,
      slug: data.slug,
      title: data.title,
      image: data.image,
      price: data.price,
    });
  }, [data]);

  const stock = selected?.stock ?? 0;
  const outOfStock = stock <= 0;
  const price = selected?.price ?? data?.price ?? 0;
  const listPrice = data?.list_price ?? null;
  const savings =
    listPrice && listPrice > price ? Math.round(((listPrice - price) / listPrice) * 100) : 0;

  const addToCart = async () => {
    if (!selected) return;
    setAdding(true);
    setCartError(null);
    try {
      await api.addToCart(selected.sku, quantity);
      notifyCartChanged();
      setAdded(true);
    } catch (err) {
      setCartError(errorMessage(err));
    } finally {
      setAdding(false);
    }
  };

  const addToWishlist = async () => {
    if (!data) return;
    setWishlistError(null);
    try {
      await api.addToWishlist(data.id);
      setWishlistState("saved");
      window.dispatchEvent(new CustomEvent("bw:wishlist-changed"));
    } catch (err) {
      setWishlistError(errorMessage(err));
    }
  };

  if (loading && !data) {
    return (
      <div className="bw-container py-6">
        <LoadingState label="Loading product…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bw-container py-6">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  if (!data) return null;

  const product = data;

  return (
    <div
      className="bw-container py-4 sm:py-6"
      data-product-id={product.id}
    >
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-[12px] text-sage">
        <Link to="/" className="hover:text-brand hover:underline">
          Home
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          to={`/d/${product.dept_slug}`}
          className="hover:text-brand hover:underline"
        >
          {product.dept}
        </Link>
        <ChevronRight className="h-3 w-3" />
        <Link
          to={`/c/${product.cat_slug}`}
          className="hover:text-brand hover:underline"
        >
          {product.category}
        </Link>
      </nav>

      <div className="mx-auto mt-3 grid max-w-[1120px] gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8">
        {/* Gallery */}
        <div className="min-w-0">
          <div className="grid gap-3 sm:grid-cols-[64px_minmax(0,1fr)]">
            <div className="order-2 flex gap-2 overflow-x-auto no-scrollbar sm:order-1 sm:flex-col sm:overflow-visible">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => setGalleryIndex(index)}
                  aria-label={`View image ${index + 1}`}
                  className={cn(
                    "h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-sage-tile p-1",
                    index === galleryIndex
                      ? "border-brand"
                      : "border-sage-border",
                  )}
                >
                  <img src={image} alt="" className="h-full w-full object-contain" />
                </button>
              ))}
            </div>
            <ProductImage
              src={galleryImages[galleryIndex] ?? product.image}
              alt={product.title}
              className="order-1 aspect-square w-full rounded-xl sm:order-2"
              imgClassName="p-6 sm:p-10"
              eager
            />
          </div>
        </div>

        {/* Buy box */}
        <div className="min-w-0 lg:sticky lg:top-[128px] lg:self-start">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-sage">
            <Link
              to={`/search?brand=${encodeURIComponent(product.brand)}`}
              className="hover:text-brand hover:underline"
            >
              Visit the {product.brand} store
            </Link>
          </p>
          <h1 className="mt-1 font-display text-[1.35rem] font-semibold leading-tight text-ink sm:text-[1.7rem]">
            {product.title}
          </h1>
          <p className="mt-1 text-[11px] text-sage">{product.demoNote}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Stars rating={product.rating ?? 0} size={15} />
            <span className="text-[13px] font-semibold text-ink">
              {product.rating ? product.rating.toFixed(1) : "New"}
            </span>
            <a
              href="#reviews"
              className="text-[12.5px] text-brand underline underline-offset-2"
            >
              {number(product.review_count)} reviews
            </a>
            {product.question_count > 0 && (
              <a
                href="#questions"
                className="text-[12.5px] text-sage underline underline-offset-2 hover:text-brand"
              >
                {number(product.question_count)} answered questions
              </a>
            )}
          </div>

          <div className="mt-3 rounded-xl border border-sage-border bg-white p-3.5">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-[1.7rem] font-extrabold leading-none text-ink">
                {money(price)}
              </span>
              {listPrice && listPrice > price && (
                <span className="text-sm text-sage line-through">
                  {money(listPrice)}
                </span>
              )}
              {product.deal > 0 && (
                <span className="rounded bg-saffron px-1.5 py-0.5 text-[11px] font-extrabold text-ink">
                  -{Math.round(product.deal)}%
                </span>
              )}
            </div>
            {listPrice && listPrice > price && (
              <p className="mt-1 text-[12.5px] text-sage">
                You save {money(listPrice - price)} ({savings}%)
                {product.deal_ends
                  ? ` · deal ends ${shortDate(product.deal_ends)}`
                  : ""}
              </p>
            )}
            {product.max_price > product.price && (
              <p className="mt-0.5 text-[12px] text-sage">
                Other options from {money(product.price)}
              </p>
            )}

            {colors.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold text-ink">
                  Colour:{" "}
                  <span className="font-normal text-sage">
                    {selected?.color ?? "—"}
                  </span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {colors.map((color) => {
                    const anyStock = variants.some(
                      (variant) => variant.color === color && variant.stock > 0,
                    );
                    const isSelected = selected?.color === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        data-color={color}
                        onClick={() => chooseColor(color)}
                        aria-pressed={isSelected}
                        title={anyStock ? color : `${color} — out of stock`}
                        className={cn(
                          "tap relative flex items-center justify-center rounded-full border-2 p-[3px]",
                          isSelected ? "border-brand" : "border-sage-border",
                          !anyStock && "opacity-60",
                        )}
                      >
                        <span
                          className="h-7 w-7 rounded-full border"
                          style={{
                            backgroundColor: colorSwatch(color),
                            borderColor: isLightColor(colorSwatch(color))
                              ? "#cfc7b7"
                              : "transparent",
                          }}
                        />
                        {!anyStock && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <span className="h-[1.5px] w-8 rotate-45 bg-ink/70" />
                          </span>
                        )}
                        <span className="sr-only">
                          {color}
                          {anyStock ? "" : " (out of stock)"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {sizes.length > 0 && (
              <div className="mt-3">
                <p className="text-[12px] font-semibold text-ink">
                  Size:{" "}
                  <span className="font-normal text-sage">
                    {selected?.size ?? "—"}
                  </span>
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {sizes.map((size) => {
                    const variant = variants.find(
                      (candidate) =>
                        candidate.size === size &&
                        (candidate.color ?? "") === (selected?.color ?? ""),
                    );
                    const available = variant ? variant.stock > 0 : true;
                    const isSelected = selected?.size === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        data-size={size}
                        onClick={() => chooseSize(size)}
                        aria-pressed={isSelected}
                        aria-disabled={!available}
                        className={cn(
                          "min-h-[44px] min-w-[52px] rounded-lg border px-3 text-[13px] font-semibold",
                          isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-sage-border bg-white text-ink hover:border-brand/50",
                          !available &&
                            "cursor-not-allowed border-sage-border/60 text-sage/60 line-through hover:border-sage-border/60",
                        )}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <p
              className={cn(
                "mt-3 text-[13px] font-semibold",
                outOfStock
                  ? "text-destructive"
                  : stock <= 4
                    ? "text-saffron-dark"
                    : "text-[#2c7a4b]",
              )}
            >
              {outOfStock
                ? "Out of stock"
                : stock <= 4
                  ? `Only ${stock} left`
                  : "In stock"}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <label
                htmlFor="quantity"
                className="text-[12.5px] font-semibold text-ink"
              >
                Quantity
              </label>
              <select
                id="quantity"
                value={quantity}
                onChange={(event) => setQuantity(Number(event.target.value))}
                className="h-11 rounded-lg border border-sage-border bg-white px-2 text-base font-semibold text-ink sm:text-[13px]"
              >
                {Array.from({ length: 10 }).map((_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                data-testid="add-to-cart"
                data-sku={selected?.sku}
                onClick={addToCart}
                disabled={outOfStock || adding}
                className="tap inline-flex w-full items-center justify-center gap-2 rounded-lg bg-saffron text-[15px] font-extrabold text-ink transition hover:bg-saffron-dark hover:text-white disabled:cursor-not-allowed disabled:bg-sage-light disabled:text-sage"
              >
                {adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                {outOfStock ? "Out of stock" : "Add to cart"}
              </button>
              <button
                type="button"
                onClick={addToWishlist}
                disabled={wishlistState === "saved"}
                className="tap inline-flex w-full items-center justify-center gap-2 rounded-lg border border-brand/30 bg-white text-[14px] font-semibold text-brand transition hover:border-brand disabled:opacity-70"
              >
                {wishlistState === "saved" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Heart className="h-4 w-4" />
                )}
                {wishlistState === "saved" ? "Saved to wishlist" : "Add to wishlist"}
              </button>
            </div>

            {added && (
              <p className="mt-2 flex items-center gap-1.5 rounded-md bg-[#eaf5ee] px-2.5 py-1.5 text-[12.5px] font-semibold text-[#2c7a4b]">
                <Check className="h-3.5 w-3.5" />
                Added to cart.{" "}
                <Link to="/cart" className="underline underline-offset-2">
                  View cart
                </Link>
              </p>
            )}
            {cartError && (
              <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-destructive">
                {cartError}
              </p>
            )}
            {wishlistError && (
              <p className="mt-2 rounded-md bg-destructive/10 px-2.5 py-1.5 text-[12.5px] font-semibold text-destructive">
                {wishlistError}
              </p>
            )}

            <ul className="mt-3 space-y-1.5 border-t border-sage-border pt-3 text-[12.5px] text-sage">
              <li className="flex items-start gap-1.5">
                <Truck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>
                  Free standard delivery — arrives{" "}
                  <span className="font-semibold text-ink">
                    {deliveryEstimate()}
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <Undo2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>30-day returns, free by drop-off</span>
              </li>
              <li className="flex items-start gap-1.5">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <span>Demo store — nothing is charged or shipped</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* About + specs */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-sage-border bg-white p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold text-brand">
            About this item
          </h2>
          <ul className="mt-2 space-y-1.5">
            {(product.bullets ?? []).map((bullet, index) => (
              <li
                key={index}
                className="flex gap-2 text-[13.5px] leading-relaxed text-ink/90"
              >
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-saffron" />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          {product.description && (
            <p className="mt-3 border-t border-sage-border pt-3 text-[13.5px] leading-relaxed text-ink/90">
              {product.description}
            </p>
          )}
        </section>

        <section className="rounded-xl border border-sage-border bg-white p-4 sm:p-5">
          <h2 className="font-display text-lg font-semibold text-brand">
            Specifications
          </h2>
          <table
            data-testid="specs"
            className="mt-2 w-full table-fixed border-collapse text-[13px]"
          >
            <tbody>
              {(product.specs ?? []).map((spec) => (
                <tr
                  key={spec.name}
                  data-spec={spec.name}
                  className="border-b border-sage-border last:border-b-0"
                >
                  <th
                    scope="row"
                    className="w-[42%] py-1.5 pr-3 text-left align-top font-semibold text-sage"
                  >
                    {spec.name}
                  </th>
                  <td className="py-1.5 align-top text-ink">{spec.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      <ReviewSection product={product} />
      <QuestionsSection product={product} />

      {(product.related?.length ?? 0) > 0 && (
        <ProductRow title="Similar items" items={product.related} />
      )}
    </div>
  );
}
