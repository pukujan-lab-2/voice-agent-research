import { Wrench, FileText, ExternalLink } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Home", path: "/appliance", keywords: "HDW-500, dishwasher, support" },
  { title: "Manuals", path: "/appliance/manuals", keywords: "manual, guide, HDW-500" },
  { title: "Help & error codes", path: "/appliance/help", keywords: "E11, E15, E24, E25, E09" },
  { title: "Request service", path: "/appliance/support", keywords: "service, repair, visit" },
];

const navLinks = [
  { label: "Home", path: "/appliance" },
  { label: "Manuals", path: "/appliance/manuals" },
  { label: "Help", path: "/appliance/help" },
  { label: "Support", path: "/appliance/support" },
];

export default function ApplianceManuals() {
  return (
    <SiteLayout site="appliance" logoMark={<Wrench size={18} />} logoText="Kettlewisp Appliances" navLinks={navLinks} searchPages={searchPages} footerNote="HDW-500 dishwasher support hub.">
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "1.5rem", color: "hsl(var(--site-text))" }}>Manuals</h1>
        <div className="site-card">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <FileText size={24} style={{ color: "hsl(var(--site-accent))" }} />
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "1.125rem" }}>HDW-500 User Manual</h3>
              <p style={{ fontSize: "0.8125rem", color: "hsl(var(--site-muted))" }}>PDF, 24 pages</p>
            </div>
          </div>
          <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-text))", marginBottom: "0.75rem" }}>
            Installation, daily use, cleaning, error codes, and troubleshooting. Includes
            the serial number location (page 1) and the E24 drain fix (page 7).
          </p>
          <a href="/docs/hdw500-manual.html" target="_blank" rel="noopener noreferrer" className="site-btn">
            Open manual <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </SiteLayout>
  );
}
