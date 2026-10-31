/**
 * Send us an IRS notice (form `notice`). The notice code carries the copilot's code kind so it reads it back
 * letter by letter, and each photograph uploads at once with its own progress.
 */

import { useRef } from "react";
import { Link } from "react-router-dom";
import { FileText, Phone } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, Radio, RadioSet, SelectField, TextField, UploadField,
} from "@/components/tax/FormKit";

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019].map((y) => ({
  value: String(y),
  label: String(y),
  also: y === 2025 ? `${y}, last year` : String(y),
}));

export default function TaxNotice() {
  useTaxTitle("Send us an IRS notice");
  const f = useSiteForm("notice");
  const files = useRef<string[]>([]);

  return (
    <SitePage config="taxNotice">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">IRS notice help</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Send us the letter. We'll tell you what it wants.
            </h1>
            <p className="tax-lead">
              Most notices are a question, not an accusation: the IRS has a document that does not match the
              return, or it wants a form it has not seen. Photograph the whole letter, including the page with
              the notice number, and a preparer will read it.
            </p>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <h2 className="tax-h3">What we do with it</h2>
              <ol className="tax-list">
                <li>We read the notice and explain, in plain English, what it is asking for.</li>
                <li>We check it against your return and the IRS transcript for that year.</li>
                <li>We tell you whether to pay, reply, or wait — and what the deadline is.</li>
                <li>If you want us to answer it, we do, under a power of attorney.</li>
              </ol>
            </div>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">Deadline on the letter?</h2>
              <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: "0.5rem" }}>
                Tell us the date on the notice. Most give thirty days from the date printed on them, and
                answering inside that window is what keeps a simple question from becoming a bill.
              </p>
              <p className="tax-small" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: 0 }}>
                <Phone size={13} aria-hidden="true" /> If it is due this week, ring (555) 010-2210 as well.
              </p>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "A preparer reads the notice and its attachments within one working day.",
                  "We check it against your return and the IRS transcript for that year.",
                  "You get a plain-English explanation and what we recommend, before anything is sent.",
                ]}
                links={[
                  { to: "/tax/services/irs-notices", label: "IRS notice help" },
                  { to: "/tax/tools/refund-status", label: "Refund statuses" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="notice-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField id="nt_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="nt_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="nt_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <TextField
                    id="nt_code"
                    name="code"
                    label="Notice number"
                    required
                    kind="code"
                    pattern="(CP|LTR|LT) ?[0-9]{1,5}[A-Z]?"
                    title="Like CP2000 or LTR 1058"
                    ask="What's the notice number? It's in the top or bottom right corner, like CP2000."
                    placeholder="e.g. CP2000"
                    hint="In the top or bottom right corner of the letter, like CP2000 or LTR 1058."
                    error={f.errors.code}
                  />
                  <SelectField id="nt_year" name="tax_year" label="Which tax year?" required ask="Which tax year is it about" options={YEARS} error={f.errors.tax_year} />
                  <TextField
                    id="nt_date"
                    name="notice_date"
                    label="Date on the notice"
                    type="date"
                    required
                    kind="future"
                    ask="What's the date on the notice?"
                    error={f.errors.notice_date}
                  />
                  <TextField
                    id="nt_amount"
                    name="amount"
                    label="Amount it shows"
                    inputMode="decimal"
                    optional
                    ask="What amount does it show, in dollars? Say none if it doesn't show one."
                    placeholder="e.g. 1,284.00"
                    error={f.errors.amount}
                  />
                  <TextField
                    id="nt_due"
                    name="response_due"
                    label="Response due"
                    type="date"
                    optional
                    ask="When does it say you need to respond by? Say skip if it doesn't say."
                    error={f.errors.response_due}
                  />
                  <RadioSet
                    legend="Do you agree with it?"
                    ask="Do you agree with the notice"
                    error={f.errors.agree}
                    errorId="nt_agree-error"
                  >
                    <Radio id="nt_agree_agree" name="agree" value="agree" label="Yes" also="yes, i agree, it's right" />
                    <Radio id="nt_agree_disagree" name="agree" value="disagree" label="No" also="no, i disagree, it's wrong" />
                    <Radio id="nt_agree_partly" name="agree" value="partly" label="Partly" also="partly, some of it, partially" />
                    <Radio id="nt_agree_unsure" name="agree" value="unsure" label="Not sure" also="not sure, don't know, unsure" />
                  </RadioSet>
                  <div className="tax-field">
                    <label htmlFor="nt_description">What is the notice about?</label>
                    <textarea
                      id="nt_description"
                      name="description"
                      rows={4}
                      required
                      minLength={10}
                      data-copilot-ask="In a sentence or two, what is the notice about?"
                      aria-invalid={f.errors.description ? true : undefined}
                      aria-describedby={f.errors.description ? "nt_description-error" : undefined}
                    />
                    {f.errors.description ? (
                      <p className="tax-error" id="nt_description-error" role="alert">
                        {f.errors.description}
                      </p>
                    ) : (
                      <p className="tax-hint">A sentence or two is plenty: what it says and what you think happened.</p>
                    )}
                  </div>

                  <UploadField
                    id="nt_files"
                    label="Photos or a scan of the notice"
                    form="notice"
                    accept=".pdf,.jpg,.jpeg,.png,.heic"
                    multiple
                    hint="Up to 8 MB each. PDF, JPG, PNG or HEIC. Every page, please."
                    onUploaded={(ids) => {
                      files.current = ids;
                      f.extra.current.files = ids;
                    }}
                    error={f.errors.files}
                  />

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Send notice"}
                    </button>
                    <DraftNote saved={f.draftSaved} />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <DemoLine />
                  </div>
                </form>
              </div>
            )}

            <p className="tax-small tax-muted" style={{ marginTop: "0.875rem", display: "flex", gap: "0.375rem", alignItems: "flex-start" }}>
              <FileText size={14} aria-hidden="true" style={{ flex: "none", marginTop: 3 }} />
              <span>
                A notice can be a scam. The IRS writes by post and never demands payment by gift card, wire
                or telephone.{" "}
                <Link to="/tax/guides" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                  Check it against the guides
                </Link>
                .
              </span>
            </p>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
