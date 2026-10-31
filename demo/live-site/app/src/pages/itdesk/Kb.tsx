import { MonitorSmartphone, Server, KeyRound, Printer } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

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

const articles = [
  {
    icon: Server,
    title: "VPN and remote access",
    sections: [
      { h: "Connecting to the VPN", p: "Open the Cobblefin VPN client, enter your username and password, and click Connect. You will be prompted for a 2FA code from your authenticator app." },
      { h: "Troubleshooting VPN drops", p: "If the VPN disconnects frequently, check your internet connection stability. Wired connections are more reliable than Wi-Fi for VPN sessions." },
    ],
  },
  {
    icon: KeyRound,
    title: "Password reset",
    sections: [
      { h: "Self-service reset", p: "Go to password.cobblefin.example (fictional), enter your email, and follow the link sent to your inbox. You will need your recovery phrase." },
      { h: "Locked out?", p: "If you are locked out after five attempts, wait 15 minutes or call the IT desk on extension 4000." },
    ],
  },
  {
    icon: Printer,
    title: "Printing",
    sections: [
      { h: "Adding a network printer", p: "Open Settings, Printers, Add Printer. The office printers are named COB-FLOOR2 and COB-FLOOR3. Select one and click Add." },
      { h: "Print jobs stuck in queue", p: "Open the print queue, cancel all jobs, restart the print spooler service, and try again. If it persists, restart the printer." },
    ],
  },
];

export default function ItdeskKb() {
  return (
    <SiteLayout site="itdesk" logoMark={<MonitorSmartphone size={18} />} logoText="Cobblefin IT Desk" navLinks={navLinks} searchPages={searchPages} footerNote="Internal IT help desk for Cobblefin staff.">
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "1.5rem", color: "hsl(var(--site-text))" }}>Knowledge base</h1>
        {articles.map((a, i) => (
          <div key={i} className="site-card" style={{ marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <a.icon size={20} style={{ color: "hsl(var(--site-accent))" }} />
              <h2 style={{ fontSize: "1.125rem", fontWeight: 700 }}>{a.title}</h2>
            </div>
            {a.sections.map((s, j) => (
              <div key={j} style={{ marginBottom: "0.75rem" }}>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 600, marginBottom: "0.25rem" }}>{s.h}</h3>
                <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-text))" }}>{s.p}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </SiteLayout>
  );
}
