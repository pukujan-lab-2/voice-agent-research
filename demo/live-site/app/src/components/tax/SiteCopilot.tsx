import { useCopilotMount } from "@/hooks/useCopilot";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { SourceViewer } from "./SourceViewer";

/** Mounts the copilot with the named config and draws the call bar and the source viewer. */
export function SiteCopilot({ config }: { config: string }) {
  useCopilotMount(COPILOT_CONFIGS[config] ?? COPILOT_CONFIGS.tax);
  return (
    <>
      <SourceViewer />
      <CopilotWidget />
    </>
  );
}
