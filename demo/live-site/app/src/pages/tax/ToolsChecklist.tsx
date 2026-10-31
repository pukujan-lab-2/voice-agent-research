/**
 * The document checklist builder: the situations as large toggle cards, and the list that builds live from
 * /api/site/checklist?situations=. The situations come from the API's own list, and so does every item.
 * A Print button prints the list and nothing else.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { SitePage } from "@/components/tax/SitePage";
import { Empty, ErrorBox, PageHead } from "@/components/tax/SiteUi";
import { useTaxTitle } from "@/lib/tax";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  siteGet,
  type SiteChecklistItem,
  type SiteSituation,
} from "@/lib/practice";

export default function TaxToolsChecklist() {
  useTaxTitle("Document checklist");
  const { get, set } = useUrlState();
  const chosen = (get("situations") || "").split(",").filter(Boolean);

  // The situations arrive with the checklist; asking for none still returns the full list of situations.
  const none = useApi<{ situations: SiteSituation[]; items: SiteChecklistItem[] }>(
    () => siteGet<{ situations: SiteSituation[]; items: SiteChecklistItem[] }>("/checklist", { situations: "" }),
    [],
  );
  const list = useApi<{ situations: SiteSituation[]; items: SiteChecklistItem[] }>(
    chosen.length
      ? () => siteGet<{ situations: SiteSituation[]; items: SiteChecklistItem[] }>("/checklist", { situations: chosen.join(",") })
      : null,
    [chosen.join(",")],
  );

  const situations = none.data?.situations ?? [];
  const items = chosen.length ? (list.data?.items ?? []) : [];

  // Default to the first situation once the list arrives, so the page is never an empty shell.
  useEffect(() => {
    if (!chosen.length && situations.length) set({ situations: situations[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [situations.length]);

  const toggle = (id: string) => {
    const next = chosen.includes(id) ? chosen.filter((s) => s !== id) : [...chosen, id];
    set({ situations: next.join(",") });
  };

  const grouped = useMemo(() => {
    const map = new Map<string, SiteChecklistItem[]>();
    for (const item of items) map.set(item.situation, [...(map.get(item.situation) ?? []), item]);
    return Array.from(map.entries());
  }, [items]);

  const labelOf = (id: string) => situations.find((s) => s.id === id)?.label ?? id;

  return (
    <SitePage>
      <div className="tax-wrap tax-section">
        <PageHead
          eyebrow="Tools"
          title="Build your document checklist."
          lead="Tick the situations that apply to you and the list builds itself: the documents to gather, the form each one appears on, and why we need it. Print it, and bring it with you."
          crumbs={[{ label: "Home", to: "/tax" }, { label: "Document checklist" }]}
        />

        <div className="tax-tool">
          <div style={{ minWidth: 0 }}>
            <h2 className="tax-h2 tax-h2-lead" style={{ fontSize: "1.125rem" }}>
              Which of these apply to you?
            </h2>

            {none.loading && (
              <div className="tax-situations" aria-busy="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="tax-skel" style={{ height: "4.5rem" }} />
                ))}
              </div>
            )}
            {none.error && <ErrorBox error={none.error} onRetry={none.reload} />}

            {situations.length > 0 && (
              <div className="tax-situations tax-no-print">
                {situations.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="tax-situation"
                    aria-pressed={chosen.includes(s.id)}
                    onClick={() => toggle(s.id)}
                  >
                    <strong>{s.label}</strong>
                    <span>{s.hint}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="tax-card" style={{ marginTop: "1.5rem" }}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
                <h2 className="tax-h3" style={{ margin: 0, flex: 1 }}>
                  Your list
                  {items.length > 0 && (
                    <span className="tax-muted" style={{ fontWeight: 400, fontSize: "0.875rem" }}>
                      {" "}
                      · {items.length} {items.length === 1 ? "document" : "documents"}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  className="tax-btn tax-btn-outline tax-no-print"
                  onClick={() => window.print()}
                  disabled={items.length === 0}
                >
                  <Printer size={15} aria-hidden="true" /> Print
                </button>
              </div>

              <p className="tax-print-only" style={{ fontSize: "0.8125rem", color: "#444" }}>
                Brindlewick Tax &amp; Accounting · document checklist · demo
              </p>

              {list.loading && chosen.length > 0 && (
                <div aria-busy="true">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="tax-skel tax-skel-line" style={{ height: "1.5rem", marginBottom: "0.5rem" }} />
                  ))}
                </div>
              )}
              {list.error && <ErrorBox error={list.error} onRetry={list.reload} />}
              {!list.loading && !list.error && items.length === 0 && (
                <Empty>Tick a situation above and the list will build here.</Empty>
              )}

              {grouped.map(([situation, rows]) => (
                <section key={situation} style={{ marginBottom: "1rem" }}>
                  <h3 className="tax-tiny" style={{ textTransform: "uppercase", letterSpacing: "0.12em", color: "hsl(var(--tax-brass))", fontWeight: 700, margin: "0 0 0.25rem" }}>
                    {labelOf(situation)}
                  </h3>
                  {rows.map((item) => (
                    <div className="tax-checklist-item" key={item.id} data-testid="checklist-item">
                      <span className="box" aria-hidden="true" />
                      <div>
                        <strong>{item.name}</strong>
                        <span className="form">{item.form}</span>
                        <span>{item.why}</span>
                      </div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>

          <aside className="tax-tool-aside">
            <div className="tax-card">
              <h2 className="tax-h3">What happens next</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Bring the list to your first appointment, or send it through the client portal once you
                are a client. Nothing on it needs to be gathered before the first call.
              </p>
              <Link to="/tax/book" className="tax-btn" style={{ width: "100%" }}>
                Book a consultation
              </Link>
            </div>
            <div className="tax-card tax-card-quiet" style={{ marginTop: "1rem" }}>
              <h2 className="tax-h3">Already a client?</h2>
              <p className="tax-small tax-muted" style={{ margin: "0 0 0.75rem" }}>
                Your organizer in the portal lists the documents we are still waiting for, and lets you
                upload them.
              </p>
              <Link to="/tax/portal" className="tax-btn tax-btn-outline" style={{ width: "100%" }}>
                Client login
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </SitePage>
  );
}
