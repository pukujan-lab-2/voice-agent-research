/**
 * The three offices: address, phone, a hours table with today highlighted, parking and a note, plus a drawn map
 * placeholder (no map tiles) and a link to book at that office.
 */

import { Link } from "react-router-dom";
import { ArrowRight, Car, MapPin, Phone } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead, SkeletonCards } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useSiteLocations } from "@/lib/siteData";
import { WEEK_LABEL, WEEK_ORDER, hoursText, todayKey } from "@/lib/site";

export default function TaxLocations() {
  useTaxTitle("Locations");
  const locations = useSiteLocations();
  const today = todayKey();
  const list = locations.data?.locations ?? [];

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Locations"
          title="Three offices, and a video call if that suits you better."
          lead="All three are open Monday to Friday. You do not have to come in to have your return done, but the doors are open if you would rather sit down together."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Locations" }]}
        />

        {locations.loading && <SkeletonCards count={3} height="20rem" />}
        {locations.error && <ErrorBox error={locations.error} onRetry={locations.reload} />}
        {locations.data && list.length === 0 && <Empty>No offices are listed yet.</Empty>}

        {list.length > 0 && (
          <div className="tax-grid tax-grid-3" style={{ alignItems: "start" }}>
            {list.map((o) => (
              <article className="tax-location" key={o.id} data-testid="location-card">
                <div className="tax-map" role="img" aria-label={`A drawn map placeholder for the ${o.name} office`}>
                  <span className="tax-map-pin" />
                </div>
                <div className="tax-location-body">
                  <h2>{o.name}</h2>
                  <address>
                    {o.street}
                    <br />
                    {o.city}, {o.state} {o.zip}
                  </address>
                  <p style={{ margin: "0.5rem 0 0" }}>
                    <a className="tel" href={`tel:${o.phone.replace(/[^\d+]/g, "")}`}>
                      <Phone size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
                      {o.phone}
                    </a>
                  </p>

                  <table className="tax-hours">
                    <caption className="tax-tiny tax-muted" style={{ textAlign: "left", paddingBottom: "0.25rem" }}>
                      Opening hours
                    </caption>
                    <tbody>
                      {WEEK_ORDER.map((key) => (
                        <tr key={key} className={key === today ? "today" : undefined}>
                          <th scope="row">{WEEK_LABEL[key]}</th>
                          <td>{hoursText(o.hours?.[key])}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {o.parking && (
                    <p className="tax-small" style={{ display: "flex", gap: "0.375rem", margin: "0 0 0.5rem", color: "hsl(var(--tax-ink-soft))" }}>
                      <Car size={14} aria-hidden="true" style={{ flex: "none", marginTop: 3 }} />
                      {o.parking}
                    </p>
                  )}
                  {o.note && (
                    <p className="tax-small tax-muted" style={{ margin: "0 0 0.875rem" }}>
                      {o.note}
                    </p>
                  )}

                  <Link
                    to={`/tax/schedule?office=${encodeURIComponent(o.id)}`}
                    className="tax-btn tax-btn-outline"
                    style={{ marginTop: "auto", width: "100%" }}
                  >
                    Book at this office <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="tax-card tax-card-quiet" style={{ marginTop: "2rem" }}>
          <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
            <MapPin size={17} aria-hidden="true" style={{ verticalAlign: "-3px", marginRight: 6 }} />
            Visiting us
          </h2>
          <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
            Bring photo identification and the documents on your checklist; nothing else is needed for a
            first appointment. If you are dropping documents off, reception will take them and give you a
            receipt, but please ring first so we know to expect you.
          </p>
          <div className="tax-btn-row">
            <Link to="/tax/tools/checklist" className="tax-btn tax-btn-outline">
              Build your checklist
            </Link>
            <Link to="/tax/contact" className="tax-btn tax-btn-outline">
              Contact an office
            </Link>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
