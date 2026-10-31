/**
 * Refer a friend (form `referral`). The server needs an email or a phone for the friend, so the note under the
 * fields says so plainly.
 */

import { Link } from "react-router-dom";
import { HeartHandshake } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, NotesField, SelectField, TextField,
} from "@/components/tax/FormKit";

const RELATIONSHIPS = [
  { value: "family", label: "Family", also: "family, relative, my brother, my sister, my mother, my father" },
  { value: "friend", label: "Friend", also: "friend" },
  { value: "colleague", label: "Colleague", also: "colleague, coworker, work" },
  { value: "client", label: "Another client", also: "client, also a client" },
  { value: "other", label: "Other", also: "other" },
];

const SERVICES = [
  { value: "individual", label: "Individual return", also: "tax return, individual" },
  { value: "business", label: "Business taxes", also: "business" },
  { value: "bookkeeping", label: "Bookkeeping", also: "bookkeeping" },
  { value: "payroll", label: "Payroll", also: "payroll" },
  { value: "notice", label: "An IRS notice", also: "notice, letter" },
  { value: "planning", label: "Tax planning", also: "planning" },
];

export default function TaxRefer() {
  useTaxTitle("Refer a friend");
  const f = useSiteForm("referral");

  return (
    <SitePage config="taxRefer">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Refer a friend</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Send someone our way.
            </h1>
            <p className="tax-lead">
              Most of the people who come to us were sent by someone already here. Tell us who, and we will
              write to them once.
            </p>

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">What happens, exactly</h2>
              <ul className="tax-list">
                <li>We contact your friend once, to say you referred them, and then we stop.</li>
                <li>No follow-up letters, no second call, no mailing list.</li>
                <li>If they get in touch, we treat it as any new enquiry: a free call, then a quote.</li>
                <li>We never tell them anything about you, or that you are a client, unless you say so.</li>
              </ul>
              <p className="tax-small" style={{ display: "flex", gap: "0.375rem", alignItems: "flex-start", marginTop: "0.75rem", marginBottom: 0 }}>
                <HeartHandshake size={14} aria-hidden="true" style={{ flex: "none", marginTop: 3 }} />
                We do not pay referral fees, and there is no discount attached. It is just an introduction.
              </p>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "We write to your friend once, to say you referred them. Nothing more.",
                  "If they reply, they get the same free first call as anyone else.",
                  "You hear nothing further from us about it unless you ask.",
                ]}
                links={[
                  { to: "/tax/services", label: "Our services" },
                  { to: "/tax/reviews", label: "Reviews" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="referral-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <TextField
                    id="rf_your_name"
                    name="your_name"
                    label="Your name"
                    autoComplete="name"
                    required
                    spell
                    ask="What's your full name?"
                    placeholder="e.g. Jordan Example"
                    error={f.errors.your_name}
                  />
                  <TextField
                    id="rf_your_email"
                    name="your_email"
                    label="Your email"
                    type="email"
                    autoComplete="email"
                    required
                    ask="And your email?"
                    placeholder="e.g. jordan@example.com"
                    error={f.errors.your_email}
                  />
                  <TextField
                    id="rf_friend_name"
                    name="friend_name"
                    label="Your friend's name"
                    required
                    spell
                    ask="What's your friend's full name?"
                    placeholder="e.g. Sam Example"
                    error={f.errors.friend_name}
                  />
                  <TextField
                    id="rf_friend_email"
                    name="friend_email"
                    label="Their email"
                    type="email"
                    optional
                    ask="What's their email? Say none if you don't have it."
                    placeholder="e.g. sam@example.com"
                    hint="Their email or their phone, so we can reach them once."
                    error={f.errors.friend_email}
                  />
                  <TextField
                    id="rf_friend_phone"
                    name="friend_phone"
                    label="Their phone"
                    type="tel"
                    optional
                    ask="And their phone number? Say none if you don't have it."
                    placeholder="e.g. (555) 010-0188"
                    error={f.errors.friend_phone}
                  />
                  <SelectField
                    id="rf_relationship"
                    name="relationship"
                    label="How do you know them?"
                    required
                    ask="How do you know them"
                    options={RELATIONSHIPS}
                    error={f.errors.relationship}
                  />
                  <SelectField
                    id="rf_service"
                    name="service"
                    label="What do they need help with?"
                    required
                    ask="What do they need help with"
                    options={SERVICES}
                    error={f.errors.service}
                  />
                  <NotesField id="rf_notes" ask="Anything we should know before we write to them? Say none if not." />

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <p className="tax-form-note" style={{ marginBottom: "0.75rem" }}>
                    We'll only contact your friend once, and only to say you referred them.
                  </p>

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Send referral"}
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
              Rather send them a link?{" "}
              <Link to="/tax/book" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                The consultation form
              </Link>{" "}
              is the quickest way in.
            </p>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
