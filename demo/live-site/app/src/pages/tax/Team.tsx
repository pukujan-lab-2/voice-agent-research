/**
 * The team: everyone from /api/site/team, grouped by role, each opening a profile dialog with the bio and a
 * "Book with <first name>" link when they take new clients.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, X } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SkeletonCards } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useSiteTeam } from "@/lib/siteData";
import type { SiteTeamMember } from "@/lib/practice";

const ROLE_ORDER = [
  "Partners",
  "Managers",
  "Preparers and accountants",
  "Bookkeeping and payroll",
  "Client services and operations",
];

/** The API's role string as one of the five headings, so the order is fixed and nothing is dropped. */
function roleGroup(role: string): string {
  const r = (role || "").toLowerCase();
  if (r.includes("partner")) return "Partners";
  if (r.includes("manager")) return "Managers";
  if (r.includes("bookkeep") || r.includes("payroll")) return "Bookkeeping and payroll";
  if (r.includes("client service") || r.includes("operations") || r.includes("administrat")) {
    return "Client services and operations";
  }
  return "Preparers and accountants";
}

function accepts(p: SiteTeamMember): boolean {
  return p.accepts_new === true || p.accepts_new === 1 || p.accepts_new === "1" || p.accepts_new === "true";
}

function Profile({ person, onClose }: { person: SiteTeamMember; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="tax-dialog-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="tax-dialog" role="dialog" aria-modal="true" aria-label={person.name}>
        <div className="tax-dialog-head">
          <img src={person.avatar} alt="" />
          <div style={{ minWidth: 0 }}>
            <h2>{person.name}</h2>
            <p className="tax-small tax-muted" style={{ margin: 0 }}>
              {person.title}
            </p>
            <p className="tax-small tax-muted" style={{ margin: 0 }}>
              {person.credentials ? `${person.credentials} · ` : ""}
              {person.office} · {person.years} years
            </p>
          </div>
          <button type="button" className="tax-dialog-close" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
          {person.bio}
        </p>

        {person.specialties.length > 0 && (
          <div className="tax-chiplist" style={{ marginBottom: "0.75rem" }}>
            {person.specialties.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </div>
        )}

        {person.languages.length > 0 && (
          <p className="tax-small tax-muted" style={{ margin: "0 0 0.875rem" }}>
            Speaks {person.languages.join(", ")}.
          </p>
        )}

        <div className="tax-btn-row">
          {accepts(person) ? (
            <Link to={`/tax/schedule?staff=${encodeURIComponent(person.id)}`} className="tax-btn" onClick={onClose}>
              Book with {person.first_name || person.name} <ArrowRight size={16} aria-hidden="true" />
            </Link>
          ) : (
            <Link to="/tax/book" className="tax-btn tax-btn-outline" onClick={onClose}>
              Book a consultation
            </Link>
          )}
          <Link to="/tax/locations" className="tax-btn tax-btn-outline" onClick={onClose}>
            The offices
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function TaxTeam() {
  useTaxTitle("Our team");
  const team = useSiteTeam();
  const [open, setOpen] = useState<SiteTeamMember | null>(null);

  const grouped = useMemo(() => {
    const all = team.data?.team ?? [];
    return ROLE_ORDER.map((role) => ({ role, people: all.filter((p) => roleGroup(p.role) === role) })).filter(
      (g) => g.people.length > 0,
    );
  }, [team.data]);

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Our team"
          title="Who does the work."
          lead="Every return is prepared by one person and read by another, and you will know both names before the work starts. The practice is deliberately small so that stays true in April."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Our team" }]}
        />

        {team.loading && <SkeletonCards count={6} height="10rem" />}
        {team.error && <ErrorBox error={team.error} onRetry={team.reload} />}
        {team.data && (team.data.team ?? []).length === 0 && <Empty>No team members are listed yet.</Empty>}

        {grouped.map((group) => (
          <section key={group.role}>
            <h2 className="tax-role-heading">{group.role}</h2>
            <div className="tax-team-grid">
              {group.people.map((p) => (
                <button
                  type="button"
                  className="tax-person"
                  key={p.id}
                  data-testid="team-member"
                  onClick={() => setOpen(p)}
                >
                  <div className="tax-person-top">
                    <img src={p.avatar} alt="" loading="lazy" />
                    <div style={{ minWidth: 0 }}>
                      <h3>{p.name}</h3>
                      <p className="role">{p.title}</p>
                      {p.credentials && <span className="tax-cred" style={{ marginTop: "0.25rem" }}>{p.credentials}</span>}
                    </div>
                  </div>
                  <p className="meta">
                    {p.office} · {p.years} years
                    {p.languages.length > 0 ? ` · ${p.languages.join(", ")}` : ""}
                  </p>
                  {p.specialties.length > 0 && (
                    <div className="specs">
                      {p.specialties.slice(0, 4).map((s) => (
                        <span key={s}>{s}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </section>
        ))}

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2.5rem" }}>
          <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
            Enrolled agents and CPAs
          </h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
            An enrolled agent is licensed by the federal government to represent taxpayers before the IRS. A
            certified public accountant is licensed by the state. Both can sign a return, and both can stand
            between you and a letter you would rather not answer yourself.
          </p>
          <p className="tax-p tax-small" style={{ marginBottom: 0 }}>
            <em>These people, their credentials and their biographies are invented for this demo.</em>
          </p>
        </div>

        <div className="tax-grid tax-grid-2" style={{ marginTop: "1.5rem" }}>
          <div className="tax-card">
            <h2 className="tax-h3">Talk to a preparer</h2>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              Fifteen minutes, no charge, at a time you choose.
            </p>
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="tax-card">
            <h2 className="tax-h3">Work here</h2>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              We hire two or three people a year, and we read every application ourselves.
            </p>
            <Link to="/tax/careers" className="tax-btn tax-btn-outline">
              Openings
            </Link>
          </div>
        </div>
      </div>

      {open && <Profile person={open} onClose={() => setOpen(null)} />}
    </SitePage>
  );
}
