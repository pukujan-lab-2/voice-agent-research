import { Landmark, FileText } from "lucide-react";
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

const faqs = [
  { q: "Where do I find my member number?", a: "Your member number is on your annual statement. It starts with SPF followed by six digits, for example SPF-123456. You can also find it on any letter we have sent you." },
  { q: "What is a beneficiary nomination?", a: "A beneficiary nomination tells us who should receive your pension benefits if you die before retirement. You can nominate one or more people and state what percentage each should receive." },
  { q: "How do I fill in form R-17?", a: "You can fill it in by hand or use the voice assistant on the form page. The R-17 guide walks through each section step by step. You can also read the guide online." },
  { q: "Can I change my beneficiaries later?", a: "Yes. Submitting a new R-17 replaces all earlier versions. Check the box on the form to confirm you understand this." },
  { q: "What is a contingent beneficiary?", a: "A primary beneficiary receives benefits first. A contingent beneficiary only receives benefits if all primary beneficiaries have died before you." },
  { q: "Do shares need to add up to 100%?", a: "Yes. If you nominate more than one beneficiary, the shares must add up to 100 percent. The form will not submit otherwise." },
];

export default function PensionHelp() {
  return (
    <SiteLayout site="pension" logoMark={<Landmark size={18} />} logoText="Saltmere Pension Fund" navLinks={navLinks} searchPages={searchPages} footerNote="Saltmere Pension Fund. Helping members plan for tomorrow." large>
      <div className="site-container">
        <div className="prose-site">
          <h1>Help & FAQ</h1>
          <div className="site-card" style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileText size={18} style={{ color: "hsl(var(--site-accent))" }} />
              <a href="/docs/r17-guide.html" target="_blank" rel="noopener noreferrer" style={{ color: "hsl(var(--site-accent))", fontWeight: 600, fontSize: "1.0625rem" }}>
                Read the R-17 guide
              </a>
            </div>
          </div>
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
