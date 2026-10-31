import type { ReactNode } from "react";
import { useCopilotMount } from "@/hooks/useCopilot";
import { CopilotWidget } from "@/components/copilot/CopilotWidget";
import { COPILOT_CONFIGS } from "@/lib/copilot";
import { SourceViewer } from "./SourceViewer";

/**
 * Every /tax page mounts the copilot and shows the call bar; /tax/book mounts the intake config.
 */
export function TaxCopilot({ intake = false }: { intake?: boolean }) {
  useCopilotMount(intake ? COPILOT_CONFIGS.taxIntake : COPILOT_CONFIGS.tax);
  return (
    <>
      <SourceViewer />
      <CopilotWidget />
    </>
  );
}

/** A page shell: the site chrome, the copilot, and the page content. */
export function TaxPage({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
