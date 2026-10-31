import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Building2, Users, Mail, Phone, MapPin, ArrowLeft, ScrollText } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  Button,
  Card,
  CodeChip,
  EmptyState,
  ErrorState,
  Field,
  FormErrorSummary,
  MissingDocs,
  PageHeader,
  PriorityDot,
  SkeletonBlock,
  SkeletonTable,
  StageChip,
  StatusChip,
  Toast,
  fieldAria,
} from "@/components/staff/ui";
import { Modal } from "@/components/staff/dialogs";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  STAGES,
  count,
  daysUntil,
  errorText,
  fieldErrors,
  fmtDate,
  fmtTime,
  fmtWhen,
  getStaffToken,
  staffGet,
  staffPost,
  stageLabel,
  usd,
  type ClientDetail,
  type EngagementRow,
  type Message,
  type StaffThread,
} from "@/lib/practice";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "engagements", label: "Engagements" },
  { id: "documents", label: "Documents" },
  { id: "notices", label: "Notices" },
  { id: "billing", label: "Billing" },
  { id: "messages", label: "Messages" },
  { id: "appointments", label: "Appointments" },
  { id: "tasks", label: "Tasks" },
  { id: "payroll", label: "Payroll" },
  { id: "activity", label: "Activity" },
];

export default function StaffClientDetail() {
  const { id = "" } = useParams();
  const { get, set } = useUrlState({ tab: "overview" });
  const tab = get("tab") || "overview";
  const [toast, setToast] = useState("");

  const detail = useApi(() => staffGet<ClientDetail>("/client", { id }), [id]);
  const data = detail.data;

  if (!getStaffToken()) return null;

  const client = data?.client;
  const tabs = TABS.filter((t) => t.id !== "payroll" || data?.kind === "business" || (data?.payroll?.length ?? 0) > 0);

  return (
    <StaffLayout title={client?.name ?? "Client"}>
      <div data-testid="staff-client-detail">
        <Link to="/staff/clients" className="bw-back">
          <ArrowLeft size={13} aria-hidden="true" /> Clients
        </Link>

        {detail.error ? (
          <ErrorState message={detail.error} onRetry={detail.reload} />
        ) : !data ? (
          <>
            <SkeletonBlock h={92} />
            <div style={{ height: 12 }} />
            <SkeletonTable rows={8} cols={5} />
          </>
        ) : (
          <>
            <div className="bw-client-head">
              <div className="bw-client-head-main">
                <span className="bw-client-kind" aria-hidden="true">
                  {data.kind === "business" ? <Building2 size={18} /> : <Users size={18} />}
                </span>
                <div>
                  <h1 className="bw-page-title">{client?.name}</h1>
                  <p className="bw-client-meta">
                    <span className="bw-mono">{client?.id}</span>
                    <span className="bw-dot-sep" aria-hidden="true">·</span>
                    <span className="bw-cap">{data.kind}</span>
                    {client?.city ? (
                      <>
                        <span className="bw-dot-sep" aria-hidden="true">·</span>
                        <span>
                          <MapPin size={11} aria-hidden="true" /> {client.street ? `${client.street}, ` : ""}
                          {client.city}, {client.state} {client.zip}
                        </span>
                      </>
                    ) : null}
                  </p>
                  <p className="bw-client-meta">
                    <span>Preparer: {client?.preparer_name ?? "Unassigned"}</span>
                    {client?.since ? (
                      <>
                        <span className="bw-dot-sep" aria-hidden="true">·</span>
                        <span>Client since {fmtDate(client.since)}</span>
                      </>
                    ) : null}
                    {client?.office ? (
                      <>
                        <span className="bw-dot-sep" aria-hidden="true">·</span>
                        <span>{client.office}</span>
                      </>
                    ) : null}
                  </p>
                  <div className="bw-tags bw-tags-top">
                    {(client?.tags ?? []).map((t) => (
                      <span className="bw-tag" key={t}>
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bw-client-totals">
                <div>
                  <span className="bw-stat-label">Billed</span>
                  <span className="bw-stat-value bw-stat-value-sm">{usd(data.totals.billed)}</span>
                </div>
                <div>
                  <span className="bw-stat-label">Paid</span>
                  <span className="bw-stat-value bw-stat-value-sm">{usd(data.totals.paid)}</span>
                </div>
                <div>
                  <span className="bw-stat-label">Outstanding</span>
                  <span className="bw-stat-value bw-stat-value-sm bw-warn-text">
                    {usd(data.totals.outstanding)}
                  </span>
                </div>
                <div>
                  <span className="bw-stat-label">Open notices</span>
                  <span className="bw-stat-value bw-stat-value-sm">{count(data.totals.openNotices)}</span>
                </div>
                <div>
                  <span className="bw-stat-label">Missing documents</span>
                  <span className="bw-stat-value bw-stat-value-sm">{count(data.totals.missingDocs)}</span>
                </div>
              </div>
            </div>

            <div className="bw-tabs" role="tablist" aria-label="Client">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={tab === t.id ? "bw-tab active" : "bw-tab"}
                  data-testid="staff-client-tab"
                  onClick={() => set({ tab: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <Toast message={toast} />

            {tab === "overview" && <Overview detail={data} />}
            {tab === "engagements" && <Engagements detail={data} onDone={setToast} />}
            {tab === "documents" && <Documents detail={data} onDone={setToast} reload={detail.reload} />}
            {tab === "notices" && <Notices detail={data} />}
            {tab === "billing" && <Billing detail={data} />}
            {tab === "messages" && <Messages detail={data} onDone={setToast} />}
            {tab === "appointments" && <Appointments detail={data} />}
            {tab === "tasks" && <Tasks detail={data} onDone={setToast} />}
            {tab === "payroll" && <Payroll detail={data} />}
            {tab === "activity" && <Activity detail={data} />}
          </>
        )}
      </div>
    </StaffLayout>
  );
}

/* ---------- Overview ---------- */

function Overview({ detail }: { detail: ClientDetail }) {
  const c = detail.client;
  const isBusiness = detail.kind === "business";

  return (
    <div className="bw-detail-grid">
      <Card>
        <h2 className="bw-card-title">{isBusiness ? "Business" : "Household"}</h2>
        <dl className="bw-deflist">
          {isBusiness ? (
            <>
              <div>
                <dt>EIN</dt>
                <dd className="bw-mono">{c.ein ?? "—"}</dd>
              </div>
              <div>
                <dt>Entity</dt>
                <dd>{c.entity ?? c.detail ?? "—"}</dd>
              </div>
              <div>
                <dt>Industry</dt>
                <dd>{c.industry ?? "—"}</dd>
              </div>
              <div>
                <dt>Employees</dt>
                <dd className="bw-num">{count(c.employees)}</dd>
              </div>
              <div>
                <dt>Fiscal year end</dt>
                <dd>{c.fiscal_year_end ? fmtDate(c.fiscal_year_end) : "—"}</dd>
              </div>
              <div>
                <dt>Owner</dt>
                <dd>{c.owner ?? "—"}</dd>
              </div>
            </>
          ) : (
            <>
              <div>
                <dt>Filing status</dt>
                <dd>{c.filing_status ?? c.detail ?? "—"}</dd>
              </div>
              <div>
                <dt>People in the household</dt>
                <dd className="bw-num">{detail.people.length || count(c.people)}</dd>
              </div>
              <div>
                <dt>Dependents</dt>
                <dd className="bw-num">{count(c.dependents)}</dd>
              </div>
            </>
          )}
          <div>
            <dt>Preparer</dt>
            <dd>{c.preparer_name ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt>Office</dt>
            <dd>{c.office ?? "—"}</dd>
          </div>
          <div>
            <dt>Client since</dt>
            <dd>{fmtDate(c.since)}</dd>
          </div>
          {c.email ? (
            <div>
              <dt>Email</dt>
              <dd>
                <a className="bw-link" href={`mailto:${c.email}`}>
                  <Mail size={11} aria-hidden="true" /> {c.email}
                </a>
              </dd>
            </div>
          ) : null}
          {c.phone ? (
            <div>
              <dt>Phone</dt>
              <dd>
                <Phone size={11} aria-hidden="true" /> {c.phone}
              </dd>
            </div>
          ) : null}
        </dl>
      </Card>

      <div className="bw-detail-stack">
        {detail.people.length > 0 && (
          <Card>
            <h2 className="bw-card-title">People</h2>
            <table className="bw-table bw-table-compact">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relation</th>
                  <th className="bw-col-num">Age</th>
                </tr>
              </thead>
              <tbody>
                {detail.people.map((p, i) => (
                  <tr key={p.id ?? `${p.full_name}-${i}`}>
                    <td>{p.full_name ?? p.name ?? `${p.first_name ?? ""}`}</td>
                    <td className="bw-muted">{p.relation ?? "—"}</td>
                    <td className="bw-col-num bw-num">{p.age ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        <Card>
          <h2 className="bw-card-title">Related</h2>
          {detail.related.length === 0 ? (
            <EmptyState>No related households or businesses on file.</EmptyState>
          ) : (
            <ul className="bw-link-list">
              {detail.related.map((r, i) => {
                const ref = r.id ?? r.ref ?? "";
                return (
                  <li key={`${ref}-${i}`}>
                    <Link to={`/staff/clients/${ref}`} className="bw-link">
                      {r.name ?? ref}
                    </Link>
                    <span className="bw-muted">
                      {" "}
                      · {r.relation ?? r.kind ?? ""} · <span className="bw-mono">{ref}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <h2 className="bw-card-title">Recent activity</h2>
          {detail.activity.length === 0 ? (
            <EmptyState>Nothing has been logged for this client yet.</EmptyState>
          ) : (
            <ul className="bw-timeline">
              {detail.activity.slice(0, 6).map((a) => (
                <li key={a.id}>
                  <span className="bw-timeline-when">{fmtWhen(a.at)}</span>
                  <span className="bw-timeline-text">
                    <strong>{a.actor_name ?? a.actor}</strong> {a.action} {a.entity}
                    {a.detail ? <span className="bw-muted"> — {a.detail}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ---------- Engagements ---------- */

function Engagements({ detail, onDone }: { detail: ClientDetail; onDone: (m: string) => void }) {
  const [saving, setSaving] = useState<string>("");
  const [error, setError] = useState("");

  const move = async (row: EngagementRow, stage: string) => {
    setSaving(row.id);
    setError("");
    try {
      await staffPost("/stage", { id: row.id, stage });
      onDone(`${row.form} ${row.tax_year} moved to ${stageLabel(stage).toLowerCase()}.`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving("");
    }
  };

  return (
    <Card>
      {error ? <ErrorState message={error} compact /> : null}
      {detail.engagements.length === 0 ? (
        <EmptyState>No engagements on file. Start one from the New menu.</EmptyState>
      ) : (
        <div className="bw-table-wrap">
          <table className="bw-table bw-table-hover">
            <thead>
              <tr>
                <th>Engagement</th>
                <th>Form</th>
                <th>Year</th>
                <th>Preparer</th>
                <th>Due</th>
                <th className="bw-col-num">Fee</th>
                <th>Stage</th>
                <th>Move to</th>
              </tr>
            </thead>
            <tbody>
              {detail.engagements.map((row) => (
                <tr key={row.id}>
                  <td>
                    <span className="bw-cell-name">{row.kind}</span>
                    <span className="bw-row-sub bw-mono">{row.id}</span>
                  </td>
                  <td className="bw-num-cell">{row.form}</td>
                  <td className="bw-num-cell">{row.tax_year}</td>
                  <td>{row.preparer_name}</td>
                  <td className={(daysUntil(row.due) ?? 0) < 0 ? "bw-late" : ""}>{fmtDate(row.due)}</td>
                  <td className="bw-col-num bw-num">{usd(row.fee_cents)}</td>
                  <td>
                    <div className="bw-stage-cell">
                      <StageChip stage={row.stage} />
                      {row.missing ? <MissingDocs n={row.missing} /> : null}
                    </div>
                  </td>
                  <td>
                    <select
                      className="bw-inline-select"
                      value=""
                      aria-label={`Move ${row.form} ${row.tax_year} to another stage`}
                      disabled={saving === row.id}
                      onChange={(e) => {
                        if (e.target.value) void move(row, e.target.value);
                      }}
                    >
                      <option value="">Move…</option>
                      {STAGES.filter((s) => s.id !== row.stage).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="bw-card-foot">
        <Link
          to={`/staff/engagements/new?client=${encodeURIComponent(detail.client.id)}`}
          className="bw-btn bw-btn-quiet bw-btn-sm"
        >
          Start a new engagement
        </Link>
      </div>
    </Card>
  );
}

/* ---------- Documents ---------- */

function Documents({
  detail,
  onDone,
  reload,
}: {
  detail: ClientDetail;
  onDone: (m: string) => void;
  reload: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [form, setForm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const engagementId = detail.engagements[0]?.id ?? "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      await staffPost("/doc-request", { engagement_id: engagementId, name: name.trim(), form });
      setOpen(false);
      setName("");
      setForm("");
      onDone("Document requested from the client.");
      reload();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <div className="bw-card-head">
        <h2 className="bw-card-title">Documents</h2>
        <Button size="sm" onClick={() => setOpen(true)} disabled={!engagementId}>
          Request document
        </Button>
      </div>
      {detail.documents.length === 0 ? (
        <EmptyState>No documents requested or received yet.</EmptyState>
      ) : (
        <div className="bw-table-wrap">
          <table className="bw-table bw-table-hover">
            <thead>
              <tr>
                <th>Document</th>
                <th>For</th>
                <th>Status</th>
                <th>Requested</th>
                <th>Received</th>
                <th className="bw-col-num">Waiting</th>
              </tr>
            </thead>
            <tbody>
              {detail.documents.map((doc) => (
                <tr key={doc.id}>
                  <td>
                    <span className="bw-cell-name">{doc.name}</span>
                    {doc.issuer ? <span className="bw-row-sub">{doc.issuer}</span> : null}
                  </td>
                  <td className="bw-muted">
                    {doc.engagement_form ?? doc.form ?? "—"} {doc.tax_year ?? ""}
                  </td>
                  <td>
                    <StatusChip status={doc.status} />
                  </td>
                  <td>{fmtDate(doc.requested)}</td>
                  <td>{doc.received ? fmtDate(doc.received) : "—"}</td>
                  <td className="bw-col-num">
                    {doc.days_waiting ? (
                      <span className={doc.days_waiting > 14 ? "bw-late" : "bw-num"}>
                        {doc.days_waiting} days
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {open && (
        <Modal title="Request a document" onClose={() => setOpen(false)}>
          <form onSubmit={submit} className="bw-form" noValidate>
            {formError && Object.keys(errors).length > 0 && <FormErrorSummary errors={errors} />}
            {formError && Object.keys(errors).length === 0 && (
              <p className="bw-inline-error" role="alert">
                {formError}
              </p>
            )}
            <Field label="Document" htmlFor="doc_name" error={errors.name}>
              <input
                id="doc_name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 2025 W-2 from Larkspur Holdings"
                {...fieldAria("doc_name", errors.name)}
              />
            </Field>
            <Field label="For which form" htmlFor="doc_form" error={errors.form}>
              <select
                id="doc_form"
                value={form}
                onChange={(e) => setForm(e.target.value)}
                {...fieldAria("doc_form", errors.form)}
              >
                <option value="">Choose one</option>
                {Array.from(new Set(detail.engagements.map((e) => e.form))).map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <div className="bw-modal-foot">
              <Button variant="quiet" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Requesting…" : "Request document"}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </Card>
  );
}

/* ---------- Notices ---------- */

function Notices({ detail }: { detail: ClientDetail }) {
  return (
    <Card>
      {detail.notices.length === 0 ? (
        <EmptyState>No IRS notices for this client.</EmptyState>
      ) : (
        <div className="bw-table-wrap">
          <table className="bw-table bw-table-hover">
            <thead>
              <tr>
                <th>Code</th>
                <th>Notice</th>
                <th>Year</th>
                <th className="bw-col-num">Amount</th>
                <th>Response due</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.notices.map((n) => {
                const left = n.days_left ?? daysUntil(n.response_due) ?? 0;
                return (
                  <tr key={n.id}>
                    <td>
                      <CodeChip code={n.code} />
                    </td>
                    <td>{n.title}</td>
                    <td className="bw-num-cell">{n.tax_year ?? "—"}</td>
                    <td className="bw-col-num bw-num">{usd(n.amount_cents)}</td>
                    <td className={left < 7 ? "bw-late" : left < 14 ? "bw-amber" : ""}>
                      {fmtDate(n.response_due)}
                      <span className="bw-row-sub">{left < 0 ? `${Math.abs(left)} days late` : `${left} days left`}</span>
                    </td>
                    <td>
                      <StatusChip status={n.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- Billing ---------- */

function Billing({ detail }: { detail: ClientDetail }) {
  return (
    <Card>
      {detail.invoices.length === 0 ? (
        <EmptyState>No invoices for this client.</EmptyState>
      ) : (
        <div className="bw-table-wrap">
          <table className="bw-table bw-table-hover">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Issued</th>
                <th>Due</th>
                <th className="bw-col-num">Amount</th>
                <th className="bw-col-num">Paid</th>
                <th className="bw-col-num">Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {detail.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="bw-mono">{inv.number}</td>
                  <td>{fmtDate(inv.issued)}</td>
                  <td className={(daysUntil(inv.due) ?? 0) < 0 && inv.status !== "paid" ? "bw-late" : ""}>
                    {fmtDate(inv.due)}
                  </td>
                  <td className="bw-col-num bw-num">{usd(inv.amount_cents)}</td>
                  <td className="bw-col-num bw-num">{usd(inv.paid_cents)}</td>
                  <td className="bw-col-num bw-num">{usd(inv.amount_cents - (inv.paid_cents ?? 0))}</td>
                  <td>
                    <StatusChip status={inv.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- Messages ---------- */

function Messages({ detail, onDone }: { detail: ClientDetail; onDone: (m: string) => void }) {
  const [openId, setOpenId] = useState<string>("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const thread = useApi(
    () =>
      openId
        ? staffGet<{ thread: StaffThread; messages: Message[] }>("/thread", { id: openId })
        : Promise.resolve(null),
    [openId],
  );

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await staffPost("/message", { thread: openId, client_ref: detail.client.id, body: body.trim() });
      setBody("");
      thread.reload();
      onDone("Reply sent.");
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bw-split">
      <Card>
        <h2 className="bw-card-title">Threads</h2>
        {detail.threads.length === 0 ? (
          <EmptyState>No messages with this client yet.</EmptyState>
        ) : (
          <ul className="bw-thread-list">
            {detail.threads.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={openId === t.id ? "bw-thread-item active" : "bw-thread-item"}
                  onClick={() => setOpenId(t.id)}
                >
                  <span className="bw-thread-subject">{t.subject}</span>
                  <span className="bw-thread-meta">
                    {t.updated ? fmtDate(t.updated) : ""}
                    {t.unread_staff ? <span className="bw-unread-dot" aria-label="unread" /> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        {!openId ? (
          <EmptyState>Choose a thread to read it.</EmptyState>
        ) : thread.error ? (
          <ErrorState message={thread.error} onRetry={thread.reload} compact />
        ) : thread.loading && !thread.data ? (
          <SkeletonBlock h={160} />
        ) : (
          <>
            <h2 className="bw-card-title">{thread.data?.thread.subject}</h2>
            <ul className="bw-convo">
              {(thread.data?.messages ?? []).map((m) => {
                const fromStaff = m.sender.startsWith("st-");
                return (
                  <li key={m.id} className={fromStaff ? "bw-msg bw-msg-staff" : "bw-msg bw-msg-client"}>
                    <span className="bw-msg-who">
                      {m.sender_name ?? m.sender} · {fmtWhen(m.sent)}
                    </span>
                    <p className="bw-msg-body">{m.body}</p>
                  </li>
                );
              })}
            </ul>
            {error ? <ErrorState message={error} compact /> : null}
            <form onSubmit={reply} className="bw-reply">
              <label className="bw-visually-hidden" htmlFor="client-reply">
                Reply
              </label>
              <textarea
                id="client-reply"
                rows={3}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a reply to the client…"
              />
              <Button type="submit" disabled={sending || !body.trim()}>
                {sending ? "Sending…" : "Send reply"}
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}

/* ---------- Appointments ---------- */

function Appointments({ detail }: { detail: ClientDetail }) {
  return (
    <Card>
      {detail.appointments.length === 0 ? (
        <EmptyState>No appointments booked with this client.</EmptyState>
      ) : (
        <ul className="bw-appt-cards">
          {detail.appointments.map((a) => (
            <li key={a.id}>
              <div className="bw-appt-card-when">
                <span className="bw-appt-card-date">{fmtDate(a.starts)}</span>
                <span className="bw-appt-card-time">{fmtTime(a.starts)}</span>
              </div>
              <div>
                <p className="bw-appt-card-kind">{a.kind}</p>
                <p className="bw-appt-meta">
                  {a.minutes} minutes · {a.mode}
                  {a.staff_name ? ` · ${a.staff_name}` : ""}
                  {a.location ? ` · ${a.location}` : ""}
                </p>
                {a.notes ? <p className="bw-muted bw-small">{a.notes}</p> : null}
              </div>
              {a.status ? <StatusChip status={a.status} /> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ---------- Tasks ---------- */

function Tasks({ detail, onDone }: { detail: ClientDetail; onDone: (m: string) => void }) {
  const [saving, setSaving] = useState("");

  const setStatus = async (id: string, status: string) => {
    setSaving(id);
    try {
      await staffPost("/task-status", { id, status });
      onDone(status === "done" ? "Task marked done." : "Task updated.");
    } catch {
      /* the toast is enough here: the row keeps its state until the next load */
    } finally {
      setSaving("");
    }
  };

  return (
    <Card>
      {detail.tasks.length === 0 ? (
        <EmptyState>No tasks for this client.</EmptyState>
      ) : (
        <table className="bw-table bw-table-hover">
          <thead>
            <tr>
              <th className="bw-col-check" aria-label="Done" />
              <th>Task</th>
              <th>Assignee</th>
              <th>Due</th>
              <th>Status</th>
              <th className="bw-col-num">Priority</th>
            </tr>
          </thead>
          <tbody>
            {detail.tasks.map((t) => (
              <tr key={t.id}>
                <td className="bw-col-check">
                  <input
                    type="checkbox"
                    checked={t.status === "done"}
                    disabled={saving === t.id}
                    onChange={(e) => void setStatus(t.id, e.target.checked ? "done" : "open")}
                    aria-label={`Mark ${t.title} done`}
                  />
                </td>
                <td>{t.title}</td>
                <td>{t.assignee_name ?? t.assignee}</td>
                <td className={(daysUntil(t.due) ?? 0) < 0 && t.status !== "done" ? "bw-late" : ""}>
                  {fmtDate(t.due)}
                </td>
                <td>
                  <StatusChip status={t.status} />
                </td>
                <td className="bw-col-num">
                  <PriorityDot priority={t.priority} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/* ---------- Payroll ---------- */

function Payroll({ detail }: { detail: ClientDetail }) {
  const runs = detail.payroll ?? [];
  return (
    <Card>
      <div className="bw-card-head">
        <h2 className="bw-card-title">Payroll</h2>
        <span className="bw-muted bw-small">{runs.length} pay runs on file</span>
      </div>
      {runs.length === 0 ? (
        <EmptyState>No payroll for this business.</EmptyState>
      ) : (
        <div className="bw-table-wrap">
          <table className="bw-table bw-table-hover">
            <thead>
              <tr>
                {Object.keys(runs[0]).map((key) => (
                  <th key={key} className={key.endsWith("_cents") ? "bw-col-num" : ""}>
                    {key.replace(/_/g, " ").replace(/\bcents\b/, "")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run, i) => (
                <tr key={String(run.id ?? i)}>
                  {Object.entries(run).map(([key, value]) => (
                    <td key={key} className={key.endsWith("_cents") ? "bw-col-num bw-num" : ""}>
                      {key.endsWith("_cents")
                        ? usd(value as number)
                        : key.includes("date") || key.includes("period")
                          ? fmtDate(String(value ?? ""))
                          : String(value ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ---------- Activity ---------- */
function Activity({ detail }: { detail: ClientDetail }) {
  return (
    <Card>
      <h2 className="bw-card-title">
        <ScrollText size={14} aria-hidden="true" /> Activity
      </h2>
      {detail.activity.length === 0 ? (
        <EmptyState>Nothing has been logged for this client yet.</EmptyState>
      ) : (
        <table className="bw-table bw-table-compact">
          <thead>
            <tr>
              <th className="bw-col-time">When</th>
              <th>Who</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {detail.activity.map((a) => (
              <tr key={a.id}>
                <td className="bw-mono bw-col-time">{fmtWhen(a.at)}</td>
                <td>{a.actor_name ?? a.actor}</td>
                <td>{a.action}</td>
                <td className="bw-muted">
                  {a.entity} {a.entity_id ? <span className="bw-mono">{a.entity_id}</span> : null}
                </td>
                <td className="bw-muted">{a.detail ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
