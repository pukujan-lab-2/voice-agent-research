import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useApi, useDebounced } from "@/hooks/useApi";
import {
  errorText,
  fieldErrors,
  staffGet,
  staffPost,
  type FoundClient,
  type StaffProfile,
} from "@/lib/practice";
import { Button, Field, FormErrorSummary, fieldAria } from "./ui";

/** A modal card: a scrim, Escape to close, focus moved to the first field. */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const first = ref.current?.querySelector<HTMLElement>("input, select, textarea, button");
    first?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <button className="bw-scrim" aria-label="Close" onClick={onClose} />
      <div
        className={wide ? "bw-modal bw-modal-wide" : "bw-modal"}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="bw-modal-head">
          <h2 className="bw-modal-title">{title}</h2>
          <button type="button" className="bw-icon-btn" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

/** A picker for a client, by name, over GET /api/staff/find. */
export function ClientPicker({
  id,
  value,
  onPick,
  placeholder = "Start typing a household or business",
  label = "Client",
}: {
  id: string;
  value: { id: string; label: string } | null;
  onPick: (client: { id: string; label: string } | null) => void;
  placeholder?: string;
  label?: string;
}) {
  const [text, setText] = useState(value?.label ?? "");
  const debounced = useDebounced(text, 250);
  const matches = useApi(
    () =>
      debounced.trim().length >= 2
        ? staffGet<{ matches: FoundClient[] }>("/find", { q: debounced.trim() })
        : Promise.resolve({ matches: [] as FoundClient[] }),
    [debounced],
  );

  // When the typed text exactly names one match, take it.
  useEffect(() => {
    const rows = matches.data?.matches ?? [];
    if (!text.trim()) return;
    const exact = rows.filter((m) => m.name.toLowerCase() === text.trim().toLowerCase());
    if (exact.length === 1 && value?.id !== exact[0].id) {
      onPick({ id: exact[0].id, label: exact[0].name });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches.data]);

  return (
    <div className="bw-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={id}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onPick(null);
        }}
        placeholder={placeholder}
        autoComplete="off"
      />
      {value ? (
        <p className="bw-picked">
          {value.label} <span className="bw-muted">· {value.id}</span>
        </p>
      ) : null}
      {!value && text.trim().length >= 2 && (matches.data?.matches?.length ?? 0) > 0 && (
        <div className="bw-matches">
          {(matches.data?.matches ?? []).slice(0, 6).map((m) => (
            <button
              key={m.id}
              type="button"
              className="bw-match"
              onClick={() => {
                setText(m.name);
                onPick({ id: m.id, label: m.name });
              }}
            >
              <span>{m.name}</span>
              <span className="bw-muted">
                {m.id}
                {m.city ? ` · ${m.city}` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NewTaskDialog({
  onClose,
  onSaved,
  clientRef,
  clientName,
}: {
  onClose: () => void;
  onSaved?: (message: string) => void;
  clientRef?: string;
  clientName?: string;
}) {
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("me");
  const [due, setDue] = useState("");
  const [priority, setPriority] = useState("normal");
  const [client, setClient] = useState<{ id: string; label: string } | null>(
    clientRef ? { id: clientRef, label: clientName ?? clientRef } : null,
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const staff = useApi(() => staffGet<{ staff: StaffProfile[] }>("/staff"), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      await staffPost<{ ok: boolean; id: string }>("/task", {
        title: title.trim(),
        assignee,
        client_ref: client?.id,
        due,
        priority,
      });
      onSaved?.("Task created.");
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New task" onClose={onClose}>
      <form onSubmit={submit} className="bw-form" noValidate>
        {formError && Object.keys(errors).length > 0 && <FormErrorSummary errors={errors} />}
        {formError && Object.keys(errors).length === 0 && (
          <p className="bw-inline-error" role="alert">
            {formError}
          </p>
        )}

        <Field label="Task" htmlFor="task_title" error={errors.title}>
          <input
            id="task_title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Chase the K-1 from Larkspur Holdings"
            {...fieldAria("task_title", errors.title)}
          />
        </Field>

        <div className="bw-form-row">
          <Field label="Assignee" htmlFor="task_assignee" error={errors.assignee}>
            <select
              id="task_assignee"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              {...fieldAria("task_assignee", errors.assignee)}
            >
              <option value="me">Me</option>
              {(staff.data?.staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due" htmlFor="task_due" error={errors.due}>
            <input
              id="task_due"
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              {...fieldAria("task_due", errors.due)}
            />
          </Field>

          <Field label="Priority" htmlFor="task_priority" error={errors.priority}>
            <select
              id="task_priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              {...fieldAria("task_priority", errors.priority)}
            >
              <option value="high">High</option>
              <option value="normal">Normal</option>
              <option value="low">Low</option>
            </select>
          </Field>
        </div>

        {!clientRef && (
          <ClientPicker id="task_client" label="Client (optional)" value={client} onPick={setClient} />
        )}

        <div className="bw-modal-foot">
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Creating…" : "Create task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function NewMessageDialog({
  onClose,
  onSaved,
  clientRef,
  clientName,
}: {
  onClose: () => void;
  onSaved?: (message: string) => void;
  clientRef?: string;
  clientName?: string;
}) {
  const [client, setClient] = useState<{ id: string; label: string } | null>(
    clientRef ? { id: clientRef, label: clientName ?? clientRef } : null,
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setFormError("");
    setSaving(true);
    try {
      await staffPost<{ ok: boolean; thread: string }>("/message", {
        client_ref: client?.id,
        subject: subject.trim(),
        body: body.trim(),
      });
      onSaved?.("Message sent.");
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setFormError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New message" onClose={onClose}>
      <form onSubmit={submit} className="bw-form" noValidate>
        {formError && Object.keys(errors).length > 0 && <FormErrorSummary errors={errors} />}
        {formError && Object.keys(errors).length === 0 && (
          <p className="bw-inline-error" role="alert">
            {formError}
          </p>
        )}

        {!clientRef && <ClientPicker id="msg_client" value={client} onPick={setClient} />}

        <Field label="Subject" htmlFor="msg_subject" error={errors.subject}>
          <input
            id="msg_subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Your 2025 return: two documents still needed"
            {...fieldAria("msg_subject", errors.subject)}
          />
        </Field>

        <Field label="Message" htmlFor="msg_body" error={errors.body}>
          <textarea
            id="msg_body"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write to the client…"
            {...fieldAria("msg_body", errors.body)}
          />
        </Field>

        <div className="bw-modal-foot">
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Sending…" : "Send message"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
