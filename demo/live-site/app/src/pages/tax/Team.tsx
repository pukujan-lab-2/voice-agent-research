import { Link } from "react-router-dom";
import { ArrowRight, Phone, Mail } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { useTaxTitle } from "@/lib/tax";

interface Person {
  name: string;
  cred: string;
  role: string;
  focus: string[];
  line: string;
  /** avatar palette */
  bg: string;
  skin: string;
  hair: string;
  top: string;
  hairStyle: "bob" | "short" | "long" | "curls" | "bun";
}

const TEAM: Person[] = [
  {
    name: "Marisol Ventura-Akande",
    cred: "EA",
    role: "Founder",
    focus: ["Individuals", "IRS notices", "Small business"],
    line: "Started the firm in 2009 after eight years inside a national practice, on the theory that clients would rather talk to the person who did the work.",
    bg: "hsl(20 60% 92%)",
    skin: "hsl(28 45% 72%)",
    hair: "hsl(158 25% 18%)",
    top: "hsl(158 32% 26%)",
    hairStyle: "curls",
  },
  {
    name: "Desmond Whitlow",
    cred: "CPA",
    role: "Partner, business tax",
    focus: ["Corporations", "Partnerships", "Depreciation"],
    line: "Reads the Code for pleasure, which is either reassuring or alarming depending on the client. Answers questions about basis without sighing.",
    bg: "hsl(150 22% 90%)",
    skin: "hsl(24 38% 48%)",
    hair: "hsl(30 18% 16%)",
    top: "hsl(36 30% 30%)",
    hairStyle: "short",
  },
  {
    name: "Priya Raghunathan",
    cred: "CPA",
    role: "Partner, individual tax",
    focus: ["Families", "Education credits", "Equity awards"],
    line: "Has a gift for explaining why a credit does not apply without making anyone feel foolish, and for finding the one she missed.",
    bg: "hsl(38 45% 90%)",
    skin: "hsl(28 42% 62%)",
    hair: "hsl(22 25% 20%)",
    top: "hsl(18 45% 40%)",
    hairStyle: "long",
  },
  {
    name: "Tomasz Bielecki",
    cred: "EA",
    role: "Senior preparer",
    focus: ["Bookkeeping", "Payroll", "Multi-state"],
    line: "Came to tax from fifteen years of running a small manufacturing business, so he has seen the shoebox of receipts from the inside.",
    bg: "hsl(200 18% 91%)",
    skin: "hsl(30 40% 76%)",
    hair: "hsl(40 25% 55%)",
    top: "hsl(200 22% 30%)",
    hairStyle: "short",
  },
  {
    name: "Ada Fairweather",
    cred: "",
    role: "Client services",
    focus: ["Scheduling", "Documents", "Follow-ups"],
    line: "Keeps the diary, chases the missing 1099 and notices when a client has gone quiet for a reason. The first voice most clients hear.",
    bg: "hsl(330 25% 93%)",
    skin: "hsl(26 36% 66%)",
    hair: "hsl(18 30% 30%)",
    top: "hsl(330 22% 38%)",
    hairStyle: "bun",
  },
];

