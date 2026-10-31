import { Link } from "react-router-dom";
import { ArrowRight, Info, BookOpen, Building2 } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { IRS_LINE, TaxNotice } from "@/components/tax/TaxNotice";
import { useTaxTitle } from "@/lib/tax";

export default function TaxAbout() {
  useTaxTitle("About this demo");

  return (
    <TaxLayout>
      <div className="tax-wrap-narrow tax-section">
        <span className="tax-eyebrow">About this demo</span>
        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          What this site is, and what it isn't.
        </h1>

        <TaxNotice />

        <div className="tax-card" style={{ marginBottom: "1rem" }}>
          <span className="tax-icon-badge">
            <Building2 size={20} aria-hidden="true" />
          </span>
          <h2 className="tax-h3">The firm is fictional</h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
            Brindlewick Tax &amp; Accounting does not exist. Its people, prices, address, telephone
            numbers, client quotation and credentials were written for this demonstration. The
            address in Harrow Falls is invented, every telephone number is in the 555-01xx range
            reserved for fiction, and every email address ends in <code>@example.com</code>. Nothing
            you type into any form on this site is sent, stored or seen by anyone.
          </p>
        </div>

        <div className="tax-card" style={{ marginBottom: "1rem" }}>
          <span className="tax-icon-badge">
            <Info size={20} aria-hidden="true" />
          </span>
          <h2 className="tax-h3">It demonstrates Website Copilot</h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
            This is one of several fictional sites built to show what a voice assistant can do on a
            real website. Tap <strong>Start voice call</strong> at the bottom of the screen and the
            assistant will talk to you, answer general tax questions from the guides, take you from
            page to page, open the page it quoted, and fill in the consultation form with you. It
            never presses the submit button: you do.
          </p>
          <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
            The other demos are a children's clinic, an appliance repair service, a design studio,
            an IT help desk and a pension fund.{" "}
            <Link to="/" style={{ color: "hsl(var(--tax-accent))", fontWeight: 600 }}>
              See them all on the Website Copilot home page
            </Link>
            .
          </p>
        </div>

        <div className="tax-card" style={{ marginBottom: "1rem" }}>
          <span className="tax-icon-badge">
            <BookOpen size={20} aria-hidden="true" />
          </span>
          <h2 className="tax-h3">The tax guides are real</h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
            The Tax Guides library is not invented. It holds 296 pages published by the Internal
            Revenue Service on irs.gov — publications, form instructions, Tax Topics and the IRS
            FAQ — reproduced in full, with a link to the original on every page. These are U.S.
            government works and are in the public domain, which is why they can be shown here.
          </p>
          <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>{IRS_LINE}</p>
        </div>

        <div className="tax-card tax-card-quiet" style={{ marginBottom: "1rem" }}>
          <h2 className="tax-h3">Not tax advice</h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
            Nothing on this site is tax advice, and the assistant will not give advice on your own
            situation. It answers general questions by quoting the IRS guides and showing you where
            the quotation came from. For anything involving your own return, speak to a qualified
            professional — in real life, not here.
          </p>
        </div>

        <div className="tax-btn-row">
          <Link to="/tax/guides" className="tax-btn">
            Browse the guides <ArrowRight size={16} />
          </Link>
          <Link to="/tax/book" className="tax-btn tax-btn-outline">
            See the consultation form
          </Link>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
