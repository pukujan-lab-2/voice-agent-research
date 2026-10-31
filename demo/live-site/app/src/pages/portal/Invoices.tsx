import { useState } from "react";
import { PortalLayout, SampleNote } from "@/components/portal/PortalLayout";
import { PortalCard, PortalEmpty, PortalError, PortalHead, PortalSkeleton, PortalStatus } from "@/components/portal/ui";
import { useApi } from "@/hooks/useApi";
import { daysUntil, fmtDate, fmtWhen, portalGet, usd, type PortalInvoice } from "@/lib/practice";

export default function PortalInvoices() {
  const invoices = useApi(() => portalGet<{ invoices: PortalInvoice[] }>("/invoices"), []);
  const [payNote, setPayNote] = useState("");

  const rows = invoices.data?.invoices ?? [];
  const outstanding = rows
    .filter((i) => i.status !== "paid")
    .reduce((sum, i) => sum + (i.amount_cents - (i.paid_cents ?? 0)), 0);

  return (
    <PortalLayout title="Invoices">
      <div className="pt-page" data-testid="portal-invoices">
        <PortalHead
          title="Invoices"
          subtitle={
            outstanding > 0 ? `${usd(outstanding)} outstanding across your account.` : "Everything is paid up to date."
          }
        />

        {invoices.error ? <PortalError message={invoices.error} onRetry={invoices.reload} /> : null}

        {payNote ? (
          <p className="pt-pay-note" role="status">
            {payNote}
          </p>
        ) : null}

        {!invoices.data && invoices.loading ? (
          <PortalSkeleton rows={4} />
        ) : rows.length === 0 ? (
          <PortalCard>
            <PortalEmpty>No invoices yet.</PortalEmpty>
          </PortalCard>
        ) : (
          rows.map((inv) => {
            const due = inv.amount_cents - (inv.paid_cents ?? 0);
            const late = (daysUntil(inv.due) ?? 0) < 0 && inv.status !== "paid";
            return (
              <PortalCard key={inv.id} className="pt-invoice">
                <div className="pt-invoice-head">
                  <div>
                    <p className="pt-invoice-number">{inv.number}</p>
                    <p className="pt-invoice-dates">
                      Issued {fmtDate(inv.issued)} · Due{" "}
                      <span className={late ? "pt-late" : ""}>{fmtDate(inv.due)}</span>
                    </p>
                  </div>
                  <div className="pt-invoice-right">
                    <PortalStatus status={inv.status} />
                    <span className="pt-invoice-total">{usd(inv.amount_cents)}</span>
                  </div>
                </div>

                {inv.lines.length > 0 && (
                  <table className="pt-invoice-lines">
                    <tbody>
                      {inv.lines.map((line, i) => (
                        <tr key={i}>
                          <td>{line.description}</td>
                          <td className="pt-num">{usd(line.amount_cents)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Total</td>
                        <td className="pt-num">{usd(inv.amount_cents)}</td>
                      </tr>
                      {inv.payments.length > 0 && (
                        <tr>
                          <td>Paid</td>
                          <td className="pt-num pt-paid">−{usd(inv.paid_cents)}</td>
                        </tr>
                      )}
                      {due > 0 && (
                        <tr className="pt-invoice-due">
                          <td>Still due</td>
                          <td className="pt-num">{usd(due)}</td>
                        </tr>
                      )}
                    </tfoot>
                  </table>
                )}

                {inv.payments.length > 0 && (
                  <ul className="pt-payments">
                    {inv.payments.map((p, i) => (
                      <li key={i}>
                        {fmtWhen(p.paid)} · {p.method ?? "Payment"} · {usd(p.amount_cents)}
                      </li>
                    ))}
                  </ul>
                )}

                {inv.status !== "paid" && (
                  <button
                    type="button"
                    className="pt-btn pt-btn-primary pt-btn-sm"
                    onClick={() => setPayNote("Online payment is turned off in this demo.")}
                  >
                    Pay {usd(due)}
                  </button>
                )}
              </PortalCard>
            );
          })
        )}

        <SampleNote />
      </div>
    </PortalLayout>
  );
}
