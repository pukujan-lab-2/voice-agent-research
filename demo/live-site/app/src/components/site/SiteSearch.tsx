import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";

export interface SearchablePage {
  title: string;
  path: string;
  keywords?: string;
}

/** A search box that searches the site's own pages by title and keywords. */
export function SiteSearch({ pages }: { pages: SearchablePage[] }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const desktopRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        (desktopRef.current && desktopRef.current.contains(target)) ||
        (mobileRef.current && mobileRef.current.contains(target))
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const results = query.trim()
    ? pages.filter((p) => {
        const q = query.toLowerCase();
        return (
          p.title.toLowerCase().includes(q) ||
          (p.keywords && p.keywords.toLowerCase().includes(q))
        );
      })
    : [];

  const renderInput = (isMobile: boolean) => (
    <>
      <Search size={16} className="site-search-icon" />
      <input
        type="search"
        className="site-search-input"
        placeholder="Search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        aria-label="Search this site"
      />
      {open && results.length > 0 && (
        <div className="site-search-results">
          {results.map((p, i) => (
            <a
              key={i}
              href={p.path}
              onClick={() => {
                setOpen(false);
                setQuery("");
                if (isMobile) setMobileOpen(false);
              }}
            >
              <span className="search-title">{p.title}</span>
              {p.keywords && <span className="search-kw">{p.keywords}</span>}
            </a>
          ))}
        </div>
      )}
      {open && query.trim() && results.length === 0 && (
        <div className="site-search-results">
          <a href="#" onClick={(e) => e.preventDefault()}>
            <span className="search-title">No results</span>
          </a>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Desktop inline search */}
      <div className="site-search-wrap site-search-desktop" ref={desktopRef}>
        {renderInput(false)}
      </div>

      {/* Mobile toggle button */}
      <button
        className="site-search-toggle"
        aria-label="Search"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        {mobileOpen ? <X size={18} /> : <Search size={18} />}
      </button>

      {/* Mobile full-width search row */}
      {mobileOpen && (
        <div className="site-search-mobile open">
          <div className="site-search-mobile-bar" ref={mobileRef}>
            {renderInput(true)}
          </div>
        </div>
      )}
    </>
  );
}
