/**
 * The Brindlewick practice API: one small typed client for the staff app (/staff) and the client portal
 * (/tax/portal). Every screen reads and writes through here. There is no mock data in the app: while a request
 * runs a page shows skeleton rows, when it fails it shows the API's own error text with a Retry, and when a list
 * is empty it shows a short empty state.
 *
 * Sessions live in sessionStorage. A 401 clears the token and hands control back to the app, which returns to
 * that app's sign-in page.
 */

/* ============================================================
   Session
   ============================================================ */

const STAFF_TOKEN_KEY = "bw-staff-token";
const PORTAL_TOKEN_KEY = "bw-portal-token";

function readSession(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* private mode: the session just won't persist */
  }
}

function dropSession(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    /* private mode */
  }
}

export const getStaffToken = () => readSession(STAFF_TOKEN_KEY);
export const setStaffToken = (token: string) => writeSession(STAFF_TOKEN_KEY, token);
export const clearStaffToken = () => dropSession(STAFF_TOKEN_KEY);

export const getPortalToken = () => readSession(PORTAL_TOKEN_KEY);
export const setPortalToken = (token: string) => writeSession(PORTAL_TOKEN_KEY, token);
export const clearPortalToken = () => dropSession(PORTAL_TOKEN_KEY);

let staffExpired: (() => void) | null = null;
let portalExpired: (() => void) | null = null;

/** The shell registers these so an expired session returns to sign-in without reloading the page. */
export function setStaffExpiredHandler(fn: (() => void) | null) {
  staffExpired = fn;
}
export function setPortalExpiredHandler(fn: (() => void) | null) {
  portalExpired = fn;
}

/** The five demo staff the sign-in page offers (the staff list itself needs a session). */
export const DEMO_STAFF = [
  { id: "st-mva", name: "Marisol Ventura-Akande", title: "Managing Partner" },
  { id: "st-dwh", name: "Desmond Whitlow", title: "Partner, Business Tax" },
  { id: "st-pra", name: "Priya Raghunathan", title: "Tax Manager" },
  { id: "st-hna", name: "Hana Nakashima", title: "Senior Accountant" },
  { id: "st-ivo", name: "Ines Vogel-Abara", title: "Staff Accountant" },
];

/* ============================================================
   Errors
   ============================================================ */

export class PracticeError extends Error {
  status: number;
  /** A 422's per-field messages. */
  errors?: Record<string, string>;

  constructor(status: number, message: string, errors?: Record<string, string>) {
    super(message);
    this.name = "PracticeError";
    this.status = status;
    this.errors = errors;
  }
}

/** A calm sentence for an inline error message: the API's own text where it gave one. */
export function errorText(e: unknown): string {
  if (e instanceof PracticeError) {
    if (e.status === 422 && e.errors) {
      const first = Object.values(e.errors)[0];
      if (first) return first;
    }
    return e.message;
  }
  if (e instanceof Error && e.message) return e.message;
  return "The practice API couldn't be reached.";
}

export function fieldErrors(e: unknown): Record<string, string> {
  return e instanceof PracticeError && e.errors ? e.errors : {};
}

/* ============================================================
   Transport
   ============================================================ */

export type Query = Record<string, string | number | boolean | undefined | null>;

function queryString(params?: Query): string {
  if (!params) return "";
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === false) continue;
    search.set(key, value === true ? "1" : String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

interface CallOptions {
  token?: string;
  method?: "GET" | "POST";
  body?: unknown;
  /** Raw request body (a file upload) instead of JSON. */
  raw?: Blob;
}

async function call<T>(path: string, options: CallOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  let body: BodyInit | undefined;
  if (options.raw) body = options.raw;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(path, { method: options.method ?? "GET", headers, body });
  } catch {
    throw new PracticeError(0, "The practice API couldn't be reached. Check your connection and try again.");
  }

  let json: unknown = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  if (response.ok) return json as T;

  const payload = (json ?? {}) as { error?: unknown; errors?: Record<string, string> };
  const message =
    typeof payload.error === "string" && payload.error !== "invalid"
      ? payload.error
      : response.status === 429
        ? "That's a lot of requests at once. Wait a moment and try again."
        : `The practice API answered ${response.status}.`;
  throw new PracticeError(response.status, message, payload.errors);
}

