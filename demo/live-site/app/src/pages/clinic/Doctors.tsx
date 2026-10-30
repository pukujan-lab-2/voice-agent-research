import { Heart } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Home", path: "/clinic", keywords: "opening hours, services" },
  { title: "Our doctors", path: "/clinic/doctors", keywords: "Dr. Okafor, Dr. Lind, paediatrician" },
  { title: "Help & FAQ", path: "/clinic/help", keywords: "what to bring, cancelling, vaccinations" },
  { title: "Book a visit", path: "/clinic/book", keywords: "appointment, booking, schedule" },
];

const navLinks = [
  { label: "Home", path: "/clinic" },
  { label: "Doctors", path: "/clinic/doctors" },
  { label: "Help", path: "/clinic/help" },
  { label: "Book a visit", path: "/clinic/book" },
];

export default function ClinicDoctors() {
  return (
    <SiteLayout site="clinic" logoMark={<Heart size={18} />} logoText="Tumbleberry Children's Clinic" navLinks={navLinks} searchPages={searchPages} footerNote="Caring for families since 2018.">
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "1.5rem", color: "hsl(var(--site-text))" }}>Our doctors</h1>
        <div className="site-card-grid">
          <div className="site-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: "hsl(var(--site-accent-soft))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "hsl(var(--site-accent))" }}>AO</div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: "1.125rem" }}>Dr. Amara Okafor</h3>
                <p style={{ fontSize: "0.8125rem", color: "hsl(var(--site-muted))" }}>Paediatrician</p>
              </div>
            </div>
            <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-text))" }}>Dr. Okafor trained at St Bartholomew's and has 14 years of experience in paediatric care. She leads our vaccination programme and sees patients on Tuesdays and Thursdays.</p>
          </div>
          <div className="site-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <div style={{ width: "3rem", height: "3rem", borderRadius: "50%", background: "hsl(var(--site-accent-soft))", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "hsl(var(--site-accent))" }}>HL</div>
              <div>
                <h3 style={{ fontWeight: 700, fontSize: "1.125rem" }}>Dr. Henrik Lind</h3>
                <p style={{ fontSize: "0.8125rem", color: "hsl(var(--site-muted))" }}>Paediatrician</p>
              </div>
            </div>
            <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-text))" }}>Dr. Lind joined Tumbleberry in 2021 after ten years at the Karolinska. He specialises in childhood asthma and sees patients on Wednesdays and Fridays.</p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
