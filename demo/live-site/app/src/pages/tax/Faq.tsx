import { useEffect, useMemo, useState } from "react";
import { ExternalLink, MessageCircle } from "lucide-react";
import { TaxLayout } from "@/components/tax/TaxLayout";
import { TaxCopilot } from "@/components/tax/TaxCopilot";
import { askAssistant, useTaxTitle, type TaxFaqItem } from "@/lib/tax";

export default function TaxFaq() {
  useTaxTitle("Tax FAQ");

  const [items, setItems] = useState<TaxFaqItem[] | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    let live = true;
    // Hand edit: ABA's page read a static faq.json; the FAQ now comes from Octo through the library API.
    fetch("/api/library/faq")
      .then((r) => r.json())
      .then((json: { faq: TaxFaqItem[] }) => {
        if (live) setItems(json.faq ?? []);
      })
      .catch(() => {
        if (live) setItems([]);
      });
    return () => {
      live = false;
    };
  }, []);

  const categories = useMemo(() => {
    const seen: string[] = [];
    for (const i of items ?? []) if (!seen.includes(i.category)) seen.push(i.category);
    return seen;
  }, [items]);

  const groups = useMemo(() => {
    const list = (items ?? []).filter((i) => filter === "all" || i.category === filter);
    const map = new Map<string, TaxFaqItem[]>();
    for (const item of list) {
      const arr = map.get(item.category) ?? [];
      arr.push(item);
      map.set(item.category, arr);
    }
    return [...map.entries()];
  }, [items, filter]);

  return (
    <TaxLayout>
      <div className="tax-wrap tax-section">
        <span className="tax-eyebrow">Tax FAQ</span>
        <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
          Questions the IRS answers, in its own words.
        </h1>
        <p className="tax-lead">
          Every question below is taken word for word from the IRS FAQ, with a link to the page it
          came from. Open one to read the answer, or ask the assistant to talk you through it.
        </p>

        {items && items.length > 0 && (
          <div className="tax-filters" role="group" aria-label="Filter by category">
            <button
              type="button"
              className={filter === "all" ? "tax-filter active" : "tax-filter"}
              aria-pressed={filter === "all"}
              onClick={() => setFilter("all")}
            >
              All ({items.length})
            </button>
            {categories.slice(0, 8).map((c) => (
              <button
                key={c}
                type="button"
                className={filter === c ? "tax-filter active" : "tax-filter"}
                aria-pressed={filter === c}
                onClick={() => setFilter(c)}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {!items && <p className="tax-empty">Loading the questions…</p>}
        {items && items.length === 0 && <p className="tax-empty">The questions couldn't be loaded.</p>}

        {groups.map(([category, list]) => (
          <section key={category} className="tax-faq-group">
            <h2 className="tax-faq-cat">{category}</h2>
            {list.map((item) => (
              <details key={item.id} className="tax-faq-item" data-testid="tax-faq">
                <summary>{item.question}</summary>
                <div className="tax-faq-body">
                  <p>{item.answer}</p>
                  <div className="tax-btn-row" style={{ gap: "0.5rem" }}>
                    <a className="tax-ext" href={item.url} target="_blank" rel="noopener noreferrer">
                      Read it on irs.gov <ExternalLink size={12} />
                    </a>
                    <button
                      type="button"
                      className="tax-chip"
                      style={{ minHeight: "36px", fontSize: "0.75rem", padding: "0.25rem 0.625rem" }}
                      onClick={() => askAssistant(item.question)}
                    >
                      <MessageCircle size={12} aria-hidden="true" /> Ask the assistant
                    </button>
                  </div>
                </div>
              </details>
            ))}
          </section>
        ))}

        <div className="tax-card tax-card-quiet" style={{ marginTop: "1.5rem" }}>
          <h2 className="tax-h3">These are general answers</h2>
          <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
            They come from the IRS FAQ and describe the general rule. Your own situation may be
            different, which is what a preparer is for. Nothing here is tax advice, and Brindlewick
            is not affiliated with the IRS.
          </p>
        </div>
      </div>

      <TaxCopilot />
    </TaxLayout>
  );
}
