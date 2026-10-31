import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { ErrorState, LoadingState } from "@/components/States";

export default function HelpArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const location = useLocation();
  const anchor = location.hash.replace("#", "");

  const { data, error, loading, reload } = useApi(
    (signal) => api.helpArticle(slug!, signal),
    [slug],
  );
  const index = useApi((signal) => api.help(signal), []);

  const [highlight, setHighlight] = useState<string | null>(null);
  useDocumentTitle(data?.title ?? "Help article");

  useEffect(() => {
    if (!anchor || !data) return;
    const element = document.getElementById(anchor);
    if (!element) return;
    const timer = window.setTimeout(() => {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlight(anchor);
      window.setTimeout(() => setHighlight(null), 2400);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [anchor, data]);

  const related = (index.data?.articles ?? []).filter(
    (article) => article.section === data?.section && article.slug !== data?.slug,
  );

  return (
    <div className="bw-container py-5">
      <Link
        to="/help"
        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-brand hover:underline"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Help centre
      </Link>

      {loading && !data && <LoadingState label="Loading article…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} className="mt-4" />}

      {data && (
        <div className="mt-2 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
          <article className="min-w-0 rounded-xl border border-sage-border bg-white p-4 sm:p-6">
            <p className="text-[11px] font-bold uppercase tracking-wide text-saffron-dark">
              {data.section}
            </p>
            <h1 className="mt-1 font-display text-2xl font-semibold text-brand sm:text-3xl">
              {data.title}
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-sage">
              {data.summary}
            </p>

            <div className="mt-4 space-y-5">
              {(data.body ?? []).map((section) => (
                <section
                  key={section.anchor}
                  id={section.anchor}
                  className={cn(
                    "scroll-mt-28 rounded-lg px-1 py-1",
                    highlight === section.anchor && "animate-section-flash",
                  )}
                >
                  <h2 className="font-display text-lg font-semibold text-ink">
                    {section.heading}
                  </h2>
                  <div className="mt-1.5 space-y-2">
                    {(section.paragraphs ?? []).map((paragraph, idx) => (
                      <p
                        key={idx}
                        className="text-[14px] leading-relaxed text-ink/90"
                      >
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            <p className="mt-6 rounded-lg bg-sage-tile px-3 py-2 text-[11.5px] leading-snug text-sage">
              Demo help article. Brambleway is fictional, and its policies are
              written for this demonstration only.
            </p>
          </article>

          {related.length > 0 && (
            <aside className="rounded-xl border border-sage-border bg-white p-4">
              <h2 className="font-display text-base font-semibold text-brand">
                Related articles
              </h2>
              <ul className="mt-2 space-y-1.5">
                {related.map((article) => (
                  <li key={article.slug}>
                    <Link
                      to={`/help/${article.slug}`}
                      className="block text-[13px] font-medium text-ink hover:text-brand hover:underline"
                    >
                      {article.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
