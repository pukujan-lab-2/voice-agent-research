import { Check, Circle } from "lucide-react";
import { PortalLayout, SampleNote } from "@/components/portal/PortalLayout";
import { PortalCard, PortalEmpty, PortalError, PortalHead, PortalSkeleton } from "@/components/portal/ui";
import { useApi } from "@/hooks/useApi";
import { count, fmtDate, portalGet, type PortalOrganizer } from "@/lib/practice";

export default function PortalOrganizerPage() {
  const organizer = useApi(() => portalGet<PortalOrganizer>("/organizer"), []);
  const data = organizer.data;

  const situations = (data?.checklist ?? []).reduce<Record<string, PortalOrganizer["checklist"]>>((acc, item) => {
    (acc[item.situation] ??= []).push(item);
    return acc;
  }, {});

  return (
    <PortalLayout title="Organizer">
      <div className="pt-page" data-testid="portal-organizer">
        <PortalHead
          title="Your organizer"
          subtitle={data ? `What we need for your ${data.taxYear} return, and why.` : "Your tax-year organizer."}
        />

        {organizer.error ? <PortalError message={organizer.error} onRetry={organizer.reload} /> : null}

        {!data && organizer.loading ? <PortalSkeleton rows={6} /> : null}

        {data && (
          <>
            <PortalCard>
              <div className="pt-card-head">
                <h2 className="pt-card-title">Documents on file</h2>
                <span className="pt-card-aside">
                  {count(data.documents.filter((d) => d.status === "received").length)} of{" "}
                  {count(data.documents.length)} received
                </span>
              </div>
              {data.documents.length === 0 ? (
                <PortalEmpty>No documents on file for this year yet.</PortalEmpty>
              ) : (
                <ul className="pt-check-list">
                  {data.documents.map((doc) => {
                    const done = doc.status === "received";
                    return (
                      <li key={doc.id} className={done ? "done" : ""}>
                        <span className="pt-check-mark" aria-hidden="true">
                          {done ? <Check size={12} /> : <Circle size={10} />}
                        </span>
                        <span className="pt-check-body">
                          <span className="pt-check-name">{doc.name}</span>
                          <span className="pt-check-meta">
                            {doc.form ? `${doc.form} · ` : ""}
                            {done ? `received ${fmtDate(doc.received)}` : "still needed"}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PortalCard>

            <PortalCard>
              <div className="pt-card-head">
                <h2 className="pt-card-title">What applies to you</h2>
                <span className="pt-card-aside">{count(data.checklist.length)} items</span>
              </div>
              {data.checklist.length === 0 ? (
                <PortalEmpty>Nothing else is needed for this year.</PortalEmpty>
              ) : (
                Object.entries(situations).map(([situation, items]) => (
                  <section className="pt-situation" key={situation}>
                    <h3 className="pt-situation-title">{situation}</h3>
                    <ul className="pt-checklist">
                      {items.map((item) => (
                        <li key={item.id}>
                          <span className="pt-checklist-name">{item.name}</span>
                          {item.form ? <code className="pt-code">{item.form}</code> : null}
                          {item.why ? <span className="pt-checklist-why">{item.why}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </PortalCard>

            <p className="pt-organizer-note">
              Not sure whether something applies? Send your preparer a message and they'll tell you
              what to send.
            </p>

            <SampleNote />
          </>
        )}
      </div>
    </PortalLayout>
  );
}
