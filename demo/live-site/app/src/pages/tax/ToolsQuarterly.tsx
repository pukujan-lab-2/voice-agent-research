/**
 * The quarterly estimate helper: expected income and withholding in, a rough figure per quarter out, and the
 * four due dates from /api/site/deadlines. Every rate comes from /api/site/rates; the dates come from the
 * calendar. Labelled plainly as a rough estimate, not tax advice.
 */

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, fmtDayMonth, type SiteDeadline, type SiteRate } from "@/lib/practice";

function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function pctOf(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) return 0;
  return typeof value === "string" && value.includes("%") ? n : n > 1 ? n : n * 100;
}

export default function TaxToolsQuarterly() {
  useTaxTitle("Quarterly estimate");
  const rates = useApi<{ rates: SiteRate[] }>(() => siteGet<{ rates: SiteRate[] }>("/rates"), []);
  const deadlines = useApi<{ deadlines: SiteDeadline[] }>(
    () => siteGet<{ deadlines: SiteDeadline[] }>("/deadlines"),
    [],
  );
  const [income, setIncome] = useState("");
  const [withheld, setWithheld] = useState("");

  const list = rates.data?.rates ?? [];
  const seRate = useMemo(
    () => list.find((r) => /self-employment|se tax|15\.3/i.test(`${r.id} ${r.label}`)),
    [list],
  );
  const factorRate = useMemo(
    () => list.find((r) => /factor|92\.35/i.test(`${r.id} ${r.label}`)),
    [list],
  );

  const earnings = Number(income.replace(/[^0-9.]/g, "")) || 0;
  const paid = Number(withheld.replace(/[^0-9.]/g, "")) || 0;
  const factor = factorRate ? pctOf(factorRate.value) / 100 : 1;
  const sePct = seRate ? pctOf(seRate.value) : 0;
  const seTax = earnings * factor * (sePct / 100);
  const setAside = Math.max(0, seTax - paid);
  const perQuarter = setAside / 4;

  const quarters = (deadlines.data?.deadlines ?? [])
    .filter((d) => /estimated|1040-ES/i.test(`${d.form} ${d.title} ${d.detail}`))
    .sort((a, b) => a.date.localeCompare(b.date));

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Calculators"
          title="How much to put aside each quarter."
          lead="Enter the income you expect to make and the tax you expect to have withheld, and this works out a rough figure for each quarterly payment. It covers self-employment tax only; income tax depends on your whole return."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Quarterly estimate" }]}
        />

        {(rates.error || deadlines.error) && (
          <ErrorBox error={rates.error || deadlines.error} onRetry={() => { rates.reload(); deadlines.reload(); }} />
        )}

        <div className="tax-tool">
          <div className="tax-calc">
            <div className="tax-field">
              <label htmlFor="income">Expected self-employment income this year</label>
              <input
                id="income"
                name="income"
                inputMode="decimal"
                placeholder="e.g. 84,000"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
              />
            </div>
            <div className="tax-field">
              <label htmlFor="withheld">Tax already withheld or paid</label>
              <input
                id="withheld"
                name="withheld"
                inputMode="decimal"
                placeholder="e.g. 6,000"
                value={withheld}
                onChange={(e) => setWithheld(e.target.value)}
              />
              <p className="tax-hint">
                From a salary, a pension, or estimates you have already sent the IRS this year.
              </p>
            </div>

            {rates.loading && <div className="tax-skel tax-skel-line" style={{ height: "4rem" }} />}

            {!rates.loading && seRate && (
              <>
                <div className="tax-calc-out" data-testid="calc-result">
                  <span className="label">Set aside each quarter</span>
                  <p className="value">{money(perQuarter)}</p>
                  <p>
                    {money(setAside)} still to pay, over the four dates below · {seRate.year} rate
                  </p>
                </div>

                <ul className="tax-calc-steps">
                  <li>
                    <span>Expected income</span>
                    <strong>{money(earnings)}</strong>
                  </li>
                  <li>
                    <span>Self-employment tax before withholding</span>
                    <strong>{money(seTax)}</strong>
                  </li>
                  <li>
                    <span>Already withheld or paid</span>
                    <strong>−{money(paid)}</strong>
                  </li>
                  <li>
                    <span>Still to pay</span>
                    <strong>{money(setAside)}</strong>
                  </li>
                  <li>
                    <span>Each quarter</span>
                    <strong>{money(perQuarter)}</strong>
                  </li>
                </ul>
              </>
            )}

            <p className="tax-disclaimer-line">
              A rough estimate, not tax advice. It uses the self-employment rate from the practice's figures
              and assumes a full year of that income. Income tax, credits and state tax are not included; a
              preparer will work out the real figure.
            </p>
          </div>

          <aside className="tax-tool-aside">
            <div className="tax-card">
              <h2 className="tax-h3" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                <CalendarDays size={16} aria-hidden="true" /> The four dates
              </h2>
              {deadlines.loading && <div className="tax-skel tax-skel-line" />}
              {deadlines.data && quarters.length === 0 && (
                <Empty>No estimated-payment dates are listed yet.</Empty>
              )}
              {quarters.map((q) => (
                <div className="tax-deadline" key={q.id} data-testid="deadline-row" style={{ gridTemplateColumns: "3.5rem minmax(0, 1fr)" }}>
                  <div className="d">{fmtDayMonth(q.date)}</div>
                  <div>
                    <h3 style={{ fontSize: "0.875rem" }}>{q.title}</h3>
                    <div className="meta">
                      <span className="form">{q.form}</span>
                    </div>
                  </div>
                </div>
              ))}
              <Link to="/tax/tools/calendar" className="tax-small" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                The full calendar →
              </Link>
            </div>

            <div className="tax-card tax-card-quiet" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">Make it exact</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                A planning session prices the year properly and gives you a payment schedule for the rest of
                it.
              </p>
              <Link to="/tax/services/planning" className="tax-btn tax-btn-outline" style={{ width: "100%" }}>
                Tax planning
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
