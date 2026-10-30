// Page adapter end to end: a real browser, our practice form, a full conversation. Nothing may ever be submitted.
// Run: node tests/page.ts [--real]   (--real also reads and fills two public practice forms made for automation tests)
import fs from 'node:fs';
import http from 'node:http';
import { chromium, type Page } from 'playwright-core';
import { Copilot } from '../src/engine.ts';
import { RuleModel } from '../src/models.ts';
import { flowFromPage, PageFiller, readForm } from '../src/page.ts';
import type { Field } from '../src/types.ts';

const html = fs.readFileSync(new URL('./fixtures/practice-form.html', import.meta.url));
const server = http.createServer((req, res) => {
  if (req.url === '/') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); } else { res.writeHead(404); res.end(); }
});
await new Promise<void>(r => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;
// Uses PW_CHROMIUM if set, else the newest Chrome for Testing already in the Playwright cache (no download).
const cache = `${process.env.HOME}/Library/Caches/ms-playwright`;
const cached = fs.existsSync(cache) ? fs.readdirSync(cache).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1])[0] : '';
const exe = process.env.PW_CHROMIUM ?? (cached ? `${cache}/${cached}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` : undefined);
const browser = await chromium.launch({ executablePath: exe && fs.existsSync(exe) ? exe : undefined });
const results: { name: string; ok: boolean; got?: unknown }[] = [];
const check = (name: string, ok: boolean, got?: unknown) => {
  results.push({ name, ok, got });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n      got ${JSON.stringify(got)}`}`);
};

// Watches for anything that would send the form: a POST or a navigation away from the page.
function watch(page: Page, start: string) {
  const sent: string[] = [];
  page.on('request', r => { if (r.method() !== 'GET' || (r.isNavigationRequest() && r.frame() === page.mainFrame() && r.url() !== start)) sent.push(`${r.method()} ${r.url()}`); });
  return sent;
}

