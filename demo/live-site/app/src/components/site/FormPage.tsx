import { type ReactNode } from "react";
import { SiteLayout, type SiteLayoutProps } from "./SiteLayout";
import { GuestGate } from "./GuestGate";
import { useGuest } from "@/hooks/useGuest";
import { useCopilotMount } from "@/hooks/useCopilot";
import { type CopilotConfig } from "@/lib/copilot";

interface FormPageProps extends Omit<SiteLayoutProps, "children" | "hasCopilot"> {
  config: CopilotConfig;
  children: ReactNode;
}

/**
 * Wraps a form page: shows the site chrome, handles the guest gate,
 * and mounts/unmounts the copilot with the given config when the form is on screen.
 */
export function FormPage({ config, children, ...layoutProps }: FormPageProps) {
  const { isGuest, enterGuest } = useGuest();
  useCopilotMount(isGuest ? config : null);

  return (
    <SiteLayout {...layoutProps} large={config.large} hasCopilot>
      {isGuest ? children : <GuestGate onEnter={enterGuest} />}
    </SiteLayout>
  );
}
