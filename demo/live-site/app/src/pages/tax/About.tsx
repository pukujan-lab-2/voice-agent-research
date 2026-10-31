/**
 * About: the firm's story (fictional, founded 2009, three offices), the values, the credentials, and the demo
 * explanation kept from the original page.
 */

import { Link } from "react-router-dom";
import { ArrowRight, BookOpen, Building2, Info, Scale, ShieldCheck } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { PageHead } from "@/components/tax/SiteUi";
import { IRS_LINE, TaxNotice } from "@/components/tax/TaxNotice";
import { useTaxTitle } from "@/lib/tax";

const VALUES = [
  {
    title: "The person who does the work is the person you talk to",
    text: "There is no account manager between you and your preparer. When you ring, you get the person who has your file open, and they know what is in it.",
  },
  {
    title: "Every return is read twice",
    text: "A second preparer reads the whole return before it is filed. It is the cheapest error we ever catch, and it is included in the fee rather than billed as review time.",
  },
  {
    title: "The price is agreed before the work starts",
    text: "We quote in writing once we know what is involved, and the quote is the invoice. If the job turns out to be bigger than we thought, we call before doing the extra work.",
  },
  {
    title: "Plain English, and the source",
    text: "When we explain a rule we tell you where it comes from, and we keep the IRS publication on the shelf so you can read it yourself.",
  },
];

export default function TaxAbout() {
  useTaxTitle("About us");

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="About us"
          title="A small firm, deliberately."
          lead="Brindlewick has prepared returns from the same three offices since 2009. We have grown to fourteen people and stopped there, because the thing clients come for — the same preparer, every year, who knows the file — stops working when a firm gets much bigger."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "About us" }]}
        />

        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <div className="tax-prose">
              <h2>How it started</h2>
              <p>
                The firm began in 2009 in a single room above a bookshop in Harrow Falls, with one enrolled
                agent and forty clients who had followed her out of a national practice. The idea was
                simple: keep the practice small enough that the person preparing the return is the person
                answering the telephone, and charge a fixed fee agreed before the work begins.
              </p>
              <p>
                Seventeen years later there are fourteen of us across three offices, and the same two rules
                still apply. We take on roughly sixty new households and thirty new businesses a year, which
                is about as many as the team can serve properly.
              </p>

              <h2>The offices</h2>
              <p>
                Harrow Falls is the original office and still where the review happens. Corbel opened in 2014
                to serve the trades and restaurants along the valley, and Millbrook in 2019, mostly for
                owner-run businesses and the people who work in them. All three are open Monday to Friday,
                and all three will see you by video if the drive is too far.
              </p>

              <h2>What we are</h2>
              <p>
                A tax and accounting practice: individual and business returns, bookkeeping, payroll, notice
                work and planning. We are not financial advisers and we do not sell investments, insurance or
                any product on commission. If a question needs an adviser or a lawyer, we will say so and
                work alongside them with your permission.
              </p>
            </div>

            <h2 className="tax-h2">What we hold to</h2>
            <div className="tax-grid tax-grid-2">
              {VALUES.map((v) => (
                <div className="tax-card" key={v.title}>
                  <span className="tax-icon-badge">
                    <ShieldCheck size={18} aria-hidden="true" />
                  </span>
                  <h3 className="tax-h3">{v.title}</h3>
                  <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
                    {v.text}
                  </p>
                </div>
              ))}
            </div>

            <h2 className="tax-h2">Credentials</h2>
            <div className="tax-card">
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                The practice prepares returns under enrolled agents and certified public accountants. An
                enrolled agent is licensed by the federal government to represent taxpayers before the IRS; a
                CPA is licensed by the state. Both can sign a return and both can act for you under a power of
                attorney.
              </p>
              <ul className="tax-list">
                <li>Preparers hold, or are studying for, the enrolled agent or CPA credential.</li>
                <li>Forty hours of continuing education a year, paid by the firm.</li>
                <li>Written engagement letters, and a named reviewer on every return.</li>
                <li>Client records kept for seven years and returned on request.</li>
                <li>Professional indemnity cover, and a written complaints procedure.</li>
              </ul>
            </div>

            <h2 className="tax-h2">This is a demo</h2>
            <TaxNotice />
            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <span className="tax-icon-badge">
                <Building2 size={18} aria-hidden="true" />
              </span>
              <h3 className="tax-h3">The firm is fictional</h3>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                Brindlewick Tax &amp; Accounting does not exist. Its people, prices, addresses, telephone
                numbers, reviews and credentials were written for this demonstration. Every telephone number
                is in the 555-01xx range reserved for fiction, and every email address ends in{" "}
                <code>@example.com</code>. The forms on this site save sample records in a demo database; do
                not enter real personal or tax information.
              </p>
            </div>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <span className="tax-icon-badge">
                <Info size={18} aria-hidden="true" />
              </span>
              <h3 className="tax-h3">It demonstrates Website Copilot</h3>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                This is one of several fictional sites built to show what a voice assistant can do on a real
                website. Tap <strong>Start voice call</strong> at the bottom of the screen and the assistant
                will talk to you, answer general tax questions from the guides, take you from page to page,
                open the page it quoted, and fill in any of the forms with you. It never presses the submit
                button: you do.
              </p>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                The other demos are a children's clinic, an appliance repair service, a design studio, an IT
                help desk and a pension fund.{" "}
                <Link to="/" style={{ color: "hsl(var(--tax-accent))", fontWeight: 600 }}>
                  See them all on the Website Copilot home page
                </Link>
                .
              </p>
            </div>

            <div className="tax-card" style={{ marginBottom: "1rem" }}>
              <span className="tax-icon-badge">
                <BookOpen size={18} aria-hidden="true" />
              </span>
              <h3 className="tax-h3">The tax guides are real</h3>
              <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
                The Tax Guides library is not invented. It holds hundreds of pages published by the Internal
                Revenue Service on irs.gov — publications, form instructions, Tax Topics and the IRS FAQ —
                reproduced in full, with a link to the original on every page. These are U.S. government works
                and are in the public domain, which is why they can be shown here.
              </p>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>{IRS_LINE}</p>
            </div>

            <div className="tax-card tax-card-quiet">
              <span className="tax-icon-badge">
                <Scale size={18} aria-hidden="true" />
              </span>
              <h3 className="tax-h3">Not tax advice</h3>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
                Nothing on this site is tax advice, and the assistant will not give advice on your own
                situation. It answers general questions by quoting the IRS guides and showing you where the
                quotation came from. For anything involving your own return, speak to a qualified
                professional — in real life, not here.
              </p>
            </div>
          </div>

          <aside className="tax-sidecard">
            <h2 className="tax-h3">The firm at a glance</h2>
            <ul className="tax-list" style={{ marginBottom: "0.875rem" }}>
              <li>Founded in 2009, in Harrow Falls</li>
              <li>Nineteen people across three offices</li>
              <li>Enrolled agents and CPAs</li>
              <li>Households and owner-run businesses</li>
              <li>Fixed quotes, agreed in writing</li>
            </ul>
            <Link to="/tax/team" className="tax-btn" style={{ width: "100%" }}>
              Meet the team <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <div className="tax-sidecard-row">
              <p>
                <Link to="/tax/locations" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                  The three offices →
                </Link>
                <br />
                Addresses, phones and opening hours.
              </p>
            </div>
            <div className="tax-sidecard-row">
              <p>
                <Link to="/tax/careers" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                  Work here →
                </Link>
                <br />
                Two or three people a year, read by a partner.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
