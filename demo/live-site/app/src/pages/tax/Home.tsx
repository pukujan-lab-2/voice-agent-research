import { Link } from "react-router-dom";
import {
  FileText,
  BookOpen,
  Users,
  ShieldAlert,
  Compass,
  ArrowRight,
  Check,
  MessageCircle,
} from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { askAssistant, useTaxTitle } from "@/lib/tax";

const SUGGESTED = [
  "When are quarterly estimated tax payments due?",
  "Is there an age limit on claiming my child as a dependent?",
  "What expenses qualify for an education credit?",
  "Is the loss on the sale of my home deductible?",
  "How can I check the status of my amended return?",
  "Are business gifts deductible?",
];

const SERVICES = [
  {
    to: "/tax/services/individual-returns",
    icon: FileText,
    title: "Individual tax returns",
    text: "Federal and state returns for employees, freelancers, retirees and families. Prepared carefully, reviewed twice, filed on time.",
  },
  {
    to: "/tax/services/bookkeeping",
    icon: BookOpen,
    title: "Small-business bookkeeping",
    text: "Clean, current books every month, so you always know what you earned and what you owe.",
  },
  {
    to: "/tax/services/payroll",
    icon: Users,
    title: "Payroll",
    text: "Pay runs, deposits and W-2s handled for small teams, with the filings done on schedule.",
  },
  {
    to: "/tax/services/irs-notices",
    icon: ShieldAlert,
    title: "IRS notice help",
    text: "A letter from the IRS is rarely as bad as it looks. We read it, work out what it wants and reply for you.",
  },
  {
    to: "/tax/services/planning",
    icon: Compass,
    title: "Tax planning",
    text: "A quiet hour in the autumn can save more than a rushed week in April. Estimates, withholding, retirement, big sales.",
  },
];

const STEPS = [
  {
    title: "Send the form",
    text: "Tell us who you are, which years you need help with and how to reach you. It takes about two minutes.",
  },
  {
    title: "A short call",
    text: "A preparer rings you at the time you chose. Fifteen minutes, no charge, no obligation, no documents needed yet.",
  },
  {
    title: "A fixed quote",
    text: "After the call we send a written quote and a short list of what to send. The price we quote is the price we charge.",
  },
];

function HeroArt() {
  return (
    <svg viewBox="0 0 320 260" role="img" aria-label="An illustration of a ledger page, a pencil and a leaf">
      <defs>
        <linearGradient id="taxGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(158 32% 20%)" />
          <stop offset="100%" stopColor="hsl(158 30% 30%)" />
        </linearGradient>
      </defs>
      <circle cx="252" cy="58" r="42" fill="hsl(20 60% 90%)" />
      <circle cx="64" cy="214" r="30" fill="hsl(36 45% 88%)" />
      <rect x="62" y="34" width="168" height="196" rx="12" fill="hsl(0 0% 100%)" stroke="hsl(40 16% 85%)" />
      <rect x="86" y="62" width="76" height="9" rx="4.5" fill="url(#taxGrad)" />
      <rect x="86" y="84" width="120" height="6" rx="3" fill="hsl(40 12% 88%)" />
      <rect x="86" y="100" width="104" height="6" rx="3" fill="hsl(40 12% 88%)" />
      <rect x="86" y="126" width="120" height="1.5" fill="hsl(40 14% 88%)" />
      <rect x="86" y="140" width="58" height="6" rx="3" fill="hsl(40 12% 88%)" />
      <rect x="162" y="140" width="44" height="6" rx="3" fill="hsl(18 52% 72%)" />
      <rect x="86" y="158" width="72" height="6" rx="3" fill="hsl(40 12% 88%)" />
      <rect x="176" y="158" width="30" height="6" rx="3" fill="hsl(40 12% 88%)" />
      <rect x="86" y="184" width="120" height="1.5" fill="hsl(40 14% 88%)" />
      <rect x="86" y="198" width="46" height="6" rx="3" fill="hsl(40 12% 88%)" />
      <rect x="150" y="198" width="56" height="6" rx="3" fill="hsl(36 45% 70%)" />
      <g transform="rotate(-28 226 158)">
        <rect x="218" y="112" width="15" height="78" rx="4" fill="hsl(18 52% 47%)" />
        <path d="M218 190h15l-7.5 16z" fill="hsl(158 32% 22%)" />
        <rect x="218" y="112" width="15" height="10" rx="4" fill="hsl(36 45% 60%)" />
      </g>
      <path d="M252 96c14 0 22 12 18 24-3 10-14 16-18 22-4-6-15-12-18-22-4-12 4-24 18-24z" fill="hsl(150 28% 74%)" opacity="0.85" />
    </svg>
  );
}

