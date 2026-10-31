/**
 * One service. Structure after a mid-size CPA firm's service page: what is included, the process, the price it
 * starts at, the questions people ask, and a sticky card on the right with the price, the booking button and the
 * preparer who would take it. Every word comes from /api/site/service; the citations are rendered as superscripts
 * with a Sources list at the foot.
 */

import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import {
  CiteText, Empty, ErrorBox, FaqList, PageHead, Prose, SkeletonPage, Sources,
} from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, type SiteService, type SiteTeamMember } from "@/lib/practice";
import { useSiteTeam } from "@/lib/siteData";
import { fromPrice, siteIcon } from "@/lib/site";

/** The preparer who would take this work: the first person whose specialties touch the service. */
function matchPreparer(team: SiteTeamMember[], service: SiteService): SiteTeamMember | undefined {
  const words = [service.name, service.short, ...service.body.map((b) => b.heading)]
    .join(" ")
    .toLowerCase();
  const scoring = team.map((p) => ({
    p,
    score: (p.specialties ?? []).reduce((n, s) => (words.includes(s.toLowerCase()) ? n + 2 : n), 0) +
      (p.accepts_new ? 1 : 0),
  }));
  scoring.sort((a, b) => b.score - a.score);
  return scoring[0]?.p;
}

export default function TaxServiceDetail() {
  const { slug } = useParams();
  const service = useApi<{ service: SiteService }>(
    () => siteGet<{ service: SiteService }>("/service", { slug }),
    [slug],
  );
  const team = useSiteTeam();
  const s = service.data?.service;
  useTaxTitle(s?.name ?? "Service");

  const preparer = s ? matchPreparer(team.data?.team ?? [], s) : undefined;
  const Icon = siteIcon(s?.icon);

  return (
    <SitePage>
      <div className="tax-wrap tax-section" data-testid="service-page">
        {service.loading && <SkeletonPage />}
        {service.error && (
          <>
            <PageHead eyebrow="Services" title="This service" crumbs={[{ label: "Home", to: "/tax" }, { label: "Services", to: "/tax/services" }]} />
            <ErrorBox error={service.error} onRetry={service.reload} />
          </>
        )}
        {service.data && !s && <Empty>That service isn't listed.</Empty>}

        {s && (
          <>
            <div className="tax-split">
              <div style={{ minWidth: 0 }}>
                <PageHead
                  eyebrow="Services"
                  title={s.name}
                  lead={s.short}
                  crumbs={[
                    { label: "Home", to: "/tax" },
                    { label: "Services", to: "/tax/services" },
                    { label: s.name },
                  ]}
                />

                <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                  <span className="tax-icon-badge" style={{ margin: 0 }}>
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <span className="tax-chiplist">
                    <span>{s.audience === "businesses" ? "For businesses" : "For individuals"}</span>
                  </span>
                  {s.forms.length > 0 && (
                    <span className="tax-chiplist">
                      {s.forms.map((f) => (
                        <span key={f}>{f}</span>
                      ))}
                    </span>
                  )}
                </div>

                <Prose body={s.body} id={s.slug} />

                {s.faqs.length > 0 && (
                  <section style={{ marginTop: "2rem" }}>
                    <h2 className="tax-h2 tax-h2-lead">Questions we get asked</h2>
                    <FaqList faqs={s.faqs} />
                  </section>
                )}

                <Sources cites={s.cites} id={s.slug} />
              </div>

              <aside className="tax-sidecard">
                {fromPrice(s.from_price) && (
                  <>
                    <span className="tax-tiny" style={{ letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "hsl(var(--tax-brass))" }}>
                      Typical fee
                    </span>
                    <p className="tax-price">{fromPrice(s.from_price)}</p>
                  </>
                )}
                <p className="tax-small tax-muted" style={{ margin: "0 0 0.875rem" }}>
                  Quoted in writing before we start. The quote is the invoice.
                </p>
                <Link to="/tax/book" className="tax-btn" style={{ width: "100%" }}>
                  Book a consultation <ArrowRight size={16} aria-hidden="true" />
                </Link>
                <p className="tax-small tax-muted" style={{ display: "flex", gap: "0.375rem", alignItems: "center", margin: "0.625rem 0 0" }}>
                  <Check size={13} aria-hidden="true" /> Fifteen minutes, no charge
                </p>

                {preparer && (
                  <div className="tax-sidecard-row">
                    <img src={preparer.avatar} alt="" loading="lazy" />
                    <p>
                      Talk to <strong>{preparer.first_name || preparer.name}</strong>
                      {preparer.credentials ? `, ${preparer.credentials}` : ""} — {preparer.title}.
                      <br />
                      <Link to={`/tax/schedule?staff=${encodeURIComponent(preparer.id)}`} style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                        Book with {preparer.first_name || preparer.name} →
                      </Link>
                    </p>
                  </div>
                )}

                <div className="tax-sidecard-row">
                  <p>
                    <Link to="/tax/tools/checklist" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
                      Build your document checklist →
                    </Link>
                    <br />
                    See what to gather before the first call.
                  </p>
                </div>
              </aside>
            </div>

            <hr className="tax-rule" />
            <h2 className="tax-h2">Other services</h2>
            <div className="tax-btn-row">
              <Link to="/tax/services" className="tax-btn tax-btn-outline">
                All services
              </Link>
              <Link to="/tax/pricing" className="tax-btn tax-btn-outline">
                Pricing
              </Link>
              <Link to="/tax/faq" className="tax-btn tax-btn-outline">
                Tax FAQ
              </Link>
            </div>
          </>
        )}
      </div>
    </SitePage>
  );
}
