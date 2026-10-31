// Structure inspired by a bank or patient-portal home; Brindlewick's own design.
// Phone first: a status card, then to-dos, with tabs along the bottom on a phone and across the top on a desktop.
import { useEffect, type ReactNode } from "react";
import { Link, Navigate, NavLink, useLocation, useNavigate } from "react-router-dom";
import { Home, FolderOpen, Receipt, MessageSquare, CalendarDays, ClipboardList, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopilotMount } from "@/hooks/useCopilot";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { SourceViewer } from "@/components/tax/SourceViewer";
import { clearPortalToken, getPortalToken, setPortalExpiredHandler } from "@/lib/practice";

const DEMO_TEXT =
  "Demo: Brindlewick is a fictional firm. Every client and record here is made-up sample data.";

const TABS = [
  { to: "/tax/portal/home", label: "Home", icon: Home },
  { to: "/tax/portal/documents", label: "Documents", icon: FolderOpen },
  { to: "/tax/portal/invoices", label: "Invoices", icon: Receipt },
  { to: "/tax/portal/messages", label: "Messages", icon: MessageSquare },
  { to: "/tax/portal/appointments", label: "Appointments", icon: CalendarDays },
  { to: "/tax/portal/organizer", label: "Organizer", icon: ClipboardList },
];

function PortalMark() {
  return (
    <span className="pt-mark" aria-hidden="true">
      <span className="pt-mark-a" />
      <span className="pt-mark-b" />
      <span className="pt-mark-c" />
    </span>
  );
}

export function usePortalGuard(): string {
  const token = getPortalToken();
  const navigate = useNavigate();

  useEffect(() => {
    setPortalExpiredHandler(() => navigate("/tax/portal", { replace: true }));
    return () => setPortalExpiredHandler(null);
  }, [navigate]);

  return token;
}

export function PortalLayout({
  children,
  title,
  firstName,
}: {
  children: ReactNode;
  title: string;
  firstName?: string;
}) {
  const token = usePortalGuard();
  const navigate = useNavigate();
  const location = useLocation();

  useCopilotMount(COPILOT_CONFIGS.tax);

  useEffect(() => {
    document.title = `${title} · Brindlewick Client Portal (Demo)`;
  }, [title]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [location.pathname]);

  if (!token) return <Navigate to="/tax/portal" replace />;

  const signOut = () => {
    clearPortalToken();
    navigate("/tax/portal", { replace: true });
  };

  return (
    <div className="pt-root">
      <div className="pt-demobar" data-testid="demo-banner">
        <span className="pt-demobar-dot" aria-hidden="true" />
        <p>{DEMO_TEXT}</p>
      </div>

      <header className="pt-topbar">
        <div className="pt-topbar-inner">
          <Link to="/tax/portal/home" className="pt-logo" aria-label="Brindlewick client portal, home">
            <PortalMark />
            <span className="pt-logo-text">
              <span className="pt-logo-name">Brindlewick</span>
              <span className="pt-logo-sub">Client portal</span>
            </span>
          </Link>

          <nav className="pt-tabs" aria-label="Portal">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) => cn("pt-tab", isActive && "active")}
              >
                <t.icon size={15} aria-hidden="true" />
                <span>{t.label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="pt-topbar-right">
            {firstName ? <span className="pt-firstname">{firstName}</span> : null}
            <button type="button" className="pt-signout" onClick={signOut}>
              <LogOut size={14} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="pt-main">{children}</main>

      <nav className="pt-bottomtabs" aria-label="Portal">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => cn("pt-bottomtab", isActive && "active")}>
            <t.icon size={19} aria-hidden="true" />
            <span>{t.label}</span>
          </NavLink>
        ))}
      </nav>

      <SourceViewer />
      <CopilotWidget />
    </div>
  );
}

/** The small note every portal page carries. */
export function SampleNote() {
  return <p className="pt-sample">Sample client: every detail is fictional.</p>;
}
