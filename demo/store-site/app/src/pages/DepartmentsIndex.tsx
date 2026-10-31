import { Link } from "react-router-dom";
import { useDepartments } from "@/lib/departments";
import { useDocumentTitle } from "@/lib/hooks";
import { ErrorState, LoadingState } from "@/components/States";

export default function DepartmentsIndex() {
  useDocumentTitle("All departments");
  const { departments, loading, error } = useDepartments();

  return (
    <div className="bw-container py-6">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        All departments
      </h1>
      <p className="mt-1 text-sm text-sage">
        {departments.length} departments, each with its own categories.
      </p>

      {loading && <LoadingState />}
      {error && !departments.length && (
        <ErrorState
          message={error}
          onRetry={() => window.location.reload()}
          className="mt-6"
        />
      )}

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((department) => (
          <section
            key={department.slug}
            className="rounded-xl border border-sage-border bg-white p-4"
          >
            <Link
              to={`/d/${department.slug}`}
              className="font-display text-lg font-semibold text-brand hover:underline"
            >
              {department.name}
            </Link>
            <ul className="mt-2 space-y-1">
              {department.categories.map((category) => (
                <li
                  key={`${department.slug}-${category.slug}-${category.name}`}
                >
                  <Link
                    to={`/c/${category.slug}`}
                    className="flex min-h-[36px] items-center justify-between gap-2 text-sm text-sage hover:text-brand hover:underline"
                  >
                    <span>{category.name}</span>
                    <span className="shrink-0 text-xs text-sage/80">
                      {category.count?.toLocaleString?.("en-US") ?? ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
