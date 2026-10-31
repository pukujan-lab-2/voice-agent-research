/**
 * Change of address (form `address`), with the Form 8822 question the IRS needs answered.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, Radio, RadioSet, StateSelect, TextField,
} from "@/components/tax/FormKit";

export default function TaxAddressChange() {
  useTaxTitle("Change of address");
  const f = useSiteForm("address");

  return (
    <SitePage config="taxAddress">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Change of address</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Tell us where to find you.
            </h1>
            <p className="tax-lead">
              One form, and every record we hold moves with you: the client file, the billing address and,
              if you want, the address the IRS has on file.
            </p>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <h2 className="tax-h3">Why the IRS needs telling separately</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                We can update our own records in a minute, but the IRS keeps its own address for you, and it
                will keep writing to the old one until it is told otherwise. Form 8822 does that. It takes
                about four to six weeks to take effect, so anything already in the post may still arrive at
                the old address.
              </p>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                If a refund is due, or a notice is likely, it is worth filing. If you have moved within the
                same state and nothing is outstanding, it can wait until your next return.
              </p>
            </div>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">A word about the date</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                Give us the date you actually moved, not the date you are telling us. The IRS form asks for
                it, and using the right date avoids a mismatch with the return.
              </p>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "We update your client file, billing address and portal details within one working day.",
                  "If you asked us to, we prepare Form 8822 and send it to you to sign.",
                  "We confirm once the IRS has the new address, usually four to six weeks later.",
                ]}
                links={[
                  { to: "/tax/contact", label: "Contact the office" },
                  { to: "/tax/portal", label: "Client portal" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="address-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField id="ad_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="ad_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="ad_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <TextField
                    id="ad_old"
                    name="old_street"
                    label="Old street address"
                    required
                    ask="What was your old street address?"
                    placeholder="e.g. 18 Fenwick Road"
                    error={f.errors.old_street}
                  />
                  <TextField
                    id="ad_street"
                    name="street"
                    label="New street address"
                    required
                    autoComplete="street-address"
                    ask="And your new street address?"
                    placeholder="e.g. 42 Alder Lane"
                    error={f.errors.street}
                  />
                  <TextField
                    id="ad_city"
                    name="city"
                    label="New city"
                    required
                    ask="New city?"
                    placeholder="e.g. Harrow Falls"
                    error={f.errors.city}
                  />
                  <StateSelect id="ad_state" name="state" label="New state" ask="New state?" error={f.errors.state} />
                  <TextField
                    id="ad_zip"
                    name="zip"
                    label="New ZIP code"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{5}"
                    title="Five digits, like 97001"
                    ask="New ZIP code?"
                    placeholder="e.g. 97001"
                    error={f.errors.zip}
                  />
                  <TextField
                    id="ad_effective"
                    name="effective"
                    label="When did you move?"
                    type="date"
                    required
                    ask="When did you move?"
                    error={f.errors.effective}
                  />
                  <RadioSet
                    legend="Should we file Form 8822 to tell the IRS?"
                    ask="Should we file Form 8822 to update your address with the IRS"
                    error={f.errors.irs}
                    errorId="ad_irs-error"
                  >
                    <Radio id="ad_irs_yes" name="irs" value="yes" label="Yes, please file it" also="yes, please, do it" />
                    <Radio id="ad_irs_no" name="irs" value="no" label="No, I'll handle it" also="no, i will, i'll do it" />
                  </RadioSet>

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Update my address"}
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
              Moving out of the area?{" "}
              <Link to="/tax/contact" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                Message the office
              </Link>{" "}
              — we prepare returns for clients in most states.
            </p>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
