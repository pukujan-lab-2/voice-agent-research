import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { CheckCircle2, Truck, Undo2, XCircle } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import { dateTime, money, shortDate } from "@/lib/format";
import type { OrderLine } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/States";
import { OrderTracker } from "@/components/OrderTracker";
import { cn } from "@/lib/utils";

const REASONS = [
  "It doesn't fit",
  "It arrived damaged",
  "Not what I expected",
  "Wrong item sent",
  "No longer needed",
  "Other reason",
];

function ReturnForm({
  orderId,
  lines,
  onDone,
}: {
  orderId: string;
  lines: OrderLine[];
  onDone: () => void;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]);
  const [method, setMethod] = useState<"dropoff" | "mail">("dropoff");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = Object.entries(quantities).filter(([, qty]) => qty > 0);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (selected.length === 0) {
      setError("Choose at least one item to return.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.startReturn({
        orderId,
        lines: selected.map(([sku, qty]) => ({ sku, qty })),
        reason,
        method,
      });
      setQuantities({});
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="mt-3 rounded-lg border border-sage-border bg-white p-3.5"
    >
      <h3 className="font-display text-base font-semibold text-brand">
        Start a return
      </h3>
      <ul className="mt-2 space-y-2">
        {lines.map((line) => {
          const max = line.qty;
          return (
            <li key={line.sku} className="flex items-center gap-2">
              <div className="h-11 w-11 shrink-0 overflow-hidden rounded bg-sage-tile">
                <img src={line.image} alt="" className="h-full w-full object-contain p-1" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[12.5px] text-ink">{line.title}</p>
                <p className="text-[11px] text-sage">
                  {[line.color, line.size].filter(Boolean).join(" · ")} · up to {max}
                </p>
              </div>
              <select
                aria-label={`Quantity to return for ${line.title}`}
                value={quantities[line.sku] ?? 0}
                onChange={(event) =>
                  setQuantities((prev) => ({
                    ...prev,
                    [line.sku]: Number(event.target.value),
                  }))
                }
                className="h-10 rounded-md border border-sage-border bg-white px-1.5 text-base sm:text-[13px]"
              >
                {Array.from({ length: max + 1 }).map((_, index) => (
                  <option key={index} value={index}>
                    {index}
                  </option>
                ))}
              </select>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-ink">
          Reason
          <select
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-sage-border bg-white px-2 text-base font-normal sm:text-[13px]"
          >
            {REASONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <fieldset className="text-[12px] font-semibold text-ink">
          <legend>How will you send it back?</legend>
          <div className="mt-1 space-y-1 font-normal">
            <label className="flex min-h-[32px] items-center gap-2 text-[12.5px]">
              <input
                type="radio"
                name="return-method"
                checked={method === "dropoff"}
                onChange={() => setMethod("dropoff")}
                className="h-4 w-4 accent-[#0f4c4a]"
              />
              Drop off at a Brambleway point (free)
            </label>
            <label className="flex min-h-[32px] items-center gap-2 text-[12.5px]">
              <input
                type="radio"
                name="return-method"
                checked={method === "mail"}
                onChange={() => setMethod("mail")}
              />
              Mail it back (prepaid label)
            </label>
          </div>
        </fieldset>
      </div>

      {error && (
        <p className="mt-2 rounded bg-destructive/10 px-2 py-1.5 text-[12px] font-semibold text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="tap mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 text-[13px] font-bold text-white disabled:opacity-60"
      >
        <Undo2 className="h-4 w-4" />
        {submitting ? "Starting return…" : "Start return"}
      </button>
    </form>
  );
}

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const justPlaced = params.get("placed") === "1";
  useDocumentTitle(`Order ${id ?? ""}`);

  const { data, error, loading, reload } = useApi(
    (signal) => api.order(id!, signal),
    [id],
  );

  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [returnOpen, setReturnOpen] = useState(false);

  const cancel = async () => {
    if (!id) return;
    setCancelling(true);
    setActionError(null);
    try {
      await api.cancelOrder(id);
      reload();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setCancelling(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="bw-container py-8">
        <LoadingState label="Loading order…" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bw-container py-8">
        <ErrorState message={error} onRetry={reload} />
        <Link
          to="/orders"
          className="tap mt-3 inline-flex items-center rounded-lg border border-sage-border px-4 text-sm font-semibold text-brand"
        >
          All orders
        </Link>
      </div>
    );
  }

  if (!data) return null;
  const order = data;

  return (
    <div className="bw-container py-5">
      {justPlaced && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-[#2c7a4b]/30 bg-[#eaf5ee] p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2c7a4b]" />
          <div>
            <p className="font-display text-lg font-semibold text-[#1f5c39]">
              Thank you, your demo order is placed
            </p>
            <p className="mt-0.5 text-[13px] text-[#2c7a4b]">
              Nothing was charged and nothing will ship — this is a demo store.
            </p>
          </div>
        </div>
      )}

      <nav className="text-[12px] text-sage">
        <Link to="/orders" className="hover:text-brand hover:underline">
          Your orders
        </Link>
        <span className="mx-1">›</span>
        <span>Order {order.id}</span>
      </nav>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-brand">
          Order {order.id}
        </h1>
        <p className="text-[13px] text-sage">
          Placed {shortDate(order.created_at)}
        </p>
      </div>

      {actionError && (
        <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">
          {actionError}
        </p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="space-y-4">
          <section className="rounded-xl border border-sage-border bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-lg font-semibold text-brand">
                {order.status}
              </h2>
              {order.estimate && (
                <p className="text-[12.5px] text-sage">
                  Estimated delivery{" "}
                  <span className="font-semibold text-ink">{order.estimate}</span>
                </p>
              )}
            </div>
            <div className="mt-3">
              <OrderTracker steps={order.steps ?? []} />
            </div>

            <div className="mt-4 grid gap-2 border-t border-sage-border pt-3 text-[12.5px] sm:grid-cols-2">
              <p className="flex items-center gap-1.5 text-sage">
                <Truck className="h-4 w-4 text-brand" />
                {order.carrier || "Carrier to be assigned"}
              </p>
              <p className="text-sage">
                Tracking number:{" "}
                <span className="font-mono font-semibold text-ink">
                  {order.trackingNumber || "—"}
                </span>
              </p>
            </div>

            {(order.steps ?? []).some((step) => step.at) && (
              <ul className="mt-3 space-y-1 border-t border-sage-border pt-3">
                {order.steps.map((step, index) => (
                  <li
                    key={`${step.status}-${index}`}
                    className={cn(
                      "flex items-baseline justify-between gap-2 text-[12.5px]",
                      step.done ? "text-ink" : "text-sage",
                    )}
                  >
                    <span className="font-medium">{step.status}</span>
                    <span className="text-sage">
                      {step.at ? dateTime(step.at) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex flex-wrap gap-2 border-t border-sage-border pt-3">
              {order.canCancel && (
                <button
                  type="button"
                  onClick={cancel}
                  disabled={cancelling}
                  className="tap inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-4 text-[13px] font-semibold text-destructive disabled:opacity-60"
                >
                  <XCircle className="h-4 w-4" />
                  {cancelling ? "Cancelling…" : "Cancel order"}
                </button>
              )}
              {order.canReturn && !returnOpen && (
                <button
                  type="button"
                  onClick={() => setReturnOpen(true)}
                  className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand/30 px-4 text-[13px] font-semibold text-brand"
                >
                  <Undo2 className="h-4 w-4" />
                  Start a return
                </button>
              )}
            </div>

            {returnOpen && (
              <ReturnForm
                orderId={order.id}
                lines={order.lines}
                onDone={() => {
                  setReturnOpen(false);
                  reload();
                }}
              />
            )}
          </section>

          <section className="rounded-xl border border-sage-border bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-brand">
              Items
            </h2>
            <ul className="mt-2 divide-y divide-sage-border">
              {order.lines.map((line) => (
                <li key={line.sku} className="flex gap-3 py-2.5 first:pt-0">
                  <Link
                    to={`/p/${line.product_id}/${line.sku}`}
                    className="h-14 w-14 shrink-0 overflow-hidden rounded bg-sage-tile"
                  >
                    <img
                      src={line.image}
                      alt=""
                      className="h-full w-full object-contain p-1"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[13px] text-ink">
                      {line.title}
                    </p>
                    <p className="text-[11.5px] text-sage">
                      Qty {line.qty}
                      {line.color ? ` · ${line.color}` : ""}
                      {line.size ? ` · ${line.size}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[13px] font-semibold text-ink">
                    {money(line.price * line.qty)}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {(order.returns?.length ?? 0) > 0 && (
            <section className="rounded-xl border border-sage-border bg-white p-4">
              <h2 className="font-display text-lg font-semibold text-brand">
                Returns
              </h2>
              <ul className="mt-2 space-y-2">
                {order.returns.map((record) => (
                  <li
                    key={record.id}
                    className="rounded-lg bg-sage-light px-3 py-2 text-[12.5px]"
                  >
                    <p className="font-semibold text-ink">
                      {record.status} · {record.method === "dropoff" ? "Drop-off" : "Mail-in"}
                    </p>
                    <p className="text-sage">
                      Started {shortDate(record.created_at)} · {record.reason}
                    </p>
                    <p className="text-sage">
                      {record.lines
                        .map((line) => `${line.qty} × ${line.title ?? line.sku}`)
                        .join(", ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-xl border border-sage-border bg-white p-4">
            <h2 className="font-display text-base font-semibold text-brand">
              Order summary
            </h2>
            <dl className="mt-2 space-y-1 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-sage">Subtotal</dt>
                <dd className="font-semibold">{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sage">Shipping</dt>
                <dd className="font-semibold">
                  {order.shipping_cost === 0 ? "Free" : money(order.shipping_cost)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sage">Tax</dt>
                <dd className="font-semibold">{money(order.tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-sage-border pt-1.5">
                <dt className="font-bold">Total</dt>
                <dd className="font-extrabold">{money(order.total)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-sage-border bg-white p-4">
            <h2 className="font-display text-base font-semibold text-brand">
              Delivery address
            </h2>
            <address className="mt-1 text-[13px] not-italic leading-relaxed text-ink/90">
              {order.address.name}
              <br />
              {order.address.line1}
              {order.address.line2 ? (
                <>
                  <br />
                  {order.address.line2}
                </>
              ) : null}
              <br />
              {order.address.city}, {order.address.state} {order.address.zip}
              <br />
              {order.address.country}
            </address>
            {order.address.email && (
              <p className="mt-1.5 text-[12px] text-sage">{order.address.email}</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
