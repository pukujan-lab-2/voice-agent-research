import { useEffect, useRef, useState } from "react";
import { X, ExternalLink } from "lucide-react";
import { useCopilot } from "@/hooks/useCopilot";
import { GuideBody } from "./GuideReader";
import { PdfPages } from "./PdfPages";
import { articleOf, fetchLibDoc, hostOf, type TaxLibDoc } from "@/lib/tax";

/**
 * While snapshot.source is set: a wide side panel on desktop (72% of the window, up to 1200 px, so a two-column page is
 * readable), a bottom sheet on a phone.
 * The body renders the source from Octo, unchanged, so the copilot can find its quote in it: a PDF's cited page (and the
 * next, in case the quote runs over) in pdf.js with its text layer, or a web-page source's whole article.
 * Hand edit: ABA's viewer fetched a static JSON file per guide.
 */
export function SourceViewer() {
  const { snapshot } = useCopilot();
  const source = snapshot.source;
  const [doc, setDoc] = useState<TaxLibDoc | null>(null);
  const [failed, setFailed] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);

  const docPath = source?.doc;

  useEffect(() => {
    if (!docPath) {
      setDoc(null);
      setFailed(false);
      return;
    }
    let live = true;
    setFailed(false);
    fetchLibDoc(docPath)
      .then((json) => {
        if (live) setDoc(json);
      })
      .catch(() => {
        if (live) {
          setDoc(null);
          setFailed(true);
        }
      });
    return () => {
      live = false;
    };
  }, [docPath]);

  // Scroll to the cited section once the document is in.
  useEffect(() => {
    if (!doc || doc.kind === "pdf" || !source?.anchor) return;
    const el = bodyRef.current?.querySelector(`#${CSS.escape(source.anchor)}`);
    el?.scrollIntoView({ block: "start" });
  }, [doc, source?.anchor]);

  // On a phone the sheet sits above the call bar: publish the bar's height so it clears it.
  const open = Boolean(source);
  useEffect(() => {
    if (!open) return;
    const root = document.querySelector<HTMLElement>(".tax-root");
    if (!root) return;
    const measure = () => {
      const panel = document.querySelector<HTMLElement>('[data-testid="call-panel"]');
      const h = panel ? Math.max(0, window.innerHeight - panel.getBoundingClientRect().top) : 0;
      root.style.setProperty("--tax-callbar-h", `${Math.round(h + 8)}px`);
    };
    measure();
    const t = window.setInterval(measure, 500);
    return () => window.clearInterval(t);
  }, [open]);

  if (!source) return null;

  return (
    <aside className="tax-source-viewer" data-testid="source-viewer" aria-label="Source">
      <div className="tax-source-head">
        <span className="tax-source-grip" aria-hidden="true" />
        <div className="tax-source-head-row">
          <div className="tax-source-head-text">
            <p className="tax-source-title">{source.title}</p>
            <p className="tax-source-credit">{source.credit}</p>
          </div>
          <button
            type="button"
            className="tax-source-close"
            data-testid="source-close"
            aria-label="Close the source"
            onClick={() => window.copilot?.closeSource()}
          >
            <X size={18} />
          </button>
        </div>
        <a
          className="tax-source-original"
          data-testid="source-original"
          href={source.href}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open original on {hostOf(source.href)} <ExternalLink size={13} />
        </a>
      </div>

      <div className="tax-source-body" data-testid="source-body" data-copilot-source-body ref={bodyRef}>
        {source.found === false && (
          <p className="tax-source-note">The quoted line couldn't be located on this page.</p>
        )}
        {doc && doc.kind === "pdf" && doc.pdf ? (
          <PdfPages url={doc.pdf} from={source.page ?? 1} to={(source.page ?? 1) + 1} maxWidth={1200} />
        ) : doc ? (
          <GuideBody doc={articleOf(doc)} />
        ) : failed ? (
          <p className="tax-source-note">This guide couldn't be loaded.</p>
        ) : (
          <p className="tax-source-note">Loading the guide…</p>
        )}
      </div>
    </aside>
  );
}
