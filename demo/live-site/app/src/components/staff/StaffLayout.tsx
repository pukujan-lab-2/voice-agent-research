// Structure inspired by practice-management client pages; Brindlewick's own design.
// A dense, quiet work tool: a fixed sidebar, a top bar with global search and the signed-in person, and the page.
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  FileSpreadsheet,
  ListChecks,
  FolderOpen,
  ShieldAlert,
  CalendarDays,
  Receipt,
  MessageSquare,
  CheckSquare,
  BarChart3,
  Inbox,
  ScrollText,
  Search,
  Plus,
  ChevronsLeft,
  ChevronsRight,
  Menu,
  X,
  LogOut,
  UserRound,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCopilotMount } from "@/hooks/useCopilot";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { SourceViewer } from "@/components/tax/SourceViewer";
import { useApi, useDebounced } from "@/hooks/useApi";
import {
  clearStaffToken,
  getStaffToken,
  setStaffExpiredHandler,
  staffGet,
  type FoundClient,
  type StaffProfile,
  type Paged,
  type StaffThread,
} from "@/lib/practice";
import { NewMessageDialog, NewTaskDialog } from "./dialogs";

const DEMO_TEXT =
  "Demo: Brindlewick is a fictional firm. Every client and record here is made-up sample data.";

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: number;
}

interface NavSection {
  label?: string;
  items: NavItem[];
}

/** Give the copilot the staff token before the page's first request, and again once it is ready. */
function publishStaffAuth() {
  const token = getStaffToken();
  if (!token) return;
  const send = () => window.copilot?.setAuth?.("staff", token);
  send();
  if (!window.copilot) window.addEventListener("copilot:ready", send, { once: true });
}

export function useStaffGuard(): string {
  const token = getStaffToken();
  const navigate = useNavigate();

  useEffect(() => {
    setStaffExpiredHandler(() => navigate("/staff", { replace: true }));
    return () => setStaffExpiredHandler(null);
  }, [navigate]);

  return token;
}

/** The mark, then "Brindlewick" over "Practice". */
function StaffMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="bw-wordmark">
      <span className="bw-mark" aria-hidden="true">
        <span className="bw-mark-a" />
        <span className="bw-mark-b" />
        <span className="bw-mark-c" />
      </span>
      {!compact && (
        <span className="bw-wordmark-text">
          <span className="bw-wordmark-name">Brindlewick</span>
          <span className="bw-wordmark-sub">Practice</span>
        </span>
      )}
    </span>
  );
}

