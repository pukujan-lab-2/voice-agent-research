/**
 * Book an appointment (form `booking`). The days and times come from /api/slots, refetched whenever the office,
 * preparer, day or kind changes, so a time that has just been taken is never offered. On desktop the next two
 * weeks are a clickable strip beside the select; the select stays the real field.
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Loader2 } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, NotesField, Radio, RadioSet, SelectField, TextField,
} from "@/components/tax/FormKit";
import { useSiteLocations, useSiteTeam } from "@/lib/siteData";
import { slotsGet, fmtLongDate, type Slot, type SlotDay } from "@/lib/practice";
import { icsDataUrl } from "@/lib/site";

const KINDS = [
  { value: "consultation", label: "New-client consultation (30 min, free)", also: "consultation, new client, first meeting, free consultation" },
  { value: "review", label: "Return review (60 min)", also: "review, go over my return, return review" },
  { value: "planning", label: "Planning meeting (60 min)", also: "planning, tax planning" },
  { value: "notice", label: "IRS notice review (30 min)", also: "notice, letter, irs notice" },
  { value: "signing", label: "Signing (30 min)", also: "signing, sign, sign my return" },
];

const OFFICES = [
  { value: "harrow", label: "Harrow Falls", also: "harrow, harrow falls" },
  { value: "corbel", label: "Corbel", also: "corbel" },
  { value: "millbrook", label: "Millbrook", also: "millbrook" },
];

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function ordinal(n: number): string {
  const rest = n % 100;
  if (rest >= 11 && rest <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

/** "Monday, November 2 · 14 times", with the spoken forms in data-copilot-also. */
function dayLabel(iso: string, open: number) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return { label: iso, also: iso };
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const weekday = WEEKDAYS[d.getUTCDay()];
  const monthDay = `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
  const label = `${weekday}, ${monthDay} · ${open === 0 ? "fully booked" : `${open} ${open === 1 ? "time" : "times"}`}`;
  return {
    label,
    also: `${weekday.toLowerCase()} ${monthDay.toLowerCase()}, ${monthDay.toLowerCase()}, the ${ordinal(Number(m[3]))}, ${weekday.toLowerCase()} the ${ordinal(Number(m[3]))}`,
    weekday,
  };
}

/** "9:00 AM" -> the spoken forms the copilot may hear. */
function timeAlso(label: string, time: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(time);
  if (!m) return label.toLowerCase();
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  const h12 = hour % 12 || 12;
  const suffix = hour >= 12 ? "pm" : "am";
  const words = ["twelve", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven"];
  const word = words[h12 % 12];
  if (minute === 0) return `${h12}, ${word}, ${h12} ${suffix}, ${word} ${suffix}`;
  if (minute === 30) return `${h12} 30, ${word} thirty, half past ${word}, ${h12} thirty ${suffix}`;
  return `${h12} ${minute}, ${word} ${minute}`;
}

export default function TaxSchedule() {
  useTaxTitle("Book an appointment");
  const [params] = useSearchParams();
  const f = useSiteForm("booking");
  const team = useSiteTeam();
  const locations = useSiteLocations();

  const [office, setOffice] = useState(params.get("office") ?? "harrow");
  const [staff, setStaff] = useState(params.get("staff") ?? "");
  const [kind, setKind] = useState("consultation");
  const [day, setDay] = useState("");

  const days = useApi<{ days: SlotDay[] }>(
    () => slotsGet<{ days: SlotDay[] }>("/days", { office, staff: staff || undefined }),
    [office, staff],
  );
  const times = useApi<{ date: string; slots: Slot[] }>(
    day ? () => slotsGet<{ date: string; slots: Slot[] }>("", { date: day, office, staff: staff || undefined, kind }) : null,
    [day, office, staff, kind],
  );

  const dayList = days.data?.days ?? [];
  const slots = times.data?.slots ?? [];

  // A weekday that appears twice in the list is spoken without the weekday name.
  const seenWeekday = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of dayList) {
      const label = dayLabel(d.date, d.open);
      const wd = "weekday" in label ? label.weekday : "";
      counts.set(wd, (counts.get(wd) ?? 0) + 1);
    }
    return counts;
  }, [dayList]);

  // Clear a day that is no longer offered when the office or preparer changes.
  useEffect(() => {
    if (day && days.data && !days.data.days.some((d) => d.date === day)) setDay("");
  }, [days.data, day]);

  const people = (team.data?.team ?? []).filter(
    (p) =>
      (p.accepts_new === true || p.accepts_new === 1 || p.accepts_new === "1" || p.accepts_new === "true") &&
      (!office || p.office?.toLowerCase().includes(office.toLowerCase()) || office === "harrow"),
  );

  const chosenOffice = locations.data?.locations?.find((o) => o.id === office || o.name.toLowerCase().includes(office));

  const result = f.confirmation;
  const confirmedDay = result ? String(result.date ?? day) : "";
  const confirmedTime = result ? String(result.time ?? "") : "";
  const confirmedStaff = result ? String(result.staff ?? "") : "";
  const confirmedOffice = result ? String(result.office ?? chosenOffice?.name ?? "") : "";

  const ics =
    result && confirmedDay && confirmedTime
      ? icsDataUrl({
          title: `Brindlewick — ${kind}`,
          date: confirmedDay,
          time: confirmedTime,
          minutes: kind === "consultation" ? 30 : 60,
          location: confirmedOffice || "Video call",
          description: `Reference ${result.ref}. Brindlewick Tax & Accounting (demo).`,
        })
      : "";

  return (
    <SitePage config="taxSchedule">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Book an appointment</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Pick a time that is actually open.
            </h1>
            <p className="tax-lead">
              The days and times below are live: what you see is what is still free. A consultation is thirty
              minutes and costs nothing; the other appointments are for clients who already have a file with
              us.
            </p>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">Before you book</h2>
              <ul className="tax-list">
                <li>Consultations are thirty minutes, by phone, video or in the office.</li>
                <li>You don't need any documents for a first appointment.</li>
                <li>If you are a client, your preparer's name is on your portal home page.</li>
                <li>Need to change it afterwards? Ring the office and we will move it.</li>
              </ul>
            </div>
          </div>

          <div>
            {result ? (
              <Confirmation
                result={result}
                next={[
                  `We have you down for ${confirmedDay ? fmtLongDate(confirmedDay) : "your chosen day"}${confirmedTime ? ` at ${confirmedTime}` : ""}.`,
                  confirmedStaff
                    ? `${confirmedStaff} will see you.`
                    : "A preparer will confirm who is seeing you within one working day.",
                  confirmedOffice
                    ? `We'll meet at ${confirmedOffice}.`
                    : "We'll send a video link, or call you, before the appointment.",
                ]}
                links={[
                  { to: "/tax/locations", label: "The offices" },
                  { to: "/tax/tools/checklist", label: "What to bring" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              >
                {ics && (
                  <p style={{ margin: "0 0 0.875rem" }}>
                    <a href={ics} download="brindlewick-appointment.ics" className="tax-btn tax-btn-outline">
                      <CalendarDays size={15} aria-hidden="true" /> Add to calendar
                    </a>
                  </p>
                )}
              </Confirmation>
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="booking" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <div className="tax-field">
                    <label htmlFor="bk_kind">What's the appointment for?</label>
                    <select
                      id="bk_kind"
                      name="kind"
                      required
                      value={kind}
                      onChange={(e) => setKind(e.target.value)}
                      data-copilot-ask="What's the appointment for"
                      aria-invalid={f.errors.kind ? true : undefined}
                      aria-describedby={f.errors.kind ? "bk_kind-error" : undefined}
                    >
                      {KINDS.map((k) => (
                        <option key={k.value} value={k.value} data-copilot-also={k.also}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    {f.errors.kind && (
                      <p className="tax-error" id="bk_kind-error" role="alert">
                        {f.errors.kind}
                      </p>
                    )}
                  </div>

                  <RadioSet
                    legend="How would you like to meet?"
                    ask="Would you like to meet in the office, by video or by phone"
                    error={f.errors.mode}
                    errorId="bk_mode-error"
                  >
                    <Radio id="bk_mode_office" name="mode" value="office" label="In the office" also="office, in person, in the office" />
                    <Radio id="bk_mode_video" name="mode" value="video" label="Video call" also="video, zoom, online" />
                    <Radio id="bk_mode_phone" name="mode" value="phone" label="Phone call" also="phone, call, by phone" />
                  </RadioSet>

                  <div className="tax-field">
                    <label htmlFor="bk_office">Which office?</label>
                    <select
                      id="bk_office"
                      name="office"
                      required
                      value={office}
                      onChange={(e) => {
                        setOffice(e.target.value);
                        setStaff("");
                      }}
                      data-copilot-ask="Which office"
                      aria-invalid={f.errors.office ? true : undefined}
                      aria-describedby={f.errors.office ? "bk_office-error" : undefined}
                    >
                      {OFFICES.map((o) => (
                        <option key={o.value} value={o.value} data-copilot-also={o.also}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {f.errors.office && (
                      <p className="tax-error" id="bk_office-error" role="alert">
                        {f.errors.office}
                      </p>
                    )}
                  </div>

                  <div className="tax-field">
                    <label htmlFor="bk_staff">Preparer</label>
                    <select
                      id="bk_staff"
                      name="staff"
                      value={staff}
                      onChange={(e) => setStaff(e.target.value)}
                      data-copilot-ask="Would you like a particular preparer? Say anyone if not."
                    >
                      <option value="" data-copilot-also="anyone, any, no preference, doesn't matter">
                        Any available preparer
                      </option>
                      {people.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          data-copilot-also={`${p.first_name.toLowerCase()}, ${p.name.toLowerCase()}`}
                        >
                          {p.name}
                          {p.credentials ? `, ${p.credentials}` : ""}
                        </option>
                      ))}
                    </select>
                    {team.loading && <p className="tax-hint">Loading the team…</p>}
                    {team.error && <p className="tax-error">{team.error}</p>}
                  </div>

                  <div className="tax-field">
                    <label htmlFor="bk_day">Which day?</label>
                    <select
                      id="bk_day"
                      name="date"
                      required
                      value={day}
                      onChange={(e) => setDay(e.target.value)}
                      data-copilot-ask="Which day suits you"
                      aria-invalid={f.errors.date ? true : undefined}
                      aria-describedby={f.errors.date ? "bk_day-error" : undefined}
                    >
                      <option value="">Choose a day</option>
                      {dayList.map((d) => {
                        const info = dayLabel(d.date, d.open);
                        const wd = "weekday" in info ? info.weekday : "";
                        const also =
                          wd && (seenWeekday.get(wd) ?? 0) > 1
                            ? info.also.split(", ").slice(1).join(", ")
                            : info.also;
                        return (
                          <option key={d.date} value={d.date} data-copilot-also={also} disabled={d.open === 0}>
                            {info.label}
                          </option>
                        );
                      })}
                    </select>
                    {days.loading && (
                      <p className="tax-hint" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Loader2 size={13} className="tax-spin" aria-hidden="true" /> Loading the open days…
                      </p>
                    )}
                    {days.error && <p className="tax-error">{days.error}</p>}
                    {f.errors.date && (
                      <p className="tax-error" id="bk_day-error" role="alert">
                        {f.errors.date}
                      </p>
                    )}
                  </div>

                  {dayList.length > 0 && (
                    <div className="tax-field">
                      <span className="tax-hint" style={{ display: "block", marginBottom: "0.375rem" }}>
                        Or pick from the next two weeks
                      </span>
                      <div className="tax-days">
                        {dayList.map((d) => {
                          const info = dayLabel(d.date, d.open);
                          const [, mm, dd] = d.date.split("-");
                          const wd = ("weekday" in info ? info.weekday : "").slice(0, 3);
                          return (
                            <button
                              key={d.date}
                              type="button"
                              className="tax-day"
                              data-testid="slot-day"
                              aria-pressed={day === d.date}
                              disabled={d.open === 0}
                              onClick={() => setDay(d.date)}
                            >
                              <strong>
                                {wd} {Number(dd)}
                              </strong>
                              <span>
                                {MONTHS[Number(mm) - 1]?.slice(0, 3)} · {d.open === 0 ? "full" : d.open}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <fieldset className="tax-field" aria-invalid={f.errors.time ? true : undefined}>
                    <legend>Available times</legend>
                    {!day && <p className="tax-hint">Choose a day and the open times appear here.</p>}
                    {day && times.loading && (
                      <p className="tax-hint" style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                        <Loader2 size={13} className="tax-spin" aria-hidden="true" /> Checking the diary…
                      </p>
                    )}
                    {day && times.error && <p className="tax-error">{times.error}</p>}
                    {day && !times.loading && !times.error && slots.length === 0 && (
                      <p className="tax-hint">No times left on this day. Try another day.</p>
                    )}
                    {slots.length > 0 && (
                      <div className="tax-times">
                        {slots.map((s) => {
                          const id = `bk_time_${s.time.replace(":", "")}`;
                          return (
                            <label className="tax-time" key={s.time} htmlFor={id} data-testid="slot-time">
                              <input
                                id={id}
                                name="time"
                                type="radio"
                                value={s.time}
                                required
                                data-copilot-also={timeAlso(s.label, s.time)}
                              />
                              {s.label}
                            </label>
                          );
                        })}
                      </div>
                    )}
                    {f.errors.time && (
                      <p className="tax-error" role="alert">
                        {f.errors.time}
                      </p>
                    )}
                    {f.conflict && (
                      <p className="tax-error" role="alert" style={{ marginTop: "0.5rem" }}>
                        {f.conflict}
                      </p>
                    )}
                  </fieldset>

                  <TextField id="bk_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="bk_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="bk_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <NotesField id="bk_notes" ask="Anything else we should know? Say none if not." />

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Booking…" : "Book this time"}
                    </button>
                    <DraftNote saved={f.draftSaved} />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <DemoLine />
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </SitePage>
  );
}