{
  const page = await browser.newPage();
  const sent = watch(page, url);
  await page.goto(url);
  const form = await readForm(page);
  const flow = flowFromPage(form, { business: 'Halvorsen Home' });
  check('reads the six visible fields in order', form.fields.map(f => f.label).join('|') === 'Full name|Email|Phone number|Appliance|What is wrong?|Visit time', form.fields.map(f => f.label));
  check('kinds come from the page', flow.fields.map(f => f.kind).join(',') === 'name,email,phone,choice,text,choice', flow.fields.map(f => f.kind));
  check('hidden, honeypot and disabled fields are ignored', !form.fields.some(f => ['csrf', 'website', 'account'].includes(f.name)));
  check('password and consent go on the do-it-yourself list', form.yourself.length === 2 && /password/i.test(form.yourself[0]) && /tick "I agree/.test(form.yourself[1]), form.yourself);
  check('select options are read', flow.fields[3].options?.join(',') === 'Dishwasher,Washing machine,Fridge,Oven', flow.fields[3].options);

  const hooks = new PageFiller(page, form);
  const c = new Copilot(flow, new RuleModel(), hooks);
  const val = (sel: string) => page.$eval(sel, el => (el as HTMLInputElement).value);
  c.start();
  await c.turn('Priya Raman');
  check('name is typed in as soon as it is accepted', (await val('#full_name')) === 'Priya Raman');
  let r = await c.turn('priya at');
  check('half an email is asked again', /didn't catch a full email/.test(r) && (await val('[name=email]')) === '', r);
  r = await c.turn('priya dot raman at example dot com');
  check('email is read back before it is kept', /I heard priya\.raman@example\.com/.test(r) && (await val('[name=email]')) === '', r);
  await c.turn('yes');
  check('email is typed in after the yes', (await val('[name=email]')) === 'priya.raman@example.com');
  r = await c.turn('oh seven seven double one, two three four five six');
  check('spoken phone number is read back', /I heard 0771123456/.test(r), r);
  await c.turn('yes');
  r = await c.turn('yes, submit it now');
  check('"submit it now" at a question submits nothing', /haven't submitted/.test(r) && sent.length === 0, r);
  await c.turn('the dishwasher');
  check('choice is selected in the dropdown', (await val('#appliance')) === 'dw');
  r = await c.turn('leaking');
  check('page validation rejects a too-short answer and asks again', /page didn't accept/.test(r) && (await val('#problem')) === '' && c.current() === flow.fields[4].name, r);
  await c.turn('it leaks water onto the kitchen floor');
  check('problem is typed in', (await val('#problem')) === 'it leaks water onto the kitchen floor');
  r = await c.turn('morning please');
  check('radio is checked', await page.isChecked('#t_am') && !(await page.isChecked('#t_pm')));
  check('review card hands back instead of submitting', /hand it back to you to press Book visit/.test(r), r);
  r = await c.turn('yes');
  check('final yes never presses Submit', hooks.handedBack && (await page.evaluate(() => (window as unknown as { __submitted: number }).__submitted)) === 0 && sent.length === 0, { r, sent });
  check('final message names the button and the do-it-yourself list', /press Book visit yourself/.test(r) && /password/i.test(r) && /I agree/.test(r), r);
  check('consent box stays unticked', !(await page.isChecked('#terms')));
  check('password, honeypot, disabled and hidden fields untouched',
    (await val('#pw')) === '' && (await val('#website')) === '' && (await val('#account')) === 'HH-000' && (await val('[name=csrf]')) === 'practice-token');
  check('submit button is pointed at', /solid/.test(await page.$eval('[data-copilot-submit]', el => (el as HTMLElement).style.outline)));
  await page.close();
}

// Public practice forms made for automation tests: read, fill every field the adapter takes, say yes, never submit.
if (process.argv.includes('--real')) {
  const answer = (f: Field) => ({ name: 'Test Person', email: 'test at example dot com', phone: 'five five five, zero one zero zero', choice: f.options?.at(-1) ?? '', text: 'a test answer from the copilot', serial: '' })[f.kind];
  for (const u of ['https://www.selenium.dev/selenium/web/web-form.html', 'https://httpbin.org/forms/post']) {
    const page = await browser.newPage();
    const sent = watch(page, u);
    await page.goto(u);
    const form = await readForm(page);
    const flow = flowFromPage(form, { business: 'practice' });
    const hooks = new PageFiller(page, form);
    const c = new Copilot(flow, new RuleModel(), hooks);
    c.start();
    for (let i = 0; i < 40 && c.state !== 'done'; i++) {
      await c.turn(c.state === 'ask' ? answer(flow.fields.find(x => x.name === c.current())!) : 'yes');
    }
    const typed = await Promise.all(flow.fields.map(f => page.$eval(`[data-copilot-id="${f.name}"]`, el => (el as HTMLInputElement).type === 'radio'
      ? Array.from(document.querySelectorAll<HTMLInputElement>(`[data-copilot-id="${(el as HTMLElement).dataset.copilotId}"]`)).some(x => x.checked)
      : (el as HTMLInputElement).value !== '')));
    console.log(`\n${u}\n  fields: ${flow.fields.map(f => `${f.label} (${f.kind})`).join(', ')}\n  do yourself: ${form.yourself.join('; ')}`);
    check(`${new URL(u).host}: every field filled`, typed.every(Boolean) && c.state === 'done', { typed, state: c.state, last: c.log.at(-1)?.text });
    check(`${new URL(u).host}: nothing submitted`, sent.length === 0 && page.url() === u, sent);
    await page.close();
  }
}

await browser.close();
server.close();
const pass = results.filter(x => x.ok).length;
fs.appendFileSync(new URL('../ledger.jsonl', import.meta.url), results.map(x => JSON.stringify({ ts: new Date().toISOString(), set: 'page', scenario: x.name, pass: x.ok })).join('\n') + '\n');
console.log(`\npage: ${pass}/${results.length}`);
process.exit(pass === results.length ? 0 : 1);
