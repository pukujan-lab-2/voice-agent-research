import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { useApi, useCartSignal, useDocumentTitle, notifyCartChanged } from "@/lib/hooks";
import { money } from "@/lib/format";
import type { ShipOption } from "@/lib/types";
import { US_STATES, spelledCode } from "@/lib/usStates";
import { ErrorState, LoadingState } from "@/components/States";

const SHIP_ALSO: Record<string, string> = {
  standard: "standard, regular, normal, cheapest, free",
  expedited: "expedited, faster, two day, 2 day, express",
  nextday: "next day, tomorrow, overnight, fastest",
  freight: "freight, delivery",
};

const GIFT_WRAP_PER_ITEM = 4.99;

function fieldClass(extra = "") {
  return `h-12 w-full rounded-lg border border-sage-border bg-white px-3 text-base text-ink placeholder:text-sage/70 focus:border-brand focus:outline-none ${extra}`;
}

function SectionHeading({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
        {step}
      </span>
      <div>
        <h2 className="font-display text-lg font-semibold text-brand sm:text-xl">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export default function Checkout() {
  useDocumentTitle("Checkout");
  const navigate = useNavigate();
  const tick = useCartSignal();
  const cart = useApi((signal) => api.cart(signal), [tick]);
  const shipping = useApi((signal) => api.shipping(signal), []);

  const options: ShipOption[] = shipping.data?.options ?? [];
  const taxRate = shipping.data?.taxRate ?? 0;
  const taxRateFraction = taxRate > 1 ? taxRate / 100 : taxRate;

  const [shipChoice, setShipChoice] = useState<string>("");
  const [giftWrap, setGiftWrap] = useState<string>("no");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!options.length) return;
    setShipChoice((current) => current || options[0].id);
  }, [options]);

  const lines = cart.data?.lines ?? [];
  const subtotal = cart.data?.subtotal ?? 0;
  const itemCount = lines.reduce((total, line) => total + line.qty, 0);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === shipChoice) ?? options[0],
    [options, shipChoice],
  );
  const shippingCost = selectedOption?.cost ?? 0;
  const giftWrapCost = giftWrap === "yes" ? GIFT_WRAP_PER_ITEM * itemCount : 0;
  const tax = Math.round(subtotal * taxRateFraction * 100) / 100;
  const total = subtotal + shippingCost + tax + giftWrapCost;

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    setError(null);
    setSubmitting(true);
    const data = new FormData(form);
    const address = {
      name: String(data.get("fullname") ?? "").trim(),
      line1: String(data.get("line1") ?? "").trim(),
      line2: String(data.get("line2") ?? "").trim(),
      city: String(data.get("city") ?? "").trim(),
      state: String(data.get("state") ?? "").trim(),
      zip: String(data.get("zip") ?? "").trim(),
      country: "United States",
      phone: String(data.get("phone") ?? "").trim(),
      email: String(data.get("email") ?? "").trim(),
    };
    try {
      const order = await api.placeOrder({
        address,
        shipping: String(data.get("shipping") ?? selectedOption?.id ?? "standard"),
        giftWrap: String(data.get("giftwrap") ?? "no") === "yes",
      });
      notifyCartChanged();
      navigate(`/orders/${order.id}?placed=1`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const loading = (cart.loading && !cart.data) || (shipping.loading && !shipping.data);
  const loadError =
    (!cart.data && cart.error) || (!shipping.data && shipping.error) || null;

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        Checkout
      </h1>
      <p className="mt-1 text-[13px] text-sage">
        Three quick steps. This is a demo store — nothing is charged or shipped.
      </p>

      {loading && <LoadingState label="Loading checkout…" />}

      {loadError && (
        <ErrorState
          message={loadError}
          onRetry={() => {
            cart.reload();
            shipping.reload();
          }}
          className="mt-4"
        />
      )}

      {!loading && !loadError && (
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          <form
            data-copilot-form
            id="checkout"
            autoComplete="off"
            onSubmit={onSubmit}
            className="space-y-4"
          >
            {lines.length === 0 && (
              <p className="rounded-lg border border-saffron/60 bg-saffron-soft px-3.5 py-2.5 text-[13px] text-ink">
                Your cart is empty.{" "}
                <Link to="/search" className="font-semibold underline">
                  Find something to add
                </Link>{" "}
                before placing a demo order.
              </p>
            )}

            <section className="rounded-xl border border-sage-border bg-white p-4 sm:p-5">
              <SectionHeading step={1} title="Delivery address" />

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="fullname" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    Full name
                  </label>
                  <input
                    id="fullname"
                    name="fullname"
                    autoComplete="name"
                    required
                    data-copilot-spell
                    data-copilot-ask="Who is the order going to? Full name, please."
                    placeholder="e.g. Jordan Example"
                    className={fieldClass()}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="line1" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    Street address
                  </label>
                  <input
                    id="line1"
                    name="line1"
                    autoComplete="address-line1"
                    required
                    data-copilot-ask="What's the street address?"
                    placeholder="e.g. 12 Example Street"
                    className={fieldClass()}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="line2" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    Apartment, suite or unit (optional)
                  </label>
                  <input
                    id="line2"
                    name="line2"
                    autoComplete="address-line2"
                    data-copilot-ask="Apartment, suite or unit? Say none if there isn't one."
                    placeholder="Apartment, suite (optional)"
                    className={fieldClass()}
                  />
                </div>

                <div>
                  <label htmlFor="city" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    City
                  </label>
                  <input
                    id="city"
                    name="city"
                    autoComplete="address-level2"
                    required
                    data-copilot-ask="Which city?"
                    placeholder="City"
                    className={fieldClass()}
                  />
                </div>

                <div>
                  <label htmlFor="state" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    State
                  </label>
                  <select
                    id="state"
                    name="state"
                    required
                    data-copilot-ask="Which state?"
                    defaultValue=""
                    className={fieldClass()}
                  >
                    <option value="">Choose a state</option>
                    {US_STATES.map((state) => (
                      <option
                        key={state.code}
                        value={state.code}
                        data-copilot-also={spelledCode(state.code)}
                      >
                        {state.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="zip" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    ZIP code
                  </label>
                  <input
                    id="zip"
                    name="zip"
                    autoComplete="postal-code"
                    required
                    inputMode="numeric"
                    pattern="\d{5}(-\d{4})?"
                    title="Five digits, like 97201"
                    data-copilot-kind="code"
                    data-copilot-ask="And the ZIP code?"
                    placeholder="e.g. 97201"
                    className={fieldClass()}
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    Phone (optional)
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    minLength={10}
                    data-copilot-ask="A phone number for the carrier? Say none to skip."
                    placeholder="e.g. (555) 010-0199"
                    className={fieldClass()}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label htmlFor="email" className="mb-1 block text-[12.5px] font-semibold text-ink">
                    Email for the receipt
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    data-copilot-ask="Which email should the receipt go to?"
                    placeholder="e.g. jordan@example.com"
                    className={fieldClass()}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-sage-border bg-white p-4 sm:p-5">
              <SectionHeading step={2} title="Delivery speed" />

              <fieldset
                className="mt-3 space-y-2"
                data-copilot-ask="How fast do you need it?"
              >
                <legend className="sr-only">Delivery speed</legend>
                {options.map((option, index) => (
                  <label
                    key={option.id}
                    className="flex min-h-[52px] cursor-pointer items-center gap-3 rounded-lg border border-sage-border px-3 py-2 has-[:checked]:border-brand has-[:checked]:bg-brand-tint"
                  >
                    <input
                      type="radio"
                      name="shipping"
                      id={`ship-${option.id}`}
                      value={option.id}
                      required={index === 0}
                      defaultChecked={index === 0}
                      onChange={(event) => setShipChoice(event.target.value)}
                      data-copilot-also={SHIP_ALSO[option.id]}
                      className="h-4 w-4 shrink-0 accent-[#0f4c4a]"
                    />
                    <span className="flex-1 text-[13.5px] font-medium text-ink">
                      {option.label} · {option.days} ·{" "}
                      {option.cost === 0 ? "Free" : money(option.cost)}
                    </span>
                  </label>
                ))}
                {options.length === 0 && (
                  <p className="text-[13px] text-sage">
                    Loading delivery options…
                  </p>
                )}
              </fieldset>

              <div className="mt-4">
                <label htmlFor="giftwrap" className="mb-1 block text-[12.5px] font-semibold text-ink">
                  Gift wrap
                </label>
                <select
                  id="giftwrap"
                  name="giftwrap"
                  defaultValue="no"
                  onChange={(event) => setGiftWrap(event.target.value)}
                  data-copilot-ask="Should we gift wrap it? It's 4.99 an item."
                  className={fieldClass()}
                >
                  <option value="no" data-copilot-also="no, nope, no thanks, not needed">
                    No gift wrap
                  </option>
                  <option value="yes" data-copilot-also="yes, please, gift wrap, wrap it">
                    Gift wrap ($4.99 per item)
                  </option>
                </select>
              </div>
            </section>

            <section className="rounded-xl border border-sage-border bg-white p-4 sm:p-5">
              <SectionHeading step={3} title="Payment (demo)">
                <p className="mt-0.5 text-[12.5px] text-sage">
                  No card details are collected anywhere in this demo.
                </p>
              </SectionHeading>

              <div className="mt-3">
                <label htmlFor="payment" className="mb-1 block text-[12.5px] font-semibold text-ink">
                  Payment method
                </label>
                <select
                  id="payment"
                  name="payment"
                  required
                  defaultValue=""
                  data-copilot-ask="This is a demo store, so payment is pretend. Shall I choose demo payment?"
                  className={fieldClass()}
                >
                  <option value="">Choose a payment method</option>
                  <option value="demo" data-copilot-also="demo, demo payment, yes, pretend, fake">
                    Demo payment (nothing is charged)
                  </option>
                </select>
              </div>

              <div className="mt-4 flex flex-col gap-2 border-t border-sage-border pt-4 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  data-testid="place-order"
                  disabled={submitting}
                  className="tap inline-flex w-full items-center justify-center gap-2 rounded-lg bg-saffron px-6 text-[15px] font-extrabold text-ink transition hover:bg-saffron-dark hover:text-white disabled:opacity-60 sm:w-auto"
                >
                  <Lock className="h-4 w-4" />
                  {submitting ? "Placing order…" : "Place order"}
                </button>
                <p className="text-[12px] font-semibold text-sage">
                  Demo: nothing is charged or shipped.
                </p>
              </div>

              {error && (
                <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-[13px] font-semibold text-destructive">
                  {error}
                </p>
              )}
            </section>
          </form>

          <aside className="rounded-xl border border-sage-border bg-white p-4 lg:sticky lg:top-[122px]">
            <h2 className="font-display text-lg font-semibold text-brand">
              Order review
            </h2>

            <ul className="mt-2 divide-y divide-sage-border">
              {lines.map((line) => (
                <li key={line.sku} className="flex gap-2 py-2">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-sage-tile">
                    <img
                      src={line.image}
                      alt=""
                      className="h-full w-full object-contain p-1"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12px] leading-tight text-ink">
                      {line.title}
                    </p>
                    <p className="text-[11px] text-sage">
                      Qty {line.qty}
                      {line.color ? ` · ${line.color}` : ""}
                      {line.size ? ` · ${line.size}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-[12px] font-semibold text-ink">
                    {money(line.line_total)}
                  </span>
                </li>
              ))}
              {lines.length === 0 && (
                <li className="py-2 text-[12.5px] text-sage">No items yet.</li>
              )}
            </ul>

            <dl className="mt-2 space-y-1 border-t border-sage-border pt-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-sage">Subtotal</dt>
                <dd className="font-semibold text-ink">{money(subtotal)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sage">
                  Shipping{selectedOption ? ` · ${selectedOption.label}` : ""}
                </dt>
                <dd className="font-semibold text-ink">
                  {shippingCost === 0 ? "Free" : money(shippingCost)}
                </dd>
              </div>
              {giftWrapCost > 0 && (
                <div className="flex justify-between">
                  <dt className="text-sage">Gift wrap</dt>
                  <dd className="font-semibold text-ink">{money(giftWrapCost)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-sage">
                  Estimated tax
                  {taxRateFraction > 0
                    ? ` (${(taxRateFraction * 100).toFixed(2)}%)`
                    : ""}
                </dt>
                <dd className="font-semibold text-ink">{money(tax)}</dd>
              </div>
              <div className="flex justify-between border-t border-sage-border pt-1.5">
                <dt className="text-[14px] font-bold text-ink">Total</dt>
                <dd className="text-[15px] font-extrabold text-ink">
                  {money(total)}
                </dd>
              </div>
            </dl>

            <p className="mt-3 rounded-lg bg-sage-tile px-2.5 py-2 text-[11.5px] leading-snug text-sage">
              Demo checkout. The order is saved to your guest shopper so you can
              see tracking, but nothing is charged and nothing ships.
            </p>
          </aside>
        </div>
      )}
    </div>
  );
}
