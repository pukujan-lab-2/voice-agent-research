/**
 * Contact: a message form and the three offices with their phones, addresses and hours.
 */

import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { ErrorBox, PageHead, SkeletonCards } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import { Confirmation, DemoLine, DraftNote, ErrorSummary, SelectField, TextField } from "@/components/tax/FormKit";
import { useSiteLocations } from "@/lib/siteData";
import { hoursText, todayKey } from "@/lib/site";

const TOPICS = [
  { value: "question", label: "A question", also: "question, ask" },
  { value: "billing", label: "Billing", also: "billing, invoice, bill" },
  { value: "portal", label: "The client portal", also: "portal, login, sign in" },
  { value: "other", label: "Something else", also: "other" },
];

export default function TaxContact() {
  useTaxTitle("Contact us");
  const f = useSiteForm("contact");
  const locations = useSiteLocations();
  const today = todayKey();

  return (
    <SitePage config="taxContact">
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Contact"
          title="Send a message, or ring an office."
          lead="A person reads every message, usually the same working day. If it is urgent — a notice with a deadline this week — ring instead."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Contact" }]}
        />

        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "A person reads your message the same working day.",
                  "You get a reply by email, or a call if it needs one.",
                  "If it is about a return or an invoice, we look the file up first.",
                ]}
                links={[
                  { to: "/tax", label: "Back to the site" },
                  { to: "/tax/book", label: "Book a consultation" },
                  { to: "/tax/faq", label: "Tax FAQ" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="contact-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField id="ct_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="ct_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="ct_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <SelectField
                    id="ct_topic"
                    name="topic"
                    label="What's it about?"
                    required
                    ask="What's it about"
                    options={TOPICS}
                    error={f.errors.topic}
                  />
                  <div className="tax-field">
                    <label htmlFor="ct_message">Your message</label>
                    <textarea
                      id="ct_message"
                      name="message"
                      rows={5}
                      required
                      minLength={5}
                      data-copilot-ask="What would you like to say?"
                      aria-invalid={f.errors.message ? true : undefined}
                      aria-describedby={f.errors.message ? "ct_message-error" : undefined}
                    />
                    {f.errors.message && (
                      <p className="tax-error" id="ct_message-error" role="alert">
                        {f.errors.message}
                      </p>
                    )}
                  </div>

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Send message"}
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
              About a return you have already filed?{" "}
              <Link to="/tax/portal" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                The portal
              </Link>{" "}
              reaches your preparer directly, and keeps the documents together.
            </p>
          </div>

          <aside className="tax-tool-aside">
            <h2 className="tax-h3" style={{ marginBottom: "0.75rem" }}>
              The offices
            </h2>
            {locations.loading && <SkeletonCards count={3} height="6rem" />}
            {locations.error && <ErrorBox error={locations.error} onRetry={locations.reload} />}
            {(locations.data?.locations ?? []).map((o) => (
              <div className="tax-card" key={o.id} data-testid="location-card" style={{ marginBottom: "0.75rem" }}>
                <h3 className="tax-h3">{o.name}</h3>
                <p className="tax-small" style={{ margin: "0 0 0.375rem", color: "hsl(var(--tax-ink-soft))" }}>
                  {o.street}
                  <br />
                  {o.city}, {o.state} {o.zip}
                </p>
                <p className="tax-small" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0 0 0.25rem" }}>
                  <Phone size={13} aria-hidden="true" />
                  <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} style={{ textDecoration: "none", fontWeight: 600 }}>
                    {o.phone}
                  </a>
                </p>
                <p className="tax-tiny tax-muted" style={{ margin: 0 }}>
                  Today: {hoursText(o.hours?.[today])}
                </p>
              </div>
            ))}
            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">Or book a time</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Fifteen minutes with a preparer, free, at a time you pick from the open ones.
              </p>
              <Link to="/tax/schedule" className="tax-btn" style={{ width: "100%" }}>
                See open times
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
