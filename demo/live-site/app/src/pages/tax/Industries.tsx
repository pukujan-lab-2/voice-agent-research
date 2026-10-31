/**
 * The industry index: the six kinds of work the practice knows well, each with its one-line description.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SkeletonCards } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useSiteIndustries } from "@/lib/siteData";
import { siteIcon } from "@/lib/site";

export default function TaxIndustries() {
  useTaxTitle("Industries");
  const industries = useSiteIndustries();
  const list = industries.data?.industries ?? [];

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Industries"
          title="Six kinds of work we know well."
          lead="Owner-run businesses and the people who run them. Each page covers what is different about the tax in that trade, the forms involved, and the questions we answer most often."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Industries" }]}
        />

        {industries.loading && <SkeletonCards count={6} height="9rem" />}
        {industries.error && <ErrorBox error={industries.error} onRetry={industries.reload} />}
        {industries.data && list.length === 0 && <Empty>No industries are listed yet.</Empty>}

        {list.length > 0 && (
          <div className="tax-grid tax-grid-3">
            {list.map((i) => {
              const Icon = siteIcon(i.icon);
              return (
                <Link key={i.slug} to={`/tax/industries/${i.slug}`} className="tax-link-card">
                  <span className="tax-icon-badge">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <h3>{i.name}</h3>
                  <p>{i.short}</p>
                  <span className="tax-link-card-foot">
                    <span className="more">Read more →</span>
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </SitePage>
  );
}
