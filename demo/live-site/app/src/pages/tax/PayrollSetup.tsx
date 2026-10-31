/**
 * Payroll setup (form `payroll`). The EIN field carries the copilot's code kind, and the first pay date is a
 * future date the copilot checks before it accepts one.
 */

import { Link } from "react-router-dom";
import { Check } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, NotesField, Radio, RadioSet, SelectField, StateSelect,
  TextField,
} from "@/components/tax/FormKit";

const ENTITIES = [
  { value: "sole", label: "Sole proprietor", also: "sole proprietor, just me" },
  { value: "llc", label: "LLC", also: "llc, limited liability company" },
  { value: "scorp", label: "S corporation", also: "s corp, s corporation" },
  { value: "ccorp", label: "C corporation", also: "c corp, corporation" },
  { value: "partnership", label: "Partnership", also: "partnership" },
  { value: "nonprofit", label: "Nonprofit", also: "nonprofit, charity" },
];

export default function TaxPayrollSetup() {
  useTaxTitle("Payroll setup");
  const f = useSiteForm("payroll");

  return (
    <SitePage config="taxPayroll">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Payroll</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Start payroll properly.
            </h1>
            <p className="tax-lead">
              Tell us the business, the team and how often you pay, and we will set up the accounts, the
              withholding and the first run. Five working days from receiving the employee file.
            </p>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <h2 className="tax-h3">What we set up</h2>
              <ul className="tax-list">
                <li>Federal and state withholding accounts, and the deposits on the schedule that applies.</li>
                <li>Direct-deposit pay runs, submitted two working days before payday.</li>
                <li>Forms 941 quarterly, Form 940 annually, and W-2s to employees in January.</li>
                <li>New-hire paperwork: Forms W-4 and I-9, checked before the first run.</li>
                <li>A named person to ring when a pay run needs changing.</li>
              </ul>
            </div>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">What it costs</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                $45 a month, plus $6 per employee a month, whichever schedule you choose. The setup is
                included; there is no charge for adding an employee part-way through the year.
              </p>
              <p className="tax-small tax-muted" style={{ display: "flex", gap: "0.375rem", alignItems: "center", margin: 0 }}>
                <Check size={13} aria-hidden="true" /> If a mistake is ours, we cover any penalty or interest.
              </p>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "A payroll specialist rings you within one working day to confirm the details.",
                  "We send the employee file request and the account forms to sign.",
                  "Setup is complete five working days after the file comes back, ready for your first pay date.",
                ]}
                links={[
                  { to: "/tax/services/payroll", label: "Payroll services" },
                  { to: "/tax/pricing", label: "Pricing" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="payroll-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField
                    id="py_business"
                    name="business_name"
                    label="Business legal name"
                    required
                    ask="What's the business's legal name?"
                    placeholder="e.g. Alder Lane Bakery LLC"
                    error={f.errors.business_name}
                  />
                  <TextField
                    id="py_ein"
                    name="ein"
                    label="Employer identification number"
                    required
                    kind="code"
                    pattern="[0-9]{2}-?[0-9]{7}"
                    title="9 digits, like 12-3456789"
                    ask="What's the business's EIN? You can read the nine digits."
                    placeholder="e.g. 00-1234567"
                    hint="Nine digits, in the format 12-3456789."
                    error={f.errors.ein}
                  />
                  <SelectField
                    id="py_entity"
                    name="entity"
                    label="What kind of entity is it?"
                    required
                    ask="What kind of entity is it"
                    options={ENTITIES}
                    error={f.errors.entity}
                  />
                  <TextField
                    id="py_employees"
                    name="employees"
                    label="Employees on payroll"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{1,3}"
                    title="A number, like 4"
                    ask="How many employees will be on payroll?"
                    placeholder="e.g. 4"
                    error={f.errors.employees}
                  />
                  <RadioSet
                    legend="How often do you pay?"
                    ask="How often do you pay your team"
                    error={f.errors.frequency}
                    errorId="py_freq-error"
                  >
                    <Radio id="py_freq_weekly" name="frequency" value="weekly" label="Weekly" also="weekly, every week" />
                    <Radio id="py_freq_biweekly" name="frequency" value="biweekly" label="Every two weeks" also="every two weeks, biweekly, every other week" />
                    <Radio id="py_freq_semimonthly" name="frequency" value="semimonthly" label="Twice a month" also="twice a month, semimonthly, 15th and last" />
                    <Radio id="py_freq_monthly" name="frequency" value="monthly" label="Monthly" also="monthly, once a month" />
                  </RadioSet>
                  <TextField
                    id="py_first"
                    name="first_pay_date"
                    label="First pay date"
                    type="date"
                    required
                    kind="future"
                    ask="What's the first pay date you'd like us to run?"
                    hint="Give us five working days' notice before this date."
                    error={f.errors.first_pay_date}
                  />
                  <StateSelect id="py_state" name="state" ask="Which state do your employees work in?" error={f.errors.state} />
                  <TextField
                    id="py_contact"
                    name="contact_name"
                    label="Who should we talk to?"
                    required
                    spell
                    ask="Who should we talk to about payroll? Their full name."
                    placeholder="e.g. Jordan Example"
                    error={f.errors.contact_name}
                  />
                  <TextField id="py_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="py_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <TextField
                    id="py_provider"
                    name="current_provider"
                    label="Who runs your payroll now?"
                    optional
                    ask="Who runs your payroll now? Say none if no one."
                    placeholder="e.g. none, or a provider's name"
                    error={f.errors.current_provider}
                  />
                  <NotesField id="py_notes" ask="Anything else about the team or the pay runs? Say none if not." />

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Start payroll setup"}
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
              Taking over mid-year?{" "}
              <Link to="/tax/contact" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                Tell us who runs it now
              </Link>{" "}
              and we will reconcile the year-to-date figures before the first run.
            </p>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
