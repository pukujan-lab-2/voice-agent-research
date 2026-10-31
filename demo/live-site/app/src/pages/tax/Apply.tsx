/**
 * Job application (form `application`). The position comes from /api/site/jobs and is preselected from ?job=; the
 * résumé uploads at once and is sent as `resume: [id]`.
 */

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SitePage } from "@/components/tax/SitePage";
import { useTaxTitle } from "@/lib/tax";
import { useApi } from "@/hooks/useApi";
import { useSiteForm } from "@/components/tax/useSiteForm";
import {
  Confirmation, DemoLine, DraftNote, ErrorSummary, SelectField, TextField, UploadField,
} from "@/components/tax/FormKit";
import { siteGet, type SiteJob } from "@/lib/practice";

const CREDENTIALS = [
  { value: "cpa", label: "CPA", also: "cpa, certified public accountant" },
  { value: "ea", label: "Enrolled agent", also: "ea, enrolled agent" },
  { value: "both", label: "CPA and EA", also: "both" },
  { value: "progress", label: "Working toward one", also: "studying, working toward, in progress" },
  { value: "none", label: "None yet", also: "none, no" },
];

export default function TaxApply() {
  useTaxTitle("Apply");
  const [params] = useSearchParams();
  const jobs = useApi<{ jobs: SiteJob[] }>(() => siteGet<{ jobs: SiteJob[] }>("/jobs"), []);
  const f = useSiteForm("application");
  const resume = useRef<string[]>([]);
  const [job, setJob] = useState(params.get("job") ?? "");

  const list = jobs.data?.jobs ?? [];

  useEffect(() => {
    if (!job && list.length) setJob(list[0].slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list.length]);

  const chosen = list.find((j) => j.slug === job);

  return (
    <SitePage config="taxApply">
      <div className="tax-wrap tax-section">
        <div className="tax-split">
          <div style={{ minWidth: 0 }}>
            <span className="tax-eyebrow">Careers</span>
            <h1 className="tax-h1" style={{ fontSize: "clamp(1.75rem, 5vw, 2.5rem)" }}>
              Apply.
            </h1>
            <p className="tax-lead">
              A partner reads every application. Tell us what you have done, what you hold, and why this
              practice rather than a bigger one.
            </p>

            {chosen && (
              <div className="tax-card" style={{ marginBottom: "1rem" }}>
                <span className="tax-tiny" style={{ textTransform: "uppercase", letterSpacing: "0.12em", color: "hsl(var(--tax-brass))", fontWeight: 700 }}>
                  Applying for
                </span>
                <h2 className="tax-h3" style={{ marginTop: "0.25rem" }}>
                  {chosen.title}
                </h2>
                <p className="tax-small tax-muted" style={{ margin: "0 0 0.5rem" }}>
                  {chosen.office} · {chosen.type} · {chosen.salary}
                </p>
                <p className="tax-p" style={{ fontSize: "0.875rem", marginBottom: 0 }}>
                  {chosen.summary}
                </p>
              </div>
            )}

            <div className="tax-card tax-card-quiet">
              <h2 className="tax-h3">What happens after you send it</h2>
              <ol className="tax-list">
                <li>A partner reads it, usually within a week.</li>
                <li>If we want to talk, a ninety-minute conversation with the partner who would review your work.</li>
                <li>A short paid exercise: a sample return and the documents that go with it.</li>
                <li>A day in the office, and an offer within a week of the last step.</li>
              </ol>
              <p className="tax-small" style={{ marginTop: "0.75rem", marginBottom: 0 }}>
                We answer every application, including the ones we turn down.
              </p>
            </div>
          </div>

          <div>
            {f.confirmation ? (
              <Confirmation
                result={f.confirmation}
                next={[
                  "A partner reads your application, usually within a week.",
                  "If we would like to talk, we ring or email to arrange the first conversation.",
                  "Either way, you hear from us: we answer every application.",
                ]}
                links={[
                  { to: "/tax/careers", label: "All openings" },
                  { to: "/tax/about", label: "About the firm" },
                  { to: "/tax", label: "Back to the site" },
                ]}
              />
            ) : (
              <div className="tax-form-card">
                <ErrorSummary errors={f.errors} />
                <form ref={f.formRef} data-copilot-form id="apply-form" autoComplete="on" onSubmit={f.onSubmit} noValidate={false}>
                  <div className="tax-field">
                    <label htmlFor="ja_job">Which position?</label>
                    <select
                      id="ja_job"
                      name="job"
                      required
                      value={job}
                      onChange={(e) => setJob(e.target.value)}
                      data-copilot-ask="Which position are you applying for"
                      aria-invalid={f.errors.job ? true : undefined}
                      aria-describedby={f.errors.job ? "ja_job-error" : undefined}
                    >
                      <option value="">Choose a position</option>
                      {list.map((j) => (
                        <option key={j.slug} value={j.slug} data-copilot-also={j.title.toLowerCase()}>
                          {j.title}
                        </option>
                      ))}
                    </select>
                    {jobs.loading && <p className="tax-hint">Loading the openings…</p>}
                    {jobs.error && <p className="tax-error">{jobs.error}</p>}
                    {f.errors.job && (
                      <p className="tax-error" id="ja_job-error" role="alert">
                        {f.errors.job}
                      </p>
                    )}
                  </div>

                  <TextField id="ja_name" name="name" label="Your name" autoComplete="name" required spell ask="What's your full name?" placeholder="e.g. Jordan Example" error={f.errors.name} />
                  <TextField id="ja_email" name="email" label="Email" type="email" autoComplete="email" required placeholder="e.g. jordan@example.com" error={f.errors.email} />
                  <TextField id="ja_phone" name="phone" label="Phone" type="tel" autoComplete="tel" required minLength={10} placeholder="e.g. (555) 010-0199" error={f.errors.phone} />
                  <SelectField
                    id="ja_credentials"
                    name="credentials"
                    label="Which credentials do you hold?"
                    required
                    ask="Which credentials do you hold"
                    options={CREDENTIALS}
                    error={f.errors.credentials}
                  />
                  <TextField
                    id="ja_years"
                    name="years"
                    label="Years of tax or accounting experience"
                    required
                    inputMode="numeric"
                    pattern="[0-9]{1,2}"
                    title="A number, like 6"
                    ask="How many years of tax or accounting experience do you have?"
                    placeholder="e.g. 6"
                    error={f.errors.years}
                  />
                  <TextField
                    id="ja_start"
                    name="start"
                    label="When could you start?"
                    type="date"
                    required
                    kind="future"
                    ask="When could you start?"
                    error={f.errors.start}
                  />
                  <UploadField
                    id="ja_resume"
                    label="Your résumé"
                    form="application"
                    accept=".pdf,.docx"
                    hint="PDF or DOCX, up to 8 MB."
                    onUploaded={(ids) => {
                      resume.current = ids;
                      f.extra.current.resume = ids;
                    }}
                    error={f.errors.resume}
                  />
                  <div className="tax-field">
                    <label htmlFor="ja_cover">Why Brindlewick?</label>
                    <textarea
                      id="ja_cover"
                      name="cover"
                      rows={5}
                      required
                      minLength={20}
                      data-copilot-ask="In a few sentences, why Brindlewick?"
                      aria-invalid={f.errors.cover ? true : undefined}
                      aria-describedby={f.errors.cover ? "ja_cover-error" : undefined}
                    />
                    {f.errors.cover ? (
                      <p className="tax-error" id="ja_cover-error" role="alert">
                        {f.errors.cover}
                      </p>
                    ) : (
                      <p className="tax-hint">A few sentences. We would rather read four honest ones than a page.</p>
                    )}
                  </div>

                  {f.general && (
                    <p className="tax-error" role="alert" style={{ marginBottom: "0.75rem" }}>
                      {f.general}
                    </p>
                  )}

                  <div className="tax-form-foot">
                    <button type="submit" className="tax-form-submit" disabled={f.submitting}>
                      {f.submitting ? "Sending…" : "Send application"}
                    </button>
                    <DraftNote saved={f.draftSaved} />
                  </div>
                  <div style={{ marginTop: "0.75rem" }}>
                    <DemoLine />
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </SitePage>
  );
}
