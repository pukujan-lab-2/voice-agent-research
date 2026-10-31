/**
 * The parts every /tax page shares: the loading skeleton, the error box with Retry, the empty state, the page head,
 * the citation markers and the Sources list at the foot of a service, industry or article.
 */

import { Link } from "react-router-dom";
import { ArrowUpRight, FileText, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import type { SiteCite } from "@/lib/practice";
import { splitCites } from "@/lib/site";

/** Three skeleton cards, for a grid that hasn't arrived yet. */
export function SkeletonCards({ count = 3, height = "9rem" }: { count?: number; height?: string }) {
  return (
    <div className="tax-grid tax-grid-3" aria-busy="true" aria-live="polite">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="tax-skel tax-skel-card" style={{ height }} />
      ))}
    </div>
  );
}

/** A page-shaped skeleton: a title line and a few paragraphs. */
export function SkeletonPage() {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="tax-skel tax-skel-title" style={{ height: "2rem", width: "min(28rem, 70%)" }} />
      <div className="tax-skel tax-skel-line" style={{ width: "min(38rem, 90%)" }} />
      <div className="tax-skel tax-skel-line" style={{ width: "min(34rem, 80%)" }} />
      <div className="tax-skel tax-skel-line" style={{ width: "min(30rem, 70%)" }} />
      <div className="tax-skel tax-skel-card" style={{ height: "8rem", marginTop: "1.5rem" }} />
    </div>
  );
}

/** The API's own error text, with a Retry that asks again. */
export function ErrorBox({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="tax-error-box" role="alert">
      <span>{error}</span>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          <RefreshCw size={13} aria-hidden="true" style={{ verticalAlign: "-2px", marginRight: 4 }} />
          Retry
        </button>
      )}
    </div>
  );
}

/** A short, calm empty state for a list the API returned with nothing in it. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="tax-empty">{children}</p>;
}

export interface Crumb {
  label: string;
  to?: string;
}

export function Crumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="tax-crumbs" aria-label="Breadcrumb">
      {items.map((c, i) => (
        <span key={`${c.label}-${i}`}>
          {c.to ? <Link to={c.to}>{c.label}</Link> : c.label}
          {i < items.length - 1 && <span aria-hidden="true"> / </span>}
        </span>
      ))}
    </nav>
  );
}

export function PageHead({
  eyebrow,
  title,
  lead,
  crumbs,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  crumbs?: Crumb[];
}) {
  return (
    <div className="tax-page-head">
      {crumbs && <Crumbs items={crumbs} />}
      {eyebrow && <span className="tax-eyebrow">{eyebrow}</span>}
      <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.75rem)" }}>
        {title}
      </h1>
      {lead && <p className="tax-lead">{lead}</p>}
    </div>
  );
}

/**
 * Body text with its `[1]` markers as small superscript links to the Sources list below.
 * The marker keeps the citation's 1-based number so the two agree.
 */
export function CiteText({ text, id }: { text: string; id: string }) {
  const parts = splitCites(text);
  return (
    <>
      {parts.map((part, i) =>
        part.marker === null ? (
          <span key={i}>{part.text}</span>
        ) : (
          <a
            key={i}
            className="tax-sup"
            href={`#source-${id}-${part.marker}`}
            data-testid="cite-ref"
            aria-label={`Source ${part.marker}`}
            title={`Source ${part.marker}`}
          >
            [{part.marker}]
          </a>
        ),
      )}
    </>
  );
}

/** A service, industry or article body: sections of paragraphs, each with its citation markers. */
export function Prose({
  body,
  id,
}: {
  body: { heading?: string; paragraphs?: string[] }[];
  id: string;
}) {
  return (
    <div className="tax-prose">
      {body.map((section, i) => (
        <section key={i}>
          {section.heading && <h2>{section.heading}</h2>}
          {(section.paragraphs ?? []).map((p, j) => (
            <p key={j}>
              <CiteText text={p} id={id} />
            </p>
          ))}
        </section>
      ))}
    </div>
  );
}

/** The Sources list: each citation's document, section, quoted words and the two links. */
/** One deadline's or rate's library source: its title, linked to the passage's Tax Guide. */
export function SourceLink({ cite }: { cite: SiteCite }) {
  return (
    <Link to={`/tax/guides/${encodeURIComponent(cite.doc)}`} title={cite.quote}>
      {cite.title}
      {cite.section ? `, ${cite.section.split(" › ").pop()}` : ""}
    </Link>
  );
}

export function Sources({ cites, id }: { cites: SiteCite[]; id: string }) {
  if (!cites.length) return null;
  return (
    <section className="tax-sources" data-testid="sources" aria-labelledby={`sources-${id}`}>
      <h2 id={`sources-${id}`}>Sources</h2>
      {cites.map((c, i) => (
        <div className="tax-source-item" id={`source-${id}-${i + 1}`} key={`${c.doc}-${i}`}>
          <span className="n" aria-hidden="true">
            [{i + 1}]
          </span>
          <strong>
            {c.title}
            {c.section ? ` · ${c.section}` : ""}
          </strong>
          {c.quote && <blockquote>“{c.quote}”</blockquote>}
          <div className="tax-source-links">
            <Link to={`/tax/guides/${encodeURIComponent(c.doc)}`}>
              <FileText size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginRight: 3 }} />
              Read it in our Tax Guides
            </Link>
            {c.url && (
              <a href={c.url} target="_blank" rel="noreferrer noopener">
                IRS.gov
                <ArrowUpRight size={12} aria-hidden="true" style={{ verticalAlign: "-1px", marginLeft: 2 }} />
              </a>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}

/** An accordion of questions, for a service, industry or tool page. */
export function FaqList({ faqs }: { faqs: { q: string; a: string }[] }) {
  if (!faqs.length) return null;
  return (
    <div className="tax-grid" style={{ gap: "0.5rem" }}>
      {faqs.map((f) => (
        <details key={f.q} className="tax-faq-item">
          <summary>{f.q}</summary>
          <div className="tax-faq-body">
            <p>{f.a}</p>
          </div>
        </details>
      ))}
    </div>
  );
}
