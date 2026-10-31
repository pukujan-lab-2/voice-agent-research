/**
 * The native building blocks every public form is made of: a labelled field, the state select, a radio group in a
 * fieldset, a checkbox group, the file field with its uploads, the error summary, the demo line and the
 * confirmation. Plain elements throughout, styled by site.css.
 */

import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Copy, Loader2, Upload, X } from "lucide-react";
import { errorText, uploadSiteFile, type SubmitResult } from "@/lib/practice";

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" }, { code: "AK", name: "Alaska" }, { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" }, { code: "CA", name: "California" }, { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" }, { code: "DE", name: "Delaware" }, { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" }, { code: "GA", name: "Georgia" }, { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" }, { code: "IL", name: "Illinois" }, { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" }, { code: "KS", name: "Kansas" }, { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" }, { code: "ME", name: "Maine" }, { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" }, { code: "MI", name: "Michigan" }, { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" }, { code: "MO", name: "Missouri" }, { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" }, { code: "NV", name: "Nevada" }, { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" }, { code: "NM", name: "New Mexico" }, { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" }, { code: "ND", name: "North Dakota" }, { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" }, { code: "OR", name: "Oregon" }, { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" }, { code: "SC", name: "South Carolina" }, { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" }, { code: "TX", name: "Texas" }, { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" }, { code: "VA", name: "Virginia" }, { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" }, { code: "WI", name: "Wisconsin" }, { code: "WY", name: "Wyoming" },
];

/** One labelled field, with its hint and its 422 message. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
  optional,
  as = "div",
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  optional?: boolean;
  /** `fieldset` for a group of controls, so its legend is the label. */
  as?: "div" | "fieldset";
}) {
  const Wrap = as;
  return (
    <Wrap className="tax-field">
      {as === "fieldset" ? (
        <legend>{label}</legend>
      ) : (
        <label htmlFor={id}>
          {label}
          {optional && <span className="tax-muted" style={{ fontWeight: 400 }}> (optional)</span>}
        </label>
      )}
      {children}
      {hint && !error && <p className="tax-hint">{hint}</p>}
      {error && (
        <p className="tax-error" id={`${id}-error`} role="alert">
          {error}
        </p>
      )}
    </Wrap>
  );
}

interface BaseProps {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  optional?: boolean;
  placeholder?: string;
  autoComplete?: string;
  ask?: string;
  spell?: boolean;
  kind?: "code" | "future";
  pattern?: string;
  title?: string;
  minLength?: number;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "email";
  type?: "text" | "email" | "tel" | "date" | "number";
}