export function StaffLayout({
  children,
  title,
  copilot = "staff",
}: {
  children: ReactNode;
  title: string;
  copilot?: "staff" | "staffEngagement";
}) {
  publishStaffAuth();

  const token = useStaffGuard();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [newMessage, setNewMessage] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const newRef = useRef<HTMLDivElement>(null);

  useCopilotMount(copilot === "staffEngagement" ? COPILOT_CONFIGS.staffEngagement : COPILOT_CONFIGS.staff);

  useEffect(() => {
    document.title = `${title} · Brindlewick Practice (Demo)`;
  }, [title]);

  useEffect(() => {
    setDrawer(false);
    setSearchOpen(false);
    setNewOpen(false);
  }, [location.pathname, location.search]);

  const me = useApi(
    () => (token ? staffGet<{ staff: StaffProfile }>("/me") : Promise.resolve({ staff: null as unknown as StaffProfile })),
    [token],
  );

  const unread = useApi(
    () => (token ? staffGet<Paged<StaffThread>>("/threads", { unread: 1, size: 1 }) : Promise.resolve(null)),
    [token, location.pathname],
  );
  const unreadCount = unread.data?.total ?? 0;

  const debouncedQuery = useDebounced(query, 250);
  const matches = useApi(
    () =>
      debouncedQuery.trim().length >= 2
        ? staffGet<{ matches: FoundClient[] }>("/find", { q: debouncedQuery.trim() })
        : Promise.resolve({ matches: [] as FoundClient[] }),
    [debouncedQuery],
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (newRef.current && !newRef.current.contains(e.target as Node)) setNewOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const sections = useMemo<NavSection[]>(
    () => [
      { items: [{ to: "/staff/dashboard", label: "Dashboard", icon: LayoutDashboard }] },
      { items: [{ to: "/staff/clients", label: "Clients", icon: Users }] },
      {
        label: "Work",
        items: [
          { to: "/staff/pipeline", label: "Pipeline", icon: KanbanSquare },
          { to: "/staff/engagements", label: "Engagements", icon: FileSpreadsheet },
          { to: "/staff/queue", label: "Work queue", icon: ListChecks },
          { to: "/staff/documents", label: "Documents", icon: FolderOpen },
          { to: "/staff/notices", label: "IRS notices", icon: ShieldAlert },
        ],
      },
      { items: [{ to: "/staff/calendar", label: "Calendar", icon: CalendarDays }] },
      { items: [{ to: "/staff/billing", label: "Billing", icon: Receipt }] },
      {
        items: [
          { to: "/staff/messages", label: "Messages", icon: MessageSquare, badge: unreadCount },
        ],
      },
      { items: [{ to: "/staff/tasks", label: "Tasks", icon: CheckSquare }] },
      { items: [{ to: "/staff/reports", label: "Reports", icon: BarChart3 }] },
      { items: [{ to: "/staff/submissions", label: "Website submissions", icon: Inbox }] },
      { items: [{ to: "/staff/audit", label: "Audit log", icon: ScrollText }] },
    ],
    [unreadCount],
  );

  if (!token) return <Navigate to="/staff" replace />;

  const profile = me.data?.staff;
  const signOut = () => {
    clearStaffToken();
    navigate("/staff", { replace: true });
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    setSearchOpen(false);
    navigate(q ? `/staff/clients?q=${encodeURIComponent(q)}` : "/staff/clients");
  };

  const nav = (
    <nav className="bw-nav" aria-label="Practice">
      {sections.map((section, i) => (
        <div className="bw-nav-section" key={i}>
          {section.label && !collapsed ? <span className="bw-nav-label">{section.label}</span> : null}
          {section.label && collapsed ? <span className="bw-nav-rule" aria-hidden="true" /> : null}
          {section.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => cn("bw-nav-link", isActive && "active")}
              title={collapsed ? item.label : undefined}
            >
              <item.icon size={16} aria-hidden="true" className="bw-nav-icon" />
              {!collapsed && <span className="bw-nav-text">{item.label}</span>}
              {item.badge ? (
                <span className={cn("bw-nav-badge", collapsed && "bw-nav-badge-dot")}>
                  {collapsed ? "" : item.badge > 99 ? "99+" : item.badge}
                </span>
              ) : null}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );

  return (
    <div className={cn("bw-root", collapsed && "bw-root-collapsed")}>
      <div className="bw-demobar" data-testid="demo-banner">
        <span className="bw-demobar-dot" aria-hidden="true" />
        <p>{DEMO_TEXT}</p>
      </div>

      <div className="bw-shell">
        <aside className="bw-sidebar" data-testid="staff-nav" aria-label="Practice navigation">
          <div className="bw-sidebar-head">
            <Link to="/staff/dashboard" className="bw-logo" aria-label="Brindlewick Practice, dashboard">
              <StaffMark compact={collapsed} />
            </Link>
            <button
              type="button"
              className="bw-collapse"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expand the sidebar" : "Collapse the sidebar"}
              aria-expanded={!collapsed}
            >
              {collapsed ? <ChevronsRight size={15} /> : <ChevronsLeft size={15} />}
            </button>
          </div>
          {nav}
          <div className="bw-sidebar-foot">
            {profile ? (
              <div className="bw-me">
                <span className="bw-avatar" aria-hidden="true">
                  {profile.avatar ? (
                    <img src={profile.avatar} alt="" />
                  ) : (
                    <UserRound size={15} />
                  )}
                </span>
                {!collapsed && (
                  <span className="bw-me-text">
                    <span className="bw-me-name">{profile.name}</span>
                    <span className="bw-me-role">{profile.title}</span>
                  </span>
                )}
              </div>
            ) : null}
            <button type="button" className="bw-signout" onClick={signOut}>
              <LogOut size={14} aria-hidden="true" />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </aside>

        {drawer && (
          <div className="bw-drawer" role="dialog" aria-label="Practice navigation" aria-modal="true">
            <div className="bw-drawer-head">
              <StaffMark />
              <button type="button" className="bw-icon-btn" onClick={() => setDrawer(false)} aria-label="Close the menu">
                <X size={18} />
              </button>
            </div>
            {nav}
            <button type="button" className="bw-signout" onClick={signOut}>
              <LogOut size={14} aria-hidden="true" /> Sign out
            </button>
          </div>
        )}
        {drawer && <button className="bw-scrim" aria-label="Close the menu" onClick={() => setDrawer(false)} />}

        <div className="bw-main">
          <header className="bw-topbar">
            <button
              type="button"
              className="bw-icon-btn bw-topbar-menu"
              onClick={() => setDrawer(true)}
              aria-label="Open the menu"
            >
              <Menu size={18} />
            </button>

            <div className="bw-search-wrap" ref={searchRef}>
              <form onSubmit={submitSearch} className="bw-global-search" role="search">
                <Search size={15} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder="Search clients by name, ID or city"
                  aria-label="Search clients"
                  autoComplete="off"
                />
              </form>
              {searchOpen && debouncedQuery.trim().length >= 2 && (
                <div className="bw-search-pop">
                  {matches.loading && <p className="bw-search-note">Searching…</p>}
                  {!matches.loading && (matches.data?.matches?.length ?? 0) === 0 && (
                    <p className="bw-search-note">No clients match “{debouncedQuery.trim()}”.</p>
                  )}
                  {(matches.data?.matches ?? []).slice(0, 6).map((m) => (
                    <Link key={m.id} to={`/staff/clients/${m.id}`} className="bw-search-hit">
                      {m.kind === "business" ? <Building2 size={14} /> : <Users size={14} />}
                      <span className="bw-search-hit-name">{m.name}</span>
                      <span className="bw-search-hit-meta">
                        {m.id}
                        {m.city ? ` · ${m.city}` : ""}
                      </span>
                    </Link>
                  ))}
                  <button
                    type="button"
                    className="bw-search-all"
                    onClick={() => {
                      const q = query.trim();
                      setSearchOpen(false);
                      navigate(`/staff/clients?q=${encodeURIComponent(q)}`);
                    }}
                  >
                    See every client matching “{query.trim()}” →
                  </button>
                </div>
              )}
            </div>

            <div className="bw-topbar-right">
              <div className="bw-new-wrap" ref={newRef}>
                <button
                  type="button"
                  className="bw-btn bw-btn-primary bw-btn-sm"
                  onClick={() => setNewOpen((v) => !v)}
                  aria-expanded={newOpen}
                  aria-haspopup="menu"
                >
                  <Plus size={14} aria-hidden="true" /> New
                </button>
                {newOpen && (
                  <div className="bw-menu" role="menu">
                    <Link role="menuitem" to="/staff/engagements/new" className="bw-menu-item">
                      <FileSpreadsheet size={14} aria-hidden="true" /> New engagement
                    </Link>
                    <button
                      role="menuitem"
                      type="button"
                      className="bw-menu-item"
                      onClick={() => {
                        setNewOpen(false);
                        setNewTask(true);
                      }}
                    >
                      <CheckSquare size={14} aria-hidden="true" /> New task
                    </button>
                    <button
                      role="menuitem"
                      type="button"
                      className="bw-menu-item"
                      onClick={() => {
                        setNewOpen(false);
                        setNewMessage(true);
                      }}
                    >
                      <MessageSquare size={14} aria-hidden="true" /> New message
                    </button>
                  </div>
                )}
              </div>

              {profile ? (
                <div className="bw-topbar-me">
                  <span className="bw-avatar bw-avatar-sm" aria-hidden="true">
                    {profile.avatar ? <img src={profile.avatar} alt="" /> : <UserRound size={14} />}
                  </span>
                  <span className="bw-topbar-me-text">
                    <span className="bw-topbar-me-name">{profile.name}</span>
                    <span className="bw-topbar-me-role">{profile.role ?? profile.title}</span>
                  </span>
                </div>
              ) : null}
            </div>
          </header>

          <main className="bw-content">{children}</main>
        </div>
      </div>

      {newTask && <NewTaskDialog onClose={() => setNewTask(false)} />}
      {newMessage && <NewMessageDialog onClose={() => setNewMessage(false)} />}
      <SourceViewer />
      <CopilotWidget />
    </div>
  );
}
