import { Globe, Check, ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Plans and pricing", path: "/pricing", keywords: "Starter, Growth, Scale, pricing, plans" },
  { title: "FAQ", path: "/pricing/faq", keywords: "questions, booking, payments" },
  { title: "Request a quote", path: "/pricing/quote", keywords: "quote, estimate, project" },
];

const navLinks = [
  { label: "Plans", path: "/pricing" },
  { label: "FAQ", path: "/pricing/faq" },
  { label: "Get a quote", path: "/pricing/quote" },
];

const plans = [
  { name: "Starter", price: "$900", features: ["1-page website", "Mobile responsive", "Contact form", "2 rounds of revisions"] },
  { name: "Growth", price: "$2,400", features: ["Up to 5 pages", "Booking and payments", "CMS for blog", "5 rounds of revisions"], popular: true },
  { name: "Scale", price: "$6,500", features: ["Up to 20 pages", "Custom integrations", "E-commerce", "Unlimited revisions (3 months)"] },
];

export default function PricingPlans() {
  return (
    <SiteLayout site="pricing" logoMark={<Globe size={18} />} logoText="Larchmoss Studio" navLinks={navLinks} searchPages={searchPages} footerNote="Small web design studio.">
      <section className="site-hero">
        <div className="site-hero-inner">
          <h1>Plans and pricing</h1>
          <p>Simple, transparent pricing for small business websites.</p>
        </div>
      </section>
      <div className="site-container-wide">
        <div className="site-card-grid">
          {plans.map((p, i) => (
            <div key={i} className="site-card" style={{ position: "relative" }}>
              {p.popular && (
                <div style={{ position: "absolute", top: "-0.625rem", right: "1rem", background: "hsl(var(--site-accent))", color: "hsl(var(--site-accent-fg))", fontSize: "0.6875rem", fontWeight: 700, padding: "0.25rem 0.625rem", borderRadius: "999px" }}>POPULAR</div>
              )}
              <h3 style={{ fontWeight: 700, fontSize: "1.25rem", marginBottom: "0.25rem" }}>{p.name}</h3>
              <div style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "1rem", color: "hsl(var(--site-text))" }}>{p.price}</div>
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "1.25rem" }}>
                {p.features.map((f, j) => (
                  <li key={j} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem", fontSize: "0.9375rem" }}>
                    <Check size={16} style={{ color: "hsl(var(--site-accent))" }} /> {f}
                  </li>
                ))}
              </ul>
              <a href="/pricing/quote" className="site-btn" style={{ width: "100%" }}>Get a quote <ArrowRight size={14} /></a>
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