function staffRequest<T>(
  path: string,
  options: CallOptions & { params?: Query } = {},
): Promise<T> {
  const token = getStaffToken();
  const { params, ...rest } = options;
  return call<T>(`/api/staff${path}${queryString(params)}`, { ...rest, token }).catch((e) => {
    if (e instanceof PracticeError && e.status === 401) {
      clearStaffToken();
      staffExpired?.();
    }
    throw e;
  });
}

function portalRequest<T>(
  path: string,
  options: CallOptions & { params?: Query } = {},
): Promise<T> {
  const token = getPortalToken();
  const { params, ...rest } = options;
  return call<T>(`/api/portal${path}${queryString(params)}`, { ...rest, token }).catch((e) => {
    if (e instanceof PracticeError && e.status === 401) {
      clearPortalToken();
      portalExpired?.();
    }
    throw e;
  });
}

export const staffGet = <T,>(path: string, params?: Query) => staffRequest<T>(path, { params });
export const staffPost = <T,>(path: string, body: unknown) =>
  staffRequest<T>(path, { method: "POST", body });

export const portalGet = <T,>(path: string, params?: Query) => portalRequest<T>(path, { params });
export const portalPost = <T,>(path: string, body: unknown) =>
  portalRequest<T>(path, { method: "POST", body });

/* ---------- sign in ---------- */

export interface SessionStaff {
  id: string;
  name: string;
  title: string;
}

export async function staffSignIn(staffId?: string) {
  const json = await call<{ ok: boolean; token: string; staff: SessionStaff }>("/api/staff/session", {
    method: "POST",
    body: staffId ? { staff: staffId } : {},
  });
  setStaffToken(json.token);
  return json;
}

export interface PortalSession {
  ok: boolean;
  token: string;
  household: string;
  firstName: string;
  sample: boolean;
}

export async function portalSignIn(body: { demo?: true; call?: string }) {
  const json = await call<PortalSession>("/api/portal/session", { method: "POST", body });
  setPortalToken(json.token);
  return json;
}

/* ---------- the portal's one upload ---------- */

export async function uploadPortalFile(file: File, documentId: string) {
  const token = getPortalToken();
  const path = `/api/files?name=${encodeURIComponent(file.name)}&form=portal&document=${encodeURIComponent(documentId)}`;
  return call<{ ok: boolean; id: string; name: string; sizeKb: number }>(path, {
    method: "POST",
    token,
    raw: file,
  }).catch((e) => {
    if (e instanceof PracticeError && e.status === 401) {
      clearPortalToken();
      portalExpired?.();
    }
    throw e;
  });
}

/* ============================================================
   Shared vocabulary
   ============================================================ */

