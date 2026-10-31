import { useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
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
  fmtWhen,
  staffGet,
  usd,
  type Paged,
  type StaffInvoice,
} from "@/lib/practice";

const SIZE = 25;

export default function StaffBilling() {
  const { get, set, page, setPage } = useUrlState({ status: "all" });
  const status = get("status") || "all";
  const q = get("q");
  const [search, setSearch] = useUrlSearch(q, (v) => set({ q: v }));
  const [openId, setOpenId] = useState("");

  const list = useApi(
    () =>
      staffGet<Paged<StaffInvoice>>("/invoices", {
        status: status === "all" ? undefined : status,
        q: q || undefined,
        page,
        size: SIZE,
      }),
    [status, q, page],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const sum = rows.reduce(
    (acc, inv) => {
      acc.amount += inv.amount_cents;
      acc.paid += inv.paid_cents ?? 0;
      return acc;
    },
    { amount: 0, paid: 0 },
  );

  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <StaffLayout title="Billing">
      <div data-testid="staff-billing">
        <PageHeader title="Billing" subtitle="Invoices, what has been paid and what is outstanding." />

        <div className="bw-list-toolbar">
          <Segmented
            label="Invoice status"
            value={status as "all" | "open" | "overdue" | "partial" | "paid"}
            onChange={(v) => set({ status: v === "all" ? "" : v })}
            options={[
              { value: "all", label: "All" },
              { value: "open", label: "Open" },
              { value: "overdue", label: "Overdue" },
              { value: "partial", label: "Partial" },
              { value: "paid", label: "Paid" },
            ]}
          />
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Search by client or invoice number"
            label="Search invoices"
          />
        </div>

        <p className="bw-list-summary" data-copilot-summary>
          {list.data
            ? `${count(total)} ${total === 1 ? "invoice" : "invoices"}${status !== "all" ? `, ${status}` : ""}${
                q ? ` matching ${q}` : ""
              }`
            : "Loading invoices…"}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={10} cols={6} />
        ) : rows.length === 0 ? (
          <EmptyState>
            {q ? `No invoices match “${q}”.` : "No invoices with this status."}
          </EmptyState>
        ) : (
          <>
            <div className="bw-table-wrap">
              <table className="bw-table bw-table-hover">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th className="bw-col-name">Client</th>
                    <th>Issued</th>
                    <th>Due</th>
                    <th className="bw-col-num">Amount</th>
                    <th className="bw-col-num">Paid</th>
                    <th className="bw-col-num">Outstanding</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((inv) => {
                    const outstanding = inv.amount_cents - (inv.paid_cents ?? 0);
                    const late = (daysUntil(inv.due) ?? 0) < 0 && inv.status !== "paid";
                    return (
                      <tr key={inv.id} className="bw-row-click" onClick={() => setOpenId(inv.id)}>
                        <td className="bw-mono" data-label="Invoice">
                          {inv.number}
                        </td>
                        <td className="bw-col-name">
                          <Link
                            to={`/staff/clients/${inv.client_ref}?tab=billing`}
                            className="bw-row-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {inv.client_name}
                          </Link>
                          <span className="bw-row-sub bw-mono">{inv.client_ref}</span>
                        </td>
                        <td data-label="Issued">{fmtDate(inv.issued)}</td>
                        <td className={late ? "bw-late" : ""} data-label="Due">
                          {fmtDate(inv.due)}
                        </td>
                        <td className="bw-col-num bw-num" data-label="Amount">
                          {usd(inv.amount_cents)}
                        </td>
                        <td className="bw-col-num bw-num" data-label="Paid">
                          {usd(inv.paid_cents)}
                        </td>
                        <td className="bw-col-num bw-num" data-label="Outstanding">
                          {usd(outstanding)}
                        </td>
                        <td data-label="Status">
                          <StatusChip status={inv.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4} className="bw-tfoot-label">
                      Totals on this page
                    </td>
                    <td className="bw-col-num bw-num">{usd(sum.amount)}</td>
                    <td className="bw-col-num bw-num">{usd(sum.paid)}</td>
                    <td className="bw-col-num bw-num">{usd(sum.amount - sum.paid)}</td>
                    <td />
                  </tr>
                </tfoot>
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

        {open && <InvoiceSheet invoice={open} onClose={() => setOpenId("")} />}
      </div>
    </StaffLayout>
  );
}

/** A side sheet with the invoice's lines and payments. */
function InvoiceSheet({ invoice, onClose }: { invoice: StaffInvoice; onClose: () => void }) {
  const outstanding = invoice.amount_cents - (invoice.paid_cents ?? 0);
  return (
    <>
      <button className="bw-scrim" aria-label="Close the invoice" onClick={onClose} />
      <aside className="bw-sheet" role="dialog" aria-modal="true" aria-label={`Invoice ${invoice.number}`}>
        <header className="bw-sheet-head">
          <div>
            <p className="bw-sheet-eyebrow">Invoice</p>
            <h2 className="bw-sheet-title bw-mono">{invoice.number}</h2>
            <p className="bw-muted bw-small">
              <Link to={`/staff/clients/${invoice.client_ref}?tab=billing`} className="bw-link">
                {invoice.client_name}
              </Link>{" "}
              · {fmtDate(invoice.issued)} · due {fmtDate(invoice.due)}
            </p>
          </div>
          <button type="button" className="bw-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="bw-sheet-body">
          <div className="bw-sheet-status">
            <StatusChip status={invoice.status} />
            <span className="bw-sheet-total bw-num">{usd(invoice.amount_cents)}</span>
          </div>

          <h3 className="bw-sheet-sub">Lines</h3>
          {(invoice.lines ?? []).length === 0 ? (
            <EmptyState>No lines on this invoice.</EmptyState>
          ) : (
            <table className="bw-table bw-table-compact">
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="bw-col-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lines ?? []).map((line, i) => (
                  <tr key={i}>
                    <td>{line.description}</td>
                    <td className="bw-col-num bw-num">{usd(line.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h3 className="bw-sheet-sub">Payments</h3>
          {(invoice.payments ?? []).length === 0 ? (
            <EmptyState>Nothing has been paid on this invoice yet.</EmptyState>
          ) : (
            <table className="bw-table bw-table-compact">
              <thead>
                <tr>
                  <th>Paid</th>
                  <th>Method</th>
                  <th className="bw-col-num">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.payments ?? []).map((p, i) => (
                  <tr key={i}>
                    <td>{fmtWhen(p.paid)}</td>
                    <td className="bw-muted">{p.method ?? "—"}</td>
                    <td className="bw-col-num bw-num">{usd(p.amount_cents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="bw-sheet-foot">
            <div>
              <span className="bw-stat-label">Paid</span>
              <span className="bw-sheet-figure bw-num">{usd(invoice.paid_cents)}</span>
            </div>
            <div>
              <span className="bw-stat-label">Outstanding</span>
              <span className="bw-sheet-figure bw-num bw-warn-text">{usd(outstanding)}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
