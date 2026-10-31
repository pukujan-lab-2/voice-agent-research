import { Link, useParams } from "react-router-dom";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { useTaxTitle } from "@/lib/tax";
import { TAX_SERVICES, findService } from "@/lib/taxServices";
import NotFound from "@/pages/NotFound";

export default function TaxServiceDetail() {
  const { slug } = useParams();
  const service = findService(slug);
  useTaxTitle(service ? service.name : "Not found");

  if (!service) return <NotFound />;

  const others = TAX_SERVICES.filter((s) => s.slug !== service.slug).slice(0, 3);

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <Link to="/tax/services" className="tax-small tax-muted" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
          <ArrowLeft size={14} /> All services
        </Link>

        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)", marginTop: "0.75rem" }}>
          {service.name}
        </h1>
        <p className="tax-lead">{service.lede}</p>

        <div className="tax-card" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem 1.5rem", alignItems: "center" }}>
          <div>
            <div className="tax-tiny tax-muted" style={{ letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
              Typical fee
            </div>
            <div className="tax-serif" style={{ fontSize: "1.375rem", color: "hsl(var(--tax-ink))" }}>
              {service.from}
            </div>
            <div className="tax-tiny tax-muted">{service.fromNote}</div>
          </div>
          <div style={{ marginLeft: "auto" }} className="tax-btn-row">
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} />
            </Link>
            <Link to="/tax/pricing" className="tax-btn tax-btn-outline">
              Pricing
            </Link>
          </div>
        </div>

        <div className="tax-grid tax-grid-2" style={{ marginTop: "2rem" }}>
          <div>
            <h2 className="tax-h2 tax-h2-lead">Who it's for</h2>
            <ul className="tax-list">
              {service.who.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="tax-h2 tax-h2-lead">What's included</h2>
            <ul className="tax-list">
              {service.includes.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="tax-h2 tax-h2-lead">What to bring</h2>
            <ul className="tax-list tax-list-plain">
              {service.bring.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="tax-h2 tax-h2-lead">Typical timeline</h2>
            <ul className="tax-list tax-list-plain">
              {service.timeline.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>

        <hr className="tax-rule" />

        <h2 className="tax-h2">Questions we get asked</h2>
        <div className="tax-grid" style={{ gap: "0.75rem" }}>
          {service.faq.map((f) => (
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
            Start with a free fifteen-minute call
          </h2>
          <p className="tax-p" style={{ marginBottom: "1rem" }}>
            A preparer will ring you at the time you choose, at no charge. Bring nothing but the
            rough shape of your year.
          </p>
          <div className="tax-btn-row">
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} />
            </Link>
          </div>
          <p className="tax-small tax-muted" style={{ display: "flex", gap: "0.375rem", alignItems: "center", marginTop: "0.75rem", marginBottom: 0 }}>
            <Check size={14} aria-hidden="true" /> No obligation, and no documents needed for the first call.
          </p>
        </div>

        <hr className="tax-rule" />

        <h2 className="tax-h2">Other services</h2>
        <div className="tax-grid tax-grid-3">
          {others.map((o) => (
            <Link key={o.slug} to={`/tax/services/${o.slug}`} className="tax-guide-card">
              <span className="tax-guide-title">{o.name}</span>
              <span className="tax-guide-src">{o.short}</span>
            </Link>
          ))}
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
