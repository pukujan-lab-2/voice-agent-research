/**
 * The services index. Structure after a mid-size CPA firm's service list: a short lead, then every service as a
 * card with its one-line description and the price it starts at, grouped by who it is for.
 */

import { Link } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SkeletonCards } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useSiteServices } from "@/lib/siteData";
import { fromPrice, siteIcon } from "@/lib/site";

export default function TaxServices() {
  useTaxTitle("Services");
  const services = useSiteServices();

  const list = services.data?.services ?? [];
  const individuals = list.filter((s) => s.audience === "individuals");
  const businesses = list.filter((s) => s.audience === "businesses");

  const group = (heading: string, note: string, items: typeof list) =>
    items.length > 0 && (
      <section style={{ marginTop: "2rem" }}>
        <h2 className="tax-h2 tax-h2-lead">{heading}</h2>
        <p className="tax-p" style={{ maxWidth: "38rem" }}>
          {note}
        </p>
        <div className="tax-grid tax-grid-3">
          {items.map((s) => {
            const Icon = siteIcon(s.icon);
            return (
              <Link key={s.slug} to={`/tax/services/${s.slug}`} className="tax-link-card">
                <span className="tax-icon-badge">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <h3>{s.name}</h3>
                <p>{s.short}</p>
                <span className="tax-link-card-foot">
                  <span className="from">{fromPrice(s.from_price)}</span>
                  <span className="more">Read more →</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    );

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Services"
          title="The work we do, and what it costs to start."
          lead="Each service below has its own page: what is included, who it is for, how long it takes and the price we start at. Where a job varies, we quote after the first call and put the figure in writing."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Services" }]}
        />

        {services.loading && <SkeletonCards count={6} height="10rem" />}
        {services.error && <ErrorBox error={services.error} onRetry={services.reload} />}
        {services.data && list.length === 0 && <Empty>No services are listed yet.</Empty>}

        {group(
          "For individuals",
          "Returns, notices, planning and the catch-up work that follows a few years of not filing.",
          individuals,
        )}
        {group(
          "For businesses",
          "Books, payroll, business returns and the planning that decides what a year costs.",
          businesses,
        )}

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2.5rem" }}>
          <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
            Not sure which one you need?
          </h2>
          <p className="tax-p">
            Most people aren't, the first time. Book the free fifteen-minute call and describe the year
            you've had. We'll tell you what we would do, and what it would cost, before you commit to
            anything.
          </p>
          <div className="tax-btn-row">
            <Link to="/tax/book" className="tax-btn">
              Book a consultation
            </Link>
            <Link to="/tax/pricing" className="tax-btn tax-btn-outline">
              See the full price list
            </Link>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
