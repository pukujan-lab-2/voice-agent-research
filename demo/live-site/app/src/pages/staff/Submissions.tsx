import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Inbox } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  SelectField,
  SkeletonTable,
  StatusChip,
} from "@/components/staff/ui";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  count,
  fmtWhen,
  humanize,
  readableValue,
  staffGet,
  type Paged,
  type Submission,
} from "@/lib/practice";

const SIZE = 20;

const FORM_LABELS: Record<string, string> = {
  booking: "Consultation request",
  service: "Service request",
  quote: "Quote request",
  ticket: "Support ticket",
  r17: "Form R-17",
  portal: "Portal upload",
  newsletter: "Newsletter",
};

export default function StaffSubmissions() {
  const { get, set, page, setPage } = useUrlState();
  const form = get("form");
  const [openId, setOpenId] = useState("");

  const list = useApi(
    () =>
      staffGet<Paged<Submission>>("/submissions", {
        form: form || undefined,
        page,
        size: SIZE,
      }),
    [form, page],
  );

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;

  return (
    <StaffLayout title="Website submissions">
      <div data-testid="staff-submissions">
        <PageHeader
          title="Website submissions"
          subtitle="Every form people have sent from the public site, newest first."
        />

        <div className="bw-list-toolbar bw-list-toolbar-tight">
          <div className="bw-filter-row">
            <SelectField
              label="Form"
              value={form}
              onChange={(v) => set({ form: v })}
              options={[
                { value: "", label: "Every form" },
                { value: "booking", label: "Consultation requests" },
                { value: "service", label: "Service requests" },
                { value: "quote", label: "Quote requests" },
                { value: "ticket", label: "Support tickets" },
              ]}
            />
          </div>
        </div>

        <p className="bw-list-summary" data-copilot-summary>
          {list.data
            ? `${count(total)} ${total === 1 ? "submission" : "submissions"}${form ? ` from the ${FORM_LABELS[form]?.toLowerCase() ?? form} form` : ""}`
            : "Loading submissions…"}
        </p>

        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : list.loading && !list.data ? (
          <SkeletonTable rows={8} cols={4} />
        ) : rows.length === 0 ? (
          <EmptyState>No submissions yet.</EmptyState>
        ) : (
          <>
            <ul className="bw-submissions">
              {rows.map((s) => {
                const open = openId === s.id;
                return (
                  <li key={s.id} className={open ? "bw-submission open" : "bw-submission"}>
                    <button
                      type="button"
                      className="bw-submission-head"
                      onClick={() => setOpenId(open ? "" : s.id)}
                      aria-expanded={open}
                    >
                      <span className="bw-submission-icon" aria-hidden="true">
                        <Inbox size={15} />
                      </span>
                      <span className="bw-submission-main">
                        <span className="bw-submission-title">
                          {FORM_LABELS[s.form] ?? s.form} <span className="bw-mono bw-muted">{s.ref}</span>
                        </span>
                        <span className="bw-submission-meta">
                          {fmtWhen(s.created)}
                          {s.client_ref ? ` · ${s.client_ref}` : ""}
                        </span>
                      </span>
                      <StatusChip status={s.status} />
                      <ChevronDown size={15} className={open ? "bw-chev open" : "bw-chev"} aria-hidden="true" />
                    </button>

                    {open && (
                      <div className="bw-submission-body">
                        {s.data && Object.keys(s.data).length > 0 ? (
                          <dl className="bw-submission-fields">
                            {Object.entries(s.data).map(([key, value]) => (
                              <div key={key}>
                                <dt>{humanize(key)}</dt>
                                <dd>{readableValue(value)}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <EmptyState>This submission has no readable fields.</EmptyState>
                        )}
                        {s.client_ref ? (
                          <Link to={`/staff/clients/${s.client_ref}`} className="bw-link bw-small">
                            Open the client →
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

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
