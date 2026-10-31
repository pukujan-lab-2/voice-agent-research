import { type FormEvent } from "react";
import { Globe } from "lucide-react";
import { FormPage } from "@/components/site/FormPage";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { useNavigate } from "react-router-dom";

const searchPages = [
  { title: "Plans & pricing", path: "/pricing", keywords: "Starter, Growth, Scale, pricing, plans" },
  { title: "FAQ", path: "/pricing/faq", keywords: "questions, booking, payments" },
  { title: "Request a quote", path: "/pricing/quote", keywords: "quote, estimate, project" },
];

const navLinks = [
  { label: "Plans", path: "/pricing" },
  { label: "FAQ", path: "/pricing/faq" },
  { label: "Get a quote", path: "/pricing/quote" },
];

export default function PricingQuote() {
  const navigate = useNavigate();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = form.querySelectorAll("input, select, textarea");
    let valid = true;
    fields.forEach((field) => {
      const el = field as HTMLInputElement;
      if (typeof el.reportValidity === "function") {
        if (!el.reportValidity()) valid = false;
      }
    });
    if (!valid) {
      form.classList.add("attempted");
      return;
    }
    navigate("/sent");
  };

  return (
    <FormPage
      site="pricing"
      logoMark={<Globe size={18} />}
      logoText="Larchmoss Studio"
      navLinks={navLinks}
      searchPages={searchPages}
      footerNote="Small web design studio. Building sites that work."
      config={COPILOT_CONFIGS.pricing}
    >
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>
          Request a quote
        </h1>
        <p style={{ color: "hsl(var(--site-muted))", marginBottom: "1.5rem" }}>
          Tell us about your project and we will send a tailored quote within two business days.
        </p>

        <form data-copilot-form id="quote" autoComplete="off" onSubmit={handleSubmit} className="copilot-form">
          <div>
            <label htmlFor="biz">Business name</label>
            <input id="biz" name="biz" required data-copilot-ask="What's your business called?" />
          </div>
          <div>
            <label htmlFor="contact">Your name</label>
            <input id="contact" name="contact" required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="made up, for the demo" />
          </div>
          <fieldset data-copilot-ask="Which plan would you like">
            <legend>Plan</legend>
            <div className="radio-row">
              <span className="radio-item">
                <input type="radio" id="p1" name="plan" value="starter" required />
                <label htmlFor="p1">Starter</label>
              </span>
              <span className="radio-item">
                <input type="radio" id="p2" name="plan" value="growth" data-copilot-also="booking, payments" />
                <label htmlFor="p2">Growth</label>
              </span>
              <span className="radio-item">
                <input type="radio" id="p3" name="plan" value="scale" />
                <label htmlFor="p3">Scale</label>
              </span>
            </div>
          </fieldset>
          <div>
            <label htmlFor="budget">Budget</label>
            <select id="budget" name="budget" required data-copilot-ask="Roughly what budget do you have">
              <option value="">Choose one</option>
              <option value="lt1k" data-copilot-also="under a thousand, less than a thousand">Under $1,000</option>
              <option value="1to3k" data-copilot-also="three thousand, 3000, 3,000, two thousand, 2000, 2,000">$1,000 to $3,000</option>
              <option value="3to7k" data-copilot-also="five thousand, 5000, 5,000">$3,000 to $7,000</option>
              <option value="gt7k" data-copilot-also="ten thousand, more than seven thousand">Over $7,000</option>
            </select>
          </div>
          <div>
            <label htmlFor="needs">What do you need?</label>
            <textarea id="needs" name="needs" minLength={10} required />
          </div>
          <button type="submit">Request a quote</button>
        </form>
      </div>
    </FormPage>
  );
}
