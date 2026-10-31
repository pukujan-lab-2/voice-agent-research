import { Link } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  Check,
  FileWarning,
  MessageSquare,
  Receipt,
  ShieldAlert,
} from "lucide-react";
import { PortalLayout, SampleNote } from "@/components/portal/PortalLayout";
import { PortalCard, PortalEmpty, PortalError, PortalSkeleton } from "@/components/portal/ui";
import { useApi } from "@/hooks/useApi";
import {
  STAGES,
  STAGES_PLAIN,
  count,
  daysUntil,
  fmtDate,
  fmtTime,
  fmtWhen,
  portalGet,
  stageIndex,
  usd,
  type PortalSummary,
} from "@/lib/practice";

export default function PortalHome() {
  const summary = useApi(() => portalGet<PortalSummary>("/summary"), []);
  const data = summary.data;

  const newest = data?.returns?.[0] ?? null;
  const step = newest ? stageIndex(newest.stage) : 0;
  const refund = newest?.refund_cents ?? 0;
  const balance = newest?.balance_cents ?? 0;

  return (
    <PortalLayout title="Home" firstName={data?.household ? data.household.name.split(" ")[0] : undefined}>
      <div className="pt-page" data-testid="portal-dashboard">
        {summary.error ? <PortalError message={summary.error} onRetry={summary.reload} /> : null}

        {!data && summary.loading ? (
          <>
            <PortalSkeleton rows={2} />
            <div style={{ height: 12 }} />
            <PortalSkeleton rows={4} />
          </>
        ) : null}

        {data && (
          <>
            <header className="pt-welcome">
              <h1 className="pt-welcome-title">Welcome back, {data.people?.[0]?.first_name ?? "there"}</h1>
              <p className="pt-welcome-sub">{data.household.name}</p>
            </header>

            {/* the return status card comes first */}
            {newest ? (
              <section className="pt-status" data-testid="portal-return-status">
                <div className="pt-status-head">
                  <div>
                    <p className="pt-status-eyebrow">
                      {newest.form} · Tax year {newest.tax_year}
                    </p>
                    <h2 className="pt-status-title">{newest.stage_label || "In progress"}</h2>
                  </div>
                  <span className="pt-status-amount">
                    {refund > 0 ? (
                      <>
                        <span className="pt-status-amount-label">Refund</span>
                        <span className="pt-status-amount-value">{usd(refund)}</span>
                      </>
                    ) : balance > 0 ? (
                      <>
                        <span className="pt-status-amount-label">Balance due</span>
                        <span className="pt-status-amount-value">{usd(balance)}</span>
                      </>
                    ) : null}
                  </span>
                </div>

                <ol className="pt-steps">
                  {STAGES.map((s, i) => {
                    const done = i < step;
                    const current = i === step;
                    return (
                      <li key={s.id} className={done ? "done" : current ? "current" : ""}>
                        <span className="pt-step-dot" aria-hidden="true">
                          {done ? <Check size={11} /> : i + 1}
                        </span>
                        <span className="pt-step-label">{STAGES_PLAIN[i]}</span>
                      </li>
                    );
                  })}
                </ol>

                <p className="pt-status-meta">
                  {newest.due ? `Due ${fmtDate(newest.due)}` : ""}
                  {newest.preparer_name ? ` · Prepared by ${newest.preparer_name}` : ""}
                  {newest.extended ? " · Extended" : ""}
                </p>
              </section>
            ) : (
              <PortalCard>
                <PortalEmpty>No return on file yet. Your preparer will open one shortly.</PortalEmpty>
              </PortalCard>
            )}

            {/* the to-dos */}
            <div className="pt-todos">
              <Link to="/tax/portal/documents" className="pt-todo">
                <span className="pt-todo-icon pt-todo-amber" aria-hidden="true">
                  <FileWarning size={17} />
                </span>
                <span className="pt-todo-body">
                  <span className="pt-todo-label">Documents still needed</span>
                  <span className="pt-todo-value">
                    {count(data.documents.requested)} requested
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" className="pt-todo-arrow" />
              </Link>

              <Link to="/tax/portal/invoices" className="pt-todo">
                <span className="pt-todo-icon pt-todo-blue" aria-hidden="true">
                  <Receipt size={17} />
                </span>
                <span className="pt-todo-body">
                  <span className="pt-todo-label">Invoices due</span>
                  <span className="pt-todo-value">
                    {usd(data.invoices.due)} on {count(data.invoices.open)}{" "}
                    {Number(data.invoices.open) === 1 ? "invoice" : "invoices"}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" className="pt-todo-arrow" />
              </Link>

              <Link to="/tax/portal/messages" className="pt-todo">
                <span className="pt-todo-icon pt-todo-teal" aria-hidden="true">
                  <MessageSquare size={17} />
                </span>
                <span className="pt-todo-body">
                  <span className="pt-todo-label">Unread messages</span>
                  <span className="pt-todo-value">{count(data.unread)} waiting for you</span>
                </span>
                <ArrowRight size={15} aria-hidden="true" className="pt-todo-arrow" />
              </Link>

              <Link to="/tax/portal/appointments" className="pt-todo">
                <span className="pt-todo-icon pt-todo-ink" aria-hidden="true">
                  <CalendarClock size={17} />
                </span>
                <span className="pt-todo-body">
                  <span className="pt-todo-label">Next appointment</span>
                  <span className="pt-todo-value">
                    {data.appointments?.[0]
                      ? `${fmtDate(data.appointments[0].starts)} · ${fmtTime(data.appointments[0].starts)}`
                      : "Nothing booked"}
                  </span>
                </span>
                <ArrowRight size={15} aria-hidden="true" className="pt-todo-arrow" />
              </Link>
            </div>

            {data.notices?.length > 0 && (
              <PortalCard>
                <div className="pt-card-head">
                  <h2 className="pt-card-title">
                    <ShieldAlert size={15} aria-hidden="true" /> IRS notices
                  </h2>
                  <span className="pt-card-aside">{data.notices.length} open</span>
                </div>
                <ul className="pt-notice-list">
                  {data.notices.map((n) => {
                    const left = daysUntil(n.response_due) ?? 0;
                    return (
                      <li key={n.id}>
                        <code className="pt-code">{n.code}</code>
                        <span className="pt-notice-title">{n.title}</span>
                        <span className={left < 7 ? "pt-notice-due late" : "pt-notice-due"}>
                          Respond by {fmtDate(n.response_due)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </PortalCard>
            )}

            {data.appointments?.[0] && (
              <PortalCard>
                <div className="pt-card-head">
                  <h2 className="pt-card-title">Your next appointment</h2>
                  <Link to="/tax/portal/appointments" className="pt-link">
                    All appointments <ArrowRight size={12} aria-hidden="true" />
                  </Link>
                </div>
                <div className="pt-appt">
                  <span className="pt-appt-when">{fmtWhen(data.appointments[0].starts)}</span>
                  <span className="pt-appt-kind">
                    {data.appointments[0].kind} · {data.appointments[0].minutes} minutes ·{" "}
                    {data.appointments[0].mode}
                  </span>
                  {data.appointments[0].staff_name ? (
                    <span className="pt-appt-with">With {data.appointments[0].staff_name}</span>
                  ) : null}
                  {data.appointments[0].location ? (
                    <span className="pt-appt-where">{data.appointments[0].location}</span>
                  ) : null}
                </div>
              </PortalCard>
            )}

            <PortalCard>
              <div className="pt-card-head">
                <h2 className="pt-card-title">Your household</h2>
              </div>
              <p className="pt-household-line">
                {data.household.street}
                {data.household.city ? `, ${data.household.city}` : ""}
                {data.household.state ? `, ${data.household.state}` : ""}
              </p>
              <p className="pt-household-meta">
                {data.household.filing_status ?? "—"} · {count(data.household.dependents)}{" "}
                {Number(data.household.dependents) === 1 ? "dependent" : "dependents"} · client since{" "}
                {fmtDate(data.household.since)}
              </p>
              {data.household.preparer_name ? (
                <p className="pt-household-meta">
                  Your preparer: {data.household.preparer_name}
                  {data.household.preparer_credentials ? `, ${data.household.preparer_credentials}` : ""}
                </p>
              ) : null}
              {data.people.length > 1 && (
                <ul className="pt-people">
                  {data.people.map((p) => (
                    <li key={p.id}>
                      <span className="pt-people-name">{p.full_name}</span>
                      <span className="pt-people-rel">{p.relation}</span>
                    </li>
                  ))}
                </ul>
              )}
            </PortalCard>

            <SampleNote />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
