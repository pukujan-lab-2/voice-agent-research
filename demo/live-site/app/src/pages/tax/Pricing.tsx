import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { useTaxTitle } from "@/lib/tax";

const RETURNS = [
  {
    title: "Simple return",
    price: "$295",
    note: "Federal and one state",
    points: [
      "W-2 income, standard deduction",
      "Interest and dividends under $1,500",
      "No dependents, no business income",
      "Usually an hour of our time",
    ],
  },
  {
    title: "Standard return",
    price: "$450",
    note: "Federal and one state",
    points: [
      "Itemised deductions or dependents",
      "One or two Schedule C businesses",
      "Retirement and Social Security income",
      "Most years, most households",
    ],
  },
  {
    title: "Complex return",
    price: "from $795",
    note: "Quoted after the first call",
    points: [
      "Rental property or K-1 income",
      "Share awards, options or a sale",
      "Multi-state returns",
      "Second-preparer review included",
    ],
  },
];

const BOOKS = [
  {
    title: "Books Lite",
    price: "$180",
    note: "a month",
    points: ["Up to 60 transactions", "Monthly reconciliation", "Monthly one-page summary", "Quarterly estimates"],
  },
  {
    title: "Books Standard",
    price: "$340",
    note: "a month",
    points: ["Up to 180 transactions", "Monthly close and summary", "Quarterly estimates", "Year-end pack"],
  },
  {
    title: "Books Full",
    price: "from $560",
    note: "a month",
    points: ["Up to 400 transactions", "Invoicing and receivables", "Monthly call", "Year-end pack and return"],
  },
];

const FAQ = [
  {
    q: "Why are prices 'from' rather than fixed?",
    a: "Because a return with three rental properties is not the same job as a return with one W-2. We look at what's involved on the free call, then send a fixed written quote. The number on the quote is the number on the invoice.",
  },
  {
    q: "Do you charge by the hour for returns?",
    a: "No. Returns and bookkeeping are fixed fees, so you are not paying for a slow afternoon. Only tax planning and unusual advisory work is billed hourly, at $200, quoted in advance.",
  },
  {
    q: "Is the first call really free?",
    a: "Yes, fifteen minutes and no charge. It is how we work out whether we can help and what the job costs. You are under no obligation afterwards.",
  },
  {
    q: "What affects the price most?",
    a: "The number of different income sources, how many states are involved, how complete your records are, and whether you need a return filed late. Anything unusual we quote separately and in writing.",
  },
  {
    q: "Do you offer payment plans?",
    a: "Yes. Fees over $1,000 can be paid in three instalments. Your tax bill is separate and is paid to the IRS, not to us.",
  },
  {
    q: "What if I only need an hour of advice?",
    a: "Then book an hour of planning at $200. You do not have to become a full-service client.",
  },
];

