/**
 * The public site's chrome: the sticky demo bar, the mega-menu header with its search dialog, and the footer.
 *
 * The menu is drawn from the API: the service and industry lists, the team and the locations all arrive from the
 * practice API, so nothing here names a service or an office. The only fixed words are the four panel names and
 * the standing links (Tax calendar, Calculators, Articles, …), which are routes rather than content.
 *
 * Structure follows the large national firms' sites: four panels of two or three columns, each link with a
 * one-line description, and a small feature card on the right. No text, logo, colour or brand is taken from any.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight, BookOpen, Calculator, CalendarDays, CheckSquare, ChevronDown, Clock, Mail, MapPin,
  Menu, Phone, Search, X,
} from "lucide-react";
import { DemoBar } from "./TaxNotice";
import { Wordmark } from "./Wordmark";
import { SiteSearchDialog } from "./SiteSearchDialog";
import { SiteFooter } from "./SiteFooter";
import {
  useSiteIndustries, useSiteLocations, useSiteServices, useSiteTeam, useUpcomingDeadlines, deadlineAfter,
} from "@/lib/siteData";
import { fmtLongDate, type SiteDeadline } from "@/lib/practice";

export interface MenuLink {
  to: string;
  label: string;
  note?: string;
}

export interface MenuPanel {
  key: string;
  label: string;
  columns: { heading: string; links: MenuLink[] }[];
  feature?: ReactNode;
}

function PanelButton({
  panel,
  open,
  onToggle,
  onHover,
}: {
  panel: MenuPanel;
  open: boolean;
  onToggle: () => void;
  onHover: () => void;
}) {
  return (
    <div className="tax-menu-wrap">
      <button
        type="button"
        className="tax-menu-btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={onToggle}
        onMouseEnter={onHover}
      >
        {panel.label}
        <ChevronDown size={13} aria-hidden="true" />
      </button>
      {open && (
        <div className="tax-megamenu" role="menu" aria-label={panel.label} data-testid="site-megamenu">
          {panel.columns.map((col) => (
            <div className="tax-megamenu-col" key={col.heading}>
              <div className="tax-megamenu-heading">{col.heading}</div>
              {col.links.map((l) => (
                <Link key={l.to} to={l.to} className="tax-megamenu-link" role="menuitem">
                  <strong>{l.label}</strong>
                  {l.note && <span>{l.note}</span>}
                </Link>
              ))}
            </div>
          ))}
          {panel.feature}
        </div>
      )}
    </div>
  );
}

/** The next deadline as the menu's feature card. */
function NextDeadlineCard({ deadlines }: { deadlines: SiteDeadline[] }) {
  const next = deadlineAfter(deadlines);
  if (!next) return null;
  return (
    <div className="tax-megamenu-feature">
      <span className="tax-tiny">Next deadline</span>
      <strong>{next.title}</strong>
      <p>
        {fmtLongDate(next.date)} · {next.form}
      </p>
      <Link to="/tax/tools/calendar">
        The tax calendar <ArrowRight size={12} aria-hidden="true" style={{ verticalAlign: "-1px" }} />
      </Link>
    </div>
  );
}

