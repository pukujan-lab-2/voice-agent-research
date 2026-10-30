import { Globe } from "lucide-react";
import { SiteLayout } from "@/components/site/SiteLayout";

const searchPages = [
  { title: "Plans and pricing", path: "/pricing", keywords: "Starter, Growth, Scale" },
  { title: "FAQ", path: "/pricing/faq", keywords: "questions, booking, payments" },
  { title: "Request a quote", path: "/pricing/quote", keywords: "quote, estimate" },
];

const navLinks = [
  { label: "Plans", path: "/pricing" },
  { label: "FAQ", path: "/pricing/faq" },
  { label: "Get a quote", path: "/pricing/quote" },
];

const faqs = [
  { q: "How long does a project take?", a: "Starter sites take 1 to 2 weeks. Growth takes 3 to 4 weeks. Scale depends on scope but typically 6 to 8 weeks." },
  { q: "Do you offer booking and payments?", a: "Yes, on the Growth plan and above. We integrate with Stripe for payments and Calendly for booking." },
  { q: "What about hosting?", a: "Hosting is not included in the plan price. We recommend Vercel or Netlify for hosting, which starts at $0/month for small sites." },
  { q: "Can I upgrade my plan later?", a: "Absolutely. You only pay the difference between your current plan and the new one." },
  { q: "Do you work with businesses outside the UK?", a: "Yes, we work with clients worldwide. All communication is in English." },
];

export default function PricingFaq() {
  return (
    <SiteLayout site="pricing" logoMark={<Globe size={18} />} logoText="Larchmoss Studio" navLinks={navLinks} searchPages={searchPages} footerNote="Small web design studio.">
      <div className="site-container">
        <div className="prose-site">
          <h1>FAQ</h1>
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
