import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  Card,
  CardHead,
  CodeChip,
  EmptyState,
  ErrorState,
  PageHeader,
  SkeletonBlock,
} from "@/components/staff/ui";
import { useApi } from "@/hooks/useApi";
import { count, fmtDate, staffGet, usd, type ReportsData } from "@/lib/practice";

const INK = "hsl(158 32% 22%)";
const ACCENT = "hsl(18 52% 47%)";
const BRASS = "hsl(36 45% 52%)";
const TEAL = "hsl(168 32% 40%)";
const RED = "hsl(0 58% 55%)";

function money(n: number | string): string {
  return usd(n);
}

/** Recharts' tooltip, in the app's own type. */
function ChartTooltip({ active, payload, label, formatter }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bw-chart-tip">
      <p className="bw-chart-tip-label">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="bw-chart-tip-row">
          <span className="bw-chart-tip-dot" style={{ background: p.color ?? p.fill }} />
          {p.name}: <strong>{formatter ? formatter(p.value) : p.value}</strong>
        </p>
      ))}
    </div>
  );
}

export default function StaffReports() {
  const reports = useApi(() => staffGet<ReportsData>("/reports"), []);
  const data = reports.data;

  const revenue = (data?.revenueByMonth ?? []).map((r) => ({
    month: r.month,
    collected: Number(r.cents) / 100,
    payments: r.payments,
  }));

  const aging = (data?.aging ?? []).map((a) => ({
    bucket: a.bucket,
    outstanding: Number(a.outstanding) / 100,
    invoices: a.invoices,
  }));

  return (
    <StaffLayout title="Reports">
      <div data-testid="staff-reports">
        <PageHeader title="Reports" subtitle="The practice's numbers: collections, receivables and workload." />

        {reports.error ? <ErrorState message={reports.error} onRetry={reports.reload} /> : null}

        {!data && reports.loading ? (
          <div className="bw-report-grid">
            <SkeletonBlock h={260} />
            <SkeletonBlock h={260} />
          </div>
        ) : null}

        {data && (
          <>
            <div className="bw-report-grid">
              <Card>
                <CardHead title="Collections by month" aside={<span className="bw-muted bw-small">Last 12 months</span>} />
                {revenue.length === 0 ? (
                  <EmptyState>No payments recorded yet.</EmptyState>
                ) : (
                  <div className="bw-chart">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={revenue} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="hsl(40 16% 90%)" vertical={false} />
                        <XAxis
                          dataKey="month"
                          tick={{ fontSize: 11, fill: "hsl(158 8% 42%)" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(40 16% 88%)" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(158 8% 42%)" }}
                          tickLine={false}
                          axisLine={false}
                          width={54}
                          tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                        />
                        <Tooltip content={<ChartTooltip formatter={(v: number) => usd(Math.round(v * 100))} />} />
                        <Bar dataKey="collected" name="Collected" fill={INK} radius={[3, 3, 0, 0]} maxBarSize={34} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>

              <Card>
                <CardHead title="Receivables aging" aside={<span className="bw-muted bw-small">Outstanding by age</span>} />
                {aging.length === 0 ? (
                  <EmptyState>No outstanding invoices.</EmptyState>
                ) : (
                  <div className="bw-chart">
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={aging} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="hsl(40 16% 90%)" vertical={false} />
                        <XAxis
                          dataKey="bucket"
                          tick={{ fontSize: 11, fill: "hsl(158 8% 42%)" }}
                          tickLine={false}
                          axisLine={{ stroke: "hsl(40 16% 88%)" }}
                        />
                        <YAxis
                          tick={{ fontSize: 11, fill: "hsl(158 8% 42%)" }}
                          tickLine={false}
                          axisLine={false}
                          width={54}
                          tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                        />
                        <Tooltip content={<ChartTooltip formatter={(v: number) => usd(Math.round(v * 100))} />} />
                        <Bar dataKey="outstanding" name="Outstanding" radius={[3, 3, 0, 0]} maxBarSize={44}>
                          {aging.map((_, i) => (
                            <Cell key={i} fill={i === 0 ? TEAL : i === 1 ? BRASS : i === 2 ? ACCENT : RED} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </Card>
            </div>

            <div className="bw-report-grid">
              <Card>
                <CardHead title="Open and overdue work by preparer" />
                {(data.byPreparer ?? []).length === 0 ? (
                  <EmptyState>No engagements assigned.</EmptyState>
                ) : (
                  <table className="bw-table bw-table-compact bw-table-hover">
                    <thead>
                      <tr>
                        <th>Preparer</th>
                        <th className="bw-col-num">Open</th>
                        <th className="bw-col-num">Done 2025</th>
                        <th className="bw-col-num">Overdue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byPreparer.map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td className="bw-col-num bw-num">{count(p.open)}</td>
                          <td className="bw-col-num bw-num">{count(p.done_2025)}</td>
                          <td className={p.overdue > 0 ? "bw-col-num bw-num bw-late" : "bw-col-num bw-num"}>
                            {count(p.overdue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Card>

              <Card>
                <CardHead title="Most common notices" />
                {(data.notices ?? []).length === 0 ? (
                  <EmptyState>No IRS notices on file.</EmptyState>
                ) : (
                  <ul className="bw-notice-list">
                    {data.notices.map((n) => (
                      <li key={n.code}>
                        <CodeChip code={n.code} />
                        <span className="bw-notice-bar">
                          <span
                            className="bw-notice-bar-fill"
                            style={{
                              width: `${Math.round(
                                (Number(n.n) / Math.max(...data.notices.map((x) => Number(x.n)), 1)) * 100,
                              )}%`,
                            }}
                          />
                        </span>
                        <span className="bw-num">{count(n.n)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <Card>
              <CardHead title="2025 return mix" aside={<span className="bw-muted bw-small">Engagements and fees by form</span>} />
              {(data.mix ?? []).length === 0 ? (
                <EmptyState>No engagements for 2025 yet.</EmptyState>
              ) : (
                <table className="bw-table bw-table-compact bw-table-hover">
                  <thead>
                    <tr>
                      <th>Form</th>
                      <th className="bw-col-num">Engagements</th>
                      <th className="bw-col-num">Fees</th>
                      <th className="bw-col-num">Average fee</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.mix.map((m) => {
                      const fees = Number(m.fees);
                      const n = Number(m.engagements);
                      return (
                        <tr key={m.form}>
                          <td className="bw-mono">{m.form}</td>
                          <td className="bw-col-num bw-num">{count(n)}</td>
                          <td className="bw-col-num bw-num">{money(m.fees)}</td>
                          <td className="bw-col-num bw-num">
                            {n > 0 ? money(Math.round(fees / n)) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </Card>

            <p className="bw-muted bw-small">
              Figures cover the firm's fictional book of business; collections are shown as of {fmtDate(new Date().toISOString())}.
            </p>
          </>
        )}
      </div>
    </StaffLayout>
  );
}
