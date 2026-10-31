/**
 * Become a client (form `intake`, four steps). Each step is a fieldset with `data-step`, hidden and disabled when
 * it is not the current one; Next checks only that step's fields and moves on, Back returns. The progress bar
 * above names the four steps.
 */

import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  CheckboxGroup, Confirmation, DemoLine, DraftNote, ErrorSummary, NotesField, Radio, RadioSet,
  SelectField, StateSelect, TextField,
} from "@/components/tax/FormKit";

const STEP_NAMES = ["About you", "Address", "Your taxes", "Your visit"];

const INCOME = [
  { value: "w2", label: "W-2 wages", also: "w-2, wages, salary, my job", id: "in_inc_w2" },
  { value: "self", label: "Self-employment or 1099 work", also: "self-employed, 1099, freelance", id: "in_inc_self" },
  { value: "rental", label: "Rental property", also: "rental, landlord, rent", id: "in_inc_rental" },
  { value: "investments", label: "Investments (1099-B, 1099-DIV)", also: "stocks, dividends, investments", id: "in_inc_investments" },
  { value: "retirement", label: "Retirement distributions", also: "pension, 401k, ira", id: "in_inc_retirement" },
  { value: "social-security", label: "Social Security", also: "social security, ssa", id: "in_inc_social-security" },
  { value: "crypto", label: "Digital assets", also: "crypto, bitcoin, digital assets", id: "in_inc_crypto" },
  { value: "k1", label: "Partnership or S corp (K-1)", also: "k-1, partnership, s corp", id: "in_inc_k1" },
  { value: "unemployment", label: "Unemployment", also: "unemployment, benefits", id: "in_inc_unemployment" },
  { value: "foreign", label: "Foreign income or accounts", also: "foreign, overseas, abroad", id: "in_inc_foreign" },
];

