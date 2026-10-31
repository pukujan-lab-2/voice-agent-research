import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Send } from "lucide-react";
import { StaffLayout } from "@/components/staff/StaffLayout";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SearchField,
  Segmented,
  SkeletonBlock,
  Toast,
} from "@/components/staff/ui";
import { NewMessageDialog } from "@/components/staff/dialogs";
import { useApi, useUrlSearch, useUrlState } from "@/hooks/useApi";
import {
  count,
  errorText,
  fmtDate,
  fmtWhen,
  staffGet,
  staffPost,
  type Message,
  type Paged,
  type StaffThread,
} from "@/lib/practice";

const SIZE = 30;

export default function StaffMessages() {
  const { get, set } = useUrlState({ filter: "mine" });
  const filter = get("filter") || "mine";
  const q = get("q");
  const [search, setSearch] = useUrlSearch(q, (v) => set({ q: v }));
  const [openId, setOpenId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState("");
  const [compose, setCompose] = useState(false);
  const [sendError, setSendError] = useState("");

  const list = useApi(
    () =>
      staffGet<Paged<StaffThread>>("/threads", {
        mine: filter === "mine" ? 1 : undefined,
        unread: filter === "unread" ? 1 : undefined,
        q: q || undefined,
        size: SIZE,
      }),
    [filter, q],
  );

  const thread = useApi(
    () =>
      openId ? staffGet<{ thread: StaffThread; messages: Message[] }>("/thread", { id: openId }) : Promise.resolve(null),
    [openId],
  );

  const threads = list.data?.rows ?? [];
  const active = thread.data?.thread ?? threads.find((t) => t.id === openId) ?? null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !openId) return;
    setSending(true);
    setSendError("");
    try {
      await staffPost("/message", { thread: openId, body: body.trim() });
      setBody("");
      thread.reload();
      list.reload();
      setToast("Reply sent.");
    } catch (err) {
      setSendError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <StaffLayout title="Messages">
      <div data-testid="staff-messages">
        <PageHeader
          title="Messages"
          subtitle="Secure messages with clients, kept with their file."
          actions={
            <button type="button" className="bw-btn bw-btn-primary bw-btn-sm" onClick={() => setCompose(true)}>
              <Plus size={14} aria-hidden="true" /> New message
            </button>
          }
        />

        <Toast message={toast} />

        <div className="bw-inbox">
          <div className="bw-inbox-list">
            <div className="bw-inbox-toolbar">
              <Segmented
                label="Filter"
                value={filter as "mine" | "unread" | "all"}
                onChange={(v) => set({ filter: v })}
                options={[
                  { value: "mine", label: "Mine" },
                  { value: "unread", label: "Unread" },
                  { value: "all", label: "All" },
                ]}
              />
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder="Search messages"
                label="Search messages"
              />
            </div>

            {list.error ? (
              <ErrorState message={list.error} onRetry={list.reload} compact />
            ) : list.loading && !list.data ? (
              <div className="bw-inbox-skel">
                <SkeletonBlock h={54} />
                <SkeletonBlock h={54} />
                <SkeletonBlock h={54} />
                <SkeletonBlock h={54} />
              </div>
            ) : threads.length === 0 ? (
              <EmptyState>
                {filter === "unread" ? "Nothing unread." : q ? `No threads match “${q}”.` : "No threads yet."}
              </EmptyState>
            ) : (
              <ul className="bw-inbox-threads">
                {threads.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={openId === t.id ? "bw-inbox-thread active" : "bw-inbox-thread"}
                      onClick={() => setOpenId(t.id)}
                    >
                      <span className="bw-inbox-thread-top">
                        <span className="bw-inbox-client">{t.client_name}</span>
                        <span className="bw-inbox-date">{fmtDate(t.updated)}</span>
                      </span>
                      <span className="bw-inbox-subject">{t.subject}</span>
                      <span className="bw-inbox-meta">
                        {t.staff_name ?? ""}
                        {t.unread_staff ? <span className="bw-unread-dot" aria-label="unread" /> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.data ? (
              <p className="bw-inbox-count bw-muted bw-small">
                {count(list.data.total)} {list.data.total === 1 ? "thread" : "threads"}
              </p>
            ) : null}
          </div>

          <div className="bw-inbox-convo" data-testid="staff-thread">
            {!openId ? (
              <div className="bw-inbox-placeholder">
                <p>Choose a thread to read the conversation.</p>
              </div>
            ) : thread.error ? (
              <ErrorState message={thread.error} onRetry={thread.reload} />
            ) : thread.loading && !thread.data ? (
              <div className="bw-inbox-skel">
                <SkeletonBlock h={40} />
                <SkeletonBlock h={90} />
                <SkeletonBlock h={90} />
              </div>
            ) : (
              <>
                <header className="bw-inbox-convo-head">
                  <div>
                    <h2 className="bw-inbox-convo-subject">{active?.subject}</h2>
                    <p className="bw-muted bw-small">
                      {active?.client_ref ? (
                        <Link to={`/staff/clients/${active.client_ref}?tab=messages`} className="bw-link">
                          {active.client_name}
                        </Link>
                      ) : (
                        active?.client_name
                      )}
                      {active?.staff_name ? ` · ${active.staff_name}` : ""}
                    </p>
                  </div>
                </header>

                <ul className="bw-convo">
                  {(thread.data?.messages ?? []).map((m) => {
                    const fromStaff = m.sender.startsWith("st-");
                    return (
                      <li key={m.id} className={fromStaff ? "bw-msg bw-msg-staff" : "bw-msg bw-msg-client"}>
                        <span className="bw-msg-who">
                          {m.sender_name ?? m.sender} · {fmtWhen(m.sent)}
                        </span>
                        <p className="bw-msg-body">{m.body}</p>
                      </li>
                    );
                  })}
                </ul>

                {sendError ? <ErrorState message={sendError} compact /> : null}

                <form className="bw-reply" onSubmit={send}>
                  <label className="bw-visually-hidden" htmlFor="staff-reply">
                    Reply
                  </label>
                  <textarea
                    id="staff-reply"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a reply…"
                  />
                  <button type="submit" className="bw-btn bw-btn-primary bw-btn-sm" disabled={sending || !body.trim()}>
                    <Send size={13} aria-hidden="true" /> {sending ? "Sending…" : "Send"}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        {compose && (
          <NewMessageDialog
            onClose={() => setCompose(false)}
            onSaved={(m) => {
              setToast(m);
              list.reload();
            }}
          />
        )}
      </div>
    </StaffLayout>
  );
}
