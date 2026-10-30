import { Wrench } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Home", path: "/appliance", keywords: "HDW-500, dishwasher, support" },
  { title: "Manuals", path: "/appliance/manuals", keywords: "manual, guide, HDW-500" },
  { title: "Help and error codes", path: "/appliance/help", keywords: "E11, E15, E24, E25, E09" },
  { title: "Request service", path: "/appliance/support", keywords: "service, repair, visit" },
];

const navLinks = [
  { label: "Home", path: "/appliance" },
  { label: "Manuals", path: "/appliance/manuals" },
  { label: "Help", path: "/appliance/help" },
  { label: "Support", path: "/appliance/support" },
];

const errors = [
  { code: "E11", desc: "Water comes in too slowly", fix: "Check that the water supply tap is fully open and the inlet hose is not kinked." },
  { code: "E15", desc: "Leak detected", fix: "Turn off the water and power. Do not use the dishwasher until a technician inspects it." },
  { code: "E24", desc: "Water not draining", fix: "Clean the filter and check the drain hose. See manual page 7 for full steps." },
  { code: "E25", desc: "Drain pump blocked", fix: "Remove the lower spray arm and clear any debris from the drain pump impeller." },
  { code: "E09", desc: "Heater fault", fix: "The heating element may have failed. Request a service visit." },
];

export default function ApplianceHelp() {
  return (
    <SiteLayout site="appliance" logoMark={<Wrench size={18} />} logoText="Kettlewisp Appliances" navLinks={navLinks} searchPages={searchPages} footerNote="HDW-500 dishwasher support hub.">
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>Error codes</h1>
        <p style={{ color: "hsl(var(--site-muted))", marginBottom: "1.5rem" }}>Find the code on your display and follow the fix. If it does not work, request a service visit.</p>
        <div className="site-card">
          <table className="error-table">
            <thead>
              <tr><th>Code</th><th>Problem</th><th>What to do</th></tr>
            </thead>
            <tbody>
              {errors.map((e, i) => (
                <tr key={i}>
                  <td><code>{e.code}</code></td>
                  <td>{e.desc}</td>
                  <td>{e.fix}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: "1.5rem" }}>
          <a href="/appliance/support" className="site-btn">Request a service visit</a>
        </div>
      </div>
    </SiteLayout>
  );
}
