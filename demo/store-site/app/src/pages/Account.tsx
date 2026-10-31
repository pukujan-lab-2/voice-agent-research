import { Link } from "react-router-dom";
import { Heart, Package, RotateCcw, UserRound } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import { number } from "@/lib/format";
import { ErrorState, LoadingState } from "@/components/States";

export default function Account() {
  useDocumentTitle("Account");
  const { data, error, loading, reload } = useApi(
    (signal) => api.account(signal),
    [],
  );

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        Account
      </h1>

      {loading && !data && <LoadingState label="Loading your account…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} className="mt-4" />}

      {data && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
          <section className="rounded-xl border border-sage-border bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-tint text-brand">
                <UserRound className="h-5 w-5" />
              </span>
              <div>
                <p className="font-display text-lg font-semibold text-ink">
                  {data.name || "Guest shopper"}
                </p>
                <p className="text-[12px] text-sage">
                  No sign-in needed in this demo
                </p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-sage-border pt-3 text-center">
              {[
                { label: "Orders", value: data.orders, to: "/orders" },
                { label: "Returns", value: data.returns, to: "/account" },
                { label: "Wishlist", value: data.wishlist, to: "/wishlist" },
              ].map((stat) => (
                <div key={stat.label}>
                  <dd className="text-lg font-extrabold text-ink">
                    {number(stat.value)}
                  </dd>
                  <dt className="text-[11px] uppercase tracking-wide text-sage">
                    {stat.label}
                  </dt>
                </div>
              ))}
            </dl>

            {data.last_address && (
              <div className="mt-3 border-t border-sage-border pt-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-sage">
                  Last delivery address
                </p>
                <address className="mt-1 text-[12.5px] not-italic leading-relaxed text-ink/90">
                  {data.last_address.name}
                  <br />
                  {data.last_address.line1}
                  {data.last_address.line2 ? (
                    <>
                      <br />
                      {data.last_address.line2}
                    </>
                  ) : null}
                  <br />
                  {data.last_address.city}, {data.last_address.state}{" "}
                  {data.last_address.zip}
                </address>
              </div>
            )}

            {data.note && (
              <p className="mt-3 rounded-lg bg-sage-tile px-2.5 py-2 text-[11.5px] leading-snug text-sage">
                {data.note}
              </p>
            )}
          </section>

          <section className="rounded-xl border border-sage-border bg-white p-4">
            <h2 className="font-display text-lg font-semibold text-brand">
              Your shopping
            </h2>
            <ul className="mt-2 divide-y divide-sage-border">
              {[
                {
                  to: "/orders",
                  icon: Package,
                  title: "Your orders",
                  description: "Track, cancel or return a demo order.",
                },
                {
                  to: "/wishlist",
                  icon: Heart,
                  title: "Wishlist",
                  description: "Everything you saved for later.",
                },
                {
                  to: "/help",
                  icon: RotateCcw,
                  title: "Returns and help",
                  description: "Read how returns and refunds work here.",
                },
              ].map((row) => (
                <li key={row.to}>
                  <Link
                    to={row.to}
                    className="flex min-h-[56px] items-center gap-3 py-2.5 hover:text-brand"
                  >
                    <row.icon className="h-5 w-5 shrink-0 text-brand" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink">
                        {row.title}
                      </span>
                      <span className="block text-[12px] text-sage">
                        {row.description}
                      </span>
                    </span>
                    <span aria-hidden="true" className="text-sage">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <p className="mt-3 rounded-lg bg-saffron-soft px-3 py-2 text-[12px] leading-snug text-ink">
              Brambleway is a demo. There is no sign-in, no password and no real
              account — your cart, orders and wishlist belong to a guest shopper
              id stored in this browser.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
