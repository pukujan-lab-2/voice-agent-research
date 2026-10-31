/** The wordmark: a mark built from shapes and type, then "Brindlewick" over "Tax & Accounting". */
export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="tax-wordmark">
      <span className="tax-mark" aria-hidden="true">
        <span className="tax-mark-a" />
        <span className="tax-mark-b" />
        <span className="tax-mark-c" />
      </span>
      <span className="tax-wordmark-text">
        <span className="tax-wordmark-name">Brindlewick</span>
        {!compact && <span className="tax-wordmark-sub">Tax &amp; Accounting</span>}
      </span>
    </span>
  );
}
