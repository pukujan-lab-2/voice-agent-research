import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  FormErrorSummary,
  PageHeader,
  fieldAria,
} from "@/components/staff/ui";
import { useApi, useDebounced, useUrlState } from "@/hooks/useApi";
import {
  errorText,
  fieldErrors,
  firstName,
  staffGet,
  staffPost,
  type ClientRecord,
  type FoundClient,
  type StaffProfile,
} from "@/lib/practice";

const KINDS = [
  { value: "Individual return", also: "individual return, personal return, 1040, tax return" },
  { value: "Business return", also: "business return, s corp return, partnership return, corporate return" },
  { value: "Amended return", also: "amended return, amendment, 1040-x, amend" },
  { value: "Prior-year return", also: "prior-year return, prior year, back taxes, late return" },
  { value: "Tax planning", also: "tax planning, planning, projection" },
  { value: "Notice response", also: "notice response, irs notice, notice, letter" },
  { value: "Monthly bookkeeping", also: "bookkeeping, monthly bookkeeping, books" },
  { value: "Payroll", also: "payroll" },
  { value: "Nonprofit return", also: "nonprofit return, 990, exempt organization" },
  { value: "Fiduciary return", also: "fiduciary return, trust return, estate return, 1041" },
];

const FORMS = [
  { value: "1040", also: "1040, ten forty", label: "1040" },
  { value: "1040-X", also: "1040-x, 1040 x, ten forty x", label: "1040-X" },
  { value: "1120-S", also: "1120-s, 1120 s, s corp", label: "1120-S" },
  { value: "1065", also: "1065, partnership", label: "1065" },
  { value: "1120", also: "1120, c corp", label: "1120" },
  { value: "990", also: "990", label: "990" },
  { value: "990-EZ", also: "990-ez, 990 ez", label: "990-EZ" },
  { value: "1041", also: "1041", label: "1041" },
  { value: "941", also: "941", label: "941" },
  { value: "Planning", also: "planning, none, no form", label: "Planning (no form)" },
  { value: "Bookkeeping", also: "bookkeeping", label: "Bookkeeping (no form)" },
  { value: "Notice", also: "notice", label: "Notice (no form)" },
];

const YEARS = [
  { value: "2026", also: "2026, this year, twenty twenty six" },
  { value: "2025", also: "2025, last year, twenty twenty five" },
  { value: "2024", also: "2024, twenty twenty four" },
  { value: "2023", also: "2023, twenty twenty three" },
  { value: "2022", also: "2022, twenty twenty two" },
];

/** The 422's field names map to the form's own ids. */
const FIELD_IDS: Record<string, string> = {
  client_ref: "eng_client",
  eng_client: "eng_client",
  client: "eng_client",
  kind: "eng_kind",
  form: "eng_form",
  tax_year: "eng_year",
  year: "eng_year",
  preparer: "eng_preparer",
  reviewer: "eng_reviewer",
  due: "eng_due",
  fee: "eng_fee",
  notes: "eng_notes",
};

interface Saved {
  id: string;
  clientName: string;
  clientRef: string;
}