/** A text-like input: the common shape of every non-select field. */
export function TextField({ type = "text", ask, spell, kind, ...p }: BaseProps) {
  const invalid = Boolean(p.error);
  return (
    <Field id={p.id} label={p.label} hint={p.hint} error={p.error} optional={p.optional}>
      <input
        id={p.id}
        name={p.name}
        type={type}
        required={p.required}
        placeholder={p.placeholder}
        autoComplete={p.autoComplete}
        pattern={p.pattern}
        title={p.title}
        minLength={p.minLength}
        inputMode={p.inputMode}
        data-copilot-ask={ask}
        data-copilot-spell={spell ? "" : undefined}
        data-copilot-kind={kind}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${p.id}-error` : undefined}
      />
    </Field>
  );
}

/** The state select, one option per state and DC. */
export function StateSelect({
  id,
  name,
  label = "State",
  error,
  ask,
  optional,
}: {
  id: string;
  name: string;
  label?: string;
  error?: string;
  ask?: string;
  optional?: boolean;
}) {
  return (
    <Field id={id} label={label} error={error} optional={optional}>
      <select
        id={id}
        name={name}
        required={!optional}
        data-copilot-ask={ask}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="">Choose a state</option>
        {US_STATES.map((s) => (
          <option key={s.code} value={s.code} data-copilot-also={`${s.name.toLowerCase()}, ${s.code.toLowerCase()}`}>
            {s.name}
          </option>
        ))}
      </select>
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
  also?: string;
  /** The control's own id, when the page names it rather than deriving it from the group prefix. */
  id?: string;
}

/** A select with its placeholder. */
export function SelectField({
  id,
  name,
  label,
  options,
  placeholder = "Choose one",
  placeholderAlso,
  required,
  optional,
  error,
  ask,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  options: Option[];
  placeholder?: string;
  placeholderAlso?: string;
  required?: boolean;
  optional?: boolean;
  error?: string;
  ask?: string;
  hint?: string;
}) {
  return (
    <Field id={id} label={label} hint={hint} error={error} optional={optional}>
      <select
        id={id}
        name={name}
        required={required}
        data-copilot-ask={ask}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      >
        <option value="" data-copilot-also={placeholderAlso}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value} data-copilot-also={o.also}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/** One radio inside a `RadioSet`, named by its own literal id so the copilot can point at it. */
export function Radio({
  id,
  name,
  value,
  label,
  also,
  required = true,
}: {
  id: string;
  name: string;
  value: string;
  label: string;
  also?: string;
  required?: boolean;
}) {
  return (
    <label className="tax-radio" htmlFor={id}>
      <input id={id} name={name} type="radio" value={value} required={required} data-copilot-also={also} />
      <span>{label}</span>
    </label>
  );
}

/** The fieldset around a group of `Radio`s, with its legend and its 422 message. */
export function RadioSet({
  legend,
  ask,
  error,
  errorId,
  columns,
  children,
}: {
  legend: string;
  ask?: string;
  error?: string;
  errorId: string;
  columns?: boolean;
  children: ReactNode;
}) {
  return (
    <fieldset
      className="tax-field"
      data-copilot-ask={ask}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? errorId : undefined}
    >
      <legend>{legend}</legend>
      <div
        className="tax-radio-grid"
        style={columns ? { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 12rem), 1fr))" } : undefined}
      >
        {children}
      </div>
      {error && (
        <p className="tax-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

/** A checkbox group inside a fieldset, sent as an array. */
export function CheckboxGroup({
  legend,
  name,
  options,
  idPrefix,
  ask,
}: {
  legend: string;
  name: string;
  options: Option[];
  idPrefix: string;
  ask?: string;
}) {
  return (
    <fieldset className="tax-field" data-checkbox-group data-copilot-ask={ask}>
      <legend>{legend}</legend>
      <div className="tax-check-grid">
        {options.map((o) => {
          const inputId = o.id ?? `${idPrefix}_${o.value}`;
          return (
            <label className="tax-check" key={o.value} htmlFor={inputId}>
              <input
                id={inputId}
                name={name}
                type="checkbox"
                value={o.value}
                data-copilot-also={o.also}
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The notes field: optional everywhere it appears. */
export function NotesField({
  id,
  name = "notes",
  label = "Notes",
  ask,
}: {
  id: string;
  name?: string;
  label?: string;
  ask?: string;
}) {
  return (
    <Field id={id} label={label} optional>
      <textarea
        id={id}
        name={name}
        rows={3}
        data-copilot-ask={ask ?? "Anything else we should know? Say none if not."}
      />
    </Field>
  );
}

/** The 422 summary at the top of a form: each message a link that focuses its field. */
export function ErrorSummary({ errors }: { errors: Record<string, string> }) {
  const entries = Object.entries(errors);
  if (!entries.length) return null;
  return (
    <div className="tax-form-errors" data-testid="form-errors" role="alert" tabIndex={-1}>
      <h2>Some details need a second look</h2>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <a
              href={`#${field}`}
              onClick={(e) => {
                e.preventDefault();
                const el = document.querySelector<HTMLElement>(`[name="${CSS.escape(field)}"]`);
                el?.focus();
                el?.scrollIntoView({ block: "center", behavior: "smooth" });
              }}
            >
              {message}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The line beside every submit button. */
export function DemoLine() {
  return (
    <p className="tax-form-note">
      Demo: this saves a sample record in the demo database. Don't enter real personal or tax information.
    </p>
  );
}

export function DraftNote({ saved }: { saved: boolean }) {
  if (!saved) return null;
  return (
    <span className="tax-draft-note" data-testid="draft-saved">
      <Check size={13} aria-hidden="true" /> Draft saved
    </span>
  );
}

/** A file field: each chosen file uploads at once, with its progress and a remove button. */
export function UploadField({
  id,
  label,
  form,
  accept,
  multiple,
  onUploaded,
  error,
  hint,
}: {
  id: string;
  label: string;
  form: string;
  accept: string;
  multiple?: boolean;
  onUploaded: (ids: string[]) => void;
  error?: string;
  hint?: string;
}) {
  const [rows, setRows] = useState<{ key: string; name: string; progress: number; id?: string; error?: string }[]>([]);

  const start = (files: FileList | null) => {
    if (!files?.length) return;
    const chosen = Array.from(files).slice(0, multiple ? 10 : 1);
    const keys = chosen.map((f, i) => `${Date.now()}-${i}-${f.name}`);
    setRows((prev) => [...prev, ...chosen.map((f, i) => ({ key: keys[i], name: f.name, progress: 0 }))]);
    chosen.forEach((file, i) => {
      uploadSiteFile(file, form, (fraction) =>
        setRows((prev) => prev.map((r) => (r.key === keys[i] ? { ...r, progress: fraction } : r))),
      )
        .then((res) => {
          setRows((prev) => {
            const next = prev.map((r) => (r.key === keys[i] ? { ...r, progress: 1, id: res.id } : r));
            onUploaded(next.map((r) => r.id).filter((v): v is string => Boolean(v)));
            return next;
          });
        })
        .catch((err) => {
          setRows((prev) => prev.map((r) => (r.key === keys[i] ? { ...r, error: errorText(err) } : r)));
        });
    });
  };

  const remove = (key: string) => {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      onUploaded(next.map((r) => r.id).filter((v): v is string => Boolean(v)));
      return next;
    });
  };

  return (
    <Field id={id} label={label} hint={hint} error={error} optional>
      <input
        id={id}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => {
          start(e.target.files);
          e.target.value = "";
        }}
      />
      {rows.length > 0 && (
        <div className="tax-upload-list">
          {rows.map((r) => (
            <div className="tax-upload-row" key={r.key}>
              <Upload size={12} aria-hidden="true" />
              <span className="name">{r.name}</span>
              {r.error ? (
                <span className="tax-upload-error">{r.error}</span>
              ) : r.id ? (
                <Check size={13} aria-hidden="true" style={{ color: "hsl(155 45% 34%)" }} />
              ) : (
                <span className="tax-upload-bar" data-testid="upload-progress">
                  <span style={{ width: `${Math.round(r.progress * 100)}%` }} />
                </span>
              )}
              <button type="button" aria-label={`Remove ${r.name}`} onClick={() => remove(r.key)}>
                {r.id || r.error ? <X size={13} /> : <Loader2 size={13} className="tax-spin" />}
              </button>
            </div>
          ))}
        </div>
      )}
    </Field>
  );
}

/** The success panel: a tick, the API's message, the reference, what happens next and the way back. */
export function Confirmation({
  result,
  next,
  links,
  children,
}: {
  result: SubmitResult;
  next: string[];
  links: { to: string; label: string }[];
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.ref);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* the number is on screen either way */
    }
  };

  return (
    <div className="tax-form-confirm" data-testid="form-confirmation" role="status">
      <span className="tick">
        <Check size={22} aria-hidden="true" />
      </span>
      <h2>{result.message || "Thank you. We have it."}</h2>
      <p className="tax-small tax-muted">Your reference</p>
      <div className="tax-ref">
        <span data-testid="form-ref">{result.ref}</span>
        <button type="button" onClick={copy} aria-label="Copy the reference number" title="Copy">
          {copied ? <Check size={15} /> : <Copy size={15} />}
        </button>
      </div>
      {children}
      <ul className="tax-confirm-next">
        {next.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="tax-btn-row">
        {links.map((l) => (
          <Link key={l.to} to={l.to} className="tax-btn tax-btn-outline">
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
