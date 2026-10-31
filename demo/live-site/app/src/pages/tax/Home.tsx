/**
 * The home page. Structure follows the large national tax firms' home pages — a hero with the promise and two
 * calls to action, a grid of services, "who we work with", the three-step process, reviews, deadlines, articles,
 * the team and the offices — but every word, name and figure comes from the practice API. No text, logo, image or
 * colour is taken from any of them.
 */

import { Link } from "react-router-dom";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, MessageCircle, Phone, Star,
} from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { ErrorBox, SkeletonCards, Empty } from "@/components/tax/SiteUi";
import { useTaxTitle, askAssistant } from "@/lib/tax";
import { siteGet, fmtDate, fmtDayMonth, type SiteArticleSummary, type SiteReview } from "@/lib/practice";
import { useApi } from "@/hooks/useApi";
import {
  useSiteIndustries, useSiteLocations, useSiteServices, useSiteTeam, useUpcomingDeadlines,
} from "@/lib/siteData";
import { fromPrice, hoursText, siteIcon, todayKey, rating } from "@/lib/site";

const SUGGESTED = [
  "When are quarterly estimated tax payments due?",
  "Is there an age limit on claiming my child as a dependent?",
  "What expenses qualify for an education credit?",
  "Is the loss on the sale of my home deductible?",
  "How can I check the status of my amended return?",
  "Are business gifts deductible?",
];

const STEPS = [
  {
    title: "Tell us about the year",
    text: "Four short steps: who you are, where you live, what your taxes involve, and which office suits you. Two minutes, no documents.",
  },
  {
    title: "A call with a preparer",
    text: "Fifteen minutes at a time you choose. We read the form the same working day and ring you. No charge, and no obligation afterwards.",
  },
  {
    title: "A fixed quote, in writing",
    text: "We price the job once we know what is in it, and send a short list of what to gather. The quote is the invoice.",
  },
];

