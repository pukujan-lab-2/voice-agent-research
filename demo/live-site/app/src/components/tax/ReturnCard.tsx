import { FileCheck2 } from "lucide-react";
import type { CopilotReturnCard } from "@/lib/copilot";

/** After caller verification: the client's (fictional) return status. It holds no identity details, and says it is sample data. */
export function ReturnCard({ card }: { card: CopilotReturnCard }) {
  return (
    <section className="tax-return-card" data-testid="return-card" aria-label="Your return status">
      <div className="tax-return-card-head">
        <FileCheck2 size={16} aria-hidden="true" />
        <strong>Your {card.taxYear} return</strong>
        <span className="tax-return-card-sample" data-testid="return-card-sample">Sample data · fictional client</span>
      </div>
      <p className="tax-return-card-status">{card.status}</p>
      {card.amount && <p className="tax-return-card-amount">{card.amount}</p>}
      <p>{card.nextStep}</p>
      <p className="tax-return-card-meta">
        Preparer: {card.preparer} · Updated {card.updated}
      </p>
    </section>
  );
}