export const STAGES = [
  { id: "organizer_sent", label: "Organizer sent" },
  { id: "docs_in", label: "Documents in" },
  { id: "in_prep", label: "In preparation" },
  { id: "review", label: "In review" },
  { id: "efiled", label: "E-filed" },
  { id: "accepted", label: "Accepted" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

export function stageLabel(id: string | null | undefined): string {
  if (!id) return "—";
  return STAGES.find((s) => s.id === id)?.label ?? id;
}

/** The six stages in plain words, for the portal's progress tracker. */
export const STAGES_PLAIN = [
  "We sent your organizer",
  "We have your documents",
  "We're preparing your return",
  "In review",
  "E-filed",
  "Accepted by the IRS",
];

export function stageIndex(stage: string | null | undefined): number {
  const i = STAGES.findIndex((s) => s.id === stage);
  return i < 0 ? 0 : i;
}

export const PRIORITIES = ["high", "normal", "low"] as const;

export const NOTICE_STATUSES = [
  "open",
  "new",
  "in progress",
  "waiting on IRS",
  "response sent",
  "resolved",
];

/* ============================================================
   Formatting
   ============================================================ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-11-02T00:00:00.000Z" -> "Nov 2, 2026". The date part only, so no time-zone shift. */
export function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

/** "Nov 2" — for a tight column. */
export function fmtDayMonth(iso?: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** "Monday, November 2" for a page heading. */
export function fmtLongDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][
    d.getUTCDay()
  ];
  return `${weekday}, ${MONTHS_LONG[Number(m[2]) - 1]} ${Number(m[3])}`;
}

/** The hours and minutes in an ISO timestamp, read as written (no time-zone shift). */
export function timeParts(iso?: string | null): { h: number; m: number } | null {
  if (!iso) return null;
  const m = /T(\d{2}):(\d{2})/.exec(iso);
  if (!m) return null;
  return { h: Number(m[1]), m: Number(m[2]) };
}

/** "9:00 AM". */
export function fmtTime(iso?: string | null): string {
  const t = timeParts(iso);
  if (!t) return "";
  const hour = t.h % 12 || 12;
  return `${hour}:${String(t.m).padStart(2, "0")} ${t.h >= 12 ? "PM" : "AM"}`;
}

/** "Nov 2, 2026 · 9:00 AM" for an appointment. */
export function fmtWhen(iso?: string | null): string {
  if (!iso) return "—";
  const time = fmtTime(iso);
  return time ? `${fmtDate(iso)} · ${time}` : fmtDate(iso);
}

/** The date part of an ISO string, for comparing days without a time zone. */
export function datePart(iso?: string | null): string {
  return (iso ?? "").slice(0, 10);
}

/** Today as YYYY-MM-DD in the viewer's own time zone. */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday of the week containing `iso`. */
export function mondayOf(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const offset = (d.getUTCDay() + 6) % 7;
  return addDaysISO(iso, -offset);
}

/** Whole days from today to `iso` (negative when past). */
export function daysUntil(iso?: string | null): number | null {
  const day = datePart(iso);
  if (!day) return null;
  const a = Date.parse(`${day}T00:00:00Z`);
  const b = Date.parse(`${todayISO()}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((a - b) / 86_400_000);
}

/** Cents (or an already-formatted string) as "$1,234.00". */
export function usd(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("$")) return trimmed;
    if (/^-?[\d,]+(\.\d+)?$/.test(trimmed)) {
      const n = Number(trimmed.replace(/,/g, ""));
      if (!Number.isNaN(n)) return usd(n);
    }
    return trimmed;
  }
  if (Number.isNaN(value)) return "—";
  const negative = value < 0;
  const amount = Math.abs(value) / 100;
  const text = amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${negative ? "−" : ""}$${text}`;
}

/** A count the API sent as a string, with thousands separators. */
export function count(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "0";
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  if (Number.isNaN(n)) return String(value);
  return n.toLocaleString("en-US");
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return n === 1 ? one : many;
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function firstName(name?: string | null): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** "gross_cents" -> "Gross"; "period_start" -> "Period start". */
export function humanize(key: string): string {
  const words = key.replace(/_cents$/, "").replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A readable value for an unknown field of a website submission. */
export function readableValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(readableValue).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/* ============================================================
   Types
   ============================================================ */

export interface Paged<T> {
  rows: T[];
  page: number;
  size: number;
  total: number;
  pages: number;
}

export interface StaffProfile {
  id: string;
  name: string;
  title: string;
  credentials?: string | null;
  role?: string | null;
  office?: string | null;
  avatar?: string | null;
}

export interface Appointment {
  id: string;
  starts: string;
  minutes: number;
  kind: string;
  mode: string;
  client_name?: string;
  client_ref?: string;
  staff_id?: string;
  staff_name?: string;
  status?: string;
  location?: string | null;
  notes?: string | null;
}

export interface QueueRow {
  id: string;
  client_ref: string;
  client_name: string;
  form: string;
  tax_year: number | string;
  stage: string;
  due: string | null;
  priority?: string;
  preparer_name?: string;
  days_late?: number;
  missing?: number;
}

export interface DashboardData {
  counts: {
    households: string | number;
    businesses: string | number;
    people: string | number;
    open_engagements: string | number;
    overdue: string | number;
    docs_requested: string | number;
    new_submissions: string | number;
  };
  pipeline: { stage: string; label: string; n: number }[];
  tasks: { open: number; late: number };
  notices: { due_week: number; past_due: number };
  appointments: Appointment[];
  unread: number;
  billing: { overdue: number | string; collectedThisMonth: number | string };
  queue: QueueRow[];
}

export interface ClientRow {
  id: string;
  kind: string;
  name: string;
  city?: string | null;
  state?: string | null;
  preparer?: string | null;
  preparer_name?: string | null;
  office?: string | null;
  since?: string | null;
  tags?: string[] | null;
  industry?: string | null;
  detail?: string | null;
  people?: number | string | null;
  stage?: string | null;
  next_due?: string | null;
}

export interface ClientRecord {
  id: string;
  kind: string;
  name: string;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  email?: string | null;
  phone?: string | null;
  preparer?: string | null;
  preparer_name?: string | null;
  office?: string | null;
  since?: string | null;
  tags?: string[] | null;
  industry?: string | null;
  detail?: string | null;
  filing_status?: string | null;
  dependents?: number | string | null;
  ein?: string | null;
  entity?: string | null;
  employees?: number | string | null;
  fiscal_year_end?: string | null;
  owner?: string | null;
  stage?: string | null;
  next_due?: string | null;
  people?: number | string | null;
  notes?: string | null;
  [key: string]: unknown;
}

export interface EngagementRow {
  id: string;
  client_kind: string;
  client_ref: string;
  client_name: string;
  kind: string;
  form: string;
  tax_year: number | string;
  stage: string;
  preparer: string;
  preparer_name: string;
  reviewer?: string | null;
  due: string | null;
  extended?: boolean | string | null;
  fee_cents?: number | null;
  refund_cents?: number | null;
  balance_cents?: number | null;
  priority?: string | null;
  updated?: string | null;
  missing?: number | null;
}

export interface ClientDetail {
  kind: string;
  client: ClientRecord;
  people: {
    id?: string;
    first_name?: string;
    full_name?: string;
    name?: string;
    relation?: string;
    age?: number | null;
    dob?: string | null;
    [key: string]: unknown;
  }[];
  engagements: EngagementRow[];
  documents: StaffDocument[];
  invoices: StaffInvoice[];
  notices: StaffNotice[];
  threads: StaffThread[];
  appointments: Appointment[];
  tasks: StaffTask[];
  activity: AuditRow[];
  related: { id?: string; ref?: string; kind?: string; name?: string; relation?: string }[];
  payroll: Record<string, unknown>[];
  totals: {
    billed: number | string;
    paid: number | string;
    outstanding: number | string;
    openNotices: number | string;
    missingDocs: number | string;
  };
}

export interface PipelineCard {
  id: string;
  client_ref: string;
  client_name: string;
  form: string;
  due: string | null;
  priority?: string | null;
  updated?: string | null;
  preparer?: string | null;
  missing?: number | null;
}

export interface PipelineColumn {
  stage: string;
  label: string;
  total: number;
  cards: PipelineCard[];
}

export interface PipelineBoard {
  year: number | string;
  columns: PipelineColumn[];
}

export interface StaffDocument {
  id: string;
  engagement_id?: string | null;
  client_ref?: string | null;
  client_name?: string | null;
  name: string;
  form?: string | null;
  issuer?: string | null;
  status: string;
  requested?: string | null;
  received?: string | null;
  size_kb?: number | null;
  source?: string | null;
  engagement_form?: string | null;
  tax_year?: number | string | null;
  days_waiting?: number | null;
  has_file?: boolean;
}

export interface StaffNotice {
  id: string;
  client_ref: string;
  client_name: string;
  code: string;
  title: string;
  tax_year?: number | string | null;
  notice_date?: string | null;
  received?: string | null;
  response_due?: string | null;
  amount_cents?: number | null;
  status: string;
  assigned_name?: string | null;
  summary?: string | null;
  days_left?: number | null;
}

export interface StaffInvoice {
  id: string;
  number: string;
  client_ref: string;
  client_name: string;
  engagement_id?: string | null;
  issued?: string | null;
  due?: string | null;
  amount_cents: number;
  paid_cents?: number | null;
  status: string;
  lines?: { description: string; amount_cents: number }[] | null;
  payments?: { paid: string; amount_cents: number; method?: string }[] | null;
}

export interface StaffThread {
  id: string;
  client_ref: string;
  client_name: string;
  subject: string;
  staff_id?: string | null;
  staff_name?: string | null;
  updated?: string | null;
  status?: string | null;
  unread_staff?: number | boolean | null;
  unread_client?: number | boolean | null;
}

export interface Message {
  id: string;
  sender: string;
  sender_name?: string;
  sent: string;
  body: string;
}

export interface StaffTask {
  id: string;
  title: string;
  assignee: string;
  assignee_name?: string;
  client_ref?: string | null;
  client_name?: string | null;
  engagement_id?: string | null;
  due?: string | null;
  status: string;
  priority?: string | null;
}

export interface Submission {
  id: string;
  form: string;
  ref: string;
  created: string;
  status: string;
  client_ref?: string | null;
  data?: Record<string, unknown> | null;
}

export interface AuditRow {
  id: string;
  at: string;
  actor: string;
  actor_name?: string;
  actor_kind?: string;
  action: string;
  entity: string;
  entity_id?: string | null;
  detail?: string | null;
  ip?: string | null;
}

export interface ReportsData {
  byPreparer: { id: string; name: string; open: number; done_2025: number; overdue: number }[];
  revenueByMonth: { month: string; collected: number | string; cents: number; payments: number }[];
  aging: { bucket: string; invoices: number; outstanding: number | string }[];
  mix: { form: string; engagements: number; fees: number | string }[];
  notices: { code: string; n: number }[];
}

export interface FoundClient {
  id: string;
  kind: string;
  name: string;
  city?: string | null;
}

/* ---------- portal ---------- */

export interface PortalReturn {
  id: string;
  form: string;
  tax_year: number | string;
  stage: string;
  stage_label: string;
  due: string | null;
  extended?: boolean | string | null;
  efiled?: boolean | string | null;
  accepted?: boolean | string | null;
  refund_cents?: number | null;
  balance_cents?: number | null;
  preparer_name?: string | null;
  kind?: string | null;
}

export interface PortalSummary {
  household: {
    id: string;
    name: string;
    street?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
    filing_status?: string | null;
    dependents?: number | string | null;
    preparer?: string | null;
    preparer_name?: string | null;
    preparer_credentials?: string | null;
    since?: string | null;
  };
  people: { id: string; first_name: string; full_name: string; relation: string }[];
  returns: PortalReturn[];
  documents: { requested: number | string; received: number | string };
  invoices: { open: number | string; due: number | string };
  appointments: Appointment[];
  unread: number | string;
  notices: { id: string; code: string; title: string; response_due: string | null; status: string }[];
  sample: true;
}

export interface PortalDocument {
  id: string;
  engagement_id?: string | null;
  name: string;
  form?: string | null;
  status: string;
  requested?: string | null;
  received?: string | null;
  size_kb?: number | null;
  source?: string | null;
  has_file?: boolean;
}

export interface PortalInvoice extends StaffInvoice {
  lines: { description: string; amount_cents: number }[];
  payments: { paid: string; amount_cents: number; method?: string }[];
}

export interface PortalThread {
  id: string;
  subject: string;
  staff_name?: string | null;
  updated?: string | null;
  status?: string | null;
  unread_client?: number | boolean | null;
}

export interface PortalOrganizer {
  taxYear: number | string;
  engagement?: { id?: string; form?: string; tax_year?: number | string } | null;
  documents: { id: string; name: string; form?: string | null; status: string; received?: string | null }[];
  checklist: { id: string; situation: string; name: string; form?: string | null; why?: string | null }[];
}
