/* ============================================================
   PersoCRM – Einstellungen
   Tabs: Profil | Benutzer | Firma | Daten
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  const ROLLEN = ['Administrator', 'Berater', 'Beraterin'];

  /* Sidebar-Anzeige nach Profiländerung aktualisieren (nur DOM) */
  function syncSidebarUser() {
    const me = App.auth.currentUser();
    if (!me) return;
    const nameEl = document.querySelector('.sidebar-user .name');
    const roleEl = document.querySelector('.sidebar-user .role');
    if (nameEl) nameEl.textContent = me.name;
    if (roleEl) roleEl.textContent = me.rolle;
  }

  /* ---------- Tab: Profil ---------- */
  function renderProfil(panel, rerenderAll) {
    const user = App.auth.currentUser();
    if (!user) { panel.innerHTML = ''; return; }
    panel.innerHTML = `
      <div class="card" style="max-width:640px">
        <div class="card-body">
          <div class="flex mb-20" style="gap:14px">
            ${ui.avatar(user.name, 56)}
            <div>
              <div class="fw-600" style="font-size:16px">${ui.esc(user.name)}</div>
              <div class="text-muted fs-12">@${ui.esc(user.username)}</div>
            </div>
            <div style="margin-left:auto">${ui.badge(user.rolle)}</div>
          </div>
          <form id="profil-form">
            <div class="form-grid">
              <div class="field span-2">
                <label>Name *</label>
                <input type="text" name="name" required value="${ui.esc(user.name)}">
              </div>
              <div class="field span-2">
                <label>E-Mail</label>
                <input type="email" name="email" value="${ui.esc(user.email || '')}">
              </div>
              <div class="field span-2">
                <label>Benutzername</label>
                <input type="text" name="username" value="${ui.esc(user.username)}" readonly>
                <div class="hint">Der Benutzername kann nicht geändert werden.</div>
              </div>
              <div class="field span-2">
                <label>Neues Passwort</label>
                <input type="password" name="passwort" minlength="4" autocomplete="new-password" placeholder="Leer lassen, um es zu behalten">
              </div>
            </div>
            <button class="btn btn-primary" type="submit">${ui.icon('check', 16)} Profil speichern</button>
          </form>
        </div>
      </div>`;

    panel.querySelector('#profil-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      if (!form.reportValidity()) return;
      const fd = new FormData(form);
      const pw = String(fd.get('passwort') || '');
      if (pw && pw.length < 4) {
        ui.toast('Das Passwort muss mindestens 4 Zeichen lang sein.', 'error');
        return;
      }
      const patch = {
        name: String(fd.get('name') || '').trim(),
        email: String(fd.get('email') || '').trim()
      };
      if (pw) patch.password = pw;
      db.update('users', user.id, patch);
      ui.toast('Profil gespeichert');
      syncSidebarUser();
      rerenderAll();
    });
  }

  /* ---------- Tab: Benutzer ---------- */
  function renderBenutzer(panel, rerenderAll) {
    const me = App.auth.currentUser();
    if (!me || me.rolle !== 'Administrator') {
      panel.innerHTML = `
        <div class="card">
          ${ui.emptyState({ icon: 'shield', title: 'Kein Zugriff', text: 'Nur Administratoren können Benutzer verwalten.' })}
        </div>`;
      return;
    }

    const users = db.list('users');
    panel.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3>Benutzerverwaltung</h3>
          <div class="actions">
            <button class="btn btn-primary btn-sm" data-act="new">${ui.icon('plus', 15)} Neuer Benutzer</button>
          </div>
        </div>
        <div class="card-body flush">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr><th>Benutzer</th><th>E-Mail</th><th>Rolle</th><th></th></tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr data-id="${u.id}">
                    <td>
                      <div class="flex">
                        ${ui.avatar(u.name, 32)}
                        <div>
                          <div class="cell-main">${ui.esc(u.name)}${u.id === me.id ? ' <span class="text-soft fs-12">(Sie)</span>' : ''}</div>
                          <div class="cell-sub">@${ui.esc(u.username)}</div>
                        </div>
                      </div>
                    </td>
                    <td>${u.email ? `<a href="mailto:${ui.esc(u.email)}">${ui.esc(u.email)}</a>` : '<span class="text-soft">–</span>'}</td>
                    <td>${ui.badge(u.rolle)}</td>
                    <td class="actions-cell">
                      <button class="btn-icon" data-act="edit" title="Bearbeiten">${ui.icon('edit', 15)}</button>
                      <button class="btn-icon danger" data-act="delete" title="Löschen">${ui.icon('trash', 15)}</button>
                    </td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    panel.querySelector('[data-act="new"]').addEventListener('click', () => {
      openUserModal(null, rerenderAll);
    });

    panel.querySelectorAll('tbody [data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.closest('tr').dataset.id);
        const u = db.get('users', id);
        if (!u) return;
        if (btn.dataset.act === 'edit') {
          openUserModal(u, rerenderAll);
        } else if (btn.dataset.act === 'delete') {
          if (u.id === me.id) {
            ui.toast('Sie können Ihr eigenes Konto nicht löschen.', 'error');
            return;
          }
          const adminCount = db.list('users').filter(x => x.rolle === 'Administrator').length;
          if (u.rolle === 'Administrator' && adminCount <= 1) {
            ui.toast('Der letzte Administrator kann nicht gelöscht werden.', 'error');
            return;
          }
          ui.confirm(`Benutzer «${u.name}» wirklich löschen?`, () => {
            db.remove('users', u.id);
            ui.toast('Benutzer gelöscht');
            rerenderAll();
          });
        }
      });
    });
  }

  function openUserModal(user, onSaved) {
    ui.modal({
      title: user ? 'Benutzer bearbeiten' : 'Neuer Benutzer',
      width: 520,
      content: `
        <form id="user-form">
          <div class="form-grid">
            <div class="field span-2">
              <label>Benutzername *</label>
              <input type="text" name="username" required value="${user ? ui.esc(user.username) : ''}" ${user ? 'readonly' : ''} placeholder="z.B. mmuster">
              ${user ? '<div class="hint">Der Benutzername kann nicht geändert werden.</div>' : ''}
            </div>
            <div class="field span-2">
              <label>Name *</label>
              <input type="text" name="name" required value="${user ? ui.esc(user.name) : ''}" placeholder="Vorname Nachname">
            </div>
            <div class="field">
              <label>E-Mail</label>
              <input type="email" name="email" value="${user ? ui.esc(user.email || '') : ''}">
            </div>
            <div class="field">
              <label>Rolle</label>
              <select name="rolle">
                ${ROLLEN.map(r => `<option ${user && user.rolle === r ? 'selected' : ''}>${r}</option>`).join('')}
              </select>
            </div>
            <div class="field span-2">
              <label>${user ? 'Neues Passwort' : 'Passwort *'}</label>
              <input type="password" name="passwort" minlength="4" autocomplete="new-password" ${user ? '' : 'required'} placeholder="${user ? 'Leer lassen, um es zu behalten' : 'Mindestens 4 Zeichen'}">
            </div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${user ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          const form = el.querySelector('#user-form');
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const username = String(fd.get('username') || '').trim();
          const name = String(fd.get('name') || '').trim();
          const email = String(fd.get('email') || '').trim();
          const rolle = fd.get('rolle');
          const passwort = String(fd.get('passwort') || '');
          if (passwort && passwort.length < 4) {
            ui.toast('Das Passwort muss mindestens 4 Zeichen lang sein.', 'error');
            return;
          }
          if (!user) {
            const taken = db.list('users').some(u => u.username.toLowerCase() === username.toLowerCase());
            if (taken) { ui.toast('Dieser Benutzername ist bereits vergeben.', 'error'); return; }
          }
          if (user && user.rolle === 'Administrator' && rolle !== 'Administrator') {
            const adminCount = db.list('users').filter(u => u.rolle === 'Administrator').length;
            if (adminCount <= 1) {
              ui.toast('Der letzte Administrator kann nicht herabgestuft werden.', 'error');
              return;
            }
          }
          if (user) {
            const patch = { name, email, rolle };
            if (passwort) patch.password = passwort;
            db.update('users', user.id, patch);
            ui.toast('Benutzer aktualisiert');
          } else {
            db.insert('users', { username, password: passwort, name, rolle, email });
            ui.toast('Benutzer erstellt');
          }
          syncSidebarUser();
          close();
          if (onSaved) onSaved();
        });
      }
    });
  }

  /* ---------- Tab: Firma ---------- */
  function renderFirma(panel, rerenderAll) {
    const s = db.settings();
    panel.innerHTML = `
      <div class="card" style="max-width:640px">
        <div class="card-header"><h3>Firmendaten</h3></div>
        <div class="card-body">
          <p class="text-muted mb-20" style="font-size:13px">
            Diese Angaben erscheinen in der Anwendung als Ihre eigene Personalberatung.
          </p>
          <form id="firma-form">
            <div class="form-grid">
              <div class="field span-2">
                <label>Firmenname</label>
                <input type="text" name="firmenname" value="${ui.esc(s.firmenname || '')}" placeholder="z.B. PersoCRM Personalberatung AG">
              </div>
              <div class="field span-2">
                <label>Ort</label>
                <input type="text" name="ort" value="${ui.esc(s.ort || '')}" placeholder="z.B. Zürich">
              </div>
            </div>
            <button class="btn btn-primary" type="submit">${ui.icon('check', 16)} Speichern</button>
          </form>
        </div>
      </div>`;

    panel.querySelector('#firma-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      db.settings({
        firmenname: String(fd.get('firmenname') || '').trim(),
        ort: String(fd.get('ort') || '').trim()
      });
      ui.toast('Firmendaten gespeichert');
      rerenderAll();
    });
  }

  /* ---------- Tab: Daten ---------- */
  function renderDaten(panel, rerenderAll) {
    const counts = [
      ['Kandidaten', db.list('candidates').length],
      ['Unternehmen', db.list('companies').length],
      ['Vakanzen', db.list('vacancies').length],
      ['Vermittlungen', db.list('placements').length],
      ['Aktivitäten', db.list('activities').length],
      ['Benutzer', db.list('users').length]
    ];
    // localStorage speichert UTF-16 → ca. 2 Byte pro Zeichen
    const kb = Math.round(db.exportJson().length * 2 / 1024);

    panel.innerHTML = `
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3>Daten exportieren</h3></div>
          <div class="card-body">
            <p class="text-muted mb-10" style="font-size:13px">
              Sichern Sie den kompletten Datenbestand (alle Kandidaten, Unternehmen, Vakanzen, Vermittlungen und Aktivitäten) als JSON-Datei.
            </p>
            <button class="btn btn-secondary" data-act="export">${ui.icon('download', 16)} Als JSON exportieren</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Daten importieren</h3></div>
          <div class="card-body">
            <p class="text-muted mb-10" style="font-size:13px">
              <span class="text-danger fw-600">Achtung:</span> Der Import ersetzt sämtliche vorhandenen Daten durch den Inhalt der gewählten Datei.
            </p>
            <input type="file" accept=".json" data-el="import-file" style="display:none">
            <button class="btn btn-secondary" data-act="import">${ui.icon('upload', 16)} JSON-Datei importieren</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Demo-Daten zurücksetzen</h3></div>
          <div class="card-body">
            <p class="text-muted mb-10" style="font-size:13px">
              Setzt die Anwendung auf die ursprünglichen Demo-Daten zurück. Alle Ihre Änderungen gehen dabei unwiderruflich verloren.
            </p>
            <button class="btn btn-danger" data-act="reset">${ui.icon('refresh', 16)} Zurücksetzen</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Speicher</h3></div>
          <div class="card-body">
            <dl class="info-list">
              ${counts.map(([label, n]) => `<dt>${ui.esc(label)}</dt><dd>${n}</dd>`).join('')}
              <dt>Belegter Speicher</dt><dd>ca. ${kb} KB</dd>
            </dl>
          </div>
        </div>
      </div>`;

    /* Export */
    panel.querySelector('[data-act="export"]').addEventListener('click', () => {
      const blob = new Blob([db.exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'persocrm-export-' + ui.today() + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.toast('Export heruntergeladen');
    });

    /* Import */
    const fileInput = panel.querySelector('[data-el="import-file"]');
    panel.querySelector('[data-act="import"]').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (db.importJson(reader.result)) {
          ui.toast('Daten erfolgreich importiert');
          App.updateNavBadges();
          App.router.resolve();
        } else {
          ui.toast('Ungültige Datei', 'error');
        }
        fileInput.value = '';
      };
      reader.readAsText(file);
    });

    /* Reset */
    panel.querySelector('[data-act="reset"]').addEventListener('click', () => {
      ui.confirm('Wirklich alle Daten auf die Demo-Daten zurücksetzen? Alle Änderungen gehen verloren.', () => {
        db.reset();
        ui.toast('Demo-Daten zurückgesetzt');
        App.updateNavBadges();
        App.navigate('/dashboard');
        App.router.resolve();
      });
    });
  }

  /* ---------- View ---------- */
  App.registerView('einstellungen', {
    title: 'Einstellungen',
    icon: 'settings',
    nav: true,
    order: 8,
    render(container, params) {
      container.innerHTML = `
        <div class="tabs">
          <button class="tab active" data-tab="profil" type="button">Profil</button>
          <button class="tab" data-tab="benutzer" type="button">Benutzer</button>
          <button class="tab" data-tab="firma" type="button">Firma</button>
          <button class="tab" data-tab="daten" type="button">Daten</button>
        </div>
        <div class="tab-panel active" data-panel="profil"></div>
        <div class="tab-panel" data-panel="benutzer"></div>
        <div class="tab-panel" data-panel="firma"></div>
        <div class="tab-panel" data-panel="daten"></div>
        <div class="card mt-20">
          <div class="card-body" style="text-align:center">
            <span class="text-muted fs-12">PersoCRM Demo – alle Daten bleiben lokal in Ihrem Browser (localStorage). Version 1.0</span>
          </div>
        </div>`;

      const panels = {
        profil: container.querySelector('[data-panel="profil"]'),
        benutzer: container.querySelector('[data-panel="benutzer"]'),
        firma: container.querySelector('[data-panel="firma"]'),
        daten: container.querySelector('[data-panel="daten"]')
      };

      /* Alle Panels neu aufbauen (Tab-Zustand bleibt erhalten, da nur
         die Panel-Inhalte ersetzt werden) */
      function rerenderAll() {
        renderProfil(panels.profil, rerenderAll);
        renderBenutzer(panels.benutzer, rerenderAll);
        renderFirma(panels.firma, rerenderAll);
        renderDaten(panels.daten, rerenderAll);
      }

      ui.bindTabs(container);
      rerenderAll();
    }
  });
})();
