import { MonitorSmartphone, Server, Wifi, Printer, KeyRound, ArrowRight } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";
import { SiteHeroArt } from "@/components/site/SiteHeroArt";

const searchPages = [
  { title: "Home", path: "/itdesk", keywords: "status, articles, help desk" },
  { title: "Knowledge base", path: "/itdesk/kb", keywords: "VPN, password reset, printers" },
  { title: "New ticket", path: "/itdesk/new", keywords: "ticket, support, request" },
];

const navLinks = [
  { label: "Home", path: "/itdesk" },
  { label: "Knowledge base", path: "/itdesk/kb" },
  { label: "New ticket", path: "/itdesk/new" },
];

const popularArticles = [
  { icon: Server, title: "VPN setup guide", text: "Connect to the Cobblefin VPN from anywhere." },
  { icon: KeyRound, title: "Reset your password", text: "Self-service password reset in three steps." },
  { icon: Printer, title: "Printer troubleshooting", text: "Fix common printing issues on the office network." },
];

export default function ItdeskHome() {
  return (
    <SiteLayout site="itdesk" logoMark={<MonitorSmartphone size={18} />} logoText="Cobblefin IT Desk" navLinks={navLinks} searchPages={searchPages} footerNote="Internal IT help desk for Cobblefin staff.">
      <section className="site-hero">
        <div className="site-hero-inner">
          <div className="site-hero-copy">
            <h1>IT Help Desk</h1>
            <p>Service status, knowledge base, and support tickets for Cobblefin staff.</p>
          </div>
          <SiteHeroArt />
        </div>
      </section>
      <div className="site-container-wide">
        <div className="site-card" style={{ marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ width: "0.75rem", height: "0.75rem", borderRadius: "50%", background: "hsl(142 60% 42%)", flexShrink: 0 }} />
          <div>
            <span style={{ fontWeight: 700 }}>All systems operational</span>
            <span style={{ marginLeft: "0.5rem", fontSize: "0.875rem", color: "hsl(var(--site-muted))" }}>VPN, email, Wi-Fi, printing</span>
          </div>
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "1rem" }}>Popular articles</h2>
        <div className="site-card-grid">
          {popularArticles.map((a, i) => (
            <div key={i} className="site-card">
              <a.icon size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
              <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>{a.title}</h3>
              <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-muted))", marginBottom: "0.75rem" }}>{a.text}</p>
              <a href="/itdesk/kb" className="site-btn-outline site-btn">Read <ArrowRight size={14} /></a>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <a href="/itdesk/new" className="site-btn">File a new ticket <ArrowRight size={16} /></a>
        </div>
      </div>
    </SiteLayout>
  );
}
