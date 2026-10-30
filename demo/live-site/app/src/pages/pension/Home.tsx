import { Landmark, FileText, LifeBuoy, ArrowRight, ShieldCheck } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Home", path: "/pension", keywords: "pension, fund, Saltmere" },
  { title: "Forms", path: "/pension/forms", keywords: "R-17, beneficiary, nomination" },
  { title: "Help", path: "/pension/help", keywords: "guide, help, FAQ" },
  { title: "Form R-17", path: "/pension/forms/r17", keywords: "beneficiary, nomination, form" },
];

const navLinks = [
  { label: "Home", path: "/pension" },
  { label: "Forms", path: "/pension/forms" },
  { label: "Help", path: "/pension/help" },
];

export default function PensionHome() {
  return (
    <SiteLayout site="pension" logoMark={<Landmark size={18} />} logoText="Saltmere Pension Fund" navLinks={navLinks} searchPages={searchPages} footerNote="Saltmere Pension Fund. Helping members plan for tomorrow." large>
      <section className="site-hero">
        <div className="site-hero-inner">
          <h1>Your pension, your future</h1>
          <p>Saltmere Pension Fund has been looking after members since 1974. Manage your forms, check your guide, and get help.</p>
          <div style={{ marginTop: "1.5rem" }}>
            <a href="/pension/forms" className="site-btn">View forms <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      <div className="site-container-wide">
        <div className="site-card-grid">
          <div className="site-card">
            <FileText size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>Forms</h3>
            <p style={{ fontSize: "1rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>View and submit pension forms online, including beneficiary nominations.</p>
            <a href="/pension/forms" className="site-btn-outline site-btn">View forms <ArrowRight size={14} /></a>
          </div>
          <div className="site-card">
            <LifeBuoy size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>Help</h3>
            <p style={{ fontSize: "1rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>Frequently asked questions and guidance on filling in forms.</p>
            <a href="/pension/help" className="site-btn-outline site-btn">Get help <ArrowRight size={14} /></a>
          </div>
          <div className="site-card">
            <ShieldCheck size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>Member security</h3>
            <p style={{ fontSize: "1rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>Your data is protected. All forms are submitted securely and reviewed by our team.</p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
