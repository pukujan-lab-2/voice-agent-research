import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { GuideBody, GuideToc } from "@/components/tax/GuideReader";
import { PdfPages } from "@/components/tax/PdfPages";
import { articleOf, fetchLibDoc, hostOf, sourceName, useTaxTitle, type TaxLibDoc } from "@/lib/tax";

export default function TaxGuidePage() {
  const { id } = useParams();
  const { hash, search } = useLocation();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<TaxLibDoc | null>(null);
  const page = Math.max(1, Number(new URLSearchParams(search).get("page")) || 1);
  const [pages, setPages] = useState(0);
  const [failed, setFailed] = useState(false);

  useTaxTitle(doc ? sourceName(doc.source) : "Tax guide");

  useEffect(() => {
    if (!id) return;
    let live = true;
    setDoc(null);
    setFailed(false);
    // From Octo, through the site's library API (hand edit: ABA's page read a static JSON file per guide).
    fetchLibDoc(id)
      .then((json) => {
        if (live) setDoc(json);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, [id]);

  // When the URL carries a #anchor, scroll to that heading once the article is in.
  useEffect(() => {
    if (!doc || doc.kind === "pdf") return;
    const anchor = hash.replace(/^#/, "");
    if (!anchor) {
      window.scrollTo({ top: 0 });
      return;
    }
    const el = document.getElementById(anchor);
    if (el) el.scrollIntoView({ block: "start" });
  }, [doc, hash]);

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <Link
          to="/tax/guides"
          className="tax-small tax-muted"
          style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
        >
          <ArrowLeft size={14} /> Tax Guides
        </Link>

        {failed && (
          <div className="tax-card" style={{ marginTop: "1rem" }}>
            <h1 className="tax-h2 tax-h2-lead">This guide couldn't be loaded</h1>
            <p className="tax-p">It may still be on its way into the library. Try again in a moment.</p>
            <Link to="/tax/guides" className="tax-btn tax-btn-outline">
              Back to the library
            </Link>
          </div>
        )}

        {!doc && !failed && <p className="tax-empty" style={{ marginTop: "1rem" }}>Loading the guide…</p>}

        {doc && doc.kind === "pdf" && doc.pdf && (
          <article className="tax-article tax-article-pdf" style={{ marginTop: "0.75rem" }}>
            <h1>{doc.title}</h1>
            <p className="tax-credit">
              <span>Source: {sourceName(doc.source)} (public domain)</span>
              <a className="tax-ext" href={doc.url} target="_blank" rel="noopener noreferrer">
                Open original on {hostOf(doc.url)} <ExternalLink size={12} />
              </a>
            </p>
            <PdfPager page={page} pages={pages || doc.pages || 0} go={(n) => navigate(`?page=${n}`, { replace: true })} />
            <div>
              <PdfPages url={doc.pdf} from={page} to={page + 1} onPages={setPages} />
            </div>
            <PdfPager page={page} pages={pages || doc.pages || 0} go={(n) => { navigate(`?page=${n}`, { replace: true }); window.scrollTo({ top: 0 }); }} />
          </article>
        )}

        {doc && doc.kind !== "pdf" && (
          <div className="tax-article-layout" style={{ marginTop: "0.75rem" }}>
            <article className="tax-article">
              <h1>{doc.title}</h1>
              <p className="tax-credit">
                <span>Source: {sourceName(doc.source)} (public domain)</span>
                <a className="tax-ext" href={doc.url} target="_blank" rel="noopener noreferrer">
                  Open original on {hostOf(doc.url)} <ExternalLink size={12} />
                </a>
              </p>
              <GuideBody doc={articleOf(doc)} />
            </article>
            <GuideToc doc={articleOf(doc)} />
          </div>
        )}
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}

/** Two printed pages at a time, with previous and next. */
function PdfPager({ page, pages, go }: { page: number; pages: number; go: (n: number) => void }) {
  return (
    <div className="tax-pdf-pager">
      <button type="button" className="tax-btn tax-btn-outline" disabled={page <= 1} onClick={() => go(Math.max(1, page - 2))}>
        <ChevronLeft size={14} /> Previous
      </button>
      <span className="tax-small tax-muted">
        Pages {page}–{Math.min(page + 1, pages || page + 1)}{pages ? ` of ${pages}` : ""}
      </span>
      <button type="button" className="tax-btn tax-btn-outline" disabled={!!pages && page + 2 > pages} onClick={() => go(page + 2)}>
        Next <ChevronRight size={14} />
      </button>
    </div>
  );
}
