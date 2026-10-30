import { type FormEvent } from "react";
import { MonitorSmartphone } from "lucide-react";
import { FormPage } from "@/components/site/FormPage";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { useNavigate } from "react-router-dom";

const searchPages = [
  { title: "Home", path: "/itdesk", keywords: "status, articles, help desk" },
  { title: "Knowledge base", path: "/itdesk/kb", keywords: "VPN, password reset, printers" },
  { title: "New ticket", path: "/itdesk/new", keywords: "ticket, support, request" },
];

const navLinks = [
  { label: "Home", path: "/itdesk" },
  { label: "Knowledge base", path: "/itdesk/kb" },
  { label: "New ticket", path: "/itdesk/new" },
];

export default function ItdeskNew() {
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
      site="itdesk"
      logoMark={<MonitorSmartphone size={18} />}
      logoText="Cobblefin IT Desk"
      navLinks={navLinks}
      searchPages={searchPages}
      footerNote="Internal IT help desk for Cobblefin staff."
      config={COPILOT_CONFIGS.itdesk}
    >
      <div className="site-container">
        <h1 style={{ fontSize: "clamp(1.5rem, 4vw, 2rem)", fontWeight: 800, marginBottom: "0.5rem", color: "hsl(var(--site-text))" }}>
          New support ticket
        </h1>
        <p style={{ color: "hsl(var(--site-muted))", marginBottom: "1.5rem" }}>
          Tell us what is wrong and we will get on it.
        </p>

        <form data-copilot-form id="ticket" autoComplete="off" onSubmit={handleSubmit} className="copilot-form">
          <div>
            <label htmlFor="cat">Category</label>
            <select id="cat" name="cat" required data-copilot-ask="What kind of problem is it">
              <option value="">Choose one</option>
              <option value="net" data-copilot-also="vpn, wifi, wi-fi, internet">Network</option>
              <option value="hw" data-copilot-also="laptop, screen, keyboard, printer">Hardware</option>
              <option value="sw" data-copilot-also="app, program">Software</option>
              <option value="acct" data-copilot-also="password, login, locked out">Accounts and access</option>
            </select>
          </div>
          <div>
            <label htmlFor="svc">Affected service</label>
            <select id="svc" name="svc" required data-copilot-ask="Which service is affected">
              <option value="">Choose one</option>
              <option value="vpn" data-copilot-also="vpn, remote">VPN and remote access</option>
              <option value="mail" data-copilot-also="mail, outlook">Email</option>
              <option value="wifi" data-copilot-also="wifi, wi-fi, wireless">Office Wi-Fi</option>
              <option value="print" data-copilot-also="printer, printing">Printing</option>
            </select>
          </div>
          <div>
            <label htmlFor="asset">Asset tag</label>
            <input
              id="asset"
              name="asset"
              required
              pattern="CF-[0-9]{4}"
              title="Like CF-1234"
              data-copilot-ask="What's the asset tag on your laptop? It looks like CF and four digits."
            />
            <p style={{ fontSize: "0.8125rem", color: "hsl(var(--site-muted))", marginTop: "0.25rem" }}>
              On the sticker under your laptop, like CF-1234.
            </p>
          </div>
          <fieldset data-copilot-ask="Who is affected">
            <legend>Impact</legend>
            <div className="radio-row">
              <span className="radio-item">
                <input type="radio" id="i1" name="impact" value="me" required data-copilot-also="only me, just me" />
                <label htmlFor="i1">Just me</label>
              </span>
              <span className="radio-item">
                <input type="radio" id="i2" name="impact" value="team" data-copilot-also="my team, whole team" />
                <label htmlFor="i2">My team</label>
              </span>
              <span className="radio-item">
                <input type="radio" id="i3" name="impact" value="office" data-copilot-also="everyone, whole office" />
                <label htmlFor="i3">Whole office</label>
              </span>
            </div>
          </fieldset>
          <div>
            <label htmlFor="urg">Urgency</label>
            <select id="urg" name="urg" required data-copilot-ask="How urgent is it">
              <option value="">Choose one</option>
              <option value="low" data-copilot-also="not urgent, whenever">Low</option>
              <option value="med" data-copilot-also="today, sometime today">Medium</option>
              <option value="high" data-copilot-also="urgent, asap, blocked">High</option>
            </select>
          </div>
          <div>
            <label htmlFor="desc">Describe the problem</label>
            <textarea id="desc" name="desc" minLength={10} required data-copilot-ask="In a sentence, what's going wrong?" />
          </div>
          <div>
            <label htmlFor="email">Your work email</label>
            <input id="email" name="email" type="email" required placeholder="made up, for the demo" />
          </div>
          <button type="submit">Submit ticket</button>
        </form>
      </div>
    </FormPage>
  );
}
