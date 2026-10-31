import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ChevronDown,
  Heart,
  HelpCircle,
  Menu,
  Mic,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { Wordmark } from "@/components/brand/Wordmark";
import { useDepartments } from "@/lib/departments";
import { useCart, useWishlistCount } from "@/lib/hooks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { SearchBox } from "./SearchBox";

function startVoice() {
  const copilot = (window as unknown as {
    copilot?: { start?: (options?: { voice?: boolean }) => void };
  }).copilot;
  copilot?.start?.({ voice: true });
}

function CountBadge({
  count,
  testId,
  tone = "saffron",
}: {
  count: number;
  testId?: string;
  tone?: "saffron" | "white";
}) {
  return (
    <span
      data-testid={testId}
      className={cn(
        "absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-extrabold leading-none",
        tone === "saffron" ? "bg-saffron text-ink" : "bg-white text-brand",
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function Header() {
  const location = useLocation();
  const [deptOpen, setDeptOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { departments } = useDepartments();
  const cart = useCart();
  const wishlistCount = useWishlistCount();
  const isMobile = useIsMobile();

  const searchParams = new URLSearchParams(location.search);
  const currentQuery =
    location.pathname === "/search" ? searchParams.get("q") ?? "" : "";

  const cartCount = cart.data?.count ?? 0;

  useEffect(() => {
    setDeptOpen(false);
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!deptOpen && !menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDeptOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [deptOpen, menuOpen]);

  return (
    <header className="relative z-40 bg-brand text-white shadow-[0_1px_0_rgba(0,0,0,0.08)]">
      <div className="bw-container">
        <div className="flex h-[58px] items-center gap-2 sm:h-[70px] sm:gap-3">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMenuOpen(true)}
            className="tap -ml-2 flex items-center justify-center rounded-md px-1.5 text-white/90 hover:bg-white/10 lg:hidden"
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link to="/" className="shrink-0" aria-label="Brambleway home">
            <Wordmark />
          </Link>

          <div className="ml-1 hidden flex-1 items-center gap-2 sm:flex lg:ml-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setDeptOpen((open) => !open)}
                aria-expanded={deptOpen}
                className="tap flex items-center gap-1.5 rounded-md px-2.5 text-[14px] font-semibold text-white/95 hover:bg-white/10"
              >
                Departments
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition",
                    deptOpen && "rotate-180",
                  )}
                />
              </button>
            </div>
            {!isMobile && (
              <SearchBox
                initialQuery={currentQuery}
                className="max-w-[640px] flex-1"
              />
            )}
          </div>

          <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
            <button
              type="button"
              data-testid="voice-start"
              onClick={startVoice}
              aria-label="Shop with your voice"
              title="Shop with your voice"
              className="tap flex items-center justify-center rounded-md px-2 text-white/95 hover:bg-white/10"
            >
              <Mic className="h-[21px] w-[21px]" />
            </button>
            <Link
              to="/help"
              className="tap hidden items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-white/95 hover:bg-white/10 md:flex"
            >
              <HelpCircle className="h-[18px] w-[18px]" />
              Help
            </Link>
            <Link
              to="/account"
              className="tap hidden items-center gap-1.5 rounded-md px-2.5 text-[13px] font-semibold text-white/95 hover:bg-white/10 md:flex"
            >
              <User className="h-[18px] w-[18px]" />
              Account
            </Link>
            <Link
              to="/wishlist"
              className="tap relative flex items-center justify-center rounded-md px-2 text-white/95 hover:bg-white/10"
              aria-label={`Wishlist${wishlistCount ? `, ${wishlistCount} items` : ""}`}
            >
              <Heart className="h-[21px] w-[21px]" />
              {wishlistCount > 0 && (
                <CountBadge count={wishlistCount} tone="white" />
              )}
            </Link>
            <Link
              to="/cart"
              className="tap relative flex items-center justify-center gap-1.5 rounded-md px-2 text-white/95 hover:bg-white/10"
              aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
            >
              <ShoppingCart className="h-[21px] w-[21px]" />
              <CountBadge count={cartCount} testId="cart-count" />
              <span className="hidden text-[13px] font-semibold lg:inline">
                Cart
              </span>
            </Link>
          </div>
        </div>

        {isMobile && (
          <div className="pb-2.5">
            <SearchBox initialQuery={currentQuery} />
          </div>
        )}
      </div>

      {deptOpen && (
        <>
          <button
            type="button"
            aria-label="Close departments"
            className="fixed inset-0 top-0 z-30 cursor-default bg-black/25"
            onClick={() => setDeptOpen(false)}
          />
          <div className="absolute left-0 right-0 top-full z-40 max-h-[70vh] overflow-y-auto border-t border-white/10 bg-white text-ink shadow-2xl">
            <div className="bw-container py-5">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-brand">
                  All departments
                </h2>
                <button
                  type="button"
                  onClick={() => setDeptOpen(false)}
                  className="tap -mr-2 flex items-center justify-center rounded-md px-2 text-sage hover:text-ink"
                  aria-label="Close departments"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
                {departments.length === 0 && (
                  <p className="text-sm text-sage">Loading departments…</p>
                )}
                {departments.map((department) => (
                  <div key={department.slug}>
                    <Link
                      to={`/d/${department.slug}`}
                      onClick={() => setDeptOpen(false)}
                      className="text-sm font-bold text-brand hover:underline"
                    >
                      {department.name}
                    </Link>
                    <ul className="mt-1 space-y-0.5">
                      {department.categories.slice(0, 6).map((category) => (
                        <li key={`${department.slug}-${category.slug}-${category.name}`}>
                          <Link
                            to={`/c/${category.slug}`}
                            onClick={() => setDeptOpen(false)}
                            className="text-[13px] text-sage hover:text-brand hover:underline"
                          >
                            {category.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {menuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-[86%] max-w-[330px] flex-col bg-white text-ink">
            <div className="flex items-center justify-between bg-brand px-4 py-3 text-white">
              <Wordmark />
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="tap -mr-2 flex items-center justify-center px-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3">
              <p className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-sage">
                Departments
              </p>
              {departments.map((department) => (
                <Link
                  key={department.slug}
                  to={`/d/${department.slug}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex min-h-[44px] items-center rounded-md px-1 text-[15px] font-medium text-ink hover:bg-sage-light"
                >
                  {department.name}
                </Link>
              ))}
              <div className="mt-3 border-t border-sage-border pt-2">
                {[
                  { label: "Help", to: "/help" },
                  { label: "Account", to: "/account" },
                  { label: "Your orders", to: "/orders" },
                  { label: "Wishlist", to: "/wishlist" },
                  { label: "Cart", to: "/cart" },
                ].map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMenuOpen(false)}
                    className="flex min-h-[44px] items-center rounded-md px-1 text-[15px] font-medium text-ink hover:bg-sage-light"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