export default function NewEngagement() {
  const { get } = useUrlState();
  const prefilled = get("client");

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const [clientRef, setClientRef] = useState(prefilled);
  const [clientLabel, setClientLabel] = useState("");
  const [clientText, setClientText] = useState("");
  const [kind, setKind] = useState("");
  const [form, setForm] = useState("");
  const [year, setYear] = useState("");
  const [preparer, setPreparer] = useState("");
  const [reviewer, setReviewer] = useState("");
  const [due, setDue] = useState("");
  const [fee, setFee] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<Saved | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const debouncedClient = useDebounced(clientText, 250);
  const matches = useApi(
    () =>
      debouncedClient.trim().length >= 2
        ? staffGet<{ matches: FoundClient[] }>("/find", { q: debouncedClient.trim() })
        : Promise.resolve({ matches: [] as FoundClient[] }),
    [debouncedClient],
  );

  // Prefill from ?client=HH-20388 (the client page's Engagements tab links here with it).
  const prefill = useApi(
    () => (prefilled ? staffGet<{ client: ClientRecord }>("/client", { id: prefilled }) : Promise.resolve(null)),
    [prefilled],
  );

  useEffect(() => {
    const found = prefill.data?.client;
    if (found) {
      setClientRef(found.id);
      setClientLabel(found.name);
      setClientText(found.name);
    }
  }, [prefill.data]);

  // When the typed text exactly names one match, take it.
  useEffect(() => {
    const rows = matches.data?.matches ?? [];
    const typed = clientText.trim().toLowerCase();
    if (!typed) return;
    const exact = rows.filter((m) => m.name.toLowerCase() === typed);
    if (exact.length === 1) {
      setClientRef(exact[0].id);
      setClientLabel(exact[0].name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.data]);

  const showMatches =
    !clientRef && clientText.trim().length >= 2 && (matches.data?.matches?.length ?? 0) > 0;

  const errorFor = (name: string) => errors[name] ?? "";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formEl = e.currentTarget;
    if (!formEl.reportValidity()) {
      formEl.classList.add("attempted");
      return;
    }
    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      const res = await staffPost<{ ok: boolean; id: string; message?: string }>("/engagement", {
        client_ref: clientRef,
        kind,
        form,
        tax_year: Number(year),
        preparer,
        reviewer: reviewer || undefined,
        due,
        fee: Number(fee.replace(/,/g, "")),
        notes: notes.trim() || undefined,
      });
      setSaved({
        id: res.id,
        clientName: clientLabel || clientRef,
        clientRef,
      });
    } catch (err) {
      const raw = fieldErrors(err);
      const mapped: Record<string, string> = {};
      for (const [field, message] of Object.entries(raw)) {
        mapped[FIELD_IDS[field] ?? field] = message;
      }
      setErrors(mapped);
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const createAnother = () => {
    setSaved(null);
    setClientRef("");
    setClientLabel("");
    setClientText("");
    setKind("");
    setForm("");
    setYear("");
    setPreparer("");
    setReviewer("");
    setDue("");
    setFee("");
    setNotes("");
    setErrors({});
    setFormError("");
    formRef.current?.classList.remove("attempted");
  };

  return (
    <StaffLayout title="New engagement" copilot="staffEngagement">
      <div className="bw-form-page">
        <PageHeader
          title="New engagement"
          subtitle="Open a return, a planning job, a notice response or a monthly bookkeeping engagement."
        />

        {saved ? (
          <div className="bw-saved" data-testid="staff-saved">
            <CheckCircle2 size={22} aria-hidden="true" />
            <div>
              <h2 className="bw-saved-title">
                Engagement {saved.id} created for {saved.clientName}
              </h2>
              <p className="bw-muted bw-small">
                It is on the pipeline in its first stage. The preparer has been notified.
              </p>
              <div className="bw-saved-links">
                <Link to={`/staff/clients/${saved.clientRef}?tab=engagements`} className="bw-btn bw-btn-primary bw-btn-sm">
                  Open client
                </Link>
                <button type="button" className="bw-btn bw-btn-quiet bw-btn-sm" onClick={createAnother}>
                  Create another
                </button>
              </div>
            </div>
          </div>
        ) : (
          <form
            ref={formRef}
            data-copilot-form
            id="engagement"
            data-testid="staff-engagement-form"
            // busy while the client from ?client= and the staff list load: the copilot reads the form after that
            aria-busy={prefill.loading || staff.loading || (Boolean(prefilled) && !clientLabel && !prefill.error)}
            autoComplete="off"
            className="bw-form-card"
            onSubmit={submit}
            noValidate
          >
            {formError && Object.keys(errors).length > 0 && <FormErrorSummary errors={errors} />}
            {formError && Object.keys(errors).length === 0 && (
              <p className="bw-inline-error" role="alert">
                {formError}
              </p>
            )}

            <fieldset className="bw-fieldset">
              <legend className="bw-legend">Client</legend>

              <div className="bw-field bw-client-field">
                <label htmlFor="eng_client">Client</label>
                <div className="bw-client-input">
                  <Search size={14} aria-hidden="true" />
                  <input
                    id="eng_client"
                    name="eng_client"
                    required
                    data-copilot-ask="Which client is this for? Say the household or business name."
                    placeholder="Start typing a household or business"
                    value={clientText}
                    onChange={(e) => {
                      setClientText(e.target.value);
                      setClientRef("");
                      setClientLabel("");
                    }}
                    autoComplete="off"
                    {...fieldAria("eng_client", errorFor("eng_client"))}
                  />
                </div>
                <input type="hidden" id="eng_client_ref" name="client_ref" value={clientRef} readOnly />
                {errorFor("eng_client") ? (
                  <p className="bw-field-error" id="eng_client-error" role="alert">
                    {errorFor("eng_client")}
                  </p>
                ) : null}

                {clientRef && clientLabel ? (
                  <p className="bw-picked">
                    {clientLabel} · <span className="bw-mono">{clientRef}</span>
                  </p>
                ) : null}

                {showMatches && (
                  <div className="bw-matches">
                    {matches.loading && <p className="bw-search-note">Searching…</p>}
                    {(matches.data?.matches ?? []).slice(0, 6).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        className="bw-match"
                        onClick={() => {
                          setClientRef(m.id);
                          setClientLabel(m.name);
                          setClientText(m.name);
                        }}
                      >
                        <span>{m.name}</span>
                        <span className="bw-muted">
                          {m.id}
                          {m.city ? ` · ${m.city}` : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {matches.error ? <ErrorState message={matches.error} compact /> : null}
              </div>
            </fieldset>

            <fieldset className="bw-fieldset">
              <legend className="bw-legend">Work</legend>

              <div className="bw-form-row bw-form-row-3">
                <div className="bw-field">
                  <label htmlFor="eng_kind">Engagement type</label>
                  <select
                    id="eng_kind"
                    name="kind"
                    required
                    data-copilot-ask="What kind of engagement is it"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    {...fieldAria("eng_kind", errorFor("eng_kind"))}
                  >
                    <option value="">Choose one</option>
                    {KINDS.map((k) => (
                      <option key={k.value} value={k.value} data-copilot-also={k.also}>
                        {k.value}
                      </option>
                    ))}
                  </select>
                  {errorFor("eng_kind") ? (
                    <p className="bw-field-error" id="eng_kind-error" role="alert">
                      {errorFor("eng_kind")}
                    </p>
                  ) : null}
                </div>

                <div className="bw-field">
                  <label htmlFor="eng_form">Form</label>
                  <select
                    id="eng_form"
                    name="form"
                    required
                    data-copilot-ask="Which form"
                    value={form}
                    onChange={(e) => setForm(e.target.value)}
                    {...fieldAria("eng_form", errorFor("eng_form"))}
                  >
                    <option value="">Choose one</option>
                    {FORMS.map((f) => (
                      <option key={f.value} value={f.value} data-copilot-also={f.also}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  {errorFor("eng_form") ? (
                    <p className="bw-field-error" id="eng_form-error" role="alert">
                      {errorFor("eng_form")}
                    </p>
                  ) : null}
                </div>

                <div className="bw-field">
                  <label htmlFor="eng_year">Tax year</label>
                  <select
                    id="eng_year"
                    name="tax_year"
                    required
                    data-copilot-ask="Which tax year"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    {...fieldAria("eng_year", errorFor("eng_year"))}
                  >
                    <option value="">Choose one</option>
                    {YEARS.map((y) => (
                      <option key={y.value} value={y.value} data-copilot-also={y.also}>
                        {y.value}
                      </option>
                    ))}
                  </select>
                  {errorFor("eng_year") ? (
                    <p className="bw-field-error" id="eng_year-error" role="alert">
                      {errorFor("eng_year")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="bw-form-row">
                <div className="bw-field">
                  <label htmlFor="eng_preparer">Preparer</label>
                  <select
                    id="eng_preparer"
                    name="preparer"
                    required
                    data-copilot-ask="Who's preparing it"
                    value={preparer}
                    onChange={(e) => setPreparer(e.target.value)}
                    {...fieldAria("eng_preparer", errorFor("eng_preparer"))}
                  >
                    <option value="">Choose one</option>
                    {(staff.data?.staff ?? []).map((s) => (
                      <option key={s.id} value={s.id} data-copilot-also={`${firstName(s.name)}, ${s.name}`}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {errorFor("eng_preparer") ? (
                    <p className="bw-field-error" id="eng_preparer-error" role="alert">
                      {errorFor("eng_preparer")}
                    </p>
                  ) : null}
                </div>

                <div className="bw-field">
                  <label htmlFor="eng_reviewer">Reviewer</label>
                  <select
                    id="eng_reviewer"
                    name="reviewer"
                    data-copilot-ask="And who reviews it? Say none to leave it empty."
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    {...fieldAria("eng_reviewer", errorFor("eng_reviewer"))}
                  >
                    <option value="" data-copilot-also="none, no one, nobody, skip">
                      No reviewer yet
                    </option>
                    {(staff.data?.staff ?? []).map((s) => (
                      <option key={s.id} value={s.id} data-copilot-also={`${firstName(s.name)}, ${s.name}`}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {errorFor("eng_reviewer") ? (
                    <p className="bw-field-error" id="eng_reviewer-error" role="alert">
                      {errorFor("eng_reviewer")}
                    </p>
                  ) : null}
                </div>
              </div>

              {staff.error ? <ErrorState message={staff.error} onRetry={staff.reload} compact /> : null}
              {!staff.loading && (staff.data?.staff?.length ?? 0) === 0 && !staff.error ? (
                <EmptyState>The staff list couldn't be read, so there are no preparers to choose.</EmptyState>
              ) : null}
            </fieldset>

            <fieldset className="bw-fieldset">
              <legend className="bw-legend">Schedule and fee</legend>

              <div className="bw-form-row bw-form-row-3">
                <div className="bw-field">
                  <label htmlFor="eng_due">Due date</label>
                  <input
                    id="eng_due"
                    name="due"
                    type="date"
                    required
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    {...fieldAria("eng_due", errorFor("eng_due"))}
                  />
                  {errorFor("eng_due") ? (
                    <p className="bw-field-error" id="eng_due-error" role="alert">
                      {errorFor("eng_due")}
                    </p>
                  ) : null}
                </div>

                <div className="bw-field">
                  <label htmlFor="eng_fee">Fee</label>
                  <div className="bw-fee">
                    <span aria-hidden="true">$</span>
                    <input
                      id="eng_fee"
                      name="fee"
                      inputMode="decimal"
                      required
                      pattern="[0-9,]+(\.[0-9]{2})?"
                      placeholder="e.g. 425"
                      data-copilot-ask="What's the fee, in dollars?"
                      value={fee}
                      onChange={(e) => setFee(e.target.value)}
                      {...fieldAria("eng_fee", errorFor("eng_fee"))}
                    />
                  </div>
                  {errorFor("eng_fee") ? (
                    <p className="bw-field-error" id="eng_fee-error" role="alert">
                      {errorFor("eng_fee")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="bw-field">
                <label htmlFor="eng_notes">Notes (optional)</label>
                <textarea
                  id="eng_notes"
                  name="notes"
                  rows={3}
                  data-copilot-ask="Any notes for the preparer? Say none if not."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anything the preparer should know before they start"
                  {...fieldAria("eng_notes", errorFor("eng_notes"))}
                />
                {errorFor("eng_notes") ? (
                  <p className="bw-field-error" id="eng_notes-error" role="alert">
                    {errorFor("eng_notes")}
                  </p>
                ) : null}
              </div>
            </fieldset>

            <div className="bw-form-foot">
              <button type="submit" className="bw-btn bw-btn-primary" disabled={saving}>
                {saving ? <Loader2 size={15} className="bw-spin" aria-hidden="true" /> : null}
                {saving ? "Creating…" : "Create engagement"}
              </button>
              <Link to="/staff/pipeline" className="bw-btn bw-btn-ghost bw-btn-sm">
                Cancel
              </Link>
            </div>
          </form>
        )}
      </div>
    </StaffLayout>
  );
}
