import { type FormEvent } from "react";
import { Wrench, AlertCircle } from "lucide-react";
import { FormPage } from "@/components/site/FormPage";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { useNavigate } from "react-router-dom";

const searchPages = [
  { title: "Home", path: "/appliance", keywords: "HDW-500, dishwasher, support" },
  { title: "Manuals", path: "/appliance/manuals", keywords: "manual, guide, HDW-500" },
  { title: "Help & error codes", path: "/appliance/help", keywords: "E11, E15, E24, E25, E09, error" },
  { title: "Request service", path: "/appliance/support", keywords: "service, repair, visit" },
];

const navLinks = [
  { label: "Home", path: "/appliance" },
  { label: "Manuals", path: "/appliance/manuals" },
  { label: "Help", path: "/appliance/help" },
  { label: "Support", path: "/appliance/support" },
];

export default function ApplianceSupport() {
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
      site="appliance"
      logoMark={<Wrench size={18} />}
      logoText="Kettlewisp Appliances"
      navLinks={navLinks}
      searchPages={searchPages}
      footerNote="HDW-500 dishwasher support. Mon–Sat 7am–8pm."
      config={COPILOT_CONFIGS.appliance}
    >
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>
          Request a service visit
        </h1>
        <p style={{ color: "hsl(var(--site-muted))", marginBottom: "1.5rem" }}>
          Tell us what's wrong with your HDW-500 and we'll send a technician.
        </p>

        <div className="info-panel" style={{ marginBottom: "1.5rem" }}>
          <AlertCircle size={16} style={{ display: "inline", marginRight: "0.375rem", verticalAlign: "middle" }} />
          <strong>Error E24?</strong> Try the fix first — the copilot can walk you through
          cleaning the filter and checking the drain hose (manual page 7). If that doesn't
          work, fill in the form below.
        </div>

        <form data-copilot-form id="service" autoComplete="off" onSubmit={handleSubmit} className="copilot-form">
          <div>
            <label htmlFor="serial">Serial number</label>
            <input
              id="serial"
              name="serial"
              required
              pattern="[A-Z0-9]{4}-?[A-Z0-9]{4}-?[A-Z0-9]{4}"
              placeholder="1334-592C-LSD3"
              data-copilot-ask="Can you read me the serial number? It's on a silver sticker on the right edge of the inner door."
            />
            <p style={{ fontSize: "0.8125rem", color: "hsl(var(--site-muted))", marginTop: "0.25rem" }}>
              On the silver sticker on the right edge of the inner door (manual page 1).
            </p>
          </div>

          <div>
            <label htmlFor="code">Error code</label>
            <select id="code" name="code" required data-copilot-ask="Which error code does the display show">
              <option value="">Choose one</option>
              <option value="E11" data-copilot-also="E11, E 11">E11: water comes in too slowly</option>
              <option value="E15" data-copilot-also="E15, E 15">E15: leak</option>
              <option value="E24" data-copilot-also="E24, E 24, twenty four, twenty-four">E24: water not draining</option>
              <option value="E25" data-copilot-also="E25, E 25">E25: drain pump blocked</option>
              <option value="E09" data-copilot-also="E09, E9">E09: heater fault</option>
            </select>
          </div>

          <div>
            <label htmlFor="name">Your name</label>
            <input id="name" name="name" required />
          </div>

          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required placeholder="made up, for the demo" />
          </div>

          <div>
            <label htmlFor="what">What happened?</label>
            <textarea id="what" name="what" minLength={10} required />
          </div>

          <button type="submit">Request visit</button>
        </form>
      </div>
    </FormPage>
  );
}
