import { Landmark, FileText, ArrowRight } from "lucide-react";
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

const forms = [
  { code: "R-17", title: "Beneficiary nomination", desc: "Nominate who should receive your pension benefits. Requires member number and beneficiary details.", path: "/pension/forms/r17" },
  { code: "R-22", title: "Change of address", desc: "Update your contact details. Currently available as a PDF only.", path: null },
  { code: "R-31", title: "Early retirement request", desc: "Apply to draw your pension before the normal retirement age. Requires financial advice confirmation.", path: null },
  { code: "R-44", title: "Transfer in", desc: "Transfer benefits from another pension scheme into Saltmere. Available as a PDF only.", path: null },
];

export default function PensionForms() {
  return (
    <SiteLayout site="pension" logoMark={<Landmark size={18} />} logoText="Saltmere Pension Fund" navLinks={navLinks} searchPages={searchPages} footerNote="Saltmere Pension Fund. Helping members plan for tomorrow." large>
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>Forms</h1>
        <p style={{ fontSize: "1.125rem", color: "hsl(var(--site-muted))", marginBottom: "1.5rem" }}>Select a form to fill in online or download as PDF.</p>
        {forms.map((f, i) => (
          <div key={i} className="site-card" style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "3rem", height: "3rem", borderRadius: "0.625rem", background: "hsl(var(--site-accent-soft))", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FileText size={20} style={{ color: "hsl(var(--site-accent))" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <span style={{ fontWeight: 700, fontSize: "1rem", color: "hsl(var(--site-accent))" }}>{f.code}</span>
                <h3 style={{ fontWeight: 700, fontSize: "1.125rem" }}>{f.title}</h3>
              </div>
              <p style={{ fontSize: "1rem", color: "hsl(var(--site-muted))", marginTop: "0.25rem" }}>{f.desc}</p>
            </div>
            {f.path ? (
              <a href={f.path} className="site-btn" style={{ flexShrink: 0 }}>Open <ArrowRight size={14} /></a>
            ) : (
              <span style={{ fontSize: "0.875rem", color: "hsl(var(--site-muted))", flexShrink: 0 }}>PDF only</span>
            )}
          </div>
        ))}
      </div>
    </SiteLayout>
  );
}
