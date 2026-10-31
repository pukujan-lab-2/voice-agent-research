// A source PDF's pages drawn with pdf.js: each page a canvas with pdf.js's text layer on top, so the copilot can find
// the quoted words on the page and highlight them (CSS Custom Highlight API, from the copilot SDK). The PDF itself is
// served by the site's API from Octo file storage (GET /api/library/pdf?doc=…). Hand-written: ABA can't add pdf.js.
import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const docs = new Map<string, Promise<pdfjs.PDFDocumentProxy>>();
const load = (url: string) => {
  let d = docs.get(url);
  if (!d) { d = pdfjs.getDocument({ url }).promise; docs.set(url, d); if (docs.size > 4) docs.delete(docs.keys().next().value!); }
  return d;
};

function PdfPage({ pdf, n, width }: { pdf: pdfjs.PDFDocumentProxy; n: number; width: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const text = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let dead = false;
    let task: { cancel(): void } | null = null;
    setReady(false);
    (async () => {
      const page = await pdf.getPage(n);
      if (dead) return;
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: width / base.width });
      setSize({ w: viewport.width, h: viewport.height });
      const c = canvas.current!, ratio = window.devicePixelRatio || 1;
      c.width = Math.floor(viewport.width * ratio); c.height = Math.floor(viewport.height * ratio);
      const r = page.render({ canvasContext: c.getContext("2d")!, viewport, transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined });
      task = r;
      const box = text.current!;
      box.replaceChildren();
      box.style.setProperty("--scale-factor", String(viewport.scale));
      const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: box, viewport });
      await Promise.all([r.promise.catch(() => {}), layer.render()]);
      if (!dead) setReady(true);
    })().catch(() => { if (!dead) setReady(true); });
    return () => { dead = true; task?.cancel(); };
  }, [pdf, n, width]);
  return (
    <div className="tax-pdf-page" data-page={n} data-loading={ready ? undefined : ""} style={{ width: size?.w ?? width, height: size?.h ?? width * 1.294 }}>
      <canvas ref={canvas} style={{ width: "100%", height: "100%" }} aria-label={`Page ${n}`} />
      <div ref={text} className="textLayer" />
      <span className="tax-pdf-num">Page {n}</span>
    </div>
  );
}

/** Pages `from`..`to` (1-based, clipped to the document) of the PDF at `url`, fitted to the container's width. */
export function PdfPages({ url, from, to, onPages }: { url: string; from: number; to: number; onPages?: (n: number) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [width, setWidth] = useState(0);
  useEffect(() => {
    let dead = false;
    setPdf(null); setError("");
    load(url).then(p => { if (!dead) { setPdf(p); onPages?.(p.numPages); } }, () => { if (!dead) setError("This document couldn't be loaded. Try the original on irs.gov."); });
    return () => { dead = true; };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(900, Math.floor(el.clientWidth))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const pages = pdf ? Array.from({ length: Math.max(0, Math.min(to, pdf.numPages) - Math.max(1, from) + 1) }, (_, i) => Math.max(1, from) + i) : [];
  return (
    // data-loading until every page's text layer is drawn: the copilot waits for it before it looks for its quote.
    <div ref={box} className="tax-pdf" data-loading={pdf || error ? undefined : ""}>
      {error && <p className="tax-pdf-error">{error}</p>}
      {!pdf && !error && <p className="tax-pdf-loading">Loading the document…</p>}
      {pdf && width > 0 && pages.map(n => <PdfPage key={n} pdf={pdf} n={n} width={width} />)}
    </div>
  );
}
