/**
 * The self-employment tax calculator: net earnings × the factor and the rates from /api/site/rates, showing each
 * step. Nothing is hard-coded: the factor, the two rates and the wage base all arrive from the API.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { ErrorBox, PageHead, SourceLink } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, type SiteRate } from "@/lib/practice";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pct(value: string | number): number {
  if (typeof value === "number") return value > 1 ? value : value * 100;
  const n = Number(value.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return 0;
  return value.includes("%") || n > 1 ? n : n * 100;
}

/** A rate as a fraction: "92.35%" and "0.9235" both give 0.9235. */
function fraction(value: string | number): number {
  return pct(value) / 100;
}

function pick(rates: SiteRate[], test: RegExp): SiteRate | undefined {
  return rates.find((r) => test.test(`${r.id} ${r.label}`));
}

export default function TaxToolsSeTax() {
  useTaxTitle("Self-employment tax");
  const rates = useApi<{ rates: SiteRate[] }>(() => siteGet<{ rates: SiteRate[] }>("/rates"), []);
  const [net, setNet] = useState("");

  const list = rates.data?.rates ?? [];
  const factorRate = useMemo(() => pick(list, /factor|92\.35|net earnings/i), [list]);
  const seRate = useMemo(() => pick(list, /self-employment|se tax|15\.3/i), [list]);
  const wageBase = useMemo(() => pick(list, /wage base|social security/i), [list]);

  const factor = factorRate ? fraction(factorRate.value) : 0;
  const sePct = seRate ? pct(seRate.value) : 0;

  const earnings = Number(net.replace(/[^0-9.]/g, "")) || 0;
  const taxable = earnings * (factor || 0);
  const tax = taxable * (sePct / 100);

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Calculators"
          title="What self-employment tax costs."
          lead="If you are self-employed, you pay both halves of Social Security and Medicare on your net profit. The working is below: net earnings, the share that is taxable, then the two rates. A rough estimate, not tax advice."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Self-employment tax" }]}
        />

        {rates.error && <ErrorBox error={rates.error} onRetry={rates.reload} />}

        <div className="tax-tool">
          <div className="tax-calc">
            <div className="tax-field">
              <label htmlFor="net">Net earnings from self-employment</label>
              <input
                id="net"
                name="net"
                inputMode="decimal"
                placeholder="e.g. 62,000"
                value={net}
                onChange={(e) => setNet(e.target.value)}
              />
              <p className="tax-hint">
                Business income less business expenses. Not the same as your gross receipts.
              </p>
            </div>

            {rates.loading && <div className="tax-skel tax-skel-line" style={{ height: "4rem" }} />}

            {!rates.loading && seRate && factorRate && (
              <>
                <div className="tax-calc-out" data-testid="calc-result">
                  <span className="label">Self-employment tax</span>
                  <p className="value">{money(tax)}</p>
                  <p>
                    {money(taxable)} of net earnings × {sePct}% · {seRate.year} rates
                  </p>
                </div>

                <ul className="tax-calc-steps">
                  <li>
                    <span>Net earnings</span>
                    <strong>{money(earnings)}</strong>
                  </li>
                  <li>
                    <span>{factorRate.label}</span>
                    <strong>{factorRate.value}</strong>
                  </li>
                  <li>
                    <span>Earnings subject to the tax</span>
                    <strong>{money(taxable)}</strong>
                  </li>
                  <li>
                    <span>{seRate.label}</span>
                    <strong>{sePct}%</strong>
                  </li>
                  <li>
                    <span>Self-employment tax</span>
                    <strong>{money(tax)}</strong>
                  </li>
                  {wageBase && (
                    <li>
                      <span>{wageBase.label}</span>
                      <strong>{wageBase.value}</strong>
                    </li>
                  )}
                </ul>
              </>
            )}

            {(seRate?.detail || factorRate?.detail) && (
              <p className="tax-small tax-muted" style={{ marginTop: "0.75rem" }}>
                {factorRate?.detail ?? ""} {seRate?.detail ?? ""}
              </p>
            )}
            {(seRate?.cite || factorRate?.cite) && (
              <p className="tax-tiny tax-muted">Source: <SourceLink cite={(seRate?.cite ?? factorRate?.cite)!} /></p>
            )}

            <p className="tax-disclaimer-line">
              A rough estimate, not tax advice. Half of this tax is deductible on your income tax return,
              and the Social Security part stops at the wage base; a preparer will work out both with your
              actual figures.
            </p>
          </div>

          <aside className="tax-tool-aside">
            <div className="tax-card">
              <h2 className="tax-h3">Set it aside as you go</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Most people who owe this pay it quarterly, not in April. The estimate helper turns a year's
                income into the four dates.
              </p>
              <Link to="/tax/tools/quarterly" className="tax-btn tax-btn-outline" style={{ width: "100%" }}>
                Quarterly estimate
              </Link>
            </div>
            <div className="tax-card tax-card-quiet" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">Need the figures checked?</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Fifteen minutes with a preparer, no charge, and no documents needed for the first call.
              </p>
              <Link to="/tax/book" className="tax-btn" style={{ width: "100%" }}>
                Book a consultation
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
