/**
 * One opening: the summary, the body blocks the API sends (paragraphs or bullet lists), and an Apply button that
 * carries the slug to the application form.
 */

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SkeletonPage } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, type SiteJob } from "@/lib/practice";

export default function TaxCareerDetail() {
  const { slug } = useParams();
  const job = useApi<{ job: SiteJob }>(() => siteGet<{ job: SiteJob }>("/job", { slug }), [slug]);
  const j = job.data?.job;
  useTaxTitle(j?.title ?? "Careers");

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        {job.loading && <SkeletonPage />}
        {job.error && (
          <>
            <PageHead eyebrow="Careers" title="This role" crumbs={[{ label: "Home", to: "/tax" }, { label: "Careers", to: "/tax/careers" }]} />
            <ErrorBox error={job.error} onRetry={job.reload} />
          </>
        )}
        {job.data && !j && <Empty>That position isn't listed.</Empty>}

        {j && (
          <div className="tax-split">
            <div style={{ minWidth: 0 }}>
              <Link to="/tax/careers" className="tax-small tax-muted" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
                <ArrowLeft size={14} aria-hidden="true" /> All openings
              </Link>
              <PageHead eyebrow={`${j.office} · ${j.type}`} title={j.title} lead={j.summary} />

              <div className="tax-prose">
                {j.body.map((block, i) => (
                  <section key={i}>
                    {block.heading && <h2>{block.heading}</h2>}
                    {(block.paragraphs ?? []).map((p, k) => (
                      <p key={k}>{p}</p>
                    ))}
                    {block.items && block.items.length > 0 && (
                      <ul className="tax-list">
                        {block.items.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
              </div>
            </div>

            <aside className="tax-sidecard">
              <h2 className="tax-h3">The details</h2>
              <p className="tax-small" style={{ margin: "0 0 0.375rem" }}>
                <strong>Office</strong>
                <br />
                {j.office}
              </p>
              <p className="tax-small" style={{ margin: "0 0 0.375rem" }}>
                <strong>Type</strong>
                <br />
                {j.type}
              </p>
              <p className="tax-small" style={{ margin: "0 0 0.875rem" }}>
                <strong>Salary</strong>
                <br />
                {j.salary}
              </p>
              <Link to={`/tax/careers/apply?job=${encodeURIComponent(j.slug)}`} className="tax-btn" style={{ width: "100%" }}>
                Apply <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <div className="tax-sidecard-row">
                <p>
                  <Link to="/tax/about" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                    About the firm →
                  </Link>
                  <br />
                  Founded 2009, three offices.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </SitePage>
  );
}
