import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { api, isAbort } from "@/lib/api";
import { useApi, useDocumentTitle } from "@/lib/hooks";
import type { HelpSearchResult } from "@/lib/types";
import { ErrorState, LoadingState } from "@/components/States";

export default function Help() {
  useDocumentTitle("Help centre");
  const { data, error, loading, reload } = useApi(
    (signal) => api.help(signal),
    [],
  );

  const [term, setTerm] = useState("");
  const [results, setResults] = useState<HelpSearchResult[] | null>(null);

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .helpSearch(query, controller.signal)
        .then((response) => setResults(response.results ?? []))
        .catch((err) => {
          if (!isAbort(err)) setResults([]);
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term]);

  const sections = useMemo(() => {
    const map = new Map<string, { slug: string; title: string; summary: string }[]>();
    for (const article of data?.articles ?? []) {
      const list = map.get(article.section) ?? [];
      list.push(article);
      map.set(article.section, list);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <div className="bw-container py-5">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        Help centre
      </h1>
      <p className="mt-1 text-[13px] text-sage">
        Answers about delivery, returns, orders and shopping with your voice.
      </p>

      <div className="relative mt-4 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sage" />
        <input
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Search help articles"
          aria-label="Search help articles"
          className="h-12 w-full rounded-lg border border-sage-border bg-white pl-9 pr-3 text-base text-ink placeholder:text-sage/80"
        />
      </div>

      {results !== null && (
        <div className="mt-3 max-w-2xl rounded-xl border border-sage-border bg-white p-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-sage">
            {results.length} {results.length === 1 ? "result" : "results"}
          </p>
          {results.length === 0 ? (
            <p className="mt-1 text-[13px] text-sage">
              No articles match “{term.trim()}”. Try a simpler word.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-sage-border">
              {results.map((result, index) => (
                <li key={`${result.href}-${index}`}>
                  <Link
                    to={result.href}
                    className="block py-2 hover:text-brand"
                  >
                    <p className="text-[13.5px] font-semibold text-ink">
                      {result.title}
                    </p>
                    <p className="text-[11.5px] uppercase tracking-wide text-sage">
                      {result.section}
                    </p>
                    <p className="text-[12.5px] text-sage">{result.snippet}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {loading && !data && <LoadingState label="Loading help articles…" />}
      {error && !data && <ErrorState message={error} onRetry={reload} className="mt-4" />}

      {sections.length > 0 && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {sections.map(([section, articles]) => (
            <section
              key={section}
              className="rounded-xl border border-sage-border bg-white p-4"
            >
              <h2 className="font-display text-lg font-semibold text-brand">
                {section}
              </h2>
              <ul className="mt-2 divide-y divide-sage-border">
                {articles.map((article) => (
                  <li key={article.slug}>
                    <Link
                      to={`/help/${article.slug}`}
                      className="block py-2 hover:text-brand"
                    >
                      <p className="text-[13.5px] font-semibold text-ink">
                        {article.title}
                      </p>
                      <p className="text-[12.5px] leading-snug text-sage">
                        {article.summary}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
