import { Link } from "react-router-dom";
import { CalendarPlus, MapPin } from "lucide-react";
import { PortalLayout, SampleNote } from "@/components/portal/PortalLayout";
import { PortalCard, PortalEmpty, PortalError, PortalHead, PortalSkeleton, PortalStatus } from "@/components/portal/ui";
import { useApi } from "@/hooks/useApi";
import { datePart, fmtDate, fmtTime, portalGet, todayISO, type Appointment } from "@/lib/practice";

export default function PortalAppointments() {
  const appts = useApi(() => portalGet<{ appointments: Appointment[] }>("/appointments"), []);
  const all = appts.data?.appointments ?? [];
  const today = todayISO();

  const upcoming = all
    .filter((a) => datePart(a.starts) >= today)
    .sort((a, b) => a.starts.localeCompare(b.starts));
  const past = all
    .filter((a) => datePart(a.starts) < today)
    .sort((a, b) => b.starts.localeCompare(a.starts));

  return (
    <PortalLayout title="Appointments">
      <div className="pt-page" data-testid="portal-appointments">
        <PortalHead
          title="Appointments"
          subtitle="Calls and meetings with your preparer."
          actions={
            <Link to="/tax/book" className="pt-btn pt-btn-primary pt-btn-sm">
              <CalendarPlus size={14} aria-hidden="true" /> Book another
            </Link>
          }
        />

        {appts.error ? <PortalError message={appts.error} onRetry={appts.reload} /> : null}

        {!appts.data && appts.loading ? (
          <PortalSkeleton rows={4} />
        ) : (
          <>
            <PortalCard>
              <div className="pt-card-head">
                <h2 className="pt-card-title">Upcoming</h2>
                <span className="pt-card-aside">{upcoming.length}</span>
              </div>
              {upcoming.length === 0 ? (
                <PortalEmpty>No upcoming appointments. Book a call any time.</PortalEmpty>
              ) : (
                <ul className="pt-appts">
                  {upcoming.map((a) => (
                    <li key={a.id} className="pt-appt-item">
                      <div className="pt-appt-item-when">
                        <span className="pt-appt-item-date">{fmtDate(a.starts)}</span>
                        <span className="pt-appt-item-time">{fmtTime(a.starts)}</span>
                      </div>
                      <div className="pt-appt-item-body">
                        <p className="pt-appt-item-kind">{a.kind}</p>
                        <p className="pt-appt-item-meta">
                          {a.minutes} minutes · {a.mode}
                          {a.staff_name ? ` · ${a.staff_name}` : ""}
                        </p>
                        {a.location ? (
                          <p className="pt-appt-item-loc">
                            <MapPin size={11} aria-hidden="true" /> {a.location}
                          </p>
                        ) : null}
                      </div>
                      {a.status ? <PortalStatus status={a.status} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </PortalCard>

            {past.length > 0 && (
              <PortalCard>
                <div className="pt-card-head">
                  <h2 className="pt-card-title">Past</h2>
                  <span className="pt-card-aside">{past.length}</span>
                </div>
                <ul className="pt-appts pt-appts-past">
                  {past.map((a) => (
                    <li key={a.id} className="pt-appt-item">
                      <div className="pt-appt-item-when">
                        <span className="pt-appt-item-date">{fmtDate(a.starts)}</span>
                        <span className="pt-appt-item-time">{fmtTime(a.starts)}</span>
                      </div>
                      <div className="pt-appt-item-body">
                        <p className="pt-appt-item-kind">{a.kind}</p>
                        <p className="pt-appt-item-meta">
                          {a.minutes} minutes · {a.mode}
                          {a.staff_name ? ` · ${a.staff_name}` : ""}
                        </p>
                      </div>
                      {a.status ? <PortalStatus status={a.status} /> : null}
                    </li>
                  ))}
                </ul>
              </PortalCard>
            )}

            <PortalCard>
              <h2 className="pt-card-title">Need to talk sooner?</h2>
              <p className="pt-household-meta">
                Book a fifteen-minute call with a preparer, at no charge. Or send a message and your
                preparer will reply.
              </p>
              <div className="pt-btn-row">
                <Link to="/tax/book" className="pt-btn pt-btn-primary pt-btn-sm">
                  Book a consultation
                </Link>
                <Link to="/tax/portal/messages" className="pt-btn pt-btn-quiet pt-btn-sm">
                  Send a message
                </Link>
              </div>
            </PortalCard>

            <SampleNote />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
