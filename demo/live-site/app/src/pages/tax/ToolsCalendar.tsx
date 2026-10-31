/**
 * The tax calendar: the federal deadlines as a month-by-month list, filters by who they apply to, and a "Next up"
 * card. Every row comes from /api/site/deadlines; the filters only hide rows, they never invent any.
 */

import { useMemo } from "react";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SourceLink } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi, useUrlState } from "@/hooks/useApi";
import { siteGet, fmtLongDate, type SiteDeadline } from "@/lib/practice";

const FILTERS = [
  { key: "", label: "Everyone" },
  { key: "individuals", label: "Individuals" },
  { key: "businesses", label: "Businesses" },
  { key: "employers", label: "Employers" },
  { key: "nonprofits", label: "Nonprofits" },
];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const index = Number(m) - 1;
  return `${MONTH_NAMES[index] ?? m} ${y}`;
}

export default function TaxToolsCalendar() {
  useTaxTitle("Tax calendar");
  const { get, set } = useUrlState();
  const who = get("who");
  const deadlines = useApi<{ deadlines: SiteDeadline[] }>(
    () => siteGet<{ deadlines: SiteDeadline[] }>("/deadlines"),
    [],
  );

  const all = deadlines.data?.deadlines ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const next = all.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0];

  const shown = useMemo(() => {
    const list = all
      .filter((d) => !who || (d.who ?? "").toLowerCase().includes(who.replace(/s$/, "")))
      .sort((a, b) => a.date.localeCompare(b.date));
    const groups = new Map<string, SiteDeadline[]>();
    for (const d of list) {
      const key = monthKey(d.date);
      groups.set(key, [...(groups.get(key) ?? []), d]);
    }
    return Array.from(groups.entries());
  }, [all, who]);

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Tools"
          title="The 2026–27 federal tax calendar."
          lead="Every date below is a federal filing or payment deadline, with the form it belongs to and who it applies to. State dates differ; ask your preparer about yours."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Tax calendar" }]}
        />

        <div className="tax-tool">
          <div style={{ minWidth: 0 }}>
            <div className="tax-filters">
              {FILTERS.map((f) => (
                <button
                  key={f.key || "all"}
                  type="button"
                  className={who === f.key ? "tax-filter active" : "tax-filter"}
                  onClick={() => set({ who: f.key })}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {deadlines.loading && (
              <div aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="tax-skel tax-skel-line" style={{ height: "1.75rem", marginBottom: "0.625rem" }} />
                ))}
              </div>
            )}
            {deadlines.error && <ErrorBox error={deadlines.error} onRetry={deadlines.reload} />}
            {deadlines.data && all.length === 0 && <Empty>No deadlines are listed yet.</Empty>}
            {deadlines.data && all.length > 0 && shown.length === 0 && (
              <Empty>No deadlines match that filter.</Empty>
            )}

            {shown.map(([key, rows]) => (
              <section className="tax-month" key={key}>
                <h2>{monthLabel(key)}</h2>
                {rows.map((d) => {
                  const day = Number(d.date.slice(8, 10));
                  const month = MONTH_NAMES[Number(d.date.slice(5, 7)) - 1]?.slice(0, 3);
                  return (
                    <div className="tax-deadline" key={d.id} data-testid="deadline-row">
                      <div className="d">
                        {month} {day}
                      </div>
                      <div>
                        <h3>{d.title}</h3>
                        <p>{d.detail}</p>
                        <div className="meta">
                          <span className="form">{d.form}</span>
                          <span>{d.who}</span>
                          {d.cite && <span><SourceLink cite={d.cite} /></span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </section>
            ))}
          </div>

          <aside className="tax-tool-aside">
            {next && (
              <div className="tax-nextup">
                <span className="tax-tiny">Next up</span>
                <h2>{next.title}</h2>
                <p className="when">{fmtLongDate(next.date)}</p>
                <p>{next.detail}</p>
                <p className="tax-tiny" style={{ margin: "0 0 0.5rem" }}>
                  {next.form} · {next.who}
                </p>
                <Link to="/tax/book">Talk to a preparer →</Link>
              </div>
            )}

            <div className="tax-card" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">Never miss one</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Clients on a bookkeeping or planning arrangement get the dates that apply to them, with the
                amounts worked out, in the month before each one falls due.
              </p>
              <Link to="/tax/start" className="tax-btn tax-btn-outline" style={{ width: "100%" }}>
                Become a client
              </Link>
            </div>

            <div className="tax-card tax-card-quiet" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">Working out a payment?</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                The quarterly estimate helper turns a year's income and withholding into a figure for each
                of the four dates.
              </p>
              <Link to="/tax/tools/quarterly" className="tax-small" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                Quarterly estimate <ArrowUpRight size={13} aria-hidden="true" style={{ verticalAlign: "-2px" }} />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