function Stars({ n }: { n: number }) {
  return (
    <span className="tax-stars" aria-label={`${n} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={13} aria-hidden="true" fill={i <= Math.round(n) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

export default function TaxHome() {
  useTaxTitle("Home");

  const services = useSiteServices();
  const industries = useSiteIndustries();
  const team = useSiteTeam();
  const locations = useSiteLocations();
  const deadlines = useUpcomingDeadlines();

  const reviews = useApi<{ rows: SiteReview[] }>(
    () => siteGet<{ rows: SiteReview[] }>("/reviews", { page: 1, size: 3 }),
    [],
  );
  const articles = useApi<{ articles: SiteArticleSummary[] }>(
    () => siteGet<{ articles: SiteArticleSummary[] }>("/articles"),
    [],
  );

  const nextThree = (deadlines.data?.deadlines ?? [])
    .filter((d) => d.date >= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const latest = (articles.data?.articles ?? []).slice(0, 3);
  const fourPeople = (team.data?.team ?? []).slice(0, 4);
  const today = todayKey();

  return (
    <SitePage>
      <section className="tax-hero">
        <div className="tax-hero-inner">
          <div>
            <span className="tax-eyebrow">Harrow Falls · Corbel · Millbrook · since 2009</span>
            <h1 className="tax-h1">Careful tax work, explained in plain English.</h1>
            <p className="tax-lead">
              A practice of fourteen people, small enough that the preparer who does your return is the
              person who answers when you ring. Fixed quotes before we start, a second preparer reading
              every return, and the phone answered in July as well as April.
            </p>
            <div className="tax-btn-row">
              <Link to="/tax/book" className="tax-btn">
                Book a consultation <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link to="/tax/start" className="tax-btn tax-btn-outline">
                Become a client
              </Link>
            </div>
            <ul className="tax-hero-points">
              <li>
                <Check size={14} aria-hidden="true" /> Fixed quote, agreed in writing
              </li>
              <li>
                <Check size={14} aria-hidden="true" /> Every return read twice
              </li>
              <li>
                <Check size={14} aria-hidden="true" /> Your preparer's direct line
              </li>
            </ul>
          </div>
          <div className="tax-hero-art" aria-hidden="true">
            <svg viewBox="0 0 320 260" role="img" aria-label="An illustrated ledger page with a pencil">
              <defs>
                <linearGradient id="bwGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="hsl(158 32% 20%)" />
                  <stop offset="100%" stopColor="hsl(158 30% 30%)" />
                </linearGradient>
              </defs>
              <circle cx="254" cy="56" r="42" fill="hsl(20 60% 90%)" />
              <circle cx="62" cy="216" r="30" fill="hsl(36 45% 88%)" />
              <rect x="60" y="32" width="170" height="198" rx="12" fill="hsl(0 0% 100%)" stroke="hsl(40 16% 85%)" />
              <rect x="84" y="60" width="78" height="9" rx="4.5" fill="url(#bwGrad)" />
              <rect x="84" y="84" width="122" height="6" rx="3" fill="hsl(40 12% 88%)" />
              <rect x="84" y="100" width="104" height="6" rx="3" fill="hsl(40 12% 88%)" />
              <rect x="84" y="126" width="122" height="1.5" fill="hsl(40 14% 88%)" />
              <rect x="84" y="140" width="58" height="6" rx="3" fill="hsl(40 12% 88%)" />
              <rect x="160" y="140" width="46" height="6" rx="3" fill="hsl(18 52% 72%)" />
              <rect x="84" y="158" width="72" height="6" rx="3" fill="hsl(40 12% 88%)" />
              <rect x="176" y="158" width="30" height="6" rx="3" fill="hsl(40 12% 88%)" />
              <rect x="84" y="184" width="122" height="1.5" fill="hsl(40 14% 88%)" />
              <rect x="84" y="198" width="46" height="6" rx="3" fill="hsl(40 12% 88%)" />
              <rect x="148" y="198" width="58" height="6" rx="3" fill="hsl(36 45% 70%)" />
              <g transform="rotate(-28 226 158)">
                <rect x="218" y="112" width="15" height="78" rx="4" fill="hsl(18 52% 47%)" />
                <path d="M218 190h15l-7.5 16z" fill="hsl(158 32% 22%)" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* services */}
      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">What we do</span>
        <h2 className="tax-h2 tax-h2-lead">Ten services, and the price we start at.</h2>
        <p className="tax-p" style={{ maxWidth: "40rem" }}>
          Most clients use two or three of these together, which is why one team stays on the whole picture
          rather than handing you between departments.
        </p>
        {services.loading && <SkeletonCards count={6} height="10rem" />}
        {services.error && <ErrorBox error={services.error} onRetry={services.reload} />}
        {services.data && services.data.services.length === 0 && <Empty>No services are listed yet.</Empty>}
        {services.data && services.data.services.length > 0 && (
          <div className="tax-grid tax-grid-3" style={{ marginTop: "1.25rem" }}>
            {services.data.services.map((s) => {
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
        )}
      </div>

      {/* industries */}
      <div className="tax-wrap tax-section-tight">
        <div className="tax-card tax-card-quiet">
          <span className="tax-eyebrow">Who we work with</span>
          <h2 className="tax-h2 tax-h2-lead">Six kinds of work we know well.</h2>
          {industries.loading && <SkeletonCards count={6} height="5rem" />}
          {industries.error && <ErrorBox error={industries.error} onRetry={industries.reload} />}
          {industries.data && industries.data.industries.length === 0 && (
            <Empty>No industries are listed yet.</Empty>
          )}
          {industries.data && industries.data.industries.length > 0 && (
            <div className="tax-grid tax-grid-3" style={{ marginTop: "1rem" }}>
              {industries.data.industries.map((i) => {
                const Icon = siteIcon(i.icon);
                return (
                  <Link key={i.slug} to={`/tax/industries/${i.slug}`} className="tax-link-card">
                    <span className="tax-icon-badge">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <h3 style={{ fontSize: "1rem" }}>{i.name}</h3>
                    <p style={{ marginBottom: 0 }}>{i.short}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* how it works */}
      <div className="tax-wrap tax-section-tight">
        <span className="tax-eyebrow">How working with us goes</span>
        <h2 className="tax-h2 tax-h2-lead">Three steps, and the first two cost nothing.</h2>
        <div className="tax-steps" style={{ marginTop: "1rem" }}>
          {STEPS.map((s, i) => (
            <div key={s.title} className="tax-step">
              <span className="tax-step-num">{i + 1}</span>
              <h3 className="tax-h3">{s.title}</h3>
              <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
                {s.text}
              </p>
            </div>
          ))}
        </div>
        <div className="tax-btn-row" style={{ marginTop: "1.25rem" }}>
          <Link to="/tax/start" className="tax-btn">
            Start the four steps <ArrowRight size={16} aria-hidden="true" />
          </Link>
          <Link to="/tax/schedule" className="tax-btn tax-btn-outline">
            See open appointment times
          </Link>
        </div>
      </div>

      {/* reviews */}
      <div className="tax-wrap tax-section-tight">
        <span className="tax-eyebrow">Sample reviews</span>
        <h2 className="tax-h2 tax-h2-lead">What clients say.</h2>
        {reviews.loading && <SkeletonCards count={3} height="9rem" />}
        {reviews.error && <ErrorBox error={reviews.error} onRetry={reviews.reload} />}
        {reviews.data && reviews.data.rows.length === 0 && <Empty>No reviews have been published yet.</Empty>}
        {reviews.data && reviews.data.rows.length > 0 && (
          <div className="tax-grid tax-grid-3">
            {reviews.data.rows.map((r) => (
              <figure className="tax-review" key={r.id} data-testid="review-card">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Stars n={rating(r.rating)} />
                  <span className="tax-sample-tag">Sample review</span>
                </div>
                <h3>{r.title}</h3>
                <p>“{r.body}”</p>
                <figcaption className="tax-review footer" style={{ display: "block", fontSize: "0.75rem", color: "hsl(var(--tax-muted))" }}>
                  {r.author}, {r.city} · {r.service}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="tax-btn-row" style={{ marginTop: "1rem" }}>
          <Link to="/tax/reviews" className="tax-btn tax-btn-outline">
            Read all reviews
          </Link>
        </div>
      </div>

      {/* deadlines + articles */}
      <div className="tax-wrap tax-section-tight">
        <div className="tax-grid tax-grid-2">
          <div>
            <span className="tax-eyebrow">Next up</span>
            <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
              The next three deadlines
            </h2>
            {deadlines.loading && (
              <div aria-busy="true">
                <div className="tax-skel tax-skel-line" />
                <div className="tax-skel tax-skel-line" />
                <div className="tax-skel tax-skel-line" />
              </div>
            )}
            {deadlines.error && <ErrorBox error={deadlines.error} onRetry={deadlines.reload} />}
            {deadlines.data && nextThree.length === 0 && <Empty>No deadlines are listed for the coming months.</Empty>}
            {nextThree.map((d) => (
              <div className="tax-deadline" key={d.id} data-testid="deadline-row">
                <div className="d">{fmtDayMonth(d.date)}</div>
                <div>
                  <h3>{d.title}</h3>
                  <p>{d.detail}</p>
                  <div className="meta">
                    <span className="form">{d.form}</span>
                    <span>{d.who}</span>
                  </div>
                </div>
              </div>
            ))}
            <Link to="/tax/tools/calendar" className="tax-small" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
              The full 2026–27 calendar →
            </Link>
          </div>

          <div>
            <span className="tax-eyebrow">From the practice</span>
            <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.25rem" }}>
              Latest articles
            </h2>
            {articles.loading && (
              <div aria-busy="true">
                <div className="tax-skel tax-skel-line" />
                <div className="tax-skel tax-skel-line" />
                <div className="tax-skel tax-skel-line" />
              </div>
            )}
            {articles.error && <ErrorBox error={articles.error} onRetry={articles.reload} />}
            {articles.data && latest.length === 0 && <Empty>No articles have been published yet.</Empty>}
            {latest.map((a) => (
              <Link key={a.slug} to={`/tax/blog/${a.slug}`} className="tax-result" data-testid="article-card" style={{ marginBottom: "0.5rem" }}>
                <span style={{ display: "block", fontSize: "0.625rem", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700, color: "hsl(var(--tax-brass))" }}>
                  {a.category}
                </span>
                <span className="tax-result-title">{a.title}</span>
                <span className="tax-result-snippet">{a.summary}</span>
                <span className="tax-result-foot">
                  {fmtDate(a.published)} · {a.minutes} min read
                </span>
              </Link>
            ))}
            <Link to="/tax/blog" className="tax-small" style={{ fontWeight: 600, color: "hsl(var(--tax-accent))" }}>
              All articles →
            </Link>
          </div>
        </div>
      </div>

      {/* team teaser */}
      <div className="tax-wrap tax-section-tight">
        <span className="tax-eyebrow">The people</span>
        <h2 className="tax-h2 tax-h2-lead">Who will do the work.</h2>
        {team.loading && <SkeletonCards count={4} height="7rem" />}
        {team.error && <ErrorBox error={team.error} onRetry={team.reload} />}
        {team.data && team.data.team.length === 0 && <Empty>No team members are listed yet.</Empty>}
        {fourPeople.length > 0 && (
          <div className="tax-team-grid">
            {fourPeople.map((p) => (
              <Link key={p.id} to="/tax/team" className="tax-person" data-testid="team-member" style={{ textDecoration: "none" }}>
                <div className="tax-person-top">
                  <img src={p.avatar} alt="" loading="lazy" />
                  <div>
                    <h3>{p.name}</h3>
                    <p className="role">{p.title}</p>
                  </div>
                </div>
                <p className="meta">
                  {p.credentials ? `${p.credentials} · ` : ""}
                  {p.office} · {p.years} years
                </p>
              </Link>
            ))}
          </div>
        )}
        <div className="tax-btn-row" style={{ marginTop: "1rem" }}>
          <Link to="/tax/team" className="tax-btn tax-btn-outline">
            Meet the whole team
          </Link>
        </div>
      </div>

      {/* offices */}
      <div className="tax-wrap tax-section-tight">
        <span className="tax-eyebrow">Where to find us</span>
        <h2 className="tax-h2 tax-h2-lead">Three offices.</h2>
        {locations.loading && <SkeletonCards count={3} height="8rem" />}
        {locations.error && <ErrorBox error={locations.error} onRetry={locations.reload} />}
        {locations.data && locations.data.locations.length === 0 && <Empty>No offices are listed yet.</Empty>}
        {locations.data && locations.data.locations.length > 0 && (
          <div className="tax-grid tax-grid-3">
            {locations.data.locations.map((o) => (
              <div className="tax-card" key={o.id} data-testid="location-card">
                <h3 className="tax-h3">{o.name}</h3>
                <p className="tax-small" style={{ margin: "0 0 0.375rem", color: "hsl(var(--tax-ink-soft))" }}>
                  {o.street}
                  <br />
                  {o.city}, {o.state} {o.zip}
                </p>
                <p className="tax-small" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: "0 0 0.25rem" }}>
                  <Phone size={13} aria-hidden="true" />
                  <a href={`tel:${o.phone.replace(/[^\d+]/g, "")}`} style={{ textDecoration: "none", fontWeight: 600 }}>
                    {o.phone}
                  </a>
                </p>
                <p className="tax-small tax-muted" style={{ display: "flex", alignItems: "center", gap: "0.375rem", margin: 0 }}>
                  <CalendarDays size={13} aria-hidden="true" /> Today: {hoursText(o.hours?.[today])}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ask the assistant — the copilot, kept from the original home page */}
      <div className="tax-wrap tax-section">
        <div className="tax-card" style={{ background: "hsl(var(--tax-ink))", borderColor: "transparent" }}>
          <span className="tax-eyebrow" style={{ color: "hsl(20 60% 78%)" }}>
            <MessageCircle size={13} aria-hidden="true" /> Ask a tax question
          </span>
          <h2 className="tax-h2 tax-h2-lead" style={{ color: "hsl(40 34% 97%)" }}>
            Start the assistant and ask about the guides.
          </h2>
          <p style={{ color: "hsl(40 20% 84%)", fontSize: "0.9375rem", maxWidth: "36rem" }}>
            The assistant answers general questions from the firm's library of IRS publications, form
            instructions, Tax Topics, the tax code and regulations, and shows you the exact page it quoted.
            It can't advise on your own situation; a preparer can do that at a consultation.
          </p>
          <div className="tax-chips tax-chips-dark" style={{ marginTop: "1rem" }}>
            {SUGGESTED.map((q) => (
              <button key={q} type="button" className="tax-chip" data-testid="tax-chip" onClick={() => askAssistant(q)}>
                {q}
              </button>
            ))}
          </div>
          <p className="tax-tiny" style={{ color: "hsl(40 18% 72%)", marginTop: "0.875rem", marginBottom: 0 }}>
            Tap a question to start the call and send it. Or use <strong>Start voice call</strong> at the bottom
            of the screen and just talk.
          </p>
        </div>
      </div>

      <div className="tax-wrap tax-section-tight">
        <div className="tax-grid tax-grid-2">
          <div className="tax-card">
            <h3 className="tax-h3">Ready when you are</h3>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              Book fifteen minutes with a preparer. If we're not the right firm for you, we'll say so and
              point you somewhere better.
            </p>
            <Link to="/tax/book" className="tax-btn">
              Book a consultation <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </div>
          <div className="tax-card">
            <h3 className="tax-h3">Just browsing?</h3>
            <p className="tax-p" style={{ fontSize: "0.9375rem" }}>
              The Tax Guides library holds the IRS publications, form instructions and Tax Topics in full,
              searchable by passage, with the original link on every page.
            </p>
            <Link to="/tax/guides" className="tax-btn tax-btn-outline">
              Browse the guides
            </Link>
          </div>
        </div>
      </div>
    </SitePage>
  );
}
