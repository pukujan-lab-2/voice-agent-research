/**
 * Terms, short and plain: a demo site, no advice, no relationship, no warranty.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";

export default function TaxTerms() {
  useTaxTitle("Terms");

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <div className="tax-wrap-narrow" style={{ padding: 0 }}>
          <PageHead
            eyebrow="Terms"
            title="Terms of use."
            crumbs={[{ label: "Home", to: "/tax" }, { label: "Terms" }]}
          />

          <p className="tax-notice">
            <strong>A demo site, not a firm.</strong> Brindlewick Tax &amp; Accounting does not exist. Nothing
            here is a service you can buy, an engagement you can enter into, or advice you can rely on.
          </p>

          <div className="tax-prose">
            <h2>What this site is</h2>
            <p>
              A demonstration of a website with a voice assistant, built by Website Copilot. The firm, its
              people, prices, addresses, telephone numbers and reviews are invented. Every telephone number is
              in the 555-01xx range reserved for fiction, and every email address ends in{" "}
              <code>@example.com</code>.
            </p>

            <h2>No advice, no relationship</h2>
            <p>
              Nothing on this site is tax, legal, accounting or financial advice. Sending a form does not
              create a client relationship, and no one will act on it. The calculators produce rough
              illustrations from published figures; they do not know your circumstances and must not be used
              to file anything.
            </p>
            <p>
              The Tax Guides library reproduces U.S. government works from irs.gov, which are in the public
              domain. They are shown as published. Reading them here is not the same as advice on your own
              return.
            </p>

            <h2>What you type</h2>
            <p>
              The forms save sample records in a demonstration database. Do not enter real personal, financial
              or tax information. If you do, treat it as public: the database is reset from time to time and
              is not secured like a real practice's records.
            </p>

            <h2>Availability and liability</h2>
            <p>
              The site is provided as it is, with no warranty of any kind. It may be changed, broken or taken
              down without notice. Nothing in these terms limits any liability that cannot lawfully be
              limited.
            </p>

            <h2>Third-party links</h2>
            <p>
              Links to irs.gov and other sites are provided so you can read the original documents. Those
              sites have their own terms, and we have no control over them.
            </p>

            <h2>Questions</h2>
            <p>
              <Link to="/tax/privacy" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                The privacy note
              </Link>{" "}
              explains what is stored, and{" "}
              <Link to="/" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                the project's home page
              </Link>{" "}
              explains what this demonstration is.
            </p>
          </div>

          <div className="tax-btn-row" style={{ marginTop: "1.5rem" }}>
            <Link to="/tax/privacy" className="tax-btn tax-btn-outline">
              Privacy
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
