// Shared by every demo page: the "fictional company" banner, the fake guest sign-in, and forms that send nothing.
(() => {
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

  const banner = document.createElement('div');
  banner.className = 'demo-banner';
  banner.innerHTML = '<strong>Demo, fictional company.</strong> This business, its people and its documents are made up. Nothing you type is sent anywhere.';
  document.body.prepend(banner);

  // Scene pages need a guest. There are no passwords: "Enter as guest" on the home page is the whole sign-in.
  if (document.body.dataset.gate !== undefined && !window.demoGuest.name()) {
    location.replace('/?next=' + encodeURIComponent(location.pathname));
    return;
  }
  const who = document.querySelector('.topbar .who');
  if (who && window.demoGuest.name()) {
    who.textContent = `Signed in as ${window.demoGuest.name()} (demo) · `;
    const a = document.createElement('a'); a.href = '#'; a.textContent = 'Leave';
    a.onclick = e => { e.preventDefault(); window.demoGuest.leave(); };
    who.append(a);
  }

  // A demo persona shows made-up answers to try with the copilot.
  const box = document.querySelector('[data-persona-box]');
  if (box) {
    fetch('/fixtures/demo-accounts.json').then(r => r.json()).then(list => {
      const p = list.find(x => x.id === window.demoGuest.persona());
      const tips = p?.scenes?.[document.body.dataset.scene];
      if (!tips) return;
      box.hidden = false;
      box.innerHTML = `<b>Try saying (made-up details for ${p.name}):</b> ` + tips.map(t => `“${t.replace(/</g, '&lt;')}”`).join(' · ');
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
    steps[i + 1].querySelector('input,select,textarea')?.focus();
    return true;
  };
})();
