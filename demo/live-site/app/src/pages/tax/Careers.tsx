/**
 * Careers: why work here, the benefits, and the openings from /api/site/jobs.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Briefcase, Check } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SkeletonCards } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, type SiteJob } from "@/lib/practice";

const BENEFITS = [
  "A four-and-a-half-day week from May to December, and the hours we ask for in April are written down.",
  "Fees paid for the enrolled agent exam, the CPA exams and 40 hours of continuing education a year.",
  "Health cover from the first month, and a 4% retirement match after a year.",
  "Twenty days of holiday plus the week between Christmas and New Year.",
  "Your own clients after two years, with your name on the return.",
  "No cold calling and no sales targets. The work comes from referrals.",
];

export default function TaxCareers() {
  useTaxTitle("Careers");
  const jobs = useApi<{ jobs: SiteJob[] }>(() => siteGet<{ jobs: SiteJob[] }>("/jobs"), []);
  const list = jobs.data?.jobs ?? [];

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Careers"
          title="Nineteen people, and room for two more."
          lead="We hire slowly and keep people a long time. If you want to do the work rather than manage a queue of it, read on."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Careers" }]}
        />

        <div className="tax-grid tax-grid-2">
          <div className="tax-card">
            <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
              Why work here
            </h2>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              A return takes as long as it takes to get right. That means we do not measure anyone by the
              number of returns they push out, and we do not take on more clients than the team can serve
              properly. Preparers meet their clients; reviewers are named on the file; and the person who
              answers the phone knows whose return is whose.
            </p>
            <p className="tax-p" style={{ fontSize: "0.9375rem", marginBottom: 0 }}>
              We are a teaching practice. Every preparer has a reviewer who reads their work and says why,
              and everyone studies for the next credential with the firm paying for it.
            </p>
          </div>

          <div className="tax-card">
            <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
              What we offer
            </h2>
            <ul className="tax-list">
              {BENEFITS.map((b) => (
                <li key={b}>{b}</li>
              ))}
            </ul>
          </div>
        </div>

        <h2 className="tax-h2">Open positions</h2>
        {jobs.loading && <SkeletonCards count={3} height="8rem" />}
        {jobs.error && <ErrorBox error={jobs.error} onRetry={jobs.reload} />}
        {jobs.data && list.length === 0 && (
          <Empty>
            There are no openings at the moment. Send an application anyway and we will keep it on file.
          </Empty>
        )}

        {list.length > 0 && (
          <div className="tax-grid tax-grid-2">
            {list.map((j) => (
              <article className="tax-link-card" key={j.id} data-testid="job-card">
                <span className="tax-icon-badge">
                  <Briefcase size={18} aria-hidden="true" />
                </span>
                <h3>{j.title}</h3>
                <p style={{ marginBottom: "0.375rem" }}>{j.summary}</p>
                <p className="tax-tiny tax-muted" style={{ margin: "0 0 0.75rem" }}>
                  {j.office} · {j.type} · {j.salary}
                </p>
                <span className="tax-link-card-foot">
                  <Link to={`/tax/careers/${j.slug}`} className="tax-btn tax-btn-outline" style={{ minHeight: 40, padding: "0.5rem 1rem", fontSize: "0.875rem" }}>
                    The role <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                </span>
              </article>
            ))}
          </div>
        )}

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2rem" }}>
          <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
            How we hire
          </h2>
          <ul className="tax-list">
            <li>A written application: your history, your credentials and a few sentences on why here.</li>
            <li>A ninety-minute conversation with the partner who would review your work.</li>
            <li>A short paid exercise: a sample return with the documents that go with it.</li>
            <li>A day in the office, meeting the team you would sit with.</li>
            <li>An offer within a week of the last step, with the salary and the hours written into it.</li>
          </ul>
          <p className="tax-small tax-muted" style={{ display: "flex", gap: "0.375rem", alignItems: "center", marginTop: "0.875rem", marginBottom: 0 }}>
            <Check size={14} aria-hidden="true" /> We answer every application, including the ones we turn down.
          </p>
        </div>
      </div>
    </SitePage>
  );
}
