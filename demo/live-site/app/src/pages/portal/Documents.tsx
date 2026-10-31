import { useRef, useState } from "react";
import { CheckCircle2, FileText, Upload } from "lucide-react";
import { PortalLayout, SampleNote } from "@/components/portal/PortalLayout";
import { PortalCard, PortalEmpty, PortalError, PortalHead, PortalSkeleton, PortalStatus } from "@/components/portal/ui";
import { useApi } from "@/hooks/useApi";
import {
  count,
  errorText,
  fmtDate,
  portalGet,
  uploadPortalFile,
  type PortalDocument,
} from "@/lib/practice";

export default function PortalDocuments() {
  const docs = useApi(() => portalGet<{ documents: PortalDocument[] }>("/documents"), []);
  const [uploading, setUploading] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [justUploaded, setJustUploaded] = useState<Record<string, boolean>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const all = docs.data?.documents ?? [];
  const needed = all.filter((d) => d.status !== "received" && !justUploaded[d.id]);
  const received = all.filter((d) => d.status === "received" || justUploaded[d.id]);

  const byYear = received.reduce<Record<string, PortalDocument[]>>((acc, doc) => {
    const year = String(doc.received ?? doc.requested ?? "").slice(0, 4) || "Undated";
    (acc[year] ??= []).push(doc);
    return acc;
  }, {});

  const upload = async (doc: PortalDocument, file: File) => {
    setUploading(doc.id);
    setUploadError("");
    try {
      await uploadPortalFile(file, doc.id);
      setJustUploaded((prev) => ({ ...prev, [doc.id]: true }));
    } catch (e) {
      setUploadError(errorText(e));
    } finally {
      setUploading("");
    }
  };

  return (
    <PortalLayout title="Documents">
      <div className="pt-page" data-testid="portal-documents">
        <PortalHead
          title="Documents"
          subtitle="Send what we've asked for, and see everything already on file."
        />

        {docs.error ? <PortalError message={docs.error} onRetry={docs.reload} /> : null}
        {uploadError ? <PortalError message={uploadError} /> : null}

        {!docs.data && docs.loading ? (
          <PortalSkeleton rows={5} />
        ) : (
          <>
            <PortalCard>
              <div className="pt-card-head">
                <h2 className="pt-card-title">Still needed</h2>
                <span className="pt-card-aside">
                  {count(needed.length)} {needed.length === 1 ? "document" : "documents"}
                </span>
              </div>

              {needed.length === 0 ? (
                <PortalEmpty>Nothing outstanding: we have everything we asked for.</PortalEmpty>
              ) : (
                <ul className="pt-doc-list">
                  {needed.map((doc) => (
                    <li key={doc.id} className="pt-doc">
                      <span className="pt-doc-icon" aria-hidden="true">
                        <FileText size={16} />
                      </span>
                      <span className="pt-doc-body">
                        <span className="pt-doc-name">{doc.name}</span>
                        <span className="pt-doc-meta">
                          {doc.form ? `${doc.form} · ` : ""}
                          requested {fmtDate(doc.requested)}
                        </span>
                      </span>
                      <input
                        ref={(el) => {
                          inputs.current[doc.id] = el;
                        }}
                        type="file"
                        className="pt-file-input"
                        aria-label={`Upload ${doc.name}`}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) void upload(doc, file);
                        }}
                      />
                      <button
                        type="button"
                        className="pt-btn pt-btn-sm pt-btn-outline"
                        disabled={uploading === doc.id}
                        onClick={() => inputs.current[doc.id]?.click()}
                      >
                        <Upload size={13} aria-hidden="true" />
                        {uploading === doc.id ? "Uploading…" : "Upload"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </PortalCard>

            <PortalCard>
              <div className="pt-card-head">
                <h2 className="pt-card-title">Received</h2>
                <span className="pt-card-aside">
                  {count(received.length)} {received.length === 1 ? "document" : "documents"}
                </span>
              </div>

              {received.length === 0 ? (
                <PortalEmpty>No documents on file yet.</PortalEmpty>
              ) : (
                Object.entries(byYear)
                  .sort(([a], [b]) => b.localeCompare(a))
                  .map(([year, list]) => (
                    <section className="pt-doc-year" key={year}>
                      <h3 className="pt-doc-year-title">{year}</h3>
                      <ul className="pt-doc-list">
                        {list.map((doc) => (
                          <li key={doc.id} className="pt-doc">
                            <span className="pt-doc-icon pt-doc-icon-done" aria-hidden="true">
                              <CheckCircle2 size={16} />
                            </span>
                            <span className="pt-doc-body">
                              <span className="pt-doc-name">{doc.name}</span>
                              <span className="pt-doc-meta">
                                {doc.form ? `${doc.form} · ` : ""}
                                {justUploaded[doc.id]
                                  ? "just uploaded"
                                  : `received ${fmtDate(doc.received)}`}
                                {doc.size_kb ? ` · ${count(doc.size_kb)} KB` : ""}
                              </span>
                            </span>
                            <PortalStatus status={justUploaded[doc.id] ? "received" : doc.status} />
                          </li>
                        ))}
                      </ul>
                    </section>
                  ))
              )}
            </PortalCard>

            <SampleNote />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
