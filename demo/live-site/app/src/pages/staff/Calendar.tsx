import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SelectField,
  SkeletonBlock,
} from "@/components/staff/ui";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  addDaysISO,
  count,
  datePart,
  fmtDate,
  fmtLongDate,
  fmtTime,
  mondayOf,
  staffGet,
  timeParts,
  todayISO,
  type Appointment,
  type StaffProfile,
} from "@/lib/practice";

const HOUR_START = 8;
const HOUR_END = 18;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/** A colour per appointment kind, quiet enough for a work tool. */
function kindTone(kind: string): string {
  const k = kind.toLowerCase();
  if (k.includes("review")) return "violet";
  if (k.includes("planning")) return "teal";
  if (k.includes("call") || k.includes("phone")) return "blue";
  if (k.includes("notice")) return "amber";
  if (k.includes("sign") || k.includes("pickup")) return "green";
  return "ink";
}

export default function StaffCalendar() {
  const { get, set } = useUrlState();
  const from = get("from") || mondayOf(todayISO());
  const staffFilter = get("staff");
  const weekStart = mondayOf(from);
  const days = Array.from({ length: 5 }, (_, i) => addDaysISO(weekStart, i));

  const me = useApi(() => staffGet<{ staff: StaffProfile }>("/me"), []);
  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const staffParam = staffFilter === "all" ? undefined : staffFilter || me.data?.staff?.id;

  const cal = useApi(
    () =>
      staffGet<{ from: string; days: number; appointments: Appointment[] }>("/calendar", {
        from: weekStart,
        days: 5,
        staff: staffParam,
      }),
    [weekStart, staffParam],
  );

  const appointments = cal.data?.appointments ?? [];
  const byDay = days.map((d) => ({
    day: d,
    items: appointments
      .filter((a) => datePart(a.starts) === d)
      .sort((a, b) => a.starts.localeCompare(b.starts)),
  }));

  const shift = (weeks: number) => set({ from: addDaysISO(weekStart, weeks * 7) });

  return (
    <StaffLayout title="Calendar">
      <div data-testid="staff-calendar">
        <PageHeader
          title="Calendar"
          subtitle={`${fmtDate(days[0])} – ${fmtDate(days[4])}`}
          actions={
            <div className="bw-cal-nav">
              <button type="button" className="bw-page-btn" onClick={() => shift(-1)} aria-label="Previous week">
                <ChevronLeft size={15} />
              </button>
              <button type="button" className="bw-btn bw-btn-quiet bw-btn-sm" onClick={() => set({ from: "" })}>
                Today
              </button>
              <button type="button" className="bw-page-btn" onClick={() => shift(1)} aria-label="Next week">
                <ChevronRight size={15} />
              </button>
            </div>
          }
        />

        <div className="bw-list-toolbar bw-list-toolbar-tight">
          <div className="bw-filter-row">
            <SelectField
              label="Staff"
              value={staffFilter || "me"}
              onChange={(v) => set({ staff: v === "me" ? "" : v })}
              options={[
                { value: "me", label: "My calendar" },
                { value: "all", label: "Everyone" },
                ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <span className="bw-muted bw-small">
              {cal.data
                ? `${count(appointments.length)} ${appointments.length === 1 ? "appointment" : "appointments"} this week`
                : ""}
            </span>
          </div>
        </div>

        {cal.error ? (
          <ErrorState message={cal.error} onRetry={cal.reload} />
        ) : cal.loading && !cal.data ? (
          <SkeletonBlock h={420} />
        ) : (
          <>
            {/* desktop: a Mon-Fri week grid, 8 AM to 6 PM */}
            <div className="bw-week">
              <div className="bw-week-gutter">
                <div className="bw-week-dayhead" />
                {HOURS.map((h) => (
                  <div className="bw-week-hour" key={h}>
                    {h % 12 === 0 ? 12 : h % 12} {h < 12 ? "AM" : "PM"}
                  </div>
                ))}
              </div>
              {byDay.map(({ day, items }) => (
                <div className="bw-week-col" key={day}>
                  <div className="bw-week-dayhead">
                    <span className="bw-week-dow">{DAY_NAMES[days.indexOf(day)]}</span>
                    <span className={datePart(day) === todayISO() ? "bw-week-date bw-week-today" : "bw-week-date"}>
                      {Number(datePart(day).slice(8, 10))}
                    </span>
                  </div>
                  <div className="bw-week-body">
                    {HOURS.map((h) => (
                      <div className="bw-week-slot" key={h} />
                    ))}
                    {items.map((a) => {
                      const t = timeParts(a.starts);
                      if (!t) return null;
                      const top = ((t.h - HOUR_START) * 60 + t.m) / ((HOUR_END - HOUR_START) * 60);
                      const height = a.minutes / ((HOUR_END - HOUR_START) * 60);
                      const clippedTop = Math.max(0, Math.min(1, top));
                      const clippedHeight = Math.max(0.045, Math.min(1 - clippedTop, height));
                      return (
                        <div
                          key={a.id}
                          className={`bw-week-appt bw-week-appt-${kindTone(a.kind)}`}
                          style={{ top: `${clippedTop * 100}%`, height: `${clippedHeight * 100}%` }}
                          title={`${a.client_name ?? ""} · ${a.kind} · ${a.minutes} min`}
                        >
                          <span className="bw-week-appt-time">{fmtTime(a.starts)}</span>
                          <span className="bw-week-appt-name">{a.client_name}</span>
                          <span className="bw-week-appt-kind">{a.kind}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* phone: the same week as an agenda */}
            <div className="bw-agenda">
              {byDay.every((d) => d.items.length === 0) ? (
                <EmptyState>No appointments this week.</EmptyState>
              ) : (
                byDay
                  .filter((d) => d.items.length > 0)
                  .map(({ day, items }) => (
                    <section className="bw-agenda-day" key={day}>
                      <h2 className="bw-agenda-date">{fmtLongDate(day)}</h2>
                      <ul className="bw-agenda-list">
                        {items.map((a) => (
                          <li key={a.id} className={`bw-agenda-item bw-agenda-${kindTone(a.kind)}`}>
                            <span className="bw-agenda-time">{fmtTime(a.starts)}</span>
                            <span className="bw-agenda-body">
                              <span className="bw-agenda-name">
                                {a.client_ref ? (
                                  <Link to={`/staff/clients/${a.client_ref}`}>{a.client_name}</Link>
                                ) : (
                                  a.client_name
                                )}
                              </span>
                              <span className="bw-agenda-meta">
                                {a.kind} · {a.minutes} min · {a.mode}
                                {a.staff_name ? ` · ${a.staff_name}` : ""}
                              </span>
                              {a.location ? <span className="bw-agenda-meta">{a.location}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
              )}
            </div>
          </>
        )}
      </div>
    </StaffLayout>
  );
}
