import { Heart, Clock, Stethoscope, Syringe, Baby, ArrowRight } from "lucide-react";
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

const services = [
  { icon: Stethoscope, title: "Well-child checkups", text: "Routine growth and development checks from birth to age 16." },
  { icon: Syringe, title: "Vaccinations", text: "Full immunisation schedule following national guidelines." },
  { icon: Baby, title: "Sick visits", text: "Same-day appointments for fevers, infections, and minor injuries." },
];

export default function ClinicHome() {
  return (
    <SiteLayout site="clinic" logoMark={<Heart size={18} />} logoText="Tumbleberry Children's Clinic" navLinks={navLinks} searchPages={searchPages} footerNote="Caring for families since 2018. Mon to Fri 8am to 6pm.">
      <section className="site-hero">
        <div className="site-hero-inner">
          <h1>Gentle care for every child</h1>
          <p>Paediatric clinic in the heart of Tumbleberry. Book a visit online in under two minutes.</p>
          <div style={{ marginTop: "1.5rem" }}>
            <a href="/clinic/book" className="site-btn">Book a visit <ArrowRight size={16} /></a>
          </div>
        </div>
      </section>

      <div className="site-container-wide">
        <div className="site-card-grid" style={{ marginBottom: "2rem" }}>
          {services.map((s, i) => (
            <div key={i} className="site-card">
              <s.icon size={24} style={{ color: "hsl(var(--site-accent))", marginBottom: "0.75rem" }} />
              <h3 style={{ fontWeight: 700, fontSize: "1.125rem", marginBottom: "0.375rem" }}>{s.title}</h3>
              <p style={{ fontSize: "0.9375rem", color: "hsl(var(--site-muted))" }}>{s.text}</p>
            </div>
          ))}
        </div>

        <div className="site-card" style={{ maxWidth: "600px", margin: "0 auto" }}>
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Clock size={20} /> Opening hours
          </h2>
          <table style={{ width: "100%", fontSize: "0.9375rem" }}>
            <tbody>
              <tr><td style={{ padding: "0.375rem 0" }}>Monday to Friday</td><td style={{ padding: "0.375rem 0", textAlign: "right" }}>8:00 AM to 6:00 PM</td></tr>
              <tr><td style={{ padding: "0.375rem 0" }}>Saturday</td><td style={{ padding: "0.375rem 0", textAlign: "right" }}>9:00 AM to 1:00 PM</td></tr>
              <tr><td style={{ padding: "0.375rem 0" }}>Sunday</td><td style={{ padding: "0.375rem 0", textAlign: "right" }}>Closed</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </SiteLayout>
  );
}
