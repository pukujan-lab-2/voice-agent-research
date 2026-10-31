import { cn } from "@/lib/utils";

export const DEMO_NOTICE =
  "Demo site: Brindlewick is a fictional firm built to show a voice assistant. Not a real business. Don't enter real personal or tax information.";

export const IRS_LINE =
  "Tax guides are IRS.gov publications (U.S. government works, public domain). Not affiliated with or endorsed by the IRS. Not tax advice.";

/** The slim bar pinned to the top of every /tax page. */
export function DemoBar() {
  return (
    <div className="tax-demobar" data-testid="demo-banner">
      <span className="tax-demobar-dot" aria-hidden="true" />
      <p>{DEMO_NOTICE}</p>
    </div>
  );
}

/** The same notice in small, calm type: footer, About page, above the intake form. */
export function TaxNotice({ className }: { className?: string }) {
  return (
    <p className={cn("tax-notice", className)}>
      <strong>Demo.</strong> {DEMO_NOTICE.replace("Demo site: ", "")}
    </p>
  );
}
