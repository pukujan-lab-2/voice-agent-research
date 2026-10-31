import { useState } from "react";
import { ArrowLeft, Plus, Send } from "lucide-react";
import { PortalLayout, SampleNote } from "@/components/portal/PortalLayout";
import { PortalCard, PortalEmpty, PortalError, PortalHead, PortalSkeleton } from "@/components/portal/ui";
import { useApi } from "@/hooks/useApi";
import {
  errorText,
  fmtDate,
  fmtWhen,
  portalGet,
  portalPost,
  type Message,
  type PortalThread,
} from "@/lib/practice";

export default function PortalMessages() {
  const threads = useApi(() => portalGet<{ threads: PortalThread[] }>("/messages"), []);
  const [openId, setOpenId] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [compose, setCompose] = useState(false);
  const [subject, setSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const thread = useApi(
    () => (openId ? portalGet<{ thread: PortalThread; messages: Message[] }>("/thread", { id: openId }) : Promise.resolve(null)),
    [openId],
  );

  const list = threads.data?.threads ?? [];
  const active = thread.data?.thread ?? list.find((t) => t.id === openId) ?? null;

  const reply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!body.trim() || !openId) return;
    setSending(true);
    setSendError("");
    try {
      await portalPost("/message", { thread: openId, body: body.trim() });
      setBody("");
      thread.reload();
      threads.reload();
    } catch (err) {
      setSendError(errorText(err));
    } finally {
      setSending(false);
    }
  };

  const startThread = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError("");
    try {
      const res = await portalPost<{ ok: boolean; thread: string }>("/message", {
        subject: subject.trim(),
        body: newBody.trim(),
      });
      setCompose(false);
      setSubject("");
      setNewBody("");
      threads.reload();
      setOpenId(res.thread);
    } catch (err) {
      setCreateError(errorText(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <PortalLayout title="Messages">
      <div className="pt-page" data-testid="portal-messages">
        <PortalHead
          title="Messages"
          subtitle="Write to your preparer, securely, and read their replies."
          actions={
            <button type="button" className="pt-btn pt-btn-primary pt-btn-sm" onClick={() => setCompose(true)}>
              <Plus size={14} aria-hidden="true" /> New message
            </button>
          }
        />

        {threads.error ? <PortalError message={threads.error} onRetry={threads.reload} /> : null}

        {compose && (
          <PortalCard>
            <div className="pt-card-head">
              <h2 className="pt-card-title">New message</h2>
              <button type="button" className="pt-link" onClick={() => setCompose(false)}>
                Cancel
              </button>
            </div>
            {createError ? <PortalError message={createError} /> : null}
            <form className="pt-compose" onSubmit={startThread}>
              <label htmlFor="pt-subject">Subject</label>
              <input
                id="pt-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Question about my 2025 return"
                required
              />
              <label htmlFor="pt-new-body">Message</label>
              <textarea
                id="pt-new-body"
                rows={4}
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                placeholder="Write your message…"
                required
              />
              <button type="submit" className="pt-btn pt-btn-primary pt-btn-sm" disabled={creating}>
                {creating ? "Sending…" : "Send message"}
              </button>
            </form>
          </PortalCard>
        )}

        {!openId ? (
          <PortalCard>
            <div className="pt-card-head">
              <h2 className="pt-card-title">Conversations</h2>
            </div>
            {!threads.data && threads.loading ? (
              <PortalSkeleton rows={3} />
            ) : list.length === 0 ? (
              <PortalEmpty>No messages yet. Write to your preparer any time.</PortalEmpty>
            ) : (
              <ul className="pt-threads">
                {list.map((t) => (
                  <li key={t.id}>
                    <button type="button" className="pt-thread" onClick={() => setOpenId(t.id)}>
                      <span className="pt-thread-top">
                        <span className="pt-thread-subject">{t.subject}</span>
                        <span className="pt-thread-date">{fmtDate(t.updated)}</span>
                      </span>
                      <span className="pt-thread-meta">
                        {t.staff_name ? `With ${t.staff_name}` : ""}
                        {t.unread_client ? <span className="pt-unread" aria-label="unread" /> : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </PortalCard>
        ) : (
          <PortalCard>
            <div className="pt-card-head">
              <button type="button" className="pt-back" onClick={() => setOpenId("")}>
                <ArrowLeft size={14} aria-hidden="true" /> All messages
              </button>
            </div>

            {thread.error ? (
              <PortalError message={thread.error} onRetry={thread.reload} />
            ) : thread.loading && !thread.data ? (
              <PortalSkeleton rows={4} />
            ) : (
              <>
                <h2 className="pt-thread-title">{active?.subject}</h2>
                {active?.staff_name ? <p className="pt-thread-with">With {active.staff_name}</p> : null}

                <ul className="pt-convo">
                  {(thread.data?.messages ?? []).map((m) => {
                    const fromStaff = m.sender.startsWith("st-");
                    return (
                      <li key={m.id} className={fromStaff ? "pt-msg pt-msg-staff" : "pt-msg pt-msg-me"}>
                        <span className="pt-msg-who">
                          {fromStaff ? (m.sender_name ?? "Brindlewick") : "You"} · {fmtWhen(m.sent)}
                        </span>
                        <p className="pt-msg-body">{m.body}</p>
                      </li>
                    );
                  })}
                </ul>

                {sendError ? <PortalError message={sendError} /> : null}

                <form className="pt-reply" onSubmit={reply}>
                  <label htmlFor="pt-reply" className="pt-visually-hidden">
                    Reply
                  </label>
                  <textarea
                    id="pt-reply"
                    rows={3}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Write a reply…"
                  />
                  <button type="submit" className="pt-btn pt-btn-primary pt-btn-sm" disabled={sending || !body.trim()}>
                    <Send size={13} aria-hidden="true" /> {sending ? "Sending…" : "Send"}
                  </button>
                </form>
              </>
            )}
          </PortalCard>
        )}

        <SampleNote />
      </div>
    </PortalLayout>
  );
}
