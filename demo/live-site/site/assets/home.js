// Home page: the fake sign-in. A guest name is made up on the spot; nothing is asked for and nothing is stored on a server.
const next = new URLSearchParams(location.search).get('next');
const go = () => { if (next && /^\/[a-z]+\/$/.test(next)) location.href = next; else show(); };
const show = () => { document.getElementById('scenes').hidden = false; };
addEventListener('DOMContentLoaded', async () => {
  if (window.demoGuest?.name()) show();
  document.getElementById('guest').onclick = () => { window.demoGuest.enter(`Guest ${1000 + Math.floor(Math.random() * 9000)}`); go(); };
  try {
    const list = await (await fetch('/fixtures/demo-accounts.json')).json();
    const box = document.getElementById('personas');
    for (const p of list) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'secondary'; b.style.marginRight = '8px'; b.textContent = p.name; b.title = p.note;
      b.onclick = () => { window.demoGuest.enter(p.name, p.id); go(); };
      box.append(b);
    }
  } catch { /* personas are optional */ }
});
