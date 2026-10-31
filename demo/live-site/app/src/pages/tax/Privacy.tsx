/**
 * Privacy, short and plain: what this demo site does with what you type, and what a real firm would do.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";

export default function TaxPrivacy() {
  useTaxTitle("Privacy");

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <div className="tax-wrap-narrow" style={{ padding: 0 }}>
          <PageHead
            eyebrow="Privacy"
            title="Privacy, in plain English."
            crumbs={[{ label: "Home", to: "/tax" }, { label: "Privacy" }]}
          />

          <p className="tax-notice">
            <strong>This is a demo site.</strong> Brindlewick is fictional. The forms here save sample
            records in a demonstration database, so please do not enter real personal or tax information.
          </p>

          <div className="tax-prose">
            <h2>What happens to what you type</h2>
            <p>
              Every form on this site writes to a demonstration database. Nothing is sent to the IRS, to a
              bank, or to any real firm. Drafts are saved in your own browser's session storage and in the
              same demo database so that a half-filled form survives a page change; they are deleted when
              the form is sent, or when you close the tab.
            </p>
            <p>
              Files you upload — a photograph of a notice, a résumé — go to the same demonstration storage
              and are kept with the sample record they belong to. Nothing is opened by a person, and the
              whole database is reset from time to time.
            </p>

            <h2>Cookies and tracking</h2>
            <p>
              This site sets no advertising cookies and runs no analytics. The only things stored in your
              browser are a draft reference for each form, which lives in session storage and disappears when
              you close the tab, and a sign-in token for the client portal and the staff app, which is also
              session-only.
            </p>

            <h2>Your choices</h2>
            <p>
              You can clear anything this site has stored by closing the tab, or by clearing site data in
              your browser. There is nothing to unsubscribe from and no account to delete.
            </p>

            <h2>What a real firm would tell you</h2>
            <p>
              A real tax practice holds far more: Social Security numbers, income documents, bank details
              and the returns themselves. It is bound by professional confidentiality rules, must give you a
              written privacy notice under the Gramm-Leach-Bliley Act, and must tell you how to complain if
              something goes wrong. None of that applies here, because there is nothing real to protect.
            </p>

            <h2>Questions</h2>
            <p>
              The demonstration is run by Website Copilot.{" "}
              <Link to="/" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                The project's home page
              </Link>{" "}
              explains what it is and lists the other demo sites.
            </p>
          </div>

          <div className="tax-btn-row" style={{ marginTop: "1.5rem" }}>
            <Link to="/tax/terms" className="tax-btn tax-btn-outline">
              Terms of use
            </Link>
            <Link to="/tax/contact" className="tax-btn tax-btn-outline">
              Contact
            </Link>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
