import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckSquare, Clock, MessageSquare } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  Card,
  CardHead,
  ErrorState,
  PageHeader,
  SkeletonBlock,
  StageChip,
  StatTile,
} from "@/components/staff/ui";
import { useApi } from "@/hooks/useApi";
import {
  STAGES,
  count,
  daysUntil,
  firstName,
  fmtDate,
  fmtLongDate,
  fmtTime,
  staffGet,
  todayISO,
  usd,
  type DashboardData,
  type StaffProfile,
} from "@/lib/practice";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function StaffDashboard() {
  const me = useApi(() => staffGet<{ staff: StaffProfile }>("/me"), []);
  const dash = useApi(() => staffGet<DashboardData>("/dashboard"), []);

  const d = dash.data;
  const name = firstName(me.data?.staff?.name) || "there";
  const pipelineTotal = d ? d.pipeline.reduce((sum, p) => sum + Number(p.n), 0) : 0;

  return (
    <StaffLayout title="Dashboard">
      <div data-testid="staff-dashboard">
        <PageHeader
          title={`${greeting()}, ${name}`}
          subtitle={fmtLongDate(todayISO())}
          actions={
            <Link to="/staff/engagements/new" className="bw-btn bw-btn-primary bw-btn-sm">
              New engagement
            </Link>
          }
        />

        {dash.error && <ErrorState message={dash.error} onRetry={dash.reload} />}

        {!d && dash.loading && (
          <div className="bw-stats">
            {Array.from({ length: 7 }).map((_, i) => (
              <SkeletonBlock key={i} h={84} />
            ))}
          </div>
        )}

        {d && (
          <>
            <div className="bw-stats">
              <StatTile
                label="Open engagements"
                value={count(d.counts.open_engagements)}
                hint={`${count(d.counts.households)} households · ${count(d.counts.businesses)} businesses`}
                to="/staff/engagements"
              />
              <StatTile
                label="Overdue"
                value={count(d.counts.overdue)}
                tone={Number(d.counts.overdue) > 0 ? "warn" : "plain"}
                hint="Past the due date"
                to="/staff/queue"
              />
              <StatTile
                label="Documents requested"
                value={count(d.counts.docs_requested)}
                hint="Waiting on the client"
                to="/staff/documents?status=requested"
              />
              <StatTile
                label="Notices due this week"
                value={count(d.notices.due_week)}
                tone={Number(d.notices.due_week) > 0 ? "warn" : "plain"}
                hint={`${count(d.notices.past_due)} past due`}
                to="/staff/notices?due_within=7"
              />
              <StatTile
                label="Overdue invoices"
                value={usd(d.billing.overdue)}
                tone={Number(d.billing.overdue) > 0 ? "warn" : "plain"}
                to="/staff/billing?status=overdue"
              />
              <StatTile
                label="Collected this month"
                value={usd(d.billing.collectedThisMonth)}
                tone="good"
                to="/staff/billing?status=paid"
              />
              <StatTile
                label="Unread messages"
                value={count(d.unread)}
                hint={`${count(d.counts.new_submissions)} new website submissions`}
                to="/staff/messages"
              />
            </div>

            <Card className="bw-pipeline-card">
              <CardHead
                title="2025 pipeline"
                aside={
                  <Link to="/staff/pipeline" className="bw-link">
                    Open the board <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                }
              />
              <div className="bw-stackbar" role="img" aria-label={`${pipelineTotal} returns by stage`}>
                {d.pipeline.map((p) => {
                  const pct = pipelineTotal > 0 ? (Number(p.n) / pipelineTotal) * 100 : 0;
                  return (
                    <Link
                      key={p.stage}
                      to={`/staff/engagements?stage=${p.stage}&year=2025`}
                      className={`bw-stackbar-seg bw-stackbar-${p.stage}`}
                      style={{ flexGrow: Math.max(pct, 0.6) }}
                      title={`${p.label}: ${count(p.n)}`}
                    >
                      {pct > 7 ? <span>{count(p.n)}</span> : null}
                    </Link>
                  );
                })}
              </div>
              <ul className="bw-stackbar-legend">
                {d.pipeline.map((p) => (
                  <li key={p.stage}>
                    <Link to={`/staff/engagements?stage=${p.stage}&year=2025`}>
                      <span className={`bw-legend-dot bw-stackbar-${p.stage}`} aria-hidden="true" />
                      <span className="bw-legend-label">{p.label}</span>
                      <span className="bw-legend-n">{count(p.n)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="bw-dash-grid">
              <Card>
                <CardHead
                  title="My queue"
                  aside={
                    <Link to="/staff/queue" className="bw-link">
                      The whole queue <ArrowRight size={13} aria-hidden="true" />
                    </Link>
                  }
                />
                {d.queue.length === 0 ? (
                  <p className="bw-empty">Nothing is due on your desk.</p>
                ) : (
                  <table className="bw-table bw-table-compact">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Form</th>
                        <th>Due</th>
                        <th>Stage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.queue.slice(0, 10).map((row) => {
                        const late = (daysUntil(row.due) ?? 0) < 0;
                        return (
                          <tr key={row.id}>
                            <td>
                              <Link to={`/staff/clients/${row.client_ref}`} className="bw-row-link">
                                {row.client_name}
                              </Link>
                              <span className="bw-row-sub">
                                {row.client_ref} · {row.form} {row.tax_year}
                              </span>
                            </td>
                            <td className="bw-num-cell">{row.form}</td>
                            <td className={late ? "bw-num-cell bw-late" : "bw-num-cell"}>{fmtDate(row.due)}</td>
                            <td>
                              <StageChip stage={row.stage} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </Card>

              <div className="bw-dash-side">
                <Card>
                  <CardHead
                    title="This week"
                    aside={
                      <Link to="/staff/calendar" className="bw-link">
                        Calendar <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    }
                  />
                  {d.appointments.length === 0 ? (
                    <p className="bw-empty">No appointments booked this week.</p>
                  ) : (
                    <ul className="bw-appt-list">
                      {d.appointments.slice(0, 6).map((a) => (
                        <li key={a.id}>
                          <span className="bw-appt-time">
                            <Clock size={12} aria-hidden="true" />
                            {fmtTime(a.starts)}
                          </span>
                          <span className="bw-appt-body">
                            <span className="bw-appt-name">{a.client_name}</span>
                            <span className="bw-appt-meta">
                              {a.kind} · {a.minutes} min · {a.mode}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                <Card>
                  <CardHead
                    title="My tasks"
                    aside={
                      <Link to="/staff/tasks" className="bw-link">
                        All tasks <ArrowRight size={13} aria-hidden="true" />
                      </Link>
                    }
                  />
                  <div className="bw-mini-stats">
                    <div>
                      <CheckSquare size={15} aria-hidden="true" />
                      <span className="bw-mini-n">{count(d.tasks.open)}</span>
                      <span className="bw-mini-label">open</span>
                    </div>
                    <div className={d.tasks.late > 0 ? "bw-mini-warn" : ""}>
                      <Clock size={15} aria-hidden="true" />
                      <span className="bw-mini-n">{count(d.tasks.late)}</span>
                      <span className="bw-mini-label">late</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <CardHead title="At a glance" />
                  <ul className="bw-quick-list">
                    <li>
                      <Link to="/staff/documents?status=requested">
                        <span>Documents still missing</span>
                        <span className="bw-num">{count(d.counts.docs_requested)}</span>
                      </Link>
                    </li>
                    <li>
                      <Link to="/staff/notices">
                        <span>Open IRS notices</span>
                        <span className="bw-num">{count(d.notices.due_week)}</span>
                      </Link>
                    </li>
                    <li>
                      <Link to="/staff/messages">
                        <span>
                          <MessageSquare size={12} aria-hidden="true" /> Unread messages
                        </span>
                        <span className="bw-num">{count(d.unread)}</span>
                      </Link>
                    </li>
                    <li>
                      <Link to="/staff/calendar">
                        <span>
                          <CalendarDays size={12} aria-hidden="true" /> Appointments this week
                        </span>
                        <span className="bw-num">{d.appointments.length}</span>
                      </Link>
                    </li>
                  </ul>
                </Card>
              </div>
            </div>

            <Card>
              <CardHead
                title="Stage totals"
                aside={<span className="bw-muted bw-small">Across every open 2025 engagement</span>}
              />
              <div className="bw-stage-tiles">
                {STAGES.map((s) => {
                  const row = d.pipeline.find((p) => p.stage === s.id);
                  return (
                    <Link key={s.id} to={`/staff/engagements?stage=${s.id}&year=2025`} className="bw-stage-tile">
                      <StageChip stage={s.id} />
                      <span className="bw-stage-n">{count(row?.n ?? 0)}</span>
                    </Link>
                  );
                })}
              </div>
            </Card>
          </>
        )}

        {!d && !dash.loading && !dash.error && <p className="bw-empty">Nothing to show yet.</p>}
        {me.error ? <ErrorState message={me.error} onRetry={me.reload} compact /> : null}
      </div>
    </StaffLayout>
  );
}
