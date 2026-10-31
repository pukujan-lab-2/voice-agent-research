import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SelectField,
  SkeletonTable,
} from "@/components/staff/ui";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  count,
  fmtWhen,
  staffGet,
  type AuditRow,
  type Paged,
  type StaffProfile,
} from "@/lib/practice";

const SIZE = 40;

const ACTIONS = [
  "created",
  "updated",
  "stage changed",
  "viewed",
  "sent",
  "received",
  "deleted",
  "signed in",
  "signed out",
  "exported",
];

const ENTITIES = ["engagement", "client", "document", "invoice", "notice", "task", "message", "appointment", "staff"];

export default function StaffAudit() {
  const { get, set, page, setPage } = useUrlState();
  const actor = get("actor");
  const entity = get("entity");
  const action = get("action");

  const list = useApi(
    () =>
      staffGet<Paged<AuditRow>>("/audit", {
        actor: actor || undefined,
        entity: entity || undefined,
        action: action || undefined,
        page,
        size: SIZE,
      }),
    [actor, entity, action, page],
  );

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  return (
    <StaffLayout title="Audit log">
      <div data-testid="staff-audit">
        <PageHeader
          title="Audit log"
          subtitle="Who did what, to which record, and when."
        />

        <div className="bw-list-toolbar bw-list-toolbar-tight">
          <div className="bw-filter-row">
            <SelectField
              label="Person"
              value={actor}
              onChange={(v) => set({ actor: v })}
              options={[
                { value: "", label: "Anyone" },
                ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
            <SelectField
              label="Entity"
              value={entity}
              onChange={(v) => set({ entity: v })}
              options={[
                { value: "", label: "Any record" },
                ...ENTITIES.map((e) => ({ value: e, label: e.charAt(0).toUpperCase() + e.slice(1) })),
              ]}
            />
            <SelectField
              label="Action"
              value={action}
              onChange={(v) => set({ action: v })}
              options={[
                { value: "", label: "Any action" },
                ...ACTIONS.map((a) => ({ value: a, label: a.charAt(0).toUpperCase() + a.slice(1) })),
              ]}
            />
          </div>
        </div>

        <p className="bw-list-summary" data-copilot-summary>
          {list.data
            ? `${count(total)} ${total === 1 ? "entry" : "entries"}${actor || entity || action ? ", filtered" : ""}`
            : "Loading the audit log…"}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={12} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState>No audit entries match these filters.</EmptyState>
        ) : (
          <>
            <div className="bw-table-wrap">
              <table className="bw-table bw-table-hover bw-table-log">
                <thead>
                  <tr>
                    <th className="bw-col-time">When</th>
                    <th>Who</th>
                    <th>Action</th>
                    <th>Record</th>
                    <th>Detail</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="bw-mono bw-col-time">{fmtWhen(r.at)}</td>
                      <td>
                        <span className="bw-actor">
                          {r.actor_name ?? r.actor}
                          <span className="bw-actor-kind">{r.actor_kind ?? "staff"}</span>
                        </span>
                      </td>
                      <td>
                        <span className="bw-action">{r.action}</span>
                      </td>
                      <td>
                        <span className="bw-cap">{r.entity}</span>
                        {r.entity_id ? <span className="bw-mono bw-row-sub">{r.entity_id}</span> : null}
                      </td>
                      <td className="bw-muted">{r.detail ?? "—"}</td>
                      <td className="bw-mono bw-muted bw-small">{r.ip ?? "—"}</td>
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
