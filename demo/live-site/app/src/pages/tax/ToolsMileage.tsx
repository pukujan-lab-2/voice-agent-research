/**
 * The mileage calculator: miles × the standard mileage rate from /api/site/rates, with the year and the source
 * shown. Every figure is read from the rates API; nothing is hard-coded.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { ErrorBox, PageHead, SourceLink } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, type SiteRate } from "@/lib/practice";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

/** The rate as a number: "0.70" or "$0.70" or "70 cents". */
function rateNumber(value: string | number): number {
  if (typeof value === "number") return value;
  const text = value.trim().toLowerCase();
  const cents = /([\d.]+)\s*cents?/.exec(text);
  if (cents) return Number(cents[1]) / 100;
  const n = Number(text.replace(/[^0-9.]/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

export default function TaxToolsMileage() {
  useTaxTitle("Mileage calculator");
  const rates = useApi<{ rates: SiteRate[] }>(() => siteGet<{ rates: SiteRate[] }>("/rates"), []);
  const [miles, setMiles] = useState("");

  const rate = useMemo(
    () => (rates.data?.rates ?? []).find((r) => /mile/i.test(r.label) || /mile/i.test(r.id)),
    [rates.data],
  );

  const perMile = rate ? rateNumber(rate.value) : 0;
  const driven = Number(miles.replace(/[^0-9.]/g, "")) || 0;
  const deduction = driven * perMile;

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Calculators"
          title="What your business miles are worth."
          lead="Miles driven for business, multiplied by the standard mileage rate for the year. This is the figure that goes on a Schedule C; it is a rough estimate, not tax advice."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Mileage calculator" }]}
        />

        {rates.error && <ErrorBox error={rates.error} onRetry={rates.reload} />}

        <div className="tax-tool">
          <div className="tax-calc">
            {rates.loading && <div className="tax-skel tax-skel-line" style={{ height: "3rem", marginBottom: "1rem" }} />}

            <div className="tax-field">
              <label htmlFor="miles">Business miles driven</label>
              <input
                id="miles"
                name="miles"
                inputMode="decimal"
                placeholder="e.g. 4,250"
                value={miles}
                onChange={(e) => setMiles(e.target.value)}
              />
              <p className="tax-hint">Only miles driven for the business count: not the commute.</p>
            </div>

            {rate && (
              <div className="tax-calc-out" data-testid="calc-result">
                <span className="label">Deduction</span>
                <p className="value">{money(deduction)}</p>
                <p>
                  {driven.toLocaleString("en-US")} miles × {money(perMile)} = {money(deduction)} ·{" "}
                  {rate.year} standard mileage rate
                </p>
              </div>
            )}

            {rate && (
              <ul className="tax-calc-steps">
                <li>
                  <span>{rate.label}</span>
                  <strong>{money(perMile)}</strong>
                </li>
                <li>
                  <span>Rate year</span>
                  <strong>{rate.year}</strong>
                </li>
                <li>
                  <span>Miles</span>
                  <strong>{driven.toLocaleString("en-US")}</strong>
                </li>
                <li>
                  <span>Deduction</span>
                  <strong>{money(deduction)}</strong>
                </li>
              </ul>
            )}

            {rate?.detail && <p className="tax-small tax-muted" style={{ marginTop: "0.75rem" }}>{rate.detail}</p>}
            {rate?.cite && <p className="tax-tiny tax-muted">Source: <SourceLink cite={rate.cite} /></p>}

            <p className="tax-disclaimer-line">
              A rough estimate, not tax advice. The rate that applies depends on the year and on how the
              vehicle is used; a preparer will check both before it goes on a return.
            </p>
          </div>

          <aside className="tax-tool-aside">
            <div className="tax-card">
              <h2 className="tax-h3">Keep a log</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                The IRS expects a record made at the time: the date, the destination, the business purpose
                and the miles. A notebook in the glovebox is enough, as long as it is filled in as you go.
              </p>
              <Link to="/tax/guides" className="tax-btn tax-btn-outline" style={{ width: "100%" }}>
                Read the mileage rules
              </Link>
            </div>
            <div className="tax-card tax-card-quiet" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">Self-employed?</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                The mileage deduction is only half the picture: the self-employment tax on the profit is
                the other half.
              </p>
              <Link to="/tax/tools/se-tax" className="tax-small" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                Self-employment tax →
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
