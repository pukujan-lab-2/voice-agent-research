/**
 * Payment plan request (form `payment-plan`), with the plain explainer of Form 9465 under the title.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, NotesField, Radio, RadioSet, TextField,
} from "@/components/tax/FormKit";

export default function TaxPaymentPlan() {
  useTaxTitle("Payment plan");
  const f = useSiteForm("payment-plan");

  return (
    <SitePage config="taxPaymentPlan">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Payment plan</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              If you can't pay it all at once.
            </h1>
            <p className="tax-lead">
              The IRS would rather have the money over time than not at all. Form 9465 asks for an
              installment agreement: a monthly amount, taken on a fixed date, until the balance is gone.
              There is a fee to set it up, and interest keeps running while you pay.
            </p>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <h2 className="tax-h3">Two ways to do it</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                A <strong>short-term plan</strong> covers 180 days or less and needs no fee if you can clear
                the balance inside that window. A <strong>long-term plan</strong> is a monthly installment
                agreement: it can run for years, and it carries a setup fee and a monthly direct-debit
                requirement in most cases.
              </p>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                Either way, file the return first. A plan on an unfiled return cannot be set up, and the
                failure-to-file penalty is ten times the failure-to-pay one.
              </p>
            </div>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">What we need from you</h2>
              <ul className="tax-list">
                <li>The years you owe for, and roughly how much in total.</li>
                <li>What you could pay each month without missing it.</li>
                <li>Whether the IRS has already written to you about the balance.</li>
                <li>Whether you would pay by direct debit from a bank account.</li>
              </ul>
              <p className="tax-small" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                <Link to="/tax/guides" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                  Search the guides for “payment plan”
                </Link>{" "}
                to read the IRS's own rules on Form 9465.
              </p>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "A preparer checks the balance and whether a plan is the right route before anything is filed.",
                  "We tell you the fee, the monthly figure the IRS is likely to accept, and the interest.",
                  "If you go ahead, we prepare and file Form 9465 under a power of attorney.",
                ]}
                links={[
                  { to: "/tax/services/irs-notices", label: "IRS notice help" },
                  { to: "/tax/tools/calendar", label: "The tax calendar" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="plan-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField id="pp_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="pp_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="pp_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <TextField
                    id="pp_years"
                    name="years"
                    label="Which tax years do you owe for?"
                    required
                    ask="Which tax years do you owe for?"
                    placeholder="e.g. 2024, or 2023 and 2024"
                    error={f.errors.years}
                  />
                  <TextField
                    id="pp_owed"
                    name="owed"
                    label="About how much do you owe in total?"
                    required
                    inputMode="decimal"
                    ask="About how much do you owe in total, in dollars?"
                    placeholder="e.g. 8,400"
                    error={f.errors.owed}
                  />
                  <TextField
                    id="pp_monthly"
                    name="monthly"
                    label="How much could you pay each month?"
                    required
                    inputMode="decimal"
                    ask="How much could you pay each month?"
                    placeholder="e.g. 250"
                    error={f.errors.monthly}
                  />
                  <RadioSet
                    legend="Which kind of plan?"
                    ask="Do you want a short-term plan, a long-term plan, or are you not sure"
                    error={f.errors.plan}
                    errorId="pp_plan-error"
                  >
                    <Radio id="pp_plan_short" name="plan" value="short" label="Short-term (180 days or less)" also="short, short term, a few months" />
                    <Radio id="pp_plan_long" name="plan" value="long" label="Long-term (monthly installments)" also="long, long term, installment agreement, monthly" />
                    <Radio id="pp_plan_unsure" name="plan" value="unsure" label="Not sure" also="not sure, don't know" />
                  </RadioSet>
                  <RadioSet
                    legend="Have you had an IRS notice about this?"
                    ask="Have you had a notice from the IRS about it"
                    error={f.errors.notice}
                    errorId="pp_notice-error"
                    columns
                  >
                    <Radio id="pp_notice_yes" name="notice" value="yes" label="Yes" also="yes, i have" />
                    <Radio id="pp_notice_no" name="notice" value="no" label="No" also="no, not yet" />
                  </RadioSet>
                  <RadioSet
                    legend="Pay by direct debit?"
                    ask="Would you pay by direct debit from your bank account"
                    error={f.errors.debit}
                    errorId="pp_debit-error"
                    columns
                  >
                    <Radio id="pp_debit_yes" name="debit" value="yes" label="Yes, from my bank account" also="yes" />
                    <Radio id="pp_debit_no" name="debit" value="no" label="No, I'd rather not" also="no" />
                  </RadioSet>
                  <NotesField id="pp_notes" ask="Anything else we should know? Say none if not." />

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Request a payment plan"}
                    </button>
                    <DraftNote saved={f.draftSaved} />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <DemoLine />
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </SitePage>
  );
}
