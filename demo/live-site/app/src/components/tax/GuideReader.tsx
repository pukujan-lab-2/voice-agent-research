import { useMemo } from "react";
import type { TaxGuideDoc, TaxGuideSection } from "@/lib/tax";

/** One guide section: its heading carries id={section.anchor}, then paragraphs and real tables. */
export function GuideSection({ section }: { section: TaxGuideSection }) {
  const Heading = (section.level && section.level <= 2 ? "h2" : "h3") as "h2" | "h3";
  return (
    <section className="tax-guide-section">
      {section.heading && <Heading
        id={section.anchor || undefined}
        className={section.level && section.level <= 1 ? "tax-h2 tax-h2-lead" : "tax-h2"}
      >
        {section.heading}
      </Heading>}
      {section.blocks.map((block, i) => {
        if ("p" in block && typeof block.p === "string") {
          return (
            <p key={i} className="tax-guide-p">
              {block.p}
            </p>
          );
        }
        if ("table" in block && Array.isArray(block.table)) {
          const rows = block.table;
          if (!rows.length) return null;
          const [head, ...body] = rows;
          return (
            <div key={i} className="tax-table-wrap">
              <table className="tax-table">
                <thead>
                  <tr>
                    {head.map((cell, ci) => (
                      <th key={ci}>{cell}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }
        return null;
      })}
    </section>
  );
}

/** Every section of a guide, in order. Used by the guide page and the copilot's source viewer. */
export function GuideBody({ doc }: { doc: TaxGuideDoc }) {
  return (
    <>
      {doc.sections.map((section, i) => (
        <GuideSection key={`${section.anchor || section.heading}-${i}`} section={section} />
      ))}
    </>
  );
}

/** The table of contents shown beside a guide on wide screens. */
export function GuideToc({ doc }: { doc: TaxGuideDoc }) {
  const items = useMemo(
    () => doc.sections.filter((s) => s.heading && s.heading.trim().length > 0).slice(0, 60),
    [doc],
  );
  if (items.length < 3) return null;
  return (
    <nav className="tax-toc" aria-label="On this page">
      <span className="tax-toc-title">On this page</span>
      {items.map((s, i) => (
        <a
          key={`${s.anchor || s.heading}-${i}`}
          href={`#${s.anchor || ""}`}
          className={s.level && s.level <= 1 ? "tax-toc-link tax-toc-top" : "tax-toc-link"}
          onClick={(e) => {
            if (!s.anchor) return;
            e.preventDefault();
            document.getElementById(s.anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
          }}
        >
          {s.heading}
        </a>
      ))}
    </nav>
  );
}
