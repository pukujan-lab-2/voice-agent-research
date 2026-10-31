import { type FormEvent } from "react";
import { Landmark, FileText } from "lucide-react";
import { FormPage } from "@/components/site/FormPage";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { useNavigate } from "react-router-dom";

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

export default function PensionR17() {
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
      site="pension"
      logoMark={<Landmark size={18} />}
      logoText="Saltmere Pension Fund"
      navLinks={navLinks}
      searchPages={searchPages}
      footerNote="Saltmere Pension Fund. Helping members plan for tomorrow."
      config={COPILOT_CONFIGS.pension}
    >
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>
          Form R-17: Beneficiary nomination
        </h1>
        <p style={{ color: "hsl(var(--site-muted))", marginBottom: "1rem", fontSize: "1.125rem" }}>
          Nominate who should receive your pension benefits. Fill it in by hand or let
          the copilot help, one step at a time.
        </p>

        <div className="info-panel" style={{ marginBottom: "1.5rem" }}>
          <FileText size={16} style={{ display: "inline", marginRight: "0.375rem", verticalAlign: "middle" }} />
          Need help? Read the{" "}
          <a href="/docs/r17-guide.html" target="_blank" rel="noopener noreferrer" style={{ color: "hsl(var(--site-accent))", fontWeight: 600 }}>
            R-17 guide
          </a>{" "}
          or ask the copilot — it quotes the guide with page numbers.
        </div>

        <form data-copilot-form id="r17" autoComplete="off" onSubmit={handleSubmit} className="copilot-form">
          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "hsl(var(--site-text))", marginTop: 0 }}>
            Section A: your details
          </h2>
          <div>
            <label htmlFor="member">Member number</label>
            <input
              id="member"
              name="member"
              required
              pattern="SPF-[0-9]{6}"
              title="Like SPF-123456"
              data-copilot-ask="What's your member number? It starts with SPF and has six digits."
            />
          </div>

          <h2 style={{ fontSize: "1.25rem", fontWeight: 700, color: "hsl(var(--site-text))" }}>
            Section B: beneficiary
          </h2>
          <div>
            <label htmlFor="bfirst">Beneficiary first name</label>
            <input id="bfirst" name="bfirst" required data-copilot-ask="What's the beneficiary's first name?" />
          </div>
          <div>
            <label htmlFor="blast">Beneficiary last name</label>
            <input id="blast" name="blast" required data-copilot-ask="And their last name?" />
          </div>
          <div>
            <label htmlFor="code">Payee code</label>
            <p style={{ fontSize: "0.875rem", color: "hsl(var(--site-muted))", marginBottom: "0.375rem" }}>
              See Schedule B, paragraph 4(c).
            </p>
            <select id="code" name="code" required data-copilot-ask="How is this person related to you">
              <option value="">Choose one</option>
              <option value="C" data-copilot-also="child, son, daughter, stepson, stepdaughter">C · Child</option>
              <option value="S" data-copilot-also="spouse, wife, husband, partner">S · Spouse or civil partner</option>
              <option value="P" data-copilot-also="parent, mother, father, mom, dad">P · Parent</option>
              <option value="B" data-copilot-also="brother, sister, sibling">B · Brother or sister</option>
              <option value="O" data-copilot-also="friend, other person, niece, nephew">O · Other person</option>
            </select>
          </div>
          <div>
            <label htmlFor="share">Share (percent)</label>
            <input
              id="share"
              name="share"
              type="number"
              min={1}
              max={100}
              required
              data-copilot-ask="What share should they get, in percent?"
            />
          </div>
          <fieldset data-copilot-ask="Is this a primary or a contingent beneficiary">
            <legend>Beneficiary type</legend>
            <div className="radio-row">
              <span className="radio-item">
                <input type="radio" id="t1" name="btype" value="primary" required />
                <label htmlFor="t1">Primary</label>
              </span>
              <span className="radio-item">
                <input type="radio" id="t2" name="btype" value="contingent" />
                <label htmlFor="t2">Contingent</label>
              </span>
            </div>
          </fieldset>
          <span className="check-item">
            <input type="checkbox" id="replace" name="replace" required />
            <label htmlFor="replace">I agree this form replaces every earlier R-17</label>
          </span>
          <button type="submit">Submit form R-17</button>
        </form>
      </div>
    </FormPage>
  );
}