export function SiteHeader() {
  const [openPanel, setOpenPanel] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { pathname } = useLocation();
  const barRef = useRef<HTMLDivElement>(null);

  const services = useSiteServices();
  const industries = useSiteIndustries();
  const team = useSiteTeam();
  const locations = useSiteLocations();
  const deadlines = useUpcomingDeadlines();

  useEffect(() => {
    setOpenPanel(null);
    setSheetOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  // ⌘K / Ctrl-K opens search from anywhere on the site.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Close an open panel with Escape or a click elsewhere.
  useEffect(() => {
    if (!openPanel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenPanel(null);
    const onClick = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenPanel(null);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [openPanel]);

  const panels: MenuPanel[] = useMemo(() => {
    const allServices = services.data?.services ?? [];
    const allIndustries = industries.data?.industries ?? [];
    const individuals = allServices.filter((s) => s.audience === "individuals");
    const businesses = allServices.filter((s) => s.audience === "businesses");
    const serviceLinks = (list: typeof allServices): MenuLink[] =>
      list.map((s) => ({ to: `/tax/services/${s.slug}`, label: s.name, note: s.short }));
    const industryLinks = (list: typeof allIndustries): MenuLink[] =>
      list.map((i) => ({ to: `/tax/industries/${i.slug}`, label: i.name, note: i.short }));

    const people = (team.data?.team ?? []).filter((p) => p.accepts_new);

    return [
      {
        key: "individuals",
        label: "Individuals",
        columns: [
          { heading: "Individual services", links: serviceLinks(individuals) },
          {
            heading: "For people like you",
            links: industryLinks(allIndustries.filter((i) => /rideshare|gig|crypto/i.test(i.slug))),
          },
          {
            heading: "Get started",
            links: [
              { to: "/tax/start", label: "Become a client", note: "Four short steps, then a call" },
              { to: "/tax/schedule", label: "Book an appointment", note: "See the open times" },
              { to: "/tax/tools/checklist", label: "What to bring", note: "Build your document list" },
            ],
          },
        ],
        feature: <NextDeadlineCard deadlines={deadlines.data?.deadlines ?? []} />,
      },
      {
        key: "businesses",
        label: "Businesses",
        columns: [
          { heading: "Business services", links: serviceLinks(businesses) },
          { heading: "By industry", links: industryLinks(allIndustries) },
          {
            heading: "For owners",
            links: [
              { to: "/tax/payroll-setup", label: "Start payroll", note: "Pay runs, deposits and W-2s" },
              { to: "/tax/payment-plan", label: "Pay over time", note: "A payment plan for a balance" },
              { to: "/tax/services", label: "All services", note: "Ten things we do, with prices" },
            ],
          },
        ],
        feature: <NextDeadlineCard deadlines={deadlines.data?.deadlines ?? []} />,
      },
      {
        key: "resources",
        label: "Resources",
        columns: [
          {
            heading: "Tools",
            links: [
              { to: "/tax/tools/calendar", label: "Tax calendar", note: "Federal deadlines, month by month" },
              { to: "/tax/tools/checklist", label: "Document checklist", note: "What to gather, by situation" },
              { to: "/tax/tools/refund-status", label: "Where's my refund", note: "What each status means" },
            ],
          },
          {
            heading: "Calculators",
            links: [
              { to: "/tax/tools/quarterly", label: "Quarterly estimate", note: "What to set aside each quarter" },
              { to: "/tax/tools/mileage", label: "Mileage", note: "Miles at the standard rate" },
              { to: "/tax/tools/se-tax", label: "Self-employment tax", note: "Net earnings to SE tax" },
            ],
          },
          {
            heading: "Reading",
            links: [
              { to: "/tax/blog", label: "Articles", note: "Notes from the practice" },
              { to: "/tax/guides", label: "Tax Guides", note: "IRS publications, in full" },
              { to: "/tax/faq", label: "FAQ", note: "Questions we answer weekly" },
            ],
          },
        ],
        feature: <NextDeadlineCard deadlines={deadlines.data?.deadlines ?? []} />,
      },
      {
        key: "about",
        label: "About",
        columns: [
          {
            heading: "The firm",
            links: [
              { to: "/tax/about", label: "About us", note: "Founded 2009, three offices" },
              { to: "/tax/team", label: "Our team", note: "Who does the work" },
              { to: "/tax/locations", label: "Locations", note: "Addresses, phones and hours" },
            ],
          },
          {
            heading: "Working with us",
            links: [
              { to: "/tax/reviews", label: "Reviews", note: "Sample reviews for this demo" },
              { to: "/tax/careers", label: "Careers", note: "Openings, and what we offer" },
              { to: "/tax/pricing", label: "Pricing", note: "Published fees" },
            ],
          },
          {
            heading: "Contact",
            links: [
              { to: "/tax/contact", label: "Contact us", note: "Message the office" },
              { to: "/tax/book", label: "Book a consultation", note: "Fifteen minutes, free" },
              { to: "/tax/refer", label: "Refer a friend", note: "One introduction, no follow-up" },
            ],
          },
        ],
        feature: <NextDeadlineCard deadlines={deadlines.data?.deadlines ?? []} />,
      },
    ];
  }, [services.data, industries.data, team.data, deadlines.data]);

  const office = locations.data?.locations?.[0];

  return (
    <>
      <div className="tax-topbar" ref={barRef}>
        <DemoBar />
        <header className="tax-header">
          <div className="tax-header-inner">
            <Link to="/tax" className="tax-logo" aria-label="Brindlewick Tax & Accounting, home">
              <Wordmark />
            </Link>

            <nav className="tax-menubar" aria-label="Main">
              {panels.map((p) => (
                <PanelButton
                  key={p.key}
                  panel={p}
                  open={openPanel === p.key}
                  onToggle={() => setOpenPanel(openPanel === p.key ? null : p.key)}
                  onHover={() => openPanel && setOpenPanel(p.key)}
                />
              ))}
            </nav>

            <div className="tax-header-actions">
              <button
                type="button"
                className="tax-icon-btn"
                onClick={() => setSearchOpen(true)}
                aria-label="Search the site"
                data-testid="site-search"
              >
                <Search size={18} aria-hidden="true" />
              </button>
              <Link to="/tax/portal" className="tax-login-link" data-testid="client-login">
                Client login
              </Link>
              <Link to="/tax/book" className="tax-nav-book">
                Book a consultation
              </Link>
              <button
                type="button"
                className="tax-nav-toggle"
                style={{ display: "inline-flex", marginLeft: 0 }}
                aria-label="Open menu"
                aria-expanded={sheetOpen}
                onClick={() => setSheetOpen(true)}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            </div>
          </div>
        </header>
      </div>

      {sheetOpen && (
        <div className="tax-sheet" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="tax-sheet-head">
            <Link to="/tax" className="tax-logo" aria-label="Brindlewick, home">
              <Wordmark />
            </Link>
            <button type="button" className="tax-icon-btn" aria-label="Close menu" onClick={() => setSheetOpen(false)}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div style={{ padding: "0.75rem 1rem" }}>
            <button
              type="button"
              className="tax-btn tax-btn-outline"
              style={{ width: "100%" }}
              onClick={() => {
                setSheetOpen(false);
                setSearchOpen(true);
              }}
            >
              <Search size={16} aria-hidden="true" /> Search the site
            </button>
          </div>

          {panels.map((p) => (
            <details className="tax-accordion" key={p.key}>
              <summary>{p.label}</summary>
              <div className="tax-accordion-body">
                {p.columns.map((col) => (
                  <div key={col.heading} style={{ marginBottom: "0.75rem" }}>
                    <div className="tax-megamenu-heading">{col.heading}</div>
                    {col.links.map((l) => (
                      <Link key={l.to} to={l.to} className="tax-megamenu-link" onClick={() => setSheetOpen(false)}>
                        <strong>{l.label}</strong>
                        {l.note && <span>{l.note}</span>}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            </details>
          ))}

          <div style={{ padding: "1rem", display: "grid", gap: "0.5rem" }}>
            <Link to="/tax/book" className="tax-btn" onClick={() => setSheetOpen(false)}>
              Book a consultation <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/tax/portal" className="tax-btn tax-btn-outline" onClick={() => setSheetOpen(false)}>
              Client login
            </Link>
            {office && (
              <p className="tax-small tax-muted" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0.5rem 0 0" }}>
                <Phone size={14} aria-hidden="true" /> {office.phone}
              </p>
            )}
          </div>
        </div>
      )}

      {searchOpen && <SiteSearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}

/** The page shell: the header, the content, the footer and the published chrome height. */
export function SiteShell({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

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
      <div ref={topRef} style={{ position: "sticky", top: 0, zIndex: 40 }}>
        <SiteHeader />
      </div>
      <main className="tax-main">{children}</main>
      <SiteFooter />
    </div>
  );
}

/** Small icons re-exported for the pages that mirror the menu's resource links. */
export const SITE_ICONS = { CalendarDays, CheckSquare, Calculator, BookOpen, Clock, MapPin, Mail };
