/**
 * The footer: four link columns, the three offices with their phone numbers and today's hours from
 * /api/site/locations, a newsletter sign-up, and the standing demo and IRS notices.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Phone } from "lucide-react";
import { Wordmark } from "./Wordmark";
import { DEMO_NOTICE, IRS_LINE } from "./TaxNotice";
import { useSiteLocations } from "@/lib/siteData";
import { errorText, subscribeNewsletter } from "@/lib/practice";
import { hoursText, todayKey } from "@/lib/site";

const COLUMNS: { heading: string; links: { to: string; label: string }[] }[] = [
  {
    heading: "Individuals",
    links: [
      { to: "/tax/services", label: "Individual returns" },
      { to: "/tax/services/prior-year", label: "Prior-year returns" },
      { to: "/tax/industries/rideshare-gig", label: "Rideshare and gig" },
      { to: "/tax/industries/crypto", label: "Crypto and digital assets" },
      { to: "/tax/start", label: "Become a client" },
    ],
  },
  {
    heading: "Businesses",
    links: [
      { to: "/tax/services/bookkeeping", label: "Bookkeeping" },
      { to: "/tax/services/payroll", label: "Payroll" },
      { to: "/tax/services/business", label: "Business returns" },
      { to: "/tax/industries", label: "By industry" },
      { to: "/tax/payroll-setup", label: "Start payroll" },
    ],
  },
  {
    heading: "Resources",
    links: [
      { to: "/tax/tools/calendar", label: "Tax calendar" },
      { to: "/tax/tools/checklist", label: "Document checklist" },
      { to: "/tax/tools/mileage", label: "Mileage calculator" },
      { to: "/tax/blog", label: "Articles" },
      { to: "/tax/guides", label: "Tax Guides" },
      { to: "/tax/faq", label: "FAQ" },
    ],
  },
  {
    heading: "Firm",
    links: [
      { to: "/tax/about", label: "About us" },
      { to: "/tax/team", label: "Our team" },
      { to: "/tax/locations", label: "Locations" },
      { to: "/tax/reviews", label: "Reviews" },
      { to: "/tax/careers", label: "Careers" },
      { to: "/tax/contact", label: "Contact" },
    ],
  },
];

const TOPICS = [
  { value: "deadlines", label: "Deadlines" },
  { value: "individuals", label: "Individuals" },
  { value: "businesses", label: "Businesses" },
];

function Newsletter() {
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<string[]>(["deadlines"]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);

  const toggle = (value: string) =>
    setTopics((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    setBusy(true);
    setNote("");
    setFailed(false);
    try {
      const res = await subscribeNewsletter(email, topics);
      setNote(res.message || "Thank you. Check your inbox to confirm.");
      setEmail("");
    } catch (err) {
      setFailed(true);
      setNote(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="tax-newsletter" data-testid="newsletter" onSubmit={onSubmit} noValidate={false}>
      <label htmlFor="nl-email">The month ahead, by email</label>
      <input
        id="nl-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <div className="tax-newsletter-topics">
        {TOPICS.map((t) => (
          <label className="tax-newsletter-check" key={t.value}>
            <input
              type="checkbox"
              name="topics"
              value={t.value}
              checked={topics.includes(t.value)}
              onChange={() => toggle(t.value)}
            />
            {t.label}
          </label>
        ))}
      </div>
      <button type="submit" disabled={busy}>
        {busy ? "Signing up…" : "Sign up"}
      </button>
      {note && <p className={failed ? "tax-newsletter-note error" : "tax-newsletter-note"}>{note}</p>}
    </form>
  );
}

export function SiteFooter() {
  const locations = useSiteLocations();
  const today = todayKey();

  return (
    <footer className="tax-footer">
      <div className="tax-footer-grid">
        <div className="tax-footer-brand">
          <Wordmark />
          <p>
            Tax and accounting for households and owner-run businesses. Founded in 2009, with offices in
            Harrow Falls, Corbel and Millbrook.
          </p>
          <Newsletter />
        </div>

        {COLUMNS.map((col) => (
          <div className="tax-footer-links" key={col.heading}>
            <span className="tax-footer-heading">{col.heading}</span>
            {col.links.map((l) => (
              <Link key={`${col.heading}-${l.to}-${l.label}`} to={l.to}>
                {l.label}
              </Link>
            ))}
          </div>
        ))}

        <div className="tax-footer-links">
          <span className="tax-footer-heading">Offices</span>
          {locations.loading &&
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="tax-skel tax-skel-line" style={{ width: "9rem", opacity: 0.35 }} />
            ))}
          {locations.error && <p className="tax-tiny">{locations.error}</p>}
          {(locations.data?.locations ?? []).map((o) => (
            <div className="tax-footer-office" key={o.id}>
              <strong>{o.name}</strong>
              <p>
                {o.street}, {o.city}, {o.state} {o.zip}
              </p>
              <p>
                <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>{o.phone}</a>
              </p>
              <p>
                {hoursText(o.hours?.[today])}
                {o.hours?.[today]?.[1] ? " today" : ""}
              </p>
            </div>
          ))}
          <p style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0.5rem 0 0", fontSize: "0.75rem" }}>
            <MapPin size={12} aria-hidden="true" /> All three open Monday to Friday
          </p>
          {locations.data?.locations?.[0] && (
            <p style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0.25rem 0 0", fontSize: "0.75rem" }}>
              <Phone size={12} aria-hidden="true" /> Weekdays, 9 to 5
            </p>
          )}
        </div>
      </div>

      <div className="tax-footer-bottom">
        <Link to="/tax/privacy">Privacy</Link>
        <Link to="/tax/terms">Terms</Link>
        <Link to="/tax/contact">Contact</Link>
        <Link to="/tax/book">Book a consultation</Link>
        <span style={{ marginLeft: "auto" }}>
          <Link to="/tax/about">About this demo</Link> · <Link to="/">Website Copilot</Link>
        </span>
      </div>

      <div className="tax-footer-legal">
        <p data-testid="tax-disclaimer">
          <strong>Demo site.</strong> {DEMO_NOTICE.replace("Demo site: ", "")}
        </p>
        <p>{IRS_LINE}</p>
      </div>
    </footer>
  );
}
