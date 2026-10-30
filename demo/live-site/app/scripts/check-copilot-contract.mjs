// Fails the build when the app breaks the copilot contract (see the spec, "Copilot contract: non-negotiable").
import fs from 'node:fs';
import path from 'node:path';
const files = [];
const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(tsx?|jsx?)$/.test(e.name)) files.push(p); } };
walk('src');
const src = files.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const errors = [];
const testids = ['call-start', 'call-type', 'call-panel', 'call-input', 'call-send', 'call-message', 'call-mic', 'call-keyboard', 'call-end', 'call-mode-form', 'call-mode-guide', 'call-status', 'demo-banner', 'guest-enter'];
for (const t of testids) if (!src.includes(`"${t}"`)) errors.push(`missing data-testid "${t}"`);
const ids = ['child', 'visit', 'tod_am', 'tod_pm', 'slot', 'parent', 'phone', 'email', 'remind', 'serial', 'code', 'name', 'what', 'biz', 'contact', 'p1', 'p2', 'p3', 'budget', 'needs', 'cat', 'svc', 'asset', 'i1', 'i2', 'i3', 'urg', 'desc', 'member', 'bfirst', 'blast', 'share', 't1', 't2', 'replace'];
for (const id of ids) if (!new RegExp(`id=["{]['"]?${id}['"]?`).test(src)) errors.push(`missing form field id="${id}"`);
if (!src.includes('data-copilot-form')) errors.push('no form carries data-copilot-form');
const steps = src.match(/<fieldset[^>]*data-step[^>]*>/g) ?? [];
if (steps.length < 3) errors.push('the clinic form needs three <fieldset data-step> elements');
for (const tag of steps) {
  if (/className=[^>]*\bhidden\b/.test(tag)) errors.push(`step hidden with a CSS class, use the hidden attribute: ${tag.replace(/\s+/g, ' ')}`);
}
if (steps.length >= 3 && steps.filter(t => /\shidden=\{/.test(t)).length < 3) errors.push('every <fieldset data-step> needs hidden={...} and disabled={...}');
if (/fetch\(\s*[`'"][^`'"]*\/api\//.test(src)) errors.push('the app calls /api itself; only the copilot script may');
if (!fs.readFileSync('index.html', 'utf8').includes('/copilot/sdk.js')) errors.push('index.html does not load /copilot/sdk.js');
if (/useSyncExternalStore[\s\S]{0,400}\?\?\s*\{/.test(src)) errors.push('useSyncExternalStore getSnapshot falls back to a new object literal; use one constant');
if (errors.length) { console.error('copilot contract check failed:\n- ' + errors.join('\n- ')); process.exit(1); }
console.log('copilot contract check passed');
