import { Link } from "react-router-dom";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  MissingDocs,
  PageHeader,
  Pagination,
  PriorityDot,
  SelectField,
  SkeletonTable,
  StageChip,
} from "@/components/staff/ui";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  count,
  daysUntil,
  datePart,
  fmtDate,
  staffGet,
  todayISO,
  type Paged,
  type QueueRow,
  type StaffProfile,
} from "@/lib/practice";

const SIZE = 50;

const GROUPS = [
  { id: "overdue", label: "Overdue", hint: "Past the due date" },
  { id: "week", label: "Due this week", hint: "Within the next 7 days" },
  { id: "month", label: "Due in 30 days", hint: "Within the next 30 days" },
  { id: "later", label: "Later", hint: "Beyond 30 days" },
] as const;

function groupOf(due: string | null): (typeof GROUPS)[number]["id"] {
  const left = daysUntil(due);
  if (left === null) return "later";
  if (left < 0) return "overdue";
  if (left <= 7) return "week";
  if (left <= 30) return "month";
  return "later";
}

export default function StaffQueue() {
  const { get, set, page, setPage } = useUrlState({ days: "60" });
  const preparer = get("preparer");
  const mine = get("mine") === "1";
  const days = get("days") || "60";

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);
  const me = useApi(() => staffGet<{ staff: StaffProfile }>("/me"), []);

  const list = useApi(
    () =>
      staffGet<Paged<QueueRow>>("/queue", {
        preparer: mine ? me.data?.staff?.id : preparer || undefined,
        days,
        page,
        size: SIZE,
      }),
    [preparer, mine, days, page, me.data?.staff?.id],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const today = todayISO();

  const grouped = GROUPS.map((g) => ({
    ...g,
    rows: rows.filter((r) => groupOf(r.due) === g.id),
  })).filter((g) => g.rows.length > 0);

  const lateCount = rows.filter((r) => (daysUntil(r.due) ?? 0) < 0).length;

  return (
    <StaffLayout title="Work queue">
      <div data-testid="staff-queue">
        <PageHeader
          title="Work queue"
          subtitle="Every open engagement, nearest deadline first."
        />

        <div className="bw-list-toolbar bw-list-toolbar-tight">
          <div className="bw-filter-row">
            <button
              type="button"
              className={mine ? "bw-toggle active" : "bw-toggle"}
              aria-pressed={mine}
              onClick={() => set({ mine: mine ? "" : "1", preparer: "" })}
            >
              Mine
            </button>
            <SelectField
              label="Preparer"
              value={mine ? "" : preparer}
              onChange={(v) => set({ preparer: v, mine: "" })}
              options={[
                { value: "", label: "Everyone" },
                ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <SelectField
              label="Window"
              value={days}
              onChange={(v) => set({ days: v })}
              options={[
                { value: "14", label: "Next 14 days" },
                { value: "30", label: "Next 30 days" },
                { value: "60", label: "Next 60 days" },
                { value: "120", label: "Next 120 days" },
              ]}
            />
          </div>
        </div>

        <p className="bw-list-summary" data-copilot-summary>
          {list.data
            ? `${count(total)} open ${total === 1 ? "engagement" : "engagements"}${mine ? " on my desk" : ""}, ${count(lateCount)} past due on this page`
            : "Loading the queue…"}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={12} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState>Nothing in the queue for this window.</EmptyState>
        ) : (
          <>
            {grouped.map((group) => (
              <section className="bw-queue-group" key={group.id}>
                <header className="bw-queue-head">
                  <h2 className={group.id === "overdue" ? "bw-queue-title bw-late" : "bw-queue-title"}>
                    {group.label}
                  </h2>
                  <span className="bw-queue-n">{group.rows.length}</span>
                  <span className="bw-muted bw-small">{group.hint}</span>
                </header>
                <div className="bw-table-wrap">
                  <table className="bw-table bw-table-hover">
                    <thead>
                      <tr>
                        <th className="bw-col-name">Client</th>
                        <th>Form</th>
                        <th>Year</th>
                        <th>Stage</th>
                        <th>Preparer</th>
                        <th className="bw-col-date">Due</th>
                        <th className="bw-col-num">Late</th>
                        <th className="bw-col-pri">Pri</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.rows.map((row) => {
                        const late = (daysUntil(row.due) ?? 0) < 0;
                        return (
                          <tr key={row.id}>
                            <td className="bw-col-name">
                              <Link to={`/staff/clients/${row.client_ref}`} className="bw-cell-link">
                                <span className="bw-cell-name">{row.client_name}</span>
                              </Link>
                              <span className="bw-row-sub bw-mono">{row.client_ref}</span>
                            </td>
                            <td className="bw-num-cell" data-label="Form">
                              {row.form}
                            </td>
                            <td className="bw-num-cell" data-label="Year">
                              {row.tax_year}
                            </td>
                            <td data-label="Stage">
                              <div className="bw-stage-cell">
                                <StageChip stage={row.stage} />
                                {row.missing ? <MissingDocs n={row.missing} /> : null}
                              </div>
                            </td>
                            <td data-label="Preparer">{row.preparer_name ?? "—"}</td>
                            <td className={late ? "bw-col-date bw-late" : "bw-col-date"} data-label="Due">
                              {fmtDate(row.due)}
                              <span className="bw-row-sub">{datePart(row.due) === today ? "today" : ""}</span>
                            </td>
                            <td className="bw-col-num" data-label="Late">
                              {row.days_late && row.days_late > 0 ? (
                                <span className="bw-late">{row.days_late}d</span>
                              ) : late ? (
                                <span className="bw-late">{Math.abs(daysUntil(row.due) ?? 0)}d</span>
                              ) : (
                                <span className="bw-muted">—</span>
                              )}
                            </td>
                            <td className="bw-col-pri" data-label="Priority">
                              <PriorityDot priority={row.priority} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            <Pagination
              page={list.data?.page ?? page}
              size={list.data?.size ?? SIZE}
              total={total}
              pages={list.data?.pages ?? 1}
              onPage={setPage}
            />
          </>
        )}
      </div>
    </StaffLayout>
  );
}