function Avatar({ p }: { p: Person }) {
  const { bg, skin, hair, top, hairStyle } = p;
  return (
    <svg viewBox="0 0 96 96" className="tax-avatar" role="img" aria-label={`Illustrated portrait of ${p.name}`}>
      <rect width="96" height="96" rx="48" fill={bg} />
      {/* shoulders */}
      <path d="M18 96c0-16 13-26 30-26s30 10 30 26z" fill={top} />
      <path d="M42 66h12v8a6 6 0 0 1-12 0z" fill={skin} />
      {/* head */}
      <circle cx="48" cy="46" r="17" fill={skin} />
      {/* hair */}
      {hairStyle === "curls" && (
        <g fill={hair}>
          <circle cx="33" cy="38" r="7" />
          <circle cx="42" cy="31" r="8" />
          <circle cx="53" cy="30" r="8" />
          <circle cx="62" cy="37" r="7" />
          <circle cx="64" cy="47" r="5" />
          <circle cx="32" cy="47" r="5" />
        </g>
      )}
      {hairStyle === "short" && (
        <path d="M31 44c0-11 8-17 17-17s17 6 17 17c0-4-4-7-9-8-4 3-12 4-19 2-3 1-6 3-6 6z" fill={hair} />
      )}
      {hairStyle === "long" && (
        <path d="M29 50c0-14 8-23 19-23s19 9 19 23v16h-6V48c-3 4-8 6-13 6s-10-2-13-6v18h-6z" fill={hair} />
      )}
      {hairStyle === "bun" && (
        <g fill={hair}>
          <path d="M31 46c0-12 8-19 17-19s17 7 17 19c-2-5-7-8-17-8s-15 3-17 8z" />
          <circle cx="48" cy="24" r="6" />
        </g>
      )}
      {/* eyes + smile */}
      <circle cx="42" cy="46" r="1.8" fill="hsl(158 30% 16%)" />
      <circle cx="54" cy="46" r="1.8" fill="hsl(158 30% 16%)" />
      <path d="M43 53c2 2.5 8 2.5 10 0" stroke="hsl(158 30% 22%)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function TaxTeam() {
  useTaxTitle("Team");

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">Team</span>
        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          Five people, and the person who answers the phone.
        </h1>
        <p className="tax-lead">
          Brindlewick is deliberately small. Every return is prepared by one of us and reviewed by
          another, and you will know both names before the work starts.
        </p>

        <div className="tax-team-grid" style={{ marginTop: "1.5rem" }}>
          {TEAM.map((p) => (
            <article key={p.name} className="tax-person">
              <div style={{ display: "flex", gap: "0.875rem", alignItems: "flex-start", marginBottom: "0.875rem" }}>
                <Avatar p={p} />
                <div style={{ minWidth: 0 }}>
                  <h2 className="tax-h3" style={{ fontSize: "1.0625rem", marginBottom: "0.125rem" }}>
                    {p.name}
                  </h2>
                  <p className="tax-small tax-muted" style={{ margin: 0 }}>
                    {p.role}
                  </p>
                  {p.cred && <span className="tax-cred" style={{ marginTop: "0.375rem" }}>{p.cred}</span>}
                </div>
              </div>
              <p className="tax-p" style={{ fontSize: "0.875rem" }}>
                {p.line}
              </p>
              <div className="tax-chips">
                {p.focus.map((f) => (
                  <span
                    key={f}
                    style={{
                      fontSize: "0.6875rem",
                      padding: "0.1875rem 0.5rem",
                      borderRadius: "999px",
                      background: "hsl(var(--tax-bg-deep))",
                      color: "hsl(var(--tax-ink-soft))",
                      fontWeight: 600,
                    }}
                  >
                    {f}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2rem" }}>
          <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
            Enrolled agents and CPAs
          </h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
            An enrolled agent (EA) is licensed by the federal government to represent taxpayers
            before the IRS. A certified public accountant (CPA) is licensed by the state. Both can
            sign a return and both can stand between you and a letter you would rather not answer
            yourself.
          </p>
          <p className="tax-p tax-small" style={{ marginBottom: 0 }}>
            <em>These people and credentials are invented for this demo.</em>
          </p>
        </div>

        <div className="tax-grid tax-grid-2" style={{ marginTop: "1.5rem" }}>
          <div className="tax-card">
            <h2 className="tax-h3">Talk to a preparer</h2>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              Fifteen minutes, no charge, at a time you choose.
            </p>
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} />
            </Link>
          </div>
          <div className="tax-card">
            <h2 className="tax-h3">Reach the office</h2>
            <p className="tax-small" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0 0 0.375rem" }}>
              <Phone size={14} aria-hidden="true" /> (555) 010-2210
            </p>
            <p className="tax-small" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0 0 0.375rem" }}>
              <Mail size={14} aria-hidden="true" /> hello@example.com
            </p>
            <p className="tax-small tax-muted" style={{ marginBottom: 0 }}>
              Monday to Friday, 9 to 5. Answerphone after 5, and we ring back the next morning.
            </p>
          </div>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
