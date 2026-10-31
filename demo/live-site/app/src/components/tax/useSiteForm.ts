/**
 * The behaviour every public form shares: save a draft while it is being filled, submit it once, show the API's
 * per-field messages under the fields and in a summary at the top, and swap the form for a confirmation carrying
 * the reference number.
 *
 * Fields are uncontrolled native elements, so the draft and the submit both read the form itself: every field by
 * its `name`, a checkbox group as an array, and anything a page adds by hand (upload ids) through `extra`.
 */

import { useCallback, useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import {
  fieldErrors,
  PracticeError,
  saveFormDraft,
  submitSiteForm,
  errorText,
  type SubmitResult,
} from "@/lib/practice";

export interface SiteFormState {
  formRef: RefObject<HTMLFormElement>;
  submitting: boolean;
  /** 422 messages, by field name. */
  errors: Record<string, string>;
  /** A 429 or a network failure: one line above the button. */
  general: string;
  /** A 409: the chosen time was taken while the form was open. */
  conflict: string;
  confirmation: SubmitResult | null;
  draftSaved: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  /** Read the form's values by name, with checkbox groups as arrays. */
  collect: () => Record<string, unknown>;
  /** Values a page keeps outside the form: upload ids, and anything computed. */
  extra: RefObject<Record<string, unknown>>;
  reset: () => void;
}

function readForm(form: HTMLFormElement): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  const elements = Array.from(form.elements) as (HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement)[];
  for (const el of elements) {
    const name = el.getAttribute("name");
    if (!name) continue;
    if (el instanceof HTMLInputElement && (el.type === "file" || el.type === "submit" || el.type === "button")) continue;
    if (el instanceof HTMLInputElement && el.type === "checkbox") {
      if (el.type === "checkbox" && el.closest("[data-checkbox-group]")) {
        const list = (data[name] as string[] | undefined) ?? [];
        if (el.checked) list.push(el.value);
        data[name] = list;
      } else {
        data[name] = el.checked;
      }
      continue;
    }
    if (el instanceof HTMLInputElement && el.type === "radio") {
      if (el.checked) data[name] = el.value;
      else if (!(name in data)) data[name] = "";
      continue;
    }
    data[name] = el.value;
  }
  return data;
}

const DRAFT_KEY = (form: string) => `bw-draft:${form}`;

function readDraftId(form: string): string {
  try {
    return sessionStorage.getItem(DRAFT_KEY(form)) ?? "";
  } catch {
    return "";
  }
}

function writeDraftId(form: string, id: string) {
  try {
    if (id) sessionStorage.setItem(DRAFT_KEY(form), id);
    else sessionStorage.removeItem(DRAFT_KEY(form));
  } catch {
    /* private mode */
  }
}

export function useSiteForm(
  form: string,
  options: { conflictField?: string; onDone?: (result: SubmitResult) => void } = {},
): SiteFormState {
  const formRef = useRef<HTMLFormElement>(null);
  const extra = useRef<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState("");
  const [conflict, setConflict] = useState("");
  const [confirmation, setConfirmation] = useState<SubmitResult | null>(null);
  const [draftSaved, setDraftSaved] = useState(false);

  const collect = useCallback(() => {
    const el = formRef.current;
    return el ? readForm(el) : {};
  }, []);

  // A draft at most every three seconds, and only when something changed since the last one.
  const dirty = useRef(false);
  const draftId = useRef<string>(readDraftId(form));

  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const mark = () => {
      dirty.current = true;
    };
    el.addEventListener("input", mark);
    el.addEventListener("change", mark);
    return () => {
      el.removeEventListener("input", mark);
      el.removeEventListener("change", mark);
    };
  }, [form]);

  useEffect(() => {
    if (confirmation) return;
    const timer = window.setInterval(() => {
      const el = formRef.current;
      if (!el || !dirty.current) return;
      const data = { ...readForm(el), ...extra.current };
      const empty = Object.values(data).every(
        (v) => v === "" || v === null || v === undefined || (Array.isArray(v) && v.length === 0) || v === false,
      );
      if (empty) return;
      dirty.current = false;
      saveFormDraft(form, draftId.current, data)
        .then((res) => {
          draftId.current = res.id;
          writeDraftId(form, res.id);
          setDraftSaved(true);
        })
        .catch(() => {
          /* a draft that can't be saved is not worth interrupting anyone over */
        });
    }, 3000);
    return () => window.clearInterval(timer);
  }, [form, confirmation]);

  const reset = useCallback(() => {
    setErrors({});
    setGeneral("");
    setConflict("");
    setConfirmation(null);
  }, []);

  const onSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const el = e.currentTarget;
      if (!el.reportValidity()) {
        el.classList.add("attempted");
        return;
      }
      setSubmitting(true);
      setErrors({});
      setGeneral("");
      setConflict("");
      const data = { ...readForm(el), ...extra.current };
      submitSiteForm(form, data, draftId.current)
        .then((result) => {
          writeDraftId(form, "");
          draftId.current = "";
          setConfirmation(result);
          options.onDone?.(result);
        })
        .catch((err) => {
          if (err instanceof PracticeError) {
            if (err.status === 422) {
              setErrors(err.errors ?? {});
              setGeneral(err.errors ? "" : errorText(err));
            } else if (err.status === 409) {
              setConflict(errorText(err));
            } else {
              setGeneral(errorText(err));
            }
          } else {
            setGeneral(errorText(err));
          }
        })
        .finally(() => setSubmitting(false));
    },
    [form, options],
  );

  // Field messages clear as the field is corrected.
  useEffect(() => {
    const el = formRef.current;
    if (!el) return;
    const clear = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const name = target?.getAttribute?.("name");
      if (!name) return;
      setErrors((prev) => {
        if (!(name in prev)) return prev;
        const next = { ...prev };
        delete next[name];
        return next;
      });
    };
    el.addEventListener("input", clear);
    el.addEventListener("change", clear);
    return () => {
      el.removeEventListener("input", clear);
      el.removeEventListener("change", clear);
    };
  }, [form]);

  return {
    formRef,
    submitting,
    errors,
    general,
    conflict,
    confirmation,
    draftSaved,
    onSubmit,
    collect,
    extra,
    reset,
  };
}
