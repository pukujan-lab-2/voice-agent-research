/**
 * One industry. The same layout as a service page without the price: what is different about the tax in this
 * trade, the citations as superscripts, the questions we answer most often, and a side card to book.
 */

import { Link, useParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import {
  Empty, ErrorBox, FaqList, PageHead, Prose, SkeletonPage, Sources,
} from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, type SiteIndustry } from "@/lib/practice";
import { siteIcon } from "@/lib/site";

export default function TaxIndustryDetail() {
  const { slug } = useParams();
  const industry = useApi<{ industry: SiteIndustry }>(
    () => siteGet<{ industry: SiteIndustry }>("/industry", { slug }),
    [slug],
  );
  const i = industry.data?.industry;
  useTaxTitle(i?.name ?? "Industry");
  const Icon = siteIcon(i?.icon);

  return (
    <SitePage>
      <div className="tax-wrap tax-section" data-testid="industry-page">
        {industry.loading && <SkeletonPage />}
        {industry.error && (
          <>
            <PageHead eyebrow="Industries" title="This industry" crumbs={[{ label: "Home", to: "/tax" }, { label: "Industries", to: "/tax/industries" }]} />
            <ErrorBox error={industry.error} onRetry={industry.reload} />
          </>
        )}
        {industry.data && !i && <Empty>That industry isn't listed.</Empty>}

        {i && (
          <div className="tax-split">
            <div style={{ minWidth: 0 }}>
              <PageHead
                eyebrow="Industries"
                title={i.name}
                lead={i.short}
                crumbs={[
                  { label: "Home", to: "/tax" },
                  { label: "Industries", to: "/tax/industries" },
                  { label: i.name },
                ]}
              />

              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.5rem" }}>
                <span className="tax-icon-badge" style={{ margin: 0 }}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="tax-chiplist">
                  <span>Owner-run businesses</span>
                </span>
              </div>

              <Prose body={i.body} id={i.slug} />

              {i.faqs.length > 0 && (
                <section style={{ marginTop: "2rem" }}>
                  <h2 className="tax-h2 tax-h2-lead">Questions we get asked</h2>
                  <FaqList faqs={i.faqs} />
                </section>
              )}

              <Sources cites={i.cites} id={i.slug} />
            </div>

            <aside className="tax-sidecard">
              <h2 className="tax-h3">Talk it through</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.875rem" }}>
                Fifteen minutes with a preparer who knows this trade. No charge, and no documents needed
                for the first call.
              </p>
              <Link to="/tax/book" className="tax-btn" style={{ width: "100%" }}>
                Book a consultation <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <div className="tax-sidecard-row">
                <p>
                  <Link to="/tax/services" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                    The services involved →
                  </Link>
                  <br />
                  Bookkeeping, payroll, returns and planning.
                </p>
              </div>
              <div className="tax-sidecard-row">
                <p>
                  <Link to="/tax/tools/checklist" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                    Build a document list →
                  </Link>
                  <br />
                  Pick your situations and print it.
                </p>
              </div>
            </aside>
          </div>
        )}
      </div>
    </SitePage>
  );
}
