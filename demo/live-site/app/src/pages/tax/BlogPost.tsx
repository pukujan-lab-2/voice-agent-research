/**
 * One article. Structure after a modern publication's article page (in the manner of Stripe's or Supabase's
 * blog): a reading column, the byline with the author's portrait and title, the published date and reading time,
 * a table of contents built from the headings, the citations as superscripts, and related articles at the foot.
 */

import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Clock, FileText } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import {
  CiteText, Empty, ErrorBox, SkeletonPage, Sources,
} from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { siteGet, fmtDate, type SiteArticle, type SiteArticleSummary } from "@/lib/practice";
import { useSiteTeam } from "@/lib/siteData";

function anchorOf(heading: string, i: number): string {
  const slug = heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `s-${i}-${slug || "section"}`;
}

export default function TaxBlogPost() {
  const { slug } = useParams();
  const article = useApi<{ article: SiteArticle }>(
    () => siteGet<{ article: SiteArticle }>("/article", { slug }),
    [slug],
  );
  const all = useApi<{ articles: SiteArticleSummary[] }>(
    () => siteGet<{ articles: SiteArticleSummary[] }>("/articles"),
    [],
  );
  const team = useSiteTeam();
  const a = article.data?.article;
  useTaxTitle(a?.title ?? "Article");

  const author = a ? (team.data?.team ?? []).find((p) => p.id === a.author_id) : undefined;
  const headings = (a?.body ?? [])
    .map((b, i) => ({ heading: b.heading, anchor: anchorOf(b.heading ?? "", i) }))
    .filter((h): h is { heading: string; anchor: string } => Boolean(h.heading));
  const related = (all.data?.articles ?? []).filter((x) => x.slug !== slug).slice(0, 3);

  return (
    <SitePage>
      <div className="tax-wrap tax-section" data-testid="article-page">
        {article.loading && <SkeletonPage />}
        {article.error && <ErrorBox error={article.error} onRetry={article.reload} />}
        {article.data && !a && <Empty>That article isn't here.</Empty>}

        {a && (
          <>
            <Link to="/tax/blog" className="tax-small tax-muted" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}>
              <ArrowLeft size={14} aria-hidden="true" /> All articles
            </Link>

            <div className="tax-article-layout" style={{ marginTop: "0.75rem" }}>
              <article className="tax-article">
                <span className="tax-eyebrow" style={{ marginBottom: "0.5rem" }}>{a.category}</span>
                <h1>{a.title}</h1>
                <p className="tax-lead" style={{ fontSize: "1.0625rem", marginBottom: "1rem" }}>
                  {a.summary}
                </p>

                <div className="tax-credit" style={{ justifyContent: "space-between" }}>
                  {author ? (
                    <span className="tax-byline">
                      <img src={author.avatar} alt="" loading="lazy" />
                      <div>
                        <strong>{author.name}</strong>
                        <span>
                          {author.title}
                          {author.credentials ? `, ${author.credentials}` : ""}
                        </span>
                      </div>
                    </span>
                  ) : (
                    <span className="tax-byline">
                      <div>
                        <strong>Brindlewick Tax &amp; Accounting</strong>
                        <span>The practice</span>
                      </div>
                    </span>
                  )}
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", fontSize: "0.75rem" }}>
                    <span>{fmtDate(a.published)}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
                      <Clock size={12} aria-hidden="true" /> {a.minutes} min read
                    </span>
                  </span>
                </div>

                <div className="tax-prose">
                  {a.body.map((section, i) => (
                    <section key={i} id={section.heading ? anchorOf(section.heading, i) : undefined} className="tax-guide-section">
                      {section.heading && <h2>{section.heading}</h2>}
                      {section.paragraphs.map((p, k) => (
                        <p key={k}>
                          <CiteText text={p} id={a.slug} />
                        </p>
                      ))}
                    </section>
                  ))}
                </div>

                {a.tags.length > 0 && (
                  <div className="tax-chiplist" style={{ marginTop: "1.5rem" }}>
                    {a.tags.map((t) => (
                      <span key={t}>{t}</span>
                    ))}
                  </div>
                )}

                <Sources cites={a.cites} id={a.slug} />

                <div className="tax-card tax-card-quiet" style={{ marginTop: "2rem" }}>
                  <h2 className="tax-h3">A question about your own return?</h2>
                  <p className="tax-p" style={{ fontSize: "0.875rem" }}>
                    The assistant answers general questions from the IRS guides and shows you the page. For
                    your own situation, book fifteen minutes with a preparer.
                  </p>
                  <div className="tax-btn-row">
                    <Link to="/tax/book" className="tax-btn">
                      Book a consultation
                    </Link>
                    <Link to="/tax/guides" className="tax-btn tax-btn-outline">
                      <FileText size={15} aria-hidden="true" /> Tax Guides
                    </Link>
                  </div>
                </div>
              </article>

              <aside className="tax-toc">
                <span className="tax-toc-title">On this page</span>
                <a href="#" className="tax-toc-link tax-toc-top" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                  {a.title}
                </a>
                {headings.map((h) => (
                  <a key={h.anchor} href={`#${h.anchor}`} className="tax-toc-link">
                    {h.heading}
                  </a>
                ))}
                {a.cites.length > 0 && (
                  <a href="#sources" className="tax-toc-link" onClick={(e) => { e.preventDefault(); document.querySelector("[data-testid='sources']")?.scrollIntoView({ behavior: "smooth" }); }}>
                    Sources
                  </a>
                )}
              </aside>
            </div>

            {related.length > 0 && (
              <section style={{ marginTop: "2.5rem" }}>
                <h2 className="tax-h2">Related articles</h2>
                <div className="tax-grid tax-grid-3">
                  {related.map((r) => (
                    <Link key={r.slug} to={`/tax/blog/${r.slug}`} className="tax-article-card" data-testid="article-card">
                      <span className="cat">{r.category}</span>
                      <h3>{r.title}</h3>
                      <p>{r.summary}</p>
                      <span className="meta">
                        {fmtDate(r.published)} · {r.minutes} min read
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </SitePage>
  );
}
