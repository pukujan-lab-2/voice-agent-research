import { Link } from "react-router-dom";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  CodeChip,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchField,
  SelectField,
  SkeletonTable,
  StatusChip,
} from "@/components/staff/ui";
import { useApi, useUrlSearch, useUrlState } from "@/hooks/useApi";
import {
  NOTICE_STATUSES,
  count,
  daysUntil,
  fmtDate,
  staffGet,
  usd,
  type Paged,
  type StaffNotice,
} from "@/lib/practice";

const SIZE = 25;

/** Amber under 14 days, red under 7 or past. */
function dueTone(daysLeft: number): string {
  if (daysLeft < 7) return "bw-late";
  if (daysLeft < 14) return "bw-amber";
  return "";
}

export default function StaffNotices() {
  const { get, set, page, setPage } = useUrlState();
  const status = get("status");
  const dueWithin = get("due_within");
  const q = get("q");
  const [search, setSearch] = useUrlSearch(q, (v) => set({ q: v }));

  const list = useApi(
    () =>
      staffGet<Paged<StaffNotice>>("/notices", {
        status: status || undefined,
        due_within: dueWithin || undefined,
        q: q || undefined,
        page,
        size: SIZE,
      }),
    [status, dueWithin, q, page],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  const summary = (() => {
    if (!list.data) return "Loading notices…";
    if (dueWithin === "7") {
      return `${count(total)} ${total === 1 ? "notice" : "notices"} due in the next 7 days`;
    }
    if (dueWithin === "30") return `${count(total)} ${total === 1 ? "notice" : "notices"} due in the next 30 days`;
    const base = `${count(total)} ${total === 1 ? "notice" : "notices"}`;
    const parts: string[] = [];
    if (status) parts.push(status);
    if (q) parts.push(`matching ${q}`);
    return parts.length ? `${base}, ${parts.join(", ")}` : base;
  })();

  return (
    <StaffLayout title="IRS notices">
      <div data-testid="staff-notices">
        <PageHeader
          title="IRS notices"
          subtitle="Letters from the IRS, with the response deadline and who is handling it."
        />

        <div className="bw-list-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by client, code or title"
            label="Search notices"
          />
          <div className="bw-filter-row">
            <SelectField
              label="Status"
              value={status}
              onChange={(v) => set({ status: v })}
              options={[
                { value: "", label: "Any status" },
                ...NOTICE_STATUSES.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) })),
              ]}
            />
            <SelectField
              label="Due within"
              value={dueWithin}
              onChange={(v) => set({ due_within: v })}
              options={[
                { value: "", label: "Any deadline" },
                { value: "7", label: "This week" },
                { value: "30", label: "30 days" },
              ]}
            />
          </div>
        </div>

        <p className="bw-list-summary" data-testid="staff-list-summary" data-copilot-summary>
          {summary}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={10} cols={7} />
        ) : rows.length === 0 ? (
          <EmptyState>
            {dueWithin === "7"
              ? "No notices due in the next 7 days."
              : q
                ? `No notices match “${q}”.`
                : "No notices match these filters."}
          </EmptyState>
        ) : (
          <>
            <div className="bw-table-wrap">
              <table className="bw-table bw-table-hover">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th className="bw-col-name">Notice</th>
                    <th>Client</th>
                    <th>Year</th>
                    <th className="bw-col-num">Amount</th>
                    <th className="bw-col-date">Response due</th>
                    <th>Status</th>
                    <th>Assigned</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((n) => {
                    const left = n.days_left ?? daysUntil(n.response_due) ?? 0;
                    return (
                      <tr key={n.id}>
                        <td data-label="Code">
                          <CodeChip code={n.code} />
                        </td>
                        <td className="bw-col-name">
                          <span className="bw-cell-name">{n.title}</span>
                          {n.summary ? <span className="bw-row-sub">{n.summary}</span> : null}
                        </td>
                        <td data-label="Client">
                          <Link to={`/staff/clients/${n.client_ref}`} className="bw-row-link">
                            {n.client_name}
                          </Link>
                          <span className="bw-row-sub bw-mono">{n.client_ref}</span>
                        </td>
                        <td className="bw-num-cell" data-label="Year">
                          {n.tax_year ?? "—"}
                        </td>
                        <td className="bw-col-num bw-num" data-label="Amount">
                          {usd(n.amount_cents)}
                        </td>
                        <td className={`bw-col-date ${dueTone(left)}`} data-label="Response due">
                          {fmtDate(n.response_due)}
                          <span className="bw-row-sub">
                            {left < 0 ? `${Math.abs(left)} days late` : left === 0 ? "today" : `${left} days left`}
                          </span>
                        </td>
                        <td data-label="Status">
                          <StatusChip status={n.status} />
                        </td>
                        <td data-label="Assigned">{n.assigned_name ?? "Unassigned"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
