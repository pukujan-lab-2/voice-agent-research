import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Phone } from "lucide-react";
import { DemoBar } from "./TaxNotice";

export const TAX_NAV = [
  { label: "Services", to: "/tax/services" },
  { label: "Pricing", to: "/tax/pricing" },
  { label: "Team", to: "/tax/team" },
  { label: "Tax Guides", to: "/tax/guides" },
  { label: "FAQ", to: "/tax/faq" },
  { label: "About", to: "/tax/about" },
];

/** The wordmark: a mark built from shapes and type, then "Brindlewick" over "Tax & Accounting". */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="tax-wordmark">
      <span className="tax-mark" aria-hidden="true">
        <span className="tax-mark-a" />
        <span className="tax-mark-b" />
        <span className="tax-mark-c" />
      </span>
      <span className="tax-wordmark-text">
        <span className="tax-wordmark-name">Brindlewick</span>
        {!compact && <span className="tax-wordmark-sub">Tax &amp; Accounting</span>}
      </span>
    </span>
  );
}

export function TaxLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const topRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);

  // Publish the sticky bar's height so anchored headings and the source viewer clear it.
  useEffect(() => {
    const publish = () => {
      const h = topRef.current?.offsetHeight ?? 0;
      if (h) rootRef.current?.style.setProperty("--tax-chrome-h", `${h}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    if (topRef.current) ro.observe(topRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="tax-root" ref={rootRef}>
      <div className="tax-topbar" ref={topRef}>
        <DemoBar />
        <header className="tax-header">
          <div className="tax-header-inner">
            <Link to="/tax" className="tax-logo" aria-label="Brindlewick Tax & Accounting, home">
              <Wordmark />
            </Link>

            <nav className={open ? "tax-nav open" : "tax-nav"} aria-label="Main">
              {TAX_NAV.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  className={({ isActive }) => (isActive ? "tax-nav-link active" : "tax-nav-link")}
                >
                  {l.label}
                </NavLink>
              ))}
              <Link to="/tax/book" className="tax-nav-book">
                Book
              </Link>
            </nav>

            <button
              type="button"
              className="tax-nav-toggle"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
      </div>

      <main className="tax-main">{children}</main>

      <footer className="tax-footer">
        <div className="tax-footer-inner">
          <div className="tax-footer-brand">
            <Wordmark />
            <p>Careful, unhurried tax and accounting work for households and small businesses.</p>
            <p className="tax-footer-contact">
              <Phone size={14} aria-hidden="true" /> (555) 010-2210 · hello@example.com
            </p>
            <p className="tax-footer-contact">
              1180 Larkspur Avenue, Suite 300, Harrow Falls (fictional)
            </p>
          </div>

          <div className="tax-footer-links">
            <span className="tax-footer-heading">The firm</span>
            <Link to="/tax/services">Services</Link>
            <Link to="/tax/pricing">Pricing</Link>
            <Link to="/tax/team">Team</Link>
            <Link to="/tax/book">Book a consultation</Link>
          </div>

          <div className="tax-footer-links">
            <span className="tax-footer-heading">Tax guides</span>
            <Link to="/tax/guides">Browse the library</Link>
            <Link to="/tax/faq">Tax FAQ</Link>
            <Link to="/tax/about">About this demo</Link>
            <Link to="/">Website Copilot</Link>
          </div>
        </div>

        <div className="tax-footer-legal">
          <p data-testid="tax-disclaimer">
            <strong>Demo site.</strong> Brindlewick is a fictional firm built to show a voice
            assistant. Not a real business. Don't enter real personal or tax information.
          </p>
          <p>
            Tax guides are IRS.gov publications (U.S. government works, public domain). Not
            affiliated with or endorsed by the IRS. Not tax advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
