// Fails the build when the app breaks the copilot contract (see the spec, "Copilot contract: non-negotiable").
import fs from 'node:fs';
import path from 'node:path';
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p); } };
walk('src');
const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const errors = [];
const testids = ['call-start', 'call-type', 'call-language', 'call-panel', 'call-input', 'call-send', 'call-message', 'call-mic', 'call-keyboard', 'call-end', 'call-mode-form', 'call-mode-guide', 'call-status', 'demo-banner', 'guest-enter',
  'call-source-chip', 'source-viewer', 'source-body', 'source-close', 'source-original', 'tax-chip', 'tax-disclaimer', 'tax-guide', 'tax-guide-search', 'tax-search-result', 'tax-faq',
  // the staff app (/staff) and the client portal (/tax/portal)
  'staff-login', 'staff-nav', 'staff-dashboard', 'staff-list-summary', 'staff-pagination', 'staff-client-search', 'staff-client-row', 'staff-client-detail', 'staff-client-tab',
  'staff-pipeline', 'staff-pipeline-column', 'staff-pipeline-card', 'staff-engagements', 'staff-queue', 'staff-documents', 'staff-notices', 'staff-calendar', 'staff-billing', 'staff-messages',
  'staff-thread', 'staff-tasks', 'staff-reports', 'staff-audit', 'staff-submissions', 'staff-engagement-form', 'staff-form-errors', 'staff-saved',
  'portal-login-demo', 'portal-dashboard', 'portal-return-status', 'portal-documents', 'portal-invoices', 'portal-messages', 'portal-appointments', 'portal-organizer',
  // the public site (/tax): pages, tools and forms
  'site-megamenu', 'site-search', 'site-search-result', 'client-login', 'service-page', 'industry-page', 'team-member', 'location-card', 'job-card', 'review-card', 'article-card',
  'article-page', 'cite-ref', 'sources', 'deadline-row', 'checklist-item', 'calc-result', 'newsletter', 'form-errors', 'form-confirmation', 'form-ref', 'draft-saved', 'slot-day',
  'slot-time', 'upload-progress', 'form-progress'];
for (const t of testids) if (!src.includes(`"${t}"`)) errors.push(`missing data-testid "${t}"`);
const ids = ['child', 'visit', 'tod_am', 'tod_pm', 'slot', 'parent', 'phone', 'email', 'remind', 'serial', 'code', 'name', 'what', 'biz', 'contact', 'p1', 'p2', 'p3', 'budget', 'needs', 'cat', 'svc', 'asset', 'i1', 'i2', 'i3', 'urg', 'desc', 'member', 'bfirst', 'blast', 'share', 't1', 't2', 'replace',
  'fullname', 'tel', 'mail', 'status', 'years', 'service', 'notice', 'noticecode', 'day', 'slot', 'notes',
  'eng_client', 'eng_kind', 'eng_form', 'eng_year', 'eng_preparer', 'eng_reviewer', 'eng_due', 'eng_fee', 'eng_notes',
  'in_first', 'in_last', 'in_email', 'in_phone', 'in_street', 'in_city', 'in_state', 'in_zip', 'in_status', 'in_dependents', 'in_services', 'in_years', 'in_office_remote', 'in_heard', 'in_notes',
  'bk_kind', 'bk_mode_video', 'bk_office', 'bk_staff', 'bk_day', 'bk_name', 'bk_email', 'bk_phone', 'bk_notes',
  'nt_name', 'nt_email', 'nt_phone', 'nt_code', 'nt_year', 'nt_date', 'nt_amount', 'nt_due', 'nt_agree_agree', 'nt_description', 'nt_files',
  'py_business', 'py_ein', 'py_entity', 'py_employees', 'py_freq_weekly', 'py_first', 'py_state', 'py_contact', 'py_email', 'py_phone', 'py_provider', 'py_notes',
  'ad_name', 'ad_email', 'ad_phone', 'ad_old', 'ad_street', 'ad_city', 'ad_state', 'ad_zip', 'ad_effective', 'ad_irs_yes',
  'pp_name', 'pp_email', 'pp_phone', 'pp_years', 'pp_owed', 'pp_monthly', 'pp_plan_short', 'pp_notice_yes', 'pp_debit_yes', 'pp_notes',
  'tr_name', 'tr_email', 'tr_phone', 'tr_year', 'tr_what_copy', 'tr_delivery_portal', 'tr_purpose', 'tr_notes',
  'rf_your_name', 'rf_your_email', 'rf_friend_name', 'rf_friend_email', 'rf_friend_phone', 'rf_relationship', 'rf_service', 'rf_notes',
  'ja_job', 'ja_name', 'ja_email', 'ja_phone', 'ja_credentials', 'ja_years', 'ja_start', 'ja_resume', 'ja_cover',
  'ct_name', 'ct_email', 'ct_phone', 'ct_topic', 'ct_message'];
for (const id of ids) if (!new RegExp(`id=["{]['"]?${id}['"]?`).test(src)) errors.push(`missing form field id="${id}"`);
if (!src.includes('data-copilot-form')) errors.push('no form carries data-copilot-form');
const steps = src.match(/<fieldset[^>]*data-step[^>]*>/g) ?? [];
if (steps.length < 3) errors.push('the clinic form needs three <fieldset data-step> elements');
for (const tag of steps) {
  if (/className=[^>]*\bhidden\b/.test(tag)) errors.push(`step hidden with a CSS class, use the hidden attribute: ${tag.replace(/\s+/g, ' ')}`);
}
if (steps.length >= 3 && steps.filter(t => /\shidden=\{/.test(t)).length < 3) errors.push('every <fieldset data-step> needs hidden={...} and disabled={...}');
if (/fetch\(\s*[`'"][^`'"]*\/api\/(?!(library|site|forms|slots|portal|staff|files|newsletter)\b)/.test(src)) errors.push('the app calls an /api path outside the practice API (library, site, forms, slots, portal, staff, files, newsletter); the rest belong to the copilot script');
if (/fetch\(\s*[`'"][^`'"]*\/api\/forms\/submit/.test(src) && !/onSubmit/.test(src)) errors.push('forms are submitted only from an onSubmit handler (a person pressing the button)');
if (!src.includes('data-copilot-source-body')) errors.push('the source viewer body needs data-copilot-source-body');
if (!/copilot[?!]?\.onNavigate\(/.test(src)) errors.push('the app must register its client-side navigate with window.copilot.onNavigate');
if (!src.includes('data-copilot-kind="code"')) errors.push('the notice code field needs data-copilot-kind="code"');
if (!src.includes('data-copilot-spell')) errors.push('the full name field needs data-copilot-spell');
if (!fs.readFileSync('index.html', 'utf8').includes('/copilot/sdk.js')) errors.push('index.html does not load /copilot/sdk.js');
if (/useSyncExternalStore[\s\S]{0,400}\?\?\s*\{/.test(src)) errors.push('useSyncExternalStore getSnapshot falls back to a new object literal; use one constant');
if (errors.length) { console.error('copilot contract check failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('copilot contract check passed');