export default function TaxHome() {
  useTaxTitle("Home");

  return (
    <TaxLayout>
      <section className="tax-hero">
        <div className="tax-hero-inner">
          <div>
            <span className="tax-eyebrow">Harrow Falls · Est. 2009</span>
            <h1 className="tax-h1">Calm, careful tax work for households and small businesses.</h1>
            <p className="tax-lead">
              A small private practice of enrolled agents and CPAs. We take the time to get the
              details right, explain what we did in plain English, and answer the phone in July as
              well as April.
            </p>
            <div className="tax-btn-row">
              <Link to="/tax/book" className="tax-btn">
                Book a consultation <ArrowRight size={16} />
              </Link>
              <Link to="/tax/services" className="tax-btn tax-btn-outline">
                See what we do
              </Link>
            </div>
            <ul className="tax-hero-points">
              <li>
                <Check size={14} aria-hidden="true" /> Fixed quotes before we start
              </li>
              <li>
                <Check size={14} aria-hidden="true" /> Your preparer's direct line
              </li>
              <li>
                <Check size={14} aria-hidden="true" /> We file, you don't chase
              </li>
            </ul>
          </div>
          <div className="tax-hero-art">
            <HeroArt />
          </div>
        </div>
      </section>

      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">What we do</span>
        <h2 className="tax-h2 tax-h2-lead">Five things, done properly.</h2>
        <p className="tax-p" style={{ maxWidth: "38rem" }}>
          We keep the practice deliberately small so that every return gets read by a second
          person before it goes out.
        </p>

        <div className="tax-grid tax-grid-2" style={{ marginTop: "1.25rem" }}>
          {SERVICES.map((s) => (
            <Link key={s.to} to={s.to} className="tax-card" style={{ textDecoration: "none" }}>
              <span className="tax-icon-badge">
                <s.icon size={20} aria-hidden="true" />
              </span>
              <h3 className="tax-h3">{s.title}</h3>
              <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
                {s.text}
              </p>
              <span className="tax-small" style={{ color: "hsl(var(--tax-accent))", fontWeight: 600 }}>
                Learn more →
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="tax-wrap tax-section-tight">
        <div className="tax-card tax-card-quiet">
          <span className="tax-eyebrow">How a first consultation works</span>
          <h2 className="tax-h2 tax-h2-lead">Three steps, and none of them cost anything.</h2>
          <div className="tax-steps" style={{ marginTop: "1rem" }}>
            {STEPS.map((s, i) => (
              <div key={s.title} className="tax-step">
                <span className="tax-step-num">{i + 1}</span>
                <h3 className="tax-h3">{s.title}</h3>
                <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
                  {s.text}
                </p>
              </div>
            ))}
          </div>
          <div className="tax-btn-row" style={{ marginTop: "1.25rem" }}>
            <Link to="/tax/book" className="tax-btn">
              Start with the form <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="tax-wrap tax-section-tight">
        <figure style={{ margin: 0 }}>
          <blockquote className="tax-quote">
            “I came in with three years of unfiled returns and a lot of shame about it. Nobody
            made me feel stupid. They just asked for one folder at a time.”
          </blockquote>
          <figcaption className="tax-small tax-muted">
            — A client of the firm, 2024. <em>A fictional quotation, written for this demo.</em>
          </figcaption>
        </figure>
      </div>

      <div className="tax-wrap tax-section">
        <div className="tax-card" style={{ background: "hsl(var(--tax-ink))", borderColor: "transparent" }}>
          <span className="tax-eyebrow" style={{ color: "hsl(20 60% 78%)" }}>
            <MessageCircle size={13} aria-hidden="true" /> Ask a tax question
          </span>
          <h2 className="tax-h2 tax-h2-lead" style={{ color: "hsl(40 34% 97%)" }}>
            Start the assistant and ask about the guides.
          </h2>
          <p style={{ color: "hsl(40 20% 84%)", fontSize: "0.9375rem", maxWidth: "36rem" }}>
            The assistant answers general questions from the firm's library of IRS publications,
            form instructions, Tax Topics, the tax code and regulations, and shows you the exact page it quoted.
            It can't advise on your own situation; a preparer can do that at a consultation.
          </p>
          <div className="tax-chips tax-chips-dark" style={{ marginTop: "1rem" }}>
            {SUGGESTED.map((q) => (
              <button
                key={q}
                type="button"
                className="tax-chip"
                data-testid="tax-chip"
                onClick={() => askAssistant(q)}
              >
                {q}
              </button>
            ))}
          </div>
          <p className="tax-tiny" style={{ color: "hsl(40 18% 72%)", marginTop: "0.875rem", marginBottom: 0 }}>
            Tap a question to start the call and send it. Or use <strong>Start voice call</strong> at
            the bottom of the screen and just talk.
          </p>
        </div>
      </div>

      <div className="tax-wrap tax-section-tight">
        <div className="tax-grid tax-grid-2">
          <div className="tax-card">
            <h3 className="tax-h3">Ready when you are</h3>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              Book a fifteen-minute call with a preparer. If we're not the right firm for you, we'll
              say so and point you somewhere better.
            </p>
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} />
            </Link>
          </div>
          <div className="tax-card">
            <h3 className="tax-h3">Just browsing?</h3>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              The Tax Guides library holds thousands of IRS publications, forms and manual sections,
              plus the tax code and regulations, searchable by passage, with the original link on
              every one.
            </p>
            <Link to="/tax/guides" className="tax-btn tax-btn-outline">
              Browse the guides
            </Link>
          </div>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
