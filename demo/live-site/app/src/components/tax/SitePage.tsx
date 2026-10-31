import type { ReactNode } from "react";
import { SiteShell } from "./SiteHeader";
import { SiteCopilot } from "./SiteCopilot";

/**
 * Every /tax page is wrapped in this: the header with its mega-menu and search, the page content, the footer, and
 * the copilot. A form page names its own config; everything else mounts the desk config.
 */
export function SitePage({ children, config = "tax" }: { children: ReactNode; config?: string }) {
  return (
    <SiteShell>
      {children}
      <SiteCopilot config={config} />
    </SiteShell>
  );
}