export default function TaxPricing() {
  useTaxTitle("Pricing");

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">Pricing</span>
        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          Published fees, quoted before we start.
        </h1>
        <p className="tax-lead">
          Nobody likes finding out what a return cost after it has been filed. Everything below is
          what we actually charge; where a job varies, the range is shown and the exact figure is
          fixed in writing first.
        </p>

        <h2 className="tax-h2">Individual returns</h2>
        <p className="tax-p tax-small">
          Federal and one state return included. An additional state is $85. Prior-year catch-up
          returns are charged at the same rate as current-year returns.
        </p>
        <div className="tax-price-grid">
          {RETURNS.map((r) => (
            <div key={r.title} className="tax-price-card">
              <h3 className="tax-h3">{r.title}</h3>
              <p className="tax-price">{r.price}</p>
              <p className="tax-price-note">{r.note}</p>
              <ul className="tax-list" style={{ flex: 1 }}>
                {r.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link to="/tax/book" className="tax-btn tax-btn-outline" style={{ marginTop: "1rem" }}>
                Book a consultation
              </Link>
            </div>
          ))}
        </div>

        <h2 className="tax-h2">Bookkeeping, monthly</h2>
        <p className="tax-p tax-small">
          Priced by transaction volume, not by turnover. Catch-up work behind the start date is
          quoted separately at the same tier rate plus a one-off $150 setup.
        </p>
        <div className="tax-price-grid">
          {BOOKS.map((b) => (
            <div key={b.title} className="tax-price-card">
              <h3 className="tax-h3">{b.title}</h3>
              <p className="tax-price">
                {b.price} <span style={{ fontSize: "0.875rem", fontFamily: "var(--tax-sans)", color: "hsl(var(--tax-muted))" }}>{b.note}</span>
              </p>
              <p className="tax-price-note">Cancel with 30 days' notice</p>
              <ul className="tax-list" style={{ flex: 1 }}>
                {b.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <Link to="/tax/book" className="tax-btn tax-btn-outline" style={{ marginTop: "1rem" }}>
                Book a consultation
              </Link>
            </div>
          ))}
        </div>

        <h2 className="tax-h2">Payroll, notices and planning</h2>
        <div className="tax-grid tax-grid-3">
          <div className="tax-price-card">
            <h3 className="tax-h3">Payroll</h3>
            <p className="tax-price">$45</p>
            <p className="tax-price-note">a month, plus $6 per employee</p>
            <ul className="tax-list">
              <li>Pay runs and direct deposit</li>
              <li>Forms 941 and 940</li>
              <li>Forms W-2 and W-3</li>
              <li>New-hire setup</li>
            </ul>
          </div>
          <div className="tax-price-card">
            <h3 className="tax-h3">IRS notice help</h3>
            <p className="tax-price">$250</p>
            <p className="tax-price-note">flat fee, per notice</p>
            <ul className="tax-list">
              <li>Reading and explaining the notice</li>
              <li>Checking it against your return</li>
              <li>A written reply under power of attorney</li>
              <li>Penalty abatement where it applies, quoted separately</li>
            </ul>
          </div>
          <div className="tax-price-card">
            <h3 className="tax-h3">Tax planning</h3>
            <p className="tax-price">$200</p>
            <p className="tax-price-note">an hour, quoted in advance</p>
            <ul className="tax-list">
              <li>Year-to-date review</li>
              <li>A projection and written options</li>
              <li>An estimate schedule</li>
              <li>Follow-up call in January</li>
            </ul>
          </div>
        </div>

        <h2 className="tax-h2">What affects the price</h2>
        <div className="tax-card">
          <ul className="tax-list">
            <li><strong>Income sources.</strong> Each 1099, K-1, rental property or state adds work, and adds to the quote.</li>
            <li><strong>How complete your records are.</strong> A tidy folder is cheaper than a shoebox. If we have to reconstruct a year, that is quoted as catch-up work.</li>
            <li><strong>Deadlines.</strong> A return needed inside five working days carries a $100 rush fee, and we will say so before starting.</li>
            <li><strong>Late filing.</strong> Prior-year returns are the same price, but penalty abatement or a payment plan is a separate flat fee.</li>
            <li><strong>Complexity we can see.</strong> Share plans, crypto, foreign accounts and business sales are quoted after the first call, never guessed.</li>
          </ul>
        </div>

        <h2 className="tax-h2">Pricing questions</h2>
        <div className="tax-grid" style={{ gap: "0.75rem" }}>
          {FAQ.map((f) => (
            <details key={f.q} className="tax-faq-item">
              <summary>{f.q}</summary>
              <div className="tax-faq-body">
                <p>{f.a}</p>
              </div>
            </details>
          ))}
        </div>

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2rem" }}>
          <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
            The quote is the price
          </h2>
          <p className="tax-p">
            We do not bill by the hour for returns and we do not add "review time" at the end. If
            the job turns out to be bigger than we thought, we call you before doing the extra work.
          </p>
          <div className="tax-btn-row">
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
