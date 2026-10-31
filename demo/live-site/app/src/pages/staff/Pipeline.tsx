import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  MissingDocs,
  PageHeader,
  PriorityDot,
  SelectField,
  SkeletonCards,
  Toast,
} from "@/components/staff/ui";
import { useApi, useUrlState } from "@/hooks/useApi";
import {
  STAGES,
  count,
  daysUntil,
  errorText,
  fmtDate,
  staffGet,
  staffPost,
  stageLabel,
  type PipelineBoard,
  type PipelineCard,
  type StaffProfile,
} from "@/lib/practice";

export default function StaffPipeline() {
  const { get, set } = useUrlState({ year: "2025" });
  const year = get("year") || "2025";
  const preparer = get("preparer");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState("");
  const [moveError, setMoveError] = useState("");

  const board = useApi(
    () => staffGet<PipelineBoard>("/pipeline", { year, preparer: preparer || undefined }),
    [year, preparer],
  );

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const move = async (card: PipelineCard, stage: string) => {
    setBusy(card.id);
    setMoveError("");
    try {
      await staffPost("/stage", { id: card.id, stage });
      setToast(`${card.client_name} moved to ${stageLabel(stage).toLowerCase()}.`);
      board.reload();
    } catch (e) {
      setMoveError(errorText(e));
    } finally {
      setBusy("");
    }
  };

  const columns = board.data?.columns ?? [];
  const totalCards = columns.reduce((sum, c) => sum + Number(c.total), 0);

  return (
    <StaffLayout title="Pipeline">
      <div data-testid="staff-pipeline">
        <PageHeader
          title="Pipeline"
          subtitle={
            board.data
              ? `${count(totalCards)} returns for ${board.data.year}, by stage.`
              : "Returns by stage."
          }
        />

        <div className="bw-list-toolbar bw-list-toolbar-tight">
          <div className="bw-filter-row">
            <SelectField
              label="Tax year"
              value={year}
              onChange={(v) => set({ year: v })}
              options={[
                { value: "2026", label: "2026" },
                { value: "2025", label: "2025" },
                { value: "2024", label: "2024" },
                { value: "2023", label: "2023" },
              ]}
            />
            <SelectField
              label="Preparer"
              value={preparer}
              onChange={(v) => set({ preparer: v })}
              options={[
                { value: "", label: "Everyone" },
                ...(staff.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </div>
        </div>

        <Toast message={toast} />
        {moveError ? <ErrorState message={moveError} compact /> : null}
        {board.error ? <ErrorState message={board.error} onRetry={board.reload} /> : null}

        {board.loading && !board.data ? (
          <div className="bw-board">
            {STAGES.map((s) => (
              <div className="bw-board-col" key={s.id}>
                <div className="bw-board-col-head">
                  <span>{s.label}</span>
                </div>
                <SkeletonCards n={3} />
              </div>
            ))}
          </div>
        ) : columns.length === 0 ? (
          <EmptyState>No engagements for {year} with these filters.</EmptyState>
        ) : (
          <div className="bw-board">
            {columns.map((col) => (
              <section className="bw-board-col" key={col.stage} data-testid="staff-pipeline-column">
                <header className="bw-board-col-head">
                  <span className={`bw-board-dot bw-stackbar-${col.stage}`} aria-hidden="true" />
                  <span className="bw-board-col-label">{col.label}</span>
                  <span className="bw-board-col-n">{count(col.total)}</span>
                </header>

                <div className="bw-board-col-body">
                  {col.cards.length === 0 ? (
                    <p className="bw-board-empty">Nothing here.</p>
                  ) : (
                    col.cards.map((card) => {
                      const late = (daysUntil(card.due) ?? 0) < 0;
                      return (
                        <article className="bw-board-card" key={card.id} data-testid="staff-pipeline-card">
                          <div className="bw-board-card-top">
                            <Link to={`/staff/clients/${card.client_ref}`} className="bw-board-card-name">
                              {card.client_name}
                            </Link>
                            <PriorityDot priority={card.priority} />
                          </div>
                          <div className="bw-board-card-meta">
                            <span className="bw-mono">
                              {card.form} {card.form && card.due ? "·" : ""}
                            </span>
                            <span className={late ? "bw-late" : ""}>{fmtDate(card.due)}</span>
                          </div>
                          <div className="bw-board-card-foot">
                            {card.missing ? <MissingDocs n={card.missing} /> : <span />}
                            <details className="bw-move">
                              <summary aria-label={`Move ${card.client_name}`}>
                                Move to… <ChevronDown size={11} aria-hidden="true" />
                              </summary>
                              <div className="bw-move-menu">
                                {STAGES.filter((s) => s.id !== col.stage).map((s) => (
                                  <button
                                    key={s.id}
                                    type="button"
                                    disabled={busy === card.id}
                                    onClick={(e) => {
                                      (e.currentTarget.closest("details") as HTMLDetailsElement | null)?.removeAttribute("open");
                                      void move(card, s.id);
                                    }}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                            </details>
                          </div>
                        </article>
                      );
                    })
                  )}
                  {Number(col.total) > col.cards.length ? (
                    <Link
                      to={`/staff/engagements?stage=${col.stage}&year=${board.data?.year ?? year}`}
                      className="bw-board-more"
                    >
                      {count(Number(col.total) - col.cards.length)} more in{" "}
                      {col.label.toLowerCase()} →
                    </Link>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </StaffLayout>
  );
}
