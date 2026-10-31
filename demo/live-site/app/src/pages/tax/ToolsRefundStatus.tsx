/**
 * Where's my refund: an explainer of what each refund status means and how long each stage usually takes, with
 * a link to the IRS's own tool. The wording is plain and claims nothing beyond what the IRS publishes; the
 * library link goes to the guides rather than restating them as fact.
 */

import { Link } from "react-router-dom";
import { ArrowUpRight, Clock, FileText } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";

const STAGES = [
  {
    status: "Return received",
    means:
      "The IRS has your return and has begun to process it. Nothing is wrong at this stage: it is where every return starts, including the ones that arrive perfectly.",
    timing: "Usually within 24 hours of an e-filed return being accepted.",
  },
  {
    status: "Refund approved",
    means:
      "The return has been checked and the refund has been allowed. The amount is now fixed; the next step is the payment itself.",
    timing: "Often a few days after the return is received, longer if a credit needs checking.",
  },
  {
    status: "Refund sent",
    means:
      "The money has left the IRS. With direct deposit it usually lands in two or three working days; a paper cheque can take three or four weeks, and the bank may hold it.",
    timing: "Direct deposit is the faster route. Have the account details exactly right: a wrong number sends the refund back.",
  },
  {
    status: "Still being processed",
    means:
      "Something on the return needs a person to look at it, or a figure needs checking against a document the IRS holds. It does not mean the return is wrong, but it does mean waiting.",
    timing: "Often four to six weeks. If a letter arrives, answer it rather than filing again.",
  },
  {
    status: "No information available",
    means:
      "The IRS cannot show a status yet. This is common in the first days after filing, and for paper returns, which take much longer to reach the system.",
    timing: "Paper returns can take six weeks or more to appear. Wait a few days before checking again.",
  },
];

export default function TaxToolsRefundStatus() {
  useTaxTitle("Where's my refund");

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Tools"
          title="What each refund status means."
          lead="The IRS's Where's My Refund tool shows one of five messages. Here is what each one is actually saying, and how long that stage usually takes."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Where's my refund" }]}
        />

        <div className="tax-tool">
          <div style={{ minWidth: 0 }}>
            <div className="tax-card" style={{ marginBottom: "1.25rem" }}>
              <h2 className="tax-h3">Check it at the source</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                The only place with your actual refund is the IRS's own tool. It asks for your Social
                Security number, your filing status and the exact refund amount on the return, and it
                updates once a day, usually overnight.
              </p>
              <a
                href="https://www.irs.gov/refunds"
                target="_blank"
                rel="noreferrer noopener"
                className="tax-btn"
              >
                Where's My Refund on IRS.gov
                <ArrowUpRight size={15} aria-hidden="true" />
              </a>
              <p className="tax-tiny tax-muted" style={{ marginTop: "0.625rem", marginBottom: 0 }}>
                Brindlewick has no access to the IRS's refund system. If you are a client, your preparer can
                see the return and any letter, but not the payment itself.
              </p>
            </div>

            {STAGES.map((s) => (
              <section className="tax-card" key={s.status} style={{ marginBottom: "0.75rem" }}>
                <h2 className="tax-h3">{s.status}</h2>
                <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                  {s.means}
                </p>
                <p className="tax-small" style={{ display: "flex", gap: "0.375rem", color: "hsl(var(--tax-muted))", margin: 0 }}>
                  <Clock size={14} aria-hidden="true" style={{ flex: "none", marginTop: 3 }} />
                  {s.timing}
                </p>
              </section>
            ))}

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">If it has been longer than that</h2>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                Ring the office. A return that has gone quiet is usually one where the IRS has sent a letter
                to an old address. We can pull the transcript, see what it is waiting for, and answer it.
              </p>
              <div className="tax-btn-row" style={{ marginTop: "0.875rem" }}>
                <Link to="/tax/contact" className="tax-btn tax-btn-outline">
                  Contact the office
                </Link>
                <Link to="/tax/notice" className="tax-btn tax-btn-outline">
                  Send us a notice
                </Link>
              </div>
            </div>
          </div>

          <aside className="tax-tool-aside">
            <div className="tax-card">
              <h2 className="tax-h3">The rules behind it</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Refund timing, offsets and the interest the IRS pays on a late refund are all set out in the
                publications.
              </p>
              <Link to="/tax/guides" className="tax-btn tax-btn-outline" style={{ width: "100%" }}>
                <FileText size={15} aria-hidden="true" /> Tax Guides
              </Link>
            </div>
            <div className="tax-card tax-card-quiet" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">A letter arrived?</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Most refund delays come with a notice. Send us a photograph of it and we will tell you what
                it is asking for.
              </p>
              <Link to="/tax/notice" className="tax-btn" style={{ width: "100%" }}>
                Send a notice
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
