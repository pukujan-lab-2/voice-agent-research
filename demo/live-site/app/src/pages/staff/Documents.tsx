import { Link } from "react-router-dom";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SearchField,
  Segmented,
  SkeletonTable,
  StatusChip,
} from "@/components/staff/ui";
import { useApi, useUrlSearch, useUrlState } from "@/hooks/useApi";
import {
  count,
  daysUntil,
  fmtDate,
  staffGet,
  type Paged,
  type StaffDocument,
} from "@/lib/practice";

const SIZE = 25;

export default function StaffDocuments() {
  const { get, set, page, setPage } = useUrlState({ status: "requested" });
  const status = get("status") || "requested";
  const q = get("q");
  const [search, setSearch] = useUrlSearch(q, (v) => set({ q: v }));

  const list = useApi(
    () =>
      staffGet<Paged<StaffDocument>>("/documents", {
        status,
        q: q || undefined,
        page,
        size: SIZE,
      }),
    [status, q, page],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  return (
    <StaffLayout title="Documents">
      <div data-testid="staff-documents">
        <PageHeader
          title="Documents"
          subtitle="What clients have sent, and what the firm is still waiting for."
        />

        <div className="bw-list-toolbar">
          <Segmented
            label="Document status"
            value={status as "requested" | "received"}
            onChange={(v) => set({ status: v })}
            options={[
              { value: "requested", label: "Requested" },
              { value: "received", label: "Received" },
            ]}
          />
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by document or client"
            label="Search documents"
          />
        </div>

        <p className="bw-list-summary" data-copilot-summary>
          {list.data
            ? status === "requested"
              ? `${count(total)} ${total === 1 ? "document" : "documents"} still requested${q ? ` matching ${q}` : ""}`
              : `${count(total)} ${total === 1 ? "document" : "documents"} received${q ? ` matching ${q}` : ""}`
            : "Loading documents…"}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={10} cols={5} />
        ) : rows.length === 0 ? (
          <EmptyState>
            {status === "requested"
              ? q
                ? `No requested documents match “${q}”.`
                : "Nothing is outstanding: every document has been received."
              : "No documents received yet."}
          </EmptyState>
        ) : (
          <>
            <div className="bw-table-wrap">
              <table className="bw-table bw-table-hover">
                <thead>
                  <tr>
                    <th className="bw-col-name">Document</th>
                    <th>Client</th>
                    <th>For</th>
                    <th>Issuer</th>
                    <th>Status</th>
                    <th className="bw-col-date">Requested</th>
                    <th className="bw-col-date">Received</th>
                    <th className="bw-col-num">Waiting</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((doc) => {
                    const waiting = doc.days_waiting ?? daysUntil(doc.requested) ?? 0;
                    return (
                      <tr key={doc.id}>
                        <td className="bw-col-name">
                          <span className="bw-cell-name">{doc.name}</span>
                          {doc.source ? <span className="bw-row-sub">{doc.source}</span> : null}
                        </td>
                        <td data-label="Client">
                          {doc.client_ref ? (
                            <Link to={`/staff/clients/${doc.client_ref}`} className="bw-row-link">
                              {doc.client_name}
                            </Link>
                          ) : (
                            doc.client_name ?? "—"
                          )}
                        </td>
                        <td className="bw-muted" data-label="For">
                          {doc.engagement_form ?? doc.form ?? "—"} {doc.tax_year ?? ""}
                        </td>
                        <td data-label="Issuer">{doc.issuer ?? "—"}</td>
                        <td data-label="Status">
                          <StatusChip status={doc.status} />
                        </td>
                        <td className="bw-col-date" data-label="Requested">
                          {fmtDate(doc.requested)}
                        </td>
                        <td className="bw-col-date" data-label="Received">
                          {doc.received ? fmtDate(doc.received) : "—"}
                        </td>
                        <td className="bw-col-num" data-label="Waiting">
                          {status === "requested" ? (
                            <span className={waiting > 14 ? "bw-late" : "bw-num"}>{waiting} days</span>
                          ) : doc.size_kb ? (
                            <span className="bw-num">{count(doc.size_kb)} KB</span>
                          ) : (
                            <span className="bw-muted">—</span>
                          )}
                        </td>
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
