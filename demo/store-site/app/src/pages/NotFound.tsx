import { Link } from "react-router-dom";
import { useDocumentTitle } from "@/lib/hooks";
import { EmptyState } from "@/components/States";

export default function NotFound() {
  useDocumentTitle("Page not found");
  return (
    <div className="bw-container py-12">
      <EmptyState title="We couldn't find that page">
        <p>
          The link may be old, or the page may have moved. Try the home page or
          search for what you're after.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/"
            className="tap inline-flex items-center rounded-lg bg-brand px-5 text-sm font-semibold text-white"
          >
            Go to home
          </Link>
          <Link
            to="/search"
            className="tap inline-flex items-center rounded-lg border border-sage-border px-5 text-sm font-semibold text-brand"
          >
            Browse everything
          </Link>
        </div>
      </EmptyState>
    </div>
  );
}
