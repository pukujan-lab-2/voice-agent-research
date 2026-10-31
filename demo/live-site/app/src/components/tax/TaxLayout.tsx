import { useEffect, useRef, type ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * The chrome every /tax page sits inside: the demo bar, the mega-menu header, the page, the footer. The header's
 * height is published as --tax-chrome-h so anchored headings and the source viewer clear it.
 *
 * The pages kept from the earlier build (Pricing, Guides, the guide reader, the FAQ) still use this wrapper, so
 * they get the new header and footer without their own content changing.
 */
export function TaxLayout({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const publish = () => {
      const h = topRef.current?.offsetHeight ?? 0;
      if (h) rootRef.current?.style.setProperty("--tax-chrome-h", `${h}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    if (topRef.current) ro.observe(topRef.current);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="tax-root" ref={rootRef}>
      <div ref={topRef} style={{ position: "sticky", top: 0, zIndex: 40 }}>
        <SiteHeader />
      </div>
      <main className="tax-main">{children}</main>
      <SiteFooter />
    </div>
  );
}

export const TAX_NAV = [
  { label: "Services", to: "/tax/services" },
  { label: "Pricing", to: "/tax/pricing" },
  { label: "Team", to: "/tax/team" },
  { label: "Tax Guides", to: "/tax/guides" },
  { label: "FAQ", to: "/tax/faq" },
  { label: "About", to: "/tax/about" },
];
