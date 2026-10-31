import { Link } from "react-router-dom";
import { Building2, Users } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  DueDate,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchField,
  SelectField,
  Segmented,
  SkeletonTable,
  StageChip,
} from "@/components/staff/ui";
import { useApi, useUrlSearch, useUrlState } from "@/hooks/useApi";
import {
  count,
  daysUntil,
  staffGet,
  type ClientRow,
  type Paged,
} from "@/lib/practice";

const SIZE = 25;

const SORTS = [
  { value: "name", label: "Sort: name" },
  { value: "since", label: "Sort: client since" },
  { value: "due", label: "Sort: next due" },
];

const STAGE_OPTIONS = [
  { value: "", label: "Any stage" },
  { value: "organizer_sent", label: "Organizer sent" },
  { value: "docs_in", label: "Documents in" },
  { value: "in_prep", label: "In preparation" },
  { value: "review", label: "In review" },
  { value: "efiled", label: "E-filed" },
  { value: "accepted", label: "Accepted" },
];

export default function StaffClients() {
  const { get, set, page, setPage } = useUrlState({ kind: "all", sort: "name" });

  const q = get("q");
  const kind = get("kind") || "all";
  const preparer = get("preparer");
  const office = get("office");
  const tag = get("tag");
  const stage = get("stage");
  const industry = get("industry");
  const sort = get("sort") || "name";

  const [search, setSearch] = useUrlSearch(q, (value) => set({ q: value }));

  const list = useApi(
    () =>
      staffGet<Paged<ClientRow>>("/clients", {
        q: q || undefined,
        kind: kind === "all" ? undefined : kind,
        preparer: preparer || undefined,
        office: office || undefined,
        tag: tag || undefined,
        stage: stage || undefined,
        industry: industry || undefined,
        sort,
        page,
        size: SIZE,
      }),
    [q, kind, preparer, office, tag, stage, industry, sort, page],
  );

  const filters = useApi(
    () => staffGet<{ staff: { id: string; name: string }[] }>("/staff"),
    [],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  const summary = (() => {
    if (!list.data) return "Loading clients…";
    const base = `${count(total)} ${total === 1 ? "client" : "clients"}`;
    const parts: string[] = [];
    if (q) parts.push(`matching ${q}`);
    if (kind !== "all") parts.push(kind === "household" ? "households only" : "businesses only");
    if (preparer) {
      const person = filters.data?.staff.find((s) => s.id === preparer);
      parts.push(`preparer ${person?.name ?? preparer}`);
    }
    if (office) parts.push(`office ${office}`);
    if (tag) parts.push(`tagged ${tag}`);
    if (stage) parts.push(`stage ${STAGE_OPTIONS.find((s) => s.value === stage)?.label.toLowerCase() ?? stage}`);
    if (industry) parts.push(`in ${industry}`);
    return parts.length ? `${base} ${parts.join(", ")}` : base;
  })();

  const activeFilters =
    Boolean(q) || kind !== "all" || Boolean(preparer) || Boolean(office) || Boolean(tag) || Boolean(stage) || Boolean(industry);

  return (
    <StaffLayout title="Clients">
      <PageHeader
        title="Clients"
        subtitle="Every household and business the firm looks after."
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
          placeholder="Search by name, ID or city"
          label="Search clients"
          testId="staff-client-search"
        />

        <Segmented
          label="Client kind"
          value={kind as "all" | "household" | "business"}
          onChange={(v) => set({ kind: v === "all" ? "" : v })}
          options={[
            { value: "all", label: "All" },
            { value: "household", label: "Households" },
            { value: "business", label: "Businesses" },
          ]}
        />

        <div className="bw-filter-row">
          <SelectField
            label="Preparer"
            value={preparer}
            onChange={(v) => set({ preparer: v })}
            options={[
              { value: "", label: "Any preparer" },
              ...(filters.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
            ]}
          />
          <SelectField
            label="Office"
            value={office}
            onChange={(v) => set({ office: v })}
            options={[
              { value: "", label: "Any office" },
              { value: "Harrow Falls", label: "Harrow Falls" },
              { value: "Port Alexander", label: "Port Alexander" },
              { value: "Marrowgate", label: "Marrowgate" },
            ]}
          />
          <SelectField
            label="Stage"
            value={stage}
            onChange={(v) => set({ stage: v })}
            options={STAGE_OPTIONS}
          />
          <SelectField
            label="Tag"
            value={tag}
            onChange={(v) => set({ tag: v })}
            options={[
              { value: "", label: "Any tag" },
              { value: "vip", label: "VIP" },
              { value: "quarterly", label: "Quarterly books" },
              { value: "payroll", label: "Payroll client" },
              { value: "new", label: "New client" },
              { value: "referral", label: "Referral" },
            ]}
          />
          <SelectField
            label="Industry"
            value={industry}
            onChange={(v) => set({ industry: v })}
            options={[
              { value: "", label: "Any industry" },
              { value: "Retail", label: "Retail" },
              { value: "Construction", label: "Construction" },
              { value: "Professional services", label: "Professional services" },
              { value: "Hospitality", label: "Hospitality" },
              { value: "Healthcare", label: "Healthcare" },
              { value: "Agriculture", label: "Agriculture" },
            ]}
          />
          <SelectField label="Sort" value={sort} onChange={(v) => set({ sort: v })} options={SORTS} />
          {activeFilters ? (
            <button
              type="button"
              className="bw-btn bw-btn-ghost bw-btn-sm"
              onClick={() => {
                setSearch("");
                set({ q: "", kind: "", preparer: "", office: "", tag: "", stage: "", industry: "" });
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </div>

      <p className="bw-list-summary" data-testid="staff-list-summary" data-copilot-summary>
        {summary}
      </p>

      {list.error ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : list.loading && !list.data ? (
        <SkeletonTable rows={10} cols={6} />
      ) : rows.length === 0 ? (
        <EmptyState>
          {q ? `No clients match “${q}”.` : "No clients match these filters."}
        </EmptyState>
      ) : (
        <>
          <div className="bw-table-wrap">
            <table className="bw-table bw-table-hover">
              <thead>
                <tr>
                  <th className="bw-col-name">Client</th>
                  <th>ID</th>
                  <th>City</th>
                  <th>Preparer</th>
                  <th>Detail</th>
                  <th className="bw-col-date">Next due</th>
                  <th>Stage</th>
                  <th>Tags</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} data-testid="staff-client-row">
                    <td className="bw-col-name">
                      <Link to={`/staff/clients/${row.id}`} className="bw-cell-link">
                        <span className="bw-kind-icon" aria-hidden="true">
                          {row.kind === "business" ? <Building2 size={13} /> : <Users size={13} />}
                        </span>
                        <span className="bw-cell-name">{row.name}</span>
                      </Link>
                    </td>
                    <td className="bw-mono" data-label="ID">
                      {row.id}
                    </td>
                    <td data-label="City">
                      {row.city ? `${row.city}, ${row.state ?? ""}`.replace(/,\s*$/, "") : "—"}
                    </td>
                    <td data-label="Preparer">{row.preparer_name ?? "—"}</td>
                    <td className="bw-muted" data-label="Detail">
                      {row.detail ?? "—"}
                    </td>
                    <td className="bw-col-date" data-label="Next due">
                      <DueDate iso={row.next_due} past={(daysUntil(row.next_due) ?? 0) < 0} />
                    </td>
                    <td data-label="Stage">
                      <StageChip stage={row.stage} />
                    </td>
                    <td data-label="Tags">
                      <span className="bw-tags">
                        {(row.tags ?? []).slice(0, 2).map((t) => (
                          <span className="bw-tag" key={t}>
                            {t}
                          </span>
                        ))}
                      </span>
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
    </StaffLayout>
  );
}

