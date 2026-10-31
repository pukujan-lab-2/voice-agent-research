import { useState, type FormEvent } from "react";
import { Heart, Calendar } from "lucide-react";
import { FormPage } from "@/components/site/FormPage";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { useNavigate } from "react-router-dom";

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

export default function ClinicBook() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const currentFieldset = form.querySelector(
      "fieldset[data-step]:not([hidden])",
    ) as HTMLFieldSetElement | null;
    if (!currentFieldset) return;

    const fields = currentFieldset.querySelectorAll("input, select, textarea");
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

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    navigate("/sent");
  };

  return (
    <FormPage
      site="clinic"
      logoMark={<Heart size={18} />}
      logoText="Tumbleberry Children's Clinic"
      navLinks={navLinks}
      searchPages={searchPages}
      footerNote="Caring for families since 2018. Mon–Fri 8am–6pm."
      config={COPILOT_CONFIGS.clinic}
    >
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>
          Book a visit
        </h1>
        <p style={{ color: "hsl(var(--site-muted))", marginBottom: "1.5rem" }}>
          Three quick steps. Fill it in by hand, or tap Start voice call and let the copilot help.
        </p>

        <div className="step-indicator">
          <span className={`step-dot ${step === 1 ? "active" : ""}`}>1</span>
          <span>Your child</span>
          <span className="step-sep">·</span>
          <span className={`step-dot ${step === 2 ? "active" : ""}`}>2</span>
          <span>Time</span>
          <span className="step-sep">·</span>
          <span className={`step-dot ${step === 3 ? "active" : ""}`}>3</span>
          <span>Contact</span>
        </div>

        <form data-copilot-form id="book" autoComplete="off" onSubmit={handleSubmit} className="copilot-form">
          <fieldset data-step hidden={step !== 1} disabled={step !== 1}>
            <label htmlFor="child">Child's full name</label>
            <input id="child" name="child" required data-copilot-ask="What's your child's full name?" />
            <label htmlFor="visit">Type of visit</label>
            <select id="visit" name="visit" required data-copilot-ask="What kind of visit is it">
              <option value="">Choose one</option>
              <option value="wellchild" data-copilot-also="checkup, check-up, check up, well child">Well-child checkup</option>
              <option value="sick" data-copilot-also="sick, ill, fever, cough">Sick visit</option>
              <option value="vacc" data-copilot-also="vaccine, shot, shots, jab">Vaccination</option>
            </select>
            <button type="submit">Next</button>
          </fieldset>

          <fieldset data-step hidden={step !== 2} disabled={step !== 2}>
            <fieldset data-copilot-ask="Mornings or afternoons?">
              <legend>Time of day</legend>
              <div className="radio-row">
                <span className="radio-item">
                  <input type="radio" id="tod_am" name="tod" value="am" required />
                  <label htmlFor="tod_am">Morning</label>
                </span>
                <span className="radio-item">
                  <input type="radio" id="tod_pm" name="tod" value="pm" />
                  <label htmlFor="tod_pm">Afternoon</label>
                </span>
              </div>
            </fieldset>
            <label htmlFor="slot">Open slot</label>
            <select id="slot" name="slot" required data-copilot-ask="Which day suits you">
              <option value="">Choose a slot</option>
              <option value="tue0940" data-copilot-also="Tuesday, Tue">Tuesday 9:40 AM, Dr. Okafor</option>
              <option value="wed1020" data-copilot-also="Wednesday, Wed">Wednesday 10:20 AM, Dr. Lind</option>
              <option value="thu1415" data-copilot-also="Thursday, Thu">Thursday 2:15 PM, Dr. Okafor</option>
              <option value="fri1530" data-copilot-also="Friday, Fri">Friday 3:30 PM, Dr. Lind</option>
            </select>
            <button type="submit">Next</button>
          </fieldset>

          <fieldset data-step hidden={step !== 3} disabled={step !== 3}>
            <label htmlFor="parent">Parent or guardian name</label>
            <input id="parent" name="parent" autoComplete="off" required data-copilot-ask="And what's your name, as the parent or guardian?" />
            <label htmlFor="phone">Mobile phone</label>
            <input id="phone" name="phone" type="tel" required placeholder="made up, for the demo" />
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="made up, for the demo" />
            <span className="check-item">
              <input type="checkbox" id="remind" name="remind" />
              <label htmlFor="remind">Text me a reminder the day before</label>
            </span>
            <button type="submit">Book visit</button>
          </fieldset>
        </form>

        <div className="info-panel" style={{ marginTop: "1.5rem" }}>
          <Calendar size={16} style={{ display: "inline", marginRight: "0.375rem" }} />
          Tip: the copilot can read back your phone and email before you press Book. You always press the button yourself.
        </div>
      </div>
    </FormPage>
  );
}
