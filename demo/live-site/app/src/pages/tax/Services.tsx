import { Link } from "react-router-dom";
import { ArrowRight, FileText, BookOpen, Users, ShieldAlert, Compass, type LucideIcon } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { useTaxTitle } from "@/lib/tax";
import { TAX_SERVICES } from "@/lib/taxServices";

const ICONS: Record<string, LucideIcon> = {
  "individual-returns": FileText,
  bookkeeping: BookOpen,
  payroll: Users,
  "irs-notices": ShieldAlert,
  planning: Compass,
};

export default function TaxServices() {
  useTaxTitle("Services");

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">Services</span>
        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          The work we do, and what it costs to start.
        </h1>
        <p className="tax-lead">
          Five services, each with a fixed quote agreed before we begin. Most clients use two or
          three of them together, which is why we keep one team on the whole picture.
        </p>

        <div className="tax-grid tax-grid-2" style={{ marginTop: "1.5rem" }}>
          {TAX_SERVICES.map((s) => {
            const Icon = ICONS[s.slug] ?? FileText;
            return (
              <div key={s.slug} className="tax-card" style={{ display: "flex", flexDirection: "column" }}>
                <span className="tax-icon-badge">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h2 className="tax-h3" style={{ fontSize: "1.125rem" }}>
                  {s.name}
                </h2>
                <p className="tax-p" style={{ fontSize: "0.9375rem", flex: 1 }}>
                  {s.short}
                </p>
                <p className="tax-small" style={{ margin: "0 0 0.75rem", color: "hsl(var(--tax-brass))", fontWeight: 600 }}>
                  {s.from}
                </p>
                <div className="tax-btn-row">
                  <Link to={`/tax/services/${s.slug}`} className="tax-btn tax-btn-outline">
                    Read more <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="tax-wrap tax-section-tight">
        <div className="tax-card tax-card-quiet">
          <h2 className="tax-h2 tax-h2-lead">Not sure which one you need?</h2>
          <p className="tax-p">
            Most people aren't, the first time. Book the free fifteen-minute call and describe the
            year you've had. We'll tell you what we'd do, and what it would cost, before you commit
            to anything.
          </p>
          <div className="tax-btn-row">
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} />
            </Link>
            <Link to="/tax/pricing" className="tax-btn tax-btn-outline">
              See the full price list
            </Link>
          </div>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