export default function TaxStart() {
  useTaxTitle("Become a client");
  const f = useSiteForm("intake");
  const [step, setStep] = useState(1);
  const stepRefs = useRef<(HTMLFieldSetElement | null)[]>([]);

  const next = () => {
    const current = stepRefs.current[step];
    if (!current) return;
    const fields = Array.from(
      current.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>("input, select, textarea"),
    ).filter((el) => !el.disabled && el.willValidate);
    let ok = true;
    for (const el of fields) {
      if (!el.reportValidity()) {
        ok = false;
        break;
      }
    }
    if (!ok) {
      current.classList.add("attempted");
      return;
    }
    setStep((n) => Math.min(STEP_NAMES.length, n + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setStep((n) => Math.max(1, n - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    // The last step must be the one on screen before the form can be sent.
    if (step !== STEP_NAMES.length) {
      e.preventDefault();
      next();
      return;
    }
    f.onSubmit(e);
  };

  return (
    <SitePage config="taxStart">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Become a client</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Four short steps, then a call.
            </h1>
            <p className="tax-lead">
              This takes about two minutes. It tells us who you are, where you are, what your taxes involve
              and which office suits you. A preparer reads it the same working day.
            </p>

            <div className="tax-card tax-card-quiet" style={{ marginBottom: "1.25rem" }}>
              <h2 className="tax-h3">What happens after you send it</h2>
              <ol className="tax-list">
                <li>We read the form the same working day and check it against the diary.</li>
                <li>A preparer rings you within one working day, at no charge.</li>
                <li>If it's a fit, we send a written quote and a list of what to gather.</li>
                <li>You decide. Nothing is owed until you say yes to the quote.</li>
              </ol>
            </div>

            <p className="tax-small tax-muted">
              Already a client?{" "}
              <Link to="/tax/portal" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                Sign in to the portal
              </Link>{" "}
              instead — you don't need this form.
            </p>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "We read your details the same working day and match you with a preparer.",
                  "A preparer rings you within one working day to go through the year.",
                  "If it's a fit, a written quote and a document list follow the call.",
                ]}
                links={[
                  { to: "/tax/tools/checklist", label: "Build your checklist" },
                  { to: "/tax/team", label: "Meet the team" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <div className="tax-progress" data-testid="form-progress">
                  <div className="tax-progress-track">
                    <span style={{ width: `${(step / STEP_NAMES.length) * 100}%` }} />
                  </div>
                  <div className="tax-progress-steps">
                    {STEP_NAMES.map((name, i) => (
                      <span key={name} data-active={step === i + 1} data-done={step > i + 1}>
                        {i + 1}. {name}
                      </span>
                    ))}
                  </div>
                </div>

                <ErrorSummary errors={f.errors} />

                <form ref={f.formRef} data-copilot-form id="intake-new" autoComplete="on" onSubmit={onSubmit} noValidate={false}>
                  <fieldset
                    data-step={1}
                    hidden={step !== 1}
                    disabled={step !== 1}
                    ref={(el) => {
                      stepRefs.current[1] = el;
                    }}
                  >
                    <legend className="tax-legend">About you</legend>
                    <TextField
                      id="in_first"
                      name="first_name"
                      label="First name"
                      autoComplete="given-name"
                      required
                      spell
                      ask="What's your first name?"
                      placeholder="e.g. Jordan"
                      error={f.errors.first_name}
                    />
                    <TextField
                      id="in_last"
                      name="last_name"
                      label="Last name"
                      autoComplete="family-name"
                      required
                      spell
                      ask="And your last name?"
                      placeholder="e.g. Example"
                      error={f.errors.last_name}
                    />
                    <TextField
                      id="in_email"
                      name="email"
                      label="Email"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="e.g. jordan@example.com"
                      error={f.errors.email}
                    />
                    <TextField
                      id="in_phone"
                      name="phone"
                      label="Phone"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={10}
                      placeholder="e.g. (555) 010-0199"
                      error={f.errors.phone}
                    />
                  </fieldset>

                  <fieldset
                    data-step={2}
                    hidden={step !== 2}
                    disabled={step !== 2}
                    ref={(el) => {
                      stepRefs.current[2] = el;
                    }}
                  >
                    <legend className="tax-legend">Address</legend>
                    <TextField
                      id="in_street"
                      name="street"
                      label="Street address"
                      autoComplete="street-address"
                      required
                      ask="What's your street address?"
                      placeholder="e.g. 42 Alder Lane"
                      error={f.errors.street}
                    />
                    <TextField
                      id="in_city"
                      name="city"
                      label="City"
                      required
                      ask="Which city?"
                      placeholder="e.g. Harrow Falls"
                      error={f.errors.city}
                    />
                    <StateSelect id="in_state" name="state" ask="Which state?" error={f.errors.state} />
                    <TextField
                      id="in_zip"
                      name="zip"
                      label="ZIP code"
                      required
                      inputMode="numeric"
                      pattern="[0-9]{5}"
                      title="Five digits, like 97001"
                      ask="And the ZIP code?"
                      placeholder="e.g. 97001"
                      error={f.errors.zip}
                    />
                  </fieldset>

                  <fieldset
                    data-step={3}
                    hidden={step !== 3}
                    disabled={step !== 3}
                    ref={(el) => {
                      stepRefs.current[3] = el;
                    }}
                  >
                    <legend className="tax-legend">Your taxes</legend>
                    <SelectField
                      id="in_status"
                      name="filing_status"
                      label="Filing status"
                      required
                      ask="What's your filing status"
                      options={[
                        { value: "single", label: "Single", also: "single, not married" },
                        { value: "mfj", label: "Married filing jointly", also: "married filing jointly, jointly, joint" },
                        { value: "mfs", label: "Married filing separately", also: "separately" },
                        { value: "hoh", label: "Head of household", also: "head of household" },
                        { value: "qss", label: "Qualifying surviving spouse", also: "surviving spouse, widow, widower" },
                      ]}
                      error={f.errors.filing_status}
                    />
                    <SelectField
                      id="in_dependents"
                      name="dependents"
                      label="Dependents you claim"
                      required
                      ask="How many dependants do you claim"
                      options={[
                        { value: "0", label: "None", also: "none, zero, no, no kids" },
                        { value: "1", label: "1", also: "one" },
                        { value: "2", label: "2", also: "two" },
                        { value: "3", label: "3", also: "three" },
                        { value: "4", label: "4", also: "four" },
                        { value: "5", label: "5 or more", also: "five, five or more, more than four" },
                      ]}
                      error={f.errors.dependents}
                    />
                    <CheckboxGroup
                      legend="Income you had (tick all that apply)"
                      name="income"
                      idPrefix="in_inc"
                      options={INCOME}
                      ask="What income did you have this year"
                    />
                    <SelectField
                      id="in_services"
                      name="services"
                      label="What do you need help with"
                      required
                      ask="What do you need help with"
                      options={[
                        { value: "individual", label: "Individual return", also: "individual return, my taxes, tax return, 1040" },
                        { value: "business", label: "Business return", also: "business return, business taxes" },
                        { value: "bookkeeping", label: "Bookkeeping", also: "bookkeeping, books" },
                        { value: "payroll", label: "Payroll", also: "payroll" },
                        { value: "notice", label: "An IRS notice", also: "irs notice, notice, letter" },
                        { value: "planning", label: "Tax planning", also: "planning" },
                        { value: "prior-year", label: "Prior-year or amended return", also: "prior year, amended, back taxes" },
                        { value: "state", label: "State return only", also: "state" },
                        { value: "trust", label: "Trust or estate", also: "trust, estate" },
                        { value: "nonprofit", label: "Nonprofit (990)", also: "nonprofit, 990" },
                      ]}
                      error={f.errors.services}
                    />
                    <TextField
                      id="in_years"
                      name="years"
                      label="Which tax years?"
                      required
                      ask="Which tax years?"
                      placeholder="e.g. 2025, or 2024 and 2025"
                      error={f.errors.years}
                    />
                    <RadioSet
                      legend="Who prepared your last return?"
                      ask="Who prepared your last return"
                      error={f.errors.prior_preparer}
                      errorId="in_prior-error"
                    >
                      <Radio id="in_prior_self" name="prior_preparer" value="self" label="I did, by hand" also="myself, i did, by hand" />
                      <Radio id="in_prior_software" name="prior_preparer" value="software" label="Tax software" also="software, turbotax, an app, online" />
                      <Radio id="in_prior_preparer" name="prior_preparer" value="preparer" label="Another preparer or firm" also="another preparer, an accountant, a cpa, another firm" />
                      <Radio id="in_prior_none" name="prior_preparer" value="none" label="I haven't filed before" also="never, first time, haven't filed" />
                    </RadioSet>
                  </fieldset>

                  <fieldset
                    data-step={4}
                    hidden={step !== 4}
                    disabled={step !== 4}
                    ref={(el) => {
                      stepRefs.current[4] = el;
                    }}
                  >
                    <legend className="tax-legend">Your visit</legend>
                    <RadioSet
                      legend="Which office suits you?"
                      ask="Which office suits you"
                      error={f.errors.office}
                      errorId="in_office-error"
                    >
                      <Radio id="in_office_harrow" name="office" value="harrow" label="Harrow Falls" also="harrow, harrow falls" />
                      <Radio id="in_office_corbel" name="office" value="corbel" label="Corbel" also="corbel" />
                      <Radio id="in_office_millbrook" name="office" value="millbrook" label="Millbrook" also="millbrook" />
                      <Radio id="in_office_remote" name="office" value="remote" label="Remote, by video" also="remote, video, online, virtual" />
                    </RadioSet>
                    <SelectField
                      id="in_heard"
                      name="heard"
                      label="How did you hear about us?"
                      optional
                      ask="How did you hear about us? Say skip if you'd rather not."
                      placeholder="Choose one (optional)"
                      placeholderAlso="skip, rather not, prefer not to say"
                      options={[
                        { value: "referral", label: "A friend or client", also: "friend, referral, word of mouth" },
                        { value: "search", label: "Search", also: "google, search, online search" },
                        { value: "review", label: "Reviews", also: "reviews" },
                        { value: "social", label: "Social media", also: "social media, instagram, facebook" },
                        { value: "event", label: "An event", also: "event, workshop" },
                        { value: "other", label: "Other", also: "other" },
                      ]}
                      error={f.errors.heard}
                    />
                    <NotesField id="in_notes" ask="Anything else we should know? Say none if not." />
                  </fieldset>

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-step-actions">
                    {step > 1 && (
                      <button type="button" className="tax-btn-ghost" onClick={back}>
                        Back
                      </button>
                    )}
                    {step < STEP_NAMES.length ? (
                      <button type="button" className="tax-form-submit" data-copilot-next onClick={next}>
                        Next
                      </button>
                    ) : (
                      <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                        {f.submitting ? "Sending…" : "Send my details"}
                      </button>
                    )}
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
