import { Wrench, ArrowRight, BookOpen, LifeBuoy } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SiteHeroArt } from "@/components/site/SiteHeroArt";

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

export default function ApplianceHome() {
  return (
    <SiteLayout site="appliance" logoMark={<Wrench size={18} />} logoText="Kettlewisp Appliances" navLinks={navLinks} searchPages={searchPages} footerNote="HDW-500 dishwasher support hub.">
      <section className="site-hero">
        <div className="site-hero-inner">
          <div className="site-hero-copy">
            <h1>HDW-500 support hub</h1>
            <p>Manuals, error codes, and service requests for your Kettlewisp dishwasher.</p>
          </div>
          <SiteHeroArt />
        </div>
      </section>
      <div className="site-container-wide">
        <div className="site-card-grid">
          <div className="site-card">
            <BookOpen size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>Manuals</h3>
            <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>Read the HDW-500 user manual online.</p>
            <a href="/appliance/manuals" className="site-btn-outline site-btn">View manuals <ArrowRight size={14} /></a>
          </div>
          <div className="site-card">
            <LifeBuoy size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>Help and error codes</h3>
            <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>Decode the error code on your display.</p>
            <a href="/appliance/help" className="site-btn-outline site-btn">Error codes <ArrowRight size={14} /></a>
          </div>
          <div className="site-card">
            <Wrench size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
            <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>Request service</h3>
            <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>Book a technician visit for your dishwasher.</p>
            <a href="/appliance/support" className="site-btn-outline site-btn">Request visit <ArrowRight size={14} /></a>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
