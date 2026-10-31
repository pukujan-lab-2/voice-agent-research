import { Link } from "react-router-dom";
import { BrambleMark } from "@/components/brand/Wordmark";

export const DEMO_BAR_TEXT =
  "Demo store: Brambleway is fictional. Nothing is sold, charged or shipped.";

export const DEMO_FOOTER_TEXT =
  "Brambleway is a fictional store built to demonstrate a voice shopping assistant. Products, brands, reviews and answers are generated for this demo.";

export function DemoBar() {
  return (
    <div
      data-testid="demo-banner"
      className="w-full bg-saffron-soft text-ink"
      style={{ backgroundColor: "#fdf1dc" }}
    >
      <div className="bw-container flex items-center justify-center gap-2 py-[7px] sm:py-2">
        <span
          aria-hidden="true"
          className="hidden h-1.5 w-1.5 shrink-0 rounded-full bg-saffron-dark sm:block"
        />
        <p className="text-center text-[11px] font-semibold leading-snug tracking-[0.005em] text-ink sm:text-[12.5px]">
          {DEMO_BAR_TEXT}
        </p>
      </div>
    </div>
  );
}

const FOOTER_LINKS: { heading: string; links: { label: string; to: string }[] }[] =
  [
    {
      heading: "Shop",
      links: [
        { label: "Departments", to: "/departments" },
        { label: "Today's deals", to: "/search?deal=1&sort=discount" },
        { label: "Top rated", to: "/search?sort=rating" },
        { label: "New arrivals", to: "/search?sort=newest" },
      ],
    },
    {
      heading: "Your account",
      links: [
        { label: "Your orders", to: "/orders" },
        { label: "Returns", to: "/account" },
        { label: "Wishlist", to: "/wishlist" },
        { label: "Account", to: "/account" },
      ],
    },
    {
      heading: "Help",
      links: [
        { label: "Help centre", to: "/help" },
        { label: "Shipping and delivery", to: "/help" },
        { label: "Returns and refunds", to: "/help" },
        { label: "Shopping with voice", to: "/help" },
      ],
    },
  ];

export function SiteFooter() {
  return (
    <footer className="mt-14 border-t border-sage-border bg-white">
      <div className="bw-container py-9">
        <div className="flex flex-col gap-8 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <div className="flex items-center gap-2">
              <BrambleMark className="h-6 w-6" />
              <span className="font-display text-lg font-semibold text-brand">
                Brambleway
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-sage">
              A warm, everyday department store for the things you actually
              need — and the odd thing you don't.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-10">
            {FOOTER_LINKS.map((group) => (
              <div key={group.heading}>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink">
                  {group.heading}
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.to}
                        className="text-sm text-sage hover:text-brand hover:underline"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 border-t border-sage-border pt-5">
          <p
            data-testid="demo-footer"
            className="max-w-3xl text-[11.5px] leading-relaxed text-sage"
          >
            {DEMO_FOOTER_TEXT}
          </p>
          <p className="mt-2 text-[11px] text-sage/80">
            © Brambleway (fictional). No real brands, products or people appear
            in this demo.
          </p>
        </div>
      </div>
    </footer>
  );
}
