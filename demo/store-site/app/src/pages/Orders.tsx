import { Link } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import { money, number, shortDate } from "@/lib/format";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { OrderTracker } from "@/components/OrderTracker";

export default function Orders() {
  useDocumentTitle("Your orders");
  const { data, error, loading, reload } = useApi(
    (signal) => api.orders(signal),
    [],
  );

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        Your orders
      </h1>
      <p className="mt-1 text-[13px] text-sage">
        Demo orders placed with this guest shopper.
      </p>

      {loading && !data && <LoadingState label="Loading orders…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} className="mt-4" />}

      {data && data.orders.length === 0 && (
        <div className="mt-4">
          <EmptyState title="No orders yet" icon="none">
            <p>
              Once you place a demo order it appears here with tracking, cancel
              and return options.
            </p>
            <Link
              to="/search"
              className="tap mt-4 inline-flex items-center gap-2 rounded-lg bg-brand px-5 text-sm font-semibold text-white"
            >
              <PackageSearch className="h-4 w-4" />
              Start shopping
            </Link>
          </EmptyState>
        </div>
      )}

      {data && data.orders.length > 0 && (
        <ul className="mt-4 space-y-3">
          {data.orders.map((order) => (
            <li
              key={order.id}
              className="rounded-xl border border-sage-border bg-white p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-sage">
                    Order {order.id}
                  </p>
                  <p className="text-[13px] text-ink">
                    Placed {shortDate(order.created_at)} · {number(order.lines?.length ?? 0)}{" "}
                    {order.lines?.length === 1 ? "item" : "items"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[15px] font-extrabold text-ink">
                    {money(order.total)}
                  </p>
                  <p className="text-[12px] font-semibold text-brand">
                    {order.status}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <OrderTracker steps={order.steps ?? []} compact />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  to={`/orders/${order.id}`}
                  className="tap inline-flex items-center rounded-lg border border-brand/30 px-4 text-[13px] font-semibold text-brand hover:border-brand"
                >
                  View order
                </Link>
                {order.estimate && (
                  <span className="text-[12px] text-sage">
                    Estimated delivery {order.estimate}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
