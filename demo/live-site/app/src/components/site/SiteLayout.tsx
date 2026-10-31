import { useState, type ReactNode } from "react";
import { Menu, X, LogOut } from "lucide-react";
import { DemoBanner } from "./DemoBanner";
import { SiteSearch, type SearchablePage } from "./SiteSearch";
import { useGuest } from "@/hooks/useGuest";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";

export interface SiteNavLink {
  label: string;
  path: string;
}

export interface SiteLayoutProps {
  site: string;
  logoMark: ReactNode;
  logoText: string;
  navLinks: SiteNavLink[];
  searchPages: SearchablePage[];
  children: ReactNode;
  footerNote: string;
  hasCopilot?: boolean;
  large?: boolean;
}

export function SiteLayout({
  site,
  logoMark,
  logoText,
  navLinks,
  searchPages,
  children,
  footerNote,
  hasCopilot,
  large,
}: SiteLayoutProps) {
  const { isGuest, leaveGuest } = useGuest();
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className={`site-wrap${large ? " site-wrap-large" : ""}`} data-site={site}>
      <DemoBanner />

      <header className="site-header">
        <div className="site-header-inner">
          <a href={`/${site}`} className="site-logo">
            <span className="site-logo-mark">{logoMark}</span>
            <span className="site-logo-text">{logoText}</span>
          </a>

          <nav className={`site-nav ${navOpen ? "open" : ""}`}>
            {navLinks.map((link, i) => (
              <a key={i} href={link.path} onClick={() => setNavOpen(false)}>
                {link.label}
              </a>
            ))}
          </nav>

          <button
            className="site-nav-toggle"
            aria-label="Toggle navigation"
            onClick={() => setNavOpen((v) => !v)}
          >
            {navOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <div className="site-header-right">
            <SiteSearch pages={searchPages} />
            {isGuest && (
              <span className="site-guest-badge">
                Guest
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    leaveGuest();
                  }}
                >
                  <LogOut size={12} /> Leave
                </a>
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">{children}</main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div>
            <div style={{ fontWeight: 700, marginBottom: "0.25rem" }}>{logoText}</div>
            <div>{footerNote}</div>
          </div>
          <div>
            <div style={{ marginBottom: "0.5rem", opacity: 0.7 }}>Quick links</div>
            {navLinks.map((link, i) => (
              <div key={i}>
                <a href={link.path}>{link.label}</a>
              </div>
            ))}
            <div style={{ marginTop: "0.5rem" }}>
              <a href="/">Website Copilot home</a>
            </div>
          </div>
        </div>
      </footer>

      {hasCopilot && <CopilotWidget />}
    </div>
  );
}
