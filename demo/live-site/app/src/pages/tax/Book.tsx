import { useMemo, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarCheck, Clock, PhoneCall, ShieldCheck } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { TaxNotice } from "@/components/tax/TaxNotice";
import { nextWeekdays, useTaxTitle } from "@/lib/tax";

export default function TaxBook() {
  useTaxTitle("Book a consultation");
  const navigate = useNavigate();
  const days = useMemo(() => nextWeekdays(10), []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.reportValidity()) {
      form.classList.add("attempted");
      return;
    }
    navigate("/sent");
  };

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <div className="tax-grid tax-grid-2" style={{ alignItems: "start", gap: "1.5rem" }}>
          <div>
            <span className="tax-eyebrow">Book a consultation</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Fifteen minutes with a preparer, at no charge.
            </h1>
            <p className="tax-lead">
              Tell us a little about the year you've had and when it suits you to talk. One of us
              will ring you at the time you choose.
            </p>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <h2 className="tax-h3" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <CalendarCheck size={18} aria-hidden="true" style={{ color: "hsl(var(--tax-accent))" }} />
                What happens next
              </h2>
              <ol className="tax-list" style={{ counterReset: "none" }}>
                <li>We read your form the same working day and check the diary.</li>
                <li>A preparer rings you in the slot you chose. Fifteen minutes, no charge.</li>
                <li>If it's a fit, we send a written quote and a short list of what to send.</li>
                <li>You decide. There is no obligation and no follow-up sales call.</li>
              </ol>
            </div>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ShieldCheck size={18} aria-hidden="true" style={{ color: "hsl(var(--tax-accent))" }} />
                No sign-in, no account
              </h2>
              <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
                There is nothing to register for and nothing to remember. If you'd rather not type,
                tap <strong>Start voice call</strong> at the bottom of the screen and the assistant
                will ask you the same questions out loud and fill the form in with you.
              </p>
            </div>

            <div className="tax-card" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <PhoneCall size={18} aria-hidden="true" style={{ color: "hsl(var(--tax-accent))" }} />
                Rather just ring us?
              </h2>
              <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                (555) 010-2210, Monday to Friday, 9 to 5.
              </p>
              <p className="tax-small tax-muted" style={{ display: "flex", alignItems: "center", gap: "0.375rem", marginBottom: 0 }}>
                <Clock size={13} aria-hidden="true" /> 1180 Larkspur Avenue, Suite 300, Harrow Falls (fictional)
              </p>
            </div>
          </div>

          <div>
            <TaxNotice />

            <div className="tax-form-card">
              <form data-copilot-form id="intake" autoComplete="off" onSubmit={handleSubmit}>
                <fieldset className="tax-fieldset">
                  <legend className="tax-legend">About you</legend>

                  <div className="tax-field">
                    <label htmlFor="fullname">Full name</label>
                    <input
                      id="fullname"
                      name="fullname"
                      autoComplete="name"
                      required
                      data-copilot-spell
                      data-copilot-ask="What's your full name, as it appears on your tax return?"
                      placeholder="e.g. Jordan Example"
                    />
                  </div>

                  <div className="tax-field">
                    <label htmlFor="tel">Phone</label>
                    <input
                      id="tel"
                      name="tel"
                      type="tel"
                      autoComplete="tel"
                      required
                      minLength={10}
                      placeholder="e.g. (555) 010-0199"
                    />
                  </div>

                  <div className="tax-field">
                    <label htmlFor="mail">Email</label>
                    <input
                      id="mail"
                      name="mail"
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="e.g. jordan@example.com"
                    />
                  </div>
                </fieldset>

                <fieldset className="tax-fieldset">
                  <legend className="tax-legend">Your taxes</legend>

                  <div className="tax-field">
                    <label htmlFor="status">Filing status</label>
                    <select
                      id="status"
                      name="status"
                      required
                      data-copilot-ask="What's your filing status"
                    >
                      <option value="">Choose one</option>
                      <option value="single" data-copilot-also="single, not married, unmarried">Single</option>
                      <option value="mfj" data-copilot-also="married filing jointly, jointly, joint, married joint, together">Married filing jointly</option>
                      <option value="mfs" data-copilot-also="married filing separately, separately, separate">Married filing separately</option>
                      <option value="hoh" data-copilot-also="head of household, head of house">Head of household</option>
                      <option value="qss" data-copilot-also="qualifying surviving spouse, surviving spouse, widow, widower">Qualifying surviving spouse</option>
                    </select>
                  </div>

                  <div className="tax-field">
                    <label htmlFor="years">Tax years</label>
                    <input
                      id="years"
                      name="years"
                      required
                      placeholder="e.g. 2025, or 2024 and 2025"
                      data-copilot-ask="Which tax years do you need help with?"
                    />
                  </div>

                  <div className="tax-field">
                    <label htmlFor="service">Service needed</label>
                    <select
                      id="service"
                      name="service"
                      required
                      data-copilot-ask="Which service do you need"
                    >
                      <option value="">Choose one</option>
                      <option value="individual" data-copilot-also="individual return, tax return, my return, 1040, personal return">Individual return</option>
                      <option value="bookkeeping" data-copilot-also="bookkeeping, books, accounting">Small-business bookkeeping</option>
                      <option value="payroll" data-copilot-also="payroll, pay my employees, w-2s">Payroll</option>
                      <option value="notice" data-copilot-also="irs notice, notice, letter from the irs, irs letter, cp2000">IRS notice help</option>
                      <option value="planning" data-copilot-also="planning, tax planning, estimates, estimated payments">Planning</option>
                    </select>
                  </div>

                  <div className="tax-field">
                    <label htmlFor="notice">Have you received an IRS notice?</label>
                    <select
                      id="notice"
                      name="notice"
                      required
                      data-copilot-ask="Have you received a letter or notice from the IRS"
                    >
                      <option value="">Choose one</option>
                      <option value="yes" data-copilot-also="yes, yeah, i did, i have, got one, received one">Yes</option>
                      <option value="no" data-copilot-also="no, nope, i haven't, none, not yet">No</option>
                    </select>
                  </div>

                  <div className="tax-field">
                    <label htmlFor="noticecode">Notice code (if any)</label>
                    <input
                      id="noticecode"
                      name="noticecode"
                      data-copilot-kind="code"
                      pattern="[A-Z]{1,4}[0-9]{1,5}[A-Z]?"
                      title="Like CP2000 or LTR3172: letters, then numbers"
                      placeholder="e.g. CP2000"
                      data-copilot-ask="What's the notice code? It's in the top right corner of the letter, like CP2000. Say none if you didn't get one."
                    />
                  </div>
                </fieldset>

                <fieldset className="tax-fieldset">
                  <legend className="tax-legend">When to call</legend>

                  <div className="tax-field">
                    <label htmlFor="day">Preferred date</label>
                    <select id="day" name="day" required data-copilot-ask="Which day suits you for the call">
                      <option value="">Choose a day</option>
                      {days.map((d) => (
                        <option key={d.value} value={d.value} data-copilot-also={d.also}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="tax-field">
                    <label htmlFor="slot">Preferred time</label>
                    <select id="slot" name="slot" required data-copilot-ask="And what time of day">
                      <option value="">Choose a time</option>
                      <option value="morning" data-copilot-also="morning, am, before noon">Morning (9 to 12)</option>
                      <option value="afternoon" data-copilot-also="afternoon, after lunch, pm">Afternoon (12 to 4)</option>
                      <option value="evening" data-copilot-also="evening, after work, late">Evening (4 to 6)</option>
                    </select>
                  </div>

                  <div className="tax-field">
                    <label htmlFor="notes">Notes (optional)</label>
                    <textarea
                      id="notes"
                      name="notes"
                      rows={3}
                      data-copilot-ask="Anything else the preparer should know before the call? Say none if not."
                    />
                  </div>
                </fieldset>

                <div className="tax-form-foot">
                  <button type="submit" className="tax-form-submit">
                    Request consultation
                  </button>
                  <span className="tax-small tax-muted">Demo: nothing is sent or stored.</span>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>

      <TaxCopilot intake />
    </TaxLayout>
  );
}
