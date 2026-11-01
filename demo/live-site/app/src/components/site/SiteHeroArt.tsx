/**
 * The one illustration every demo site's home page shares: a form page with two fields,
 * one of them filled, and the copilot's speech bubble beside it. It is drawn with the
 * site's own accent tokens ([data-site]) so each business keeps its colour while the
 * pages still read as one product. Nothing here is traced from another brand's artwork.
 */
export function SiteHeroArt() {
  return (
    <div className="site-hero-art" aria-hidden="true">
      <svg viewBox="0 0 320 280" role="presentation" focusable="false">
        <circle cx="250" cy="62" r="54" fill="hsl(var(--site-accent-soft))" />
        <circle cx="48" cy="234" r="26" fill="#ece3d5" />
        <g transform="rotate(-3 134 140)">
          <rect x="44" y="24" width="180" height="232" rx="16" fill="#fffdf8" stroke="#e6e0d5" />
          <rect x="68" y="50" width="74" height="10" rx="5" fill="hsl(var(--site-accent))" />
          <rect x="68" y="76" width="132" height="6" rx="3" fill="#e8e2d7" />
          <rect x="68" y="92" width="104" height="6" rx="3" fill="#e8e2d7" />
          <rect x="68" y="122" width="48" height="6" rx="3" fill="#ddd5c8" />
          <rect x="68" y="136" width="132" height="24" rx="7" fill="hsl(var(--site-accent-soft))" />
          <rect x="78" y="145" width="64" height="6" rx="3" fill="hsl(var(--site-accent))" />
          <rect x="68" y="176" width="56" height="6" rx="3" fill="#ddd5c8" />
          <rect x="68" y="190" width="132" height="24" rx="7" fill="#fffdf8" stroke="#e6e0d5" />
          <rect x="78" y="199" width="38" height="6" rx="3" fill="#e8e2d7" />
          <rect x="68" y="228" width="62" height="16" rx="8" fill="hsl(var(--site-accent))" />
          <path d="M78 236l4 4 7-8" fill="none" stroke="hsl(var(--site-accent-fg))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        <g transform="translate(188 170)">
          <rect x="0" y="0" width="106" height="64" rx="18" fill="hsl(var(--site-accent))" />
          <path d="M24 62l-3 20 22-16z" fill="hsl(var(--site-accent))" />
          <circle cx="30" cy="32" r="5" fill="hsl(var(--site-accent-fg) / 0.92)" />
          <circle cx="52" cy="32" r="5" fill="hsl(var(--site-accent-fg) / 0.92)" />
          <circle cx="74" cy="32" r="5" fill="hsl(var(--site-accent-fg) / 0.92)" />
        </g>
      </svg>
    </div>
  );
}
