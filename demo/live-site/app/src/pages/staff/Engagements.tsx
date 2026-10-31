import { Link } from "react-router-dom";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  MissingDocs,
  PageHeader,
  Pagination,
  PriorityDot,
  SearchField,
  SelectField,
  SkeletonTable,
  StageChip,
} from "@/components/staff/ui";
import { useApi, useUrlSearch, useUrlState } from "@/hooks/useApi";
import {
  count,
  daysUntil,
  fmtDate,
  staffGet,
  usd,
  type EngagementRow,
  type Paged,
  type StaffProfile,
} from "@/lib/practice";

const SIZE = 25;

const STAGE_OPTIONS = [
  { value: "", label: "Any stage" },
  { value: "organizer_sent", label: "Organizer sent" },
  { value: "docs_in", label: "Documents in" },
  { value: "in_prep", label: "In preparation" },
  { value: "review", label: "In review" },
  { value: "efiled", label: "E-filed" },
  { value: "accepted", label: "Accepted" },
];

/** The heading follows the filter, so a link to a filtered view reads like a page of its own. */
function headingFor(stage: string): { title: string; noun: string } {
  switch (stage) {
    case "organizer_sent":
      return { title: "Organizers out", noun: "returns waiting on the client's organizer" };
    case "docs_in":
      return { title: "Returns waiting on documents", noun: "returns waiting on documents" };
    case "in_prep":
      return { title: "Returns in preparation", noun: "returns in preparation" };
    case "review":
      return { title: "Returns in review", noun: "returns in review" };
    case "efiled":
      return { title: "E-filed returns", noun: "e-filed returns" };
    case "accepted":
      return { title: "Accepted returns", noun: "accepted returns" };
    default:
      return { title: "Engagements", noun: "engagements" };
  }
}

export default function StaffEngagements() {
  const { get, set, page, setPage } = useUrlState({ sort: "due" });

  const q = get("q");
  const stage = get("stage");
  const year = get("year");
  const form = get("form");
  const preparer = get("preparer");
  const dueWithin = get("due_within");
  const sort = get("sort") || "due";

  const [search, setSearch] = useUrlSearch(q, (v) => set({ q: v }));

  const list = useApi(
    () =>
      staffGet<Paged<EngagementRow>>("/engagements", {
        stage: stage || undefined,
        year: year || undefined,
        preparer: preparer || undefined,
        q: q || undefined,
        form: form || undefined,
        due_within: dueWithin || undefined,
        sort,
        page,
        size: SIZE,
      }),
    [stage, year, preparer, q, form, dueWithin, sort, page],
  );

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const head = headingFor(stage);

  const summary = (() => {
    if (!list.data) return "Loading engagements…";
    const base = `${count(total)} ${head.noun}`;
    const parts: string[] = [];
    if (q) parts.push(`matching ${q}`);
    if (year) parts.push(`for ${year}`);
    if (form) parts.push(`on ${form}`);
    if (dueWithin) parts.push(`due within ${dueWithin} days`);
    if (preparer) {
      const person = staff.data?.staff.find((s) => s.id === preparer);
      parts.push(`for ${person?.name ?? preparer}`);
    }
    return parts.length ? `${base} ${parts.join(", ")}` : base;
  })();

  return (
    <StaffLayout title={head.title}>
      <div data-testid="staff-engagements">
        <PageHeader
          title={head.title}
          subtitle="Every return the firm is working on, with its stage, preparer and deadline."
          actions={
            <Link to="/staff/engagements/new" className="bw-btn bw-btn-primary bw-btn-sm">
              New engagement
            </Link>
          }
        />

        <div className="bw-list-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by client name or ID"
            label="Search engagements"
          />
          <div className="bw-filter-row">
            <SelectField label="Stage" value={stage} onChange={(v) => set({ stage: v })} options={STAGE_OPTIONS} />
            <SelectField
              label="Tax year"
              value={year}
              onChange={(v) => set({ year: v })}
              options={[
                { value: "", label: "Any year" },
                { value: "2026", label: "2026" },
                { value: "2025", label: "2025" },
                { value: "2024", label: "2024" },
                { value: "2023", label: "2023" },
              ]}
            />
            <SelectField
              label="Form"
              value={form}
              onChange={(v) => set({ form: v })}
              options={[
                { value: "", label: "Any form" },
                { value: "1040", label: "1040" },
                { value: "1120-S", label: "1120-S" },
                { value: "1065", label: "1065" },
                { value: "1120", label: "1120" },
                { value: "990", label: "990" },
                { value: "1041", label: "1041" },
                { value: "1040-X", label: "1040-X" },
              ]}
            />
            <SelectField
              label="Preparer"
              value={preparer}
              onChange={(v) => set({ preparer: v })}
              options={[
                { value: "", label: "Any preparer" },
                ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <SelectField
              label="Due within"
              value={dueWithin}
              onChange={(v) => set({ due_within: v })}
              options={[
                { value: "", label: "Any deadline" },
                { value: "7", label: "Due in 7 days" },
                { value: "30", label: "Due in 30 days" },
                { value: "60", label: "Due in 60 days" },
              ]}
            />
            <SelectField
              label="Sort"
              value={sort}
              onChange={(v) => set({ sort: v })}
              options={[
                { value: "due", label: "Sort: due date" },
                { value: "updated", label: "Sort: last updated" },
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
          <EmptyState>No engagements match these filters.</EmptyState>
        ) : (
          <>
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
                    <th className="bw-col-num">Fee</th>
                    <th className="bw-col-pri">Pri</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="bw-col-name">
                        <Link to={`/staff/clients/${row.client_ref}`} className="bw-cell-link">
                          <span className="bw-cell-name">{row.client_name}</span>
                        </Link>
                        <span className="bw-row-sub bw-mono">
                          {row.client_ref} · {row.id}
                        </span>
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
                      <td data-label="Preparer">{row.preparer_name}</td>
                      <td
                        className={(daysUntil(row.due) ?? 0) < 0 ? "bw-col-date bw-late" : "bw-col-date"}
                        data-label="Due"
                      >
                        {fmtDate(row.due)}
                        {row.extended ? <span className="bw-row-sub">extended</span> : null}
                      </td>
                      <td className="bw-col-num bw-num" data-label="Fee">
                        {usd(row.fee_cents)}
                      </td>
                      <td className="bw-col-pri" data-label="Priority">
                        <PriorityDot priority={row.priority} />
                      </td>
                    </tr>
                  ))}
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
