/**
 * Prior-year return request (form `transcript`): a copy of the return, an IRS transcript, or both.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, NotesField, Radio, RadioSet, SelectField, TextField,
} from "@/components/tax/FormKit";

const YEARS = [2025, 2024, 2023, 2022, 2021, 2020, 2019].map((y) => ({
  value: String(y),
  label: String(y),
}));

const PURPOSE = [
  { value: "mortgage", label: "A mortgage or loan", also: "mortgage, loan, refinance" },
  { value: "aid", label: "Financial aid", also: "financial aid, fafsa, college" },
  { value: "immigration", label: "Immigration", also: "immigration, visa, green card" },
  { value: "records", label: "My records", also: "records, my files, just to keep" },
  { value: "other", label: "Something else", also: "other, something else" },
];

export default function TaxPriorYear() {
  useTaxTitle("Prior-year return");
  const f = useSiteForm("transcript");

  return (
    <SitePage config="taxPriorYear">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Prior-year returns</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              A copy of an old return, or the transcript behind it.
            </h1>
            <p className="tax-lead">
              Two different things, and lenders usually want one of them specifically. A copy is the return
              as filed. A transcript is the IRS's own record of what it received and processed.
            </p>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <h2 className="tax-h3">Which one do you need?</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                A <strong>mortgage application</strong> usually wants the transcript, because it comes from
                the IRS and cannot be edited. <strong>Financial aid</strong> often accepts either.{" "}
                <strong>Immigration</strong> normally wants the transcript for the most recent year. If you
                are keeping it for your own records, a copy is easier to read.
              </p>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                If we prepared the return, the copy comes out of your file. If we did not, we can still pull
                the transcript with your signed authorisation.
              </p>
            </div>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">How long it takes</h2>
              <ul className="tax-list">
                <li>A copy from our file: one working day, into the portal.</li>
                <li>An IRS transcript: usually the same day, once the authorisation is signed.</li>
                <li>By post: add three to five working days.</li>
              </ul>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "We check the year against your file and the IRS record.",
                  "If we need a signed authorisation, we send it to you the same working day.",
                  "The copy or transcript arrives in your portal, or by post, as you asked.",
                ]}
                links={[
                  { to: "/tax/portal", label: "Client portal" },
                  { to: "/tax/services/prior-year", label: "Prior-year returns" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="prior-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField id="tr_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="tr_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="tr_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <SelectField
                    id="tr_year"
                    name="tax_year"
                    label="Which tax year?"
                    required
                    ask="Which tax year do you need"
                    options={YEARS}
                    error={f.errors.tax_year}
                  />
                  <RadioSet
                    legend="What do you need?"
                    ask="Do you need a copy of the return, an IRS transcript, or both"
                    error={f.errors.what}
                    errorId="tr_what-error"
                  >
                    <Radio id="tr_what_copy" name="what" value="copy" label="A copy of the return we filed" also="copy, a copy, the return" />
                    <Radio id="tr_what_transcript" name="what" value="transcript" label="An IRS transcript" also="transcript, irs transcript" />
                    <Radio id="tr_what_both" name="what" value="both" label="Both" also="both, both of them" />
                  </RadioSet>
                  <RadioSet
                    legend="How should we send it?"
                    ask="Should we put it in your portal or mail it"
                    error={f.errors.delivery}
                    errorId="tr_delivery-error"
                    columns
                  >
                    <Radio id="tr_delivery_portal" name="delivery" value="portal" label="Client portal" also="portal, online, upload it" />
                    <Radio id="tr_delivery_mail" name="delivery" value="mail" label="By mail" also="mail, post, send it" />
                  </RadioSet>
                  <SelectField
                    id="tr_purpose"
                    name="purpose"
                    label="What do you need it for?"
                    required
                    ask="What do you need it for"
                    options={PURPOSE}
                    error={f.errors.purpose}
                  />
                  <NotesField id="tr_notes" ask="Anything else we should know? Say none if not." />

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Request it"}
                    </button>
                    <DraftNote saved={f.draftSaved} />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <DemoLine />
                  </div>
                </form>
              </div>
            )}

            <p className="tax-small tax-muted" style={{ marginTop: "0.875rem" }}>
              Not filed for a year at all?{" "}
              <Link to="/tax/services/prior-year" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                That is a different job
              </Link>{" "}
              — we prepare the missing returns, usually three to four weeks per year.
            </p>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
