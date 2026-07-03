/* ============================================================
   PersoCRM – App-Shell & Bootstrap
   Baut Sidebar + Topbar, rendert Views, globale Suche,
   Schnellerfassung («+ Neu»).
   ============================================================ */
(() => {
  const ui = App.ui;
  let shellBuilt = false;

  /* ---------- Login (ohne Shell) ---------- */
  App.renderLogin = function () {
    shellBuilt = false;
    const root = document.getElementById('app');
    App.views.renderLoginPage(root);
  };

  /* ---------- Shell ---------- */
  App.renderShell = function (viewName, view, params) {
    const root = document.getElementById('app');
    if (!shellBuilt) {
      buildShell(root);
      shellBuilt = true;
    }
    // Aktive Navigation markieren
    root.querySelectorAll('.nav-item[data-view]').forEach(item => {
      item.classList.toggle('active', item.dataset.view === viewName);
    });
    // Titel setzen
    const titleEl = root.querySelector('.topbar-title');
    if (titleEl) titleEl.textContent = view.title || 'PersoCRM';
    document.title = `${view.title || 'PersoCRM'} – PersoCRM`;
    // Sidebar auf Mobile schliessen
    root.querySelector('.sidebar').classList.remove('open');
    root.querySelector('.sidebar-overlay').classList.remove('show');
    // View rendern
    const container = root.querySelector('#view');
    container.innerHTML = '';
    container.scrollTop = 0;
    window.scrollTo(0, 0);
    view.render(container, params || []);
    updateNavBadges();
  };

  function navItems() {
    return Object.entries(App.router.views)
      .filter(([, v]) => v.nav)
      .sort((a, b) => (a[1].order || 99) - (b[1].order || 99));
  }

  function buildShell(root) {
    const user = App.auth.currentUser();
    root.innerHTML = `
      <div class="app-shell">
        <div class="sidebar-overlay"></div>
        <aside class="sidebar">
          <div class="sidebar-logo">
            <div class="logo-mark">P</div>
            <div class="logo-text">PersoCRM<small>Personalvermittlung</small></div>
          </div>
          <nav class="sidebar-nav">
            ${navItems().map(([name, v]) => `
              <a class="nav-item" data-view="${name}" href="#/${name}">
                ${ui.icon(v.icon || 'file', 18)}
                <span>${ui.esc(v.title)}</span>
                <span class="nav-badge" data-badge="${name}" style="display:none"></span>
              </a>`).join('')}
          </nav>
          <div class="sidebar-footer">
            <div class="sidebar-user">
              ${ui.avatar(user ? user.name : '?', 36)}
              <div>
                <div class="name">${ui.esc(user ? user.name : '')}</div>
                <div class="role">${ui.esc(user ? user.rolle : '')}</div>
              </div>
              <button class="logout-btn" id="logout-btn" title="Abmelden">${ui.icon('logout', 17)}</button>
            </div>
          </div>
        </aside>
        <div class="main">
          <header class="topbar">
            <button class="menu-toggle" id="menu-toggle" aria-label="Menü">${ui.icon('menu', 20)}</button>
            <div class="topbar-title"></div>
            <div class="global-search">
              <div class="searchbox">
                ${ui.icon('search', 16)}
                <input type="text" id="global-search-input" placeholder="Suchen: Kandidaten, Unternehmen, Vakanzen…" autocomplete="off">
              </div>
              <div class="search-results" id="global-search-results" style="display:none"></div>
            </div>
            <div class="dropdown" id="quick-add">
              <button class="btn btn-primary" id="quick-add-btn">${ui.icon('plus', 16)} Neu</button>
            </div>
          </header>
          <main class="view" id="view"></main>
        </div>
      </div>`;

    /* Abmelden */
    root.querySelector('#logout-btn').addEventListener('click', () => {
      App.auth.logout();
      shellBuilt = false;
      App.navigate('/');
      App.router.resolve();
    });

    /* Mobile-Menü */
    const sidebar = root.querySelector('.sidebar');
    const overlay = root.querySelector('.sidebar-overlay');
    root.querySelector('#menu-toggle').addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('show', sidebar.classList.contains('open'));
    });
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('show');
    });

    bindGlobalSearch(root);
    bindQuickAdd(root);
  }

  /* ---------- Badges in der Navigation ---------- */
  function updateNavBadges() {
    const root = document.getElementById('app');
    // Offene Vakanzen
    const offeneVak = App.db.list('vacancies').filter(v => ['Offen', 'In Bearbeitung'].includes(v.status)).length;
    // Fällige Aufgaben (heute oder überfällig)
    const heute = new Date(); heute.setHours(23, 59, 59, 999);
    const faellig = App.db.list('activities').filter(a => !a.erledigt && a.faelligAm && new Date(a.faelligAm) <= heute).length;
    setBadge(root, 'vakanzen', offeneVak);
    setBadge(root, 'aktivitaeten', faellig);
  }
  function setBadge(root, name, count) {
    const el = root.querySelector(`[data-badge="${name}"]`);
    if (!el) return;
    el.style.display = count > 0 ? '' : 'none';
    el.textContent = count;
  }
  App.updateNavBadges = updateNavBadges;

  /* ---------- Globale Suche ---------- */
  function bindGlobalSearch(root) {
    const input = root.querySelector('#global-search-input');
    const results = root.querySelector('#global-search-results');

    function hide() { results.style.display = 'none'; }

    function search(q) {
      q = q.trim().toLowerCase();
      if (q.length < 2) { hide(); return; }
      const match = (s) => String(s || '').toLowerCase().includes(q);

      const kandidaten = App.db.list('candidates').filter(c =>
        match(c.vorname + ' ' + c.nachname) || match(c.beruf) || match(c.nr) || match(c.ort) ||
        (c.qualifikationen || []).some(match)).slice(0, 5);
      const firmen = App.db.list('companies').filter(f =>
        match(f.name) || match(f.branche) || match(f.nr) || match(f.ort)).slice(0, 5);
      const vakanzen = App.db.list('vacancies').filter(v =>
        match(v.titel) || match(v.nr) || match(v.einsatzort)).slice(0, 5);

      if (kandidaten.length + firmen.length + vakanzen.length === 0) {
        results.innerHTML = `<div class="search-result-item"><span class="text-muted">Keine Treffer für «${ui.esc(q)}»</span></div>`;
        results.style.display = '';
        return;
      }

      let html = '';
      if (kandidaten.length) {
        html += `<div class="search-result-group">Kandidaten</div>` + kandidaten.map(c => `
          <a class="search-result-item" href="#/kandidaten/${c.id}">
            ${ui.avatar(c.vorname + ' ' + c.nachname, 28)}
            <div><div class="fw-600">${ui.esc(c.vorname)} ${ui.esc(c.nachname)}</div>
            <div class="sub">${ui.esc(c.beruf)} · ${ui.esc(c.ort)}</div></div>
          </a>`).join('');
      }
      if (firmen.length) {
        html += `<div class="search-result-group">Unternehmen</div>` + firmen.map(f => `
          <a class="search-result-item" href="#/unternehmen/${f.id}">
            <span class="avatar" style="width:28px;height:28px;font-size:11px;background:#0e7490;border-radius:8px">${ui.esc(ui.initials(f.name))}</span>
            <div><div class="fw-600">${ui.esc(f.name)}</div>
            <div class="sub">${ui.esc(f.branche)} · ${ui.esc(f.ort)}</div></div>
          </a>`).join('');
      }
      if (vakanzen.length) {
        html += `<div class="search-result-group">Vakanzen</div>` + vakanzen.map(v => {
          const f = App.db.get('companies', v.companyId);
          return `
          <a class="search-result-item" href="#/vakanzen/${v.id}">
            <span class="avatar" style="width:28px;height:28px;font-size:11px;background:#4f46e5;border-radius:8px">${ui.icon('briefcase', 14)}</span>
            <div><div class="fw-600">${ui.esc(v.titel)}</div>
            <div class="sub">${ui.esc(f ? f.name : '')} · ${ui.badge(v.status)}</div></div>
          </a>`;
        }).join('');
      }
      results.innerHTML = html;
      results.style.display = '';
      results.querySelectorAll('a').forEach(a => a.addEventListener('click', () => { hide(); input.value = ''; }));
    }

    input.addEventListener('input', () => search(input.value));
    input.addEventListener('focus', () => search(input.value));
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.global-search')) hide();
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { hide(); input.blur(); } });
  }

  /* ---------- Schnellerfassung ---------- */
  function bindQuickAdd(root) {
    const wrap = root.querySelector('#quick-add');
    const btn = root.querySelector('#quick-add-btn');
    let menu = null;

    function closeMenu() { if (menu) { menu.remove(); menu = null; } }

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (menu) { closeMenu(); return; }
      menu = document.createElement('div');
      menu.className = 'dropdown-menu';
      menu.innerHTML = `
        <a class="dropdown-item" href="#/kandidaten/neu">${ui.icon('user', 16)} Kandidat</a>
        <a class="dropdown-item" href="#/unternehmen/neu">${ui.icon('building', 16)} Unternehmen</a>
        <a class="dropdown-item" href="#/vakanzen/neu">${ui.icon('briefcase', 16)} Vakanz</a>
        <button class="dropdown-item" data-qa="vermittlung">${ui.icon('handshake', 16)} Vermittlung</button>
        <button class="dropdown-item" data-qa="aktivitaet">${ui.icon('calendar-check', 16)} Aktivität</button>`;
      wrap.appendChild(menu);
      menu.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));
      menu.querySelector('[data-qa="vermittlung"]').addEventListener('click', () => {
        closeMenu();
        App.shared.openPlacementModal({ onSaved: () => App.router.resolve() });
      });
      menu.querySelector('[data-qa="aktivitaet"]').addEventListener('click', () => {
        closeMenu();
        App.shared.openActivityModal({ onSaved: () => App.router.resolve() });
      });
    });
    document.addEventListener('click', (e) => {
      if (menu && !e.target.closest('#quick-add')) closeMenu();
    });
  }

  /* ---------- Start ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    App.router.init();
  });
})();
