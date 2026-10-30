import { Heart } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Home", path: "/clinic", keywords: "opening hours, services" },
  { title: "Our doctors", path: "/clinic/doctors", keywords: "Dr. Okafor, Dr. Lind" },
  { title: "Help & FAQ", path: "/clinic/help", keywords: "what to bring, cancelling, vaccinations" },
  { title: "Book a visit", path: "/clinic/book", keywords: "appointment, booking" },
];

const navLinks = [
  { label: "Home", path: "/clinic" },
  { label: "Doctors", path: "/clinic/doctors" },
  { label: "Help", path: "/clinic/help" },
  { label: "Book a visit", path: "/clinic/book" },
];

const faqs = [
  { q: "What should I bring to the appointment?", a: "Bring your child's health record (red book), any medication they are currently taking, and your photo ID. If it is a vaccination visit, please also bring the immunisation record." },
  { q: "How do I cancel or reschedule?", a: "You can cancel or reschedule by calling us on 020 7946 0123 at least 24 hours before the appointment. Late cancellations may incur a fee." },
  { q: "What vaccinations do you offer?", a: "We follow the national immunisation schedule, covering rotavirus, DTaP/IPV/Hib, MMR, and boosters. The full schedule is posted at reception and explained by Dr. Okafor during visits." },
  { q: "Do you see same-day sick visits?", a: "Yes. Call before 10 AM and we will do our best to fit your child in the same day. For emergencies, call 999." },
];

export default function ClinicHelp() {
  return (
    <SiteLayout site="clinic" logoMark={<Heart size={18} />} logoText="Tumbleberry Children's Clinic" navLinks={navLinks} searchPages={searchPages} footerNote="Caring for families since 2018.">
      <div className="site-container">
        <div className="prose-site">
          <h1>Help & FAQ</h1>
          {faqs.map((f, i) => (
            <div key={i} style={{ marginBottom: "1.25rem" }}>
              <h2>{f.q}</h2>
              <p>{f.a}</p>
            </div>
          ))}
        </div>
      </div>
    </SiteLayout>
  );
}
