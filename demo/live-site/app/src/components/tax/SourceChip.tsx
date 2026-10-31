import { FileText } from "lucide-react";
import type { CopilotSource } from "@/lib/copilot";

/** Under a copilot answer: a small chip with the source label; a tap reopens the viewer. */
export function SourceChip({ messageId, source }: { messageId: number; source: CopilotSource }) {
  return (
    <button
      type="button"
      className="tax-source-chip"
      data-testid="call-source-chip"
      onClick={() => window.copilot?.showSource(messageId)}
    >
      <FileText size={12} aria-hidden="true" />
      <span>{source.label}</span>
    </button>
  );
}
