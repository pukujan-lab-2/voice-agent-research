// Shared by every demo page: the "fictional company" banner, each site's header (menu and site search), the fake guest
// sign-in, and forms that send nothing.
(() => {
  const SITES = {
    clinic: {
      brand: "Tumbleberry Children's Clinic", home: '/clinic/',
      nav: [['Book a visit', '/clinic/book/'], ['Our doctors', '/clinic/doctors/'], ['Help', '/clinic/help/']],
      pages: [
        ['Book a visit', '/clinic/book/', 'appointment checkup sick visit vaccination slot morning afternoon book'],
        ['Our doctors', '/clinic/doctors/', 'doctor okafor lind pediatrician team'],
        ['Help and FAQ', '/clinic/help/', 'opening hours cancel reschedule insurance parking fever what to bring'],
      ],
    },
    appliance: {
      brand: 'Kettlewisp Appliances', home: '/appliance/',
      nav: [['HDW-500 support', '/appliance/support/'], ['Manuals', '/appliance/manuals/'], ['Error codes', '/appliance/help/']],
      pages: [
        ['HDW-500 support and service visits', '/appliance/support/', 'dishwasher e24 water not draining service technician repair serial'],
        ['Manuals', '/appliance/manuals/', 'manual pdf user guide hdw-500 instructions'],
        ['Error codes', '/appliance/help/', 'e11 e15 e24 e25 e09 error code meaning fix drain filter leak heater'],
        ['HDW-500 user manual', '/docs/hdw500-manual.html', 'filter cleaning programs eco intensive warranty detergent rinse aid serial number'],
      ],
    },
    pricing: {
      brand: 'Larchmoss Studio', home: '/pricing/',
      nav: [['Plans', '/pricing/'], ['Request a quote', '/pricing/quote/'], ['FAQ', '/pricing/faq/']],
      pages: [
        ['Plans and pricing', '/pricing/', 'starter growth scale price cost website plan'],
        ['Request a quote', '/pricing/quote/', 'quote estimate budget contact'],
        ['FAQ', '/pricing/faq/', 'headless cms cdn hosting domain timeline booking payments seo'],
      ],
    },
    itdesk: {
      brand: 'Cobblefin IT Desk', home: '/itdesk/',
      nav: [['New ticket', '/itdesk/new/'], ['Knowledge base', '/itdesk/kb/']],
      pages: [
        ['New incident ticket', '/itdesk/new/', 'ticket incident report problem broken asset tag urgency impact'],
        ['Knowledge base', '/itdesk/kb/', 'vpn backup gateway wifi printer password reset email'],
      ],
    },
    pension: {
      brand: 'Saltmere Pension Fund', home: '/pension/',
      nav: [['Forms', '/pension/forms/'], ['Help', '/pension/help/']],
      pages: [
        ['Forms', '/pension/forms/', 'forms r-17 beneficiary address change'],
        ['Form R-17: Designation of Beneficiary', '/pension/forms/r17/', 'beneficiary designation payee code son daughter spouse share'],
        ['Help and contact', '/pension/help/', 'help contact office processing witness guide'],
        ['Guide to form R-17', '/docs/r17-guide.html', 'payee code witness spousal consent processing times primary contingent'],
      ],
    },
  };

  const store = {
    get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* private mode: the demo still works */ } },
    del(k) { try { sessionStorage.removeItem(k); } catch { /* ignore */ } },
  };
  window.demoGuest = {
    enter(name, persona) { store.set('demo.guest', name); if (persona) store.set('demo.persona', persona); else store.del('demo.persona'); },
    leave() { store.del('demo.guest'); store.del('demo.persona'); location.href = '/'; },
    name() { return store.get('demo.guest'); },
    persona() { return store.get('demo.persona'); },
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.innerHTML = '<strong>Demo, fictional company.</strong> This business, its people and its documents are made up. Nothing you type is sent anywhere.';
  document.body.prepend(banner);

  // A "View demo" link (?guest=1) enters as a guest in one step. There are no passwords anywhere.
  const params = new URLSearchParams(location.search);
  if (params.get('guest') === '1' && !window.demoGuest.name()) window.demoGuest.enter(`Guest ${1000 + Math.floor(Math.random() * 9000)}`);
  if (document.body.dataset.gate !== undefined && !window.demoGuest.name()) {
    location.replace('/?next=' + encodeURIComponent(location.pathname));
    return;
  }

  // Site header: brand, menu (a toggle on phones), site search, guest name.
  const head = document.querySelector('header.topbar[data-site]');
  const site = head && SITES[head.dataset.site];
  if (site) {
    const here = location.pathname;
    head.innerHTML = `
      <a class="brand" href="${site.home}">${esc(site.brand)} <small>fictional</small></a>
      <button class="menu-btn" type="button" aria-expanded="false" aria-controls="sitenav">Menu</button>
      <nav id="sitenav" class="sitenav">
        ${site.nav.map(([l, h]) => `<a href="${h}"${here === h ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('')}
        <form class="search" role="search"><input type="search" aria-label="Search this site" placeholder="Search this site"><div class="results" hidden></div></form>
        <span class="who"></span>
      </nav>`;
    const btn = head.querySelector('.menu-btn');
    btn.onclick = () => { const open = head.classList.toggle('open'); btn.setAttribute('aria-expanded', String(open)); };
    const q = head.querySelector('.search input');
    const out = head.querySelector('.results');
    const words = s => s.toLowerCase().match(/[a-z0-9-]+/g) ?? [];
    const find = () => {
      const w = words(q.value).filter(x => x.length > 1);
      const hits = w.length ? site.pages.map(([t, h, k]) => ({ t, h, n: w.filter(x => words(`${t} ${k}`).some(y => y.startsWith(x))).length })).filter(x => x.n).sort((a, b) => b.n - a.n) : [];
      out.hidden = !q.value.trim();
      out.innerHTML = hits.length ? hits.map(x => `<a href="${x.h}">${esc(x.t)}</a>`).join('') : '<span>No pages found. Try the Help page.</span>';
      return hits;
    };
    q.oninput = find;
    head.querySelector('.search').onsubmit = e => { e.preventDefault(); const h = find(); if (h[0]) location.href = h[0].h; };
  }
  const who = document.querySelector('.topbar .who');
  if (who && window.demoGuest.name()) {
    who.textContent = `${window.demoGuest.name()} (demo) · `;
    const a = document.createElement('a'); a.href = '#'; a.textContent = 'Leave';
    a.onclick = e => { e.preventDefault(); window.demoGuest.leave(); };
    who.append(a);
  }

  // A demo persona shows made-up answers to try.
  const box = document.querySelector('[data-persona-box]');
  if (box) {
    fetch('/fixtures/demo-accounts.json').then(r => r.json()).then(list => {
      const p = list.find(x => x.id === window.demoGuest.persona());
      const tips = p?.scenes?.[document.body.dataset.scene];
      if (!tips) return;
      box.hidden = false;
      box.innerHTML = `<b>Made-up details for ${esc(p.name)}:</b> ` + tips.map(t => `“${esc(t)}”`).join(' · ');
    }).catch(() => {});
  }

  // Every form ends here: nothing is posted, nothing leaves the browser.
  document.querySelectorAll('form[data-demo-form]').forEach(form => {
    form.addEventListener('submit', e => {
      e.preventDefault();
      if (form.dataset.wizard !== undefined && window.demoWizardNext?.(form)) return;
      location.href = '/sent.html?from=' + encodeURIComponent(document.body.dataset.scene || '');
    });
  });

  // Multi-step forms: each step's button is that step's submit, so the browser checks the step before moving on.
  window.demoWizardNext = form => {
    const steps = Array.from(form.querySelectorAll('[data-step]'));
    const i = steps.findIndex(s => !s.hidden);
    if (i < 0 || i === steps.length - 1) return false;
    // Hidden steps are also disabled, so the browser does not try to check fields the person cannot see.
    steps[i].hidden = true; steps[i].disabled = true;
    steps[i + 1].hidden = false; steps[i + 1].disabled = false;
    document.querySelectorAll('.steps span').forEach((s, j) => s.classList.toggle('on', j === i + 1));
    form.scrollIntoView({ block: 'start', behavior: 'smooth' });
    return true;
  };
})();
