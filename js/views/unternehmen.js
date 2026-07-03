/* ============================================================
   PersoCRM – Ansicht «Unternehmen»
   Liste mit Suche/Filter/Sortierung, Erfassungsmodal,
   Detailansicht mit Ansprechpartnern, Vakanzen, Aktivitäten.
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  const STATUS = ['Interessent', 'Aktiv', 'Inaktiv'];

  /* ---------- Helfer ---------- */
  function firmaVakanzen(id) {
    id = Number(id);
    return db.list('vacancies').filter(v => v.companyId === id);
  }
  function offeneVakanzen(id) {
    return firmaVakanzen(id).filter(v => ['Offen', 'In Bearbeitung'].includes(v.status));
  }
  function firmaPlacements(id) {
    const vakIds = firmaVakanzen(id).map(v => v.id);
    return db.list('placements').filter(p => vakIds.includes(p.vacancyId));
  }
  function firmaAktivitaeten(id) {
    return db.list('activities').filter(a => a.bezug && a.bezug.typ === 'unternehmen' && Number(a.bezug.id) === Number(id));
  }

  // Firmen erhalten quadratische Avatare (Kandidaten runde)
  function firmenAvatar(name, size, radius) {
    const fs = Math.round(size * 0.38);
    return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px;border-radius:${radius}px;background:${ui.avatarColor(name)}">${ui.esc(ui.initials(name))}</span>`;
  }
  function webUrl(w) { return /^https?:\/\//i.test(w) ? w : 'https://' + w; }
  function honorarText(f) {
    return (f.honorarSatz === null || f.honorarSatz === undefined || f.honorarSatz === '') ? '–' : `${f.honorarSatz} %`;
  }
  function apName(p) { return [p.anrede, p.vorname, p.nachname].filter(Boolean).join(' '); }

  /* ---------- Löschen (inkl. Schutzregel) ---------- */
  function deleteCompany(f, after) {
    if (!f) return;
    if (firmaVakanzen(f.id).length > 0) {
      ui.toast('Bitte zuerst die Vakanzen dieses Unternehmens löschen.', 'error');
      return;
    }
    ui.confirm(`Unternehmen «${f.name}» wirklich löschen? Zugehörige Aktivitäten werden ebenfalls entfernt.`, () => {
      firmaAktivitaeten(f.id).map(a => a.id).forEach(aid => db.remove('activities', aid));
      db.remove('companies', f.id);
      ui.toast('Unternehmen gelöscht');
      App.updateNavBadges();
      after();
    });
  }

  /* ---------- Modal: Unternehmen erfassen/bearbeiten ---------- */
  function openCompanyModal(firma, onSaved) {
    const f = firma || null;
    const cur = App.auth.currentUser();
    const betreuer = f ? f.betreuerId : (cur ? cur.id : 1);
    const userOpts = db.list('users').map(u =>
      `<option value="${u.id}" ${u.id === betreuer ? 'selected' : ''}>${ui.esc(u.name)}</option>`).join('');

    ui.modal({
      title: f ? 'Unternehmen bearbeiten' : 'Neues Unternehmen',
      width: 640,
      content: `
        <form id="firma-form">
          <div class="form-grid">
            <div class="field span-2"><label>Firmenname *</label>
              <input type="text" name="name" required value="${f ? ui.esc(f.name) : ''}" placeholder="z.B. Muster AG"></div>
            <div class="field"><label>Branche</label>
              <input type="text" name="branche" value="${f ? ui.esc(f.branche || '') : ''}" placeholder="z.B. Informatik / Software"></div>
            <div class="field"><label>Status</label>
              <select name="status">${STATUS.map(s => `<option ${(f ? f.status === s : s === 'Interessent') ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="field span-2"><label>Strasse</label>
              <input type="text" name="strasse" value="${f ? ui.esc(f.strasse || '') : ''}"></div>
            <div class="field"><label>PLZ</label>
              <input type="text" name="plz" value="${f ? ui.esc(f.plz || '') : ''}"></div>
            <div class="field"><label>Ort</label>
              <input type="text" name="ort" value="${f ? ui.esc(f.ort || '') : ''}"></div>
            <div class="field"><label>Telefon</label>
              <input type="tel" name="telefon" value="${f ? ui.esc(f.telefon || '') : ''}" placeholder="+41 44 …"></div>
            <div class="field"><label>E-Mail</label>
              <input type="email" name="email" value="${f ? ui.esc(f.email || '') : ''}"></div>
            <div class="field"><label>Website</label>
              <input type="text" name="website" value="${f ? ui.esc(f.website || '') : ''}" placeholder="www.beispiel.ch"></div>
            <div class="field"><label>Honorarsatz (%)</label>
              <input type="number" name="honorarSatz" min="0" max="100" step="0.5" value="${f && f.honorarSatz != null ? f.honorarSatz : ''}">
              <div class="hint">Prozent der Jahreslohnsumme</div></div>
            <div class="field span-2"><label>Betreuer/in</label>
              <select name="betreuerId">${userOpts}</select></div>
            <div class="field span-2"><label>Notizen</label>
              <textarea name="notizen" placeholder="Interne Bemerkungen…">${f ? ui.esc(f.notizen || '') : ''}</textarea></div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${f ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        const form = el.querySelector('#firma-form');
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const hs = fd.get('honorarSatz');
          const rec = {
            name: fd.get('name').trim(),
            branche: (fd.get('branche') || '').trim(),
            strasse: (fd.get('strasse') || '').trim(),
            plz: (fd.get('plz') || '').trim(),
            ort: (fd.get('ort') || '').trim(),
            telefon: (fd.get('telefon') || '').trim(),
            email: (fd.get('email') || '').trim(),
            website: (fd.get('website') || '').trim(),
            status: fd.get('status'),
            honorarSatz: hs !== null && hs !== '' ? Number(hs) : null,
            betreuerId: Number(fd.get('betreuerId')),
            notizen: (fd.get('notizen') || '').trim()
          };
          let saved;
          if (f) {
            saved = db.update('companies', f.id, rec);
            ui.toast('Unternehmen aktualisiert');
          } else {
            rec.nr = db.nextNr('F');
            rec.ansprechpartner = [];
            saved = db.insert('companies', rec);
            ui.toast('Unternehmen erstellt');
          }
          close();
          if (onSaved) onSaved(saved);
        });
      }
    });
  }

  /* ---------- Modal: Ansprechpartner ---------- */
  function openContactModal(companyId, contact, onSaved) {
    const p = contact || null;
    ui.modal({
      title: p ? 'Ansprechpartner bearbeiten' : 'Neuer Ansprechpartner',
      width: 520,
      content: `
        <form id="ap-form">
          <div class="form-grid">
            <div class="field span-2"><label>Anrede</label>
              <select name="anrede">${['Herr', 'Frau'].map(a => `<option ${p && p.anrede === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
            <div class="field"><label>Vorname *</label>
              <input type="text" name="vorname" required value="${p ? ui.esc(p.vorname) : ''}"></div>
            <div class="field"><label>Nachname *</label>
              <input type="text" name="nachname" required value="${p ? ui.esc(p.nachname) : ''}"></div>
            <div class="field span-2"><label>Funktion</label>
              <input type="text" name="funktion" value="${p ? ui.esc(p.funktion || '') : ''}" placeholder="z.B. Leiter HR"></div>
            <div class="field"><label>E-Mail</label>
              <input type="email" name="email" value="${p ? ui.esc(p.email || '') : ''}"></div>
            <div class="field"><label>Telefon</label>
              <input type="tel" name="telefon" value="${p ? ui.esc(p.telefon || '') : ''}"></div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${p ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        const form = el.querySelector('#ap-form');
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const firma = db.get('companies', companyId);
          if (!firma) return;
          const fd = new FormData(form);
          const rec = {
            anrede: fd.get('anrede'),
            vorname: fd.get('vorname').trim(),
            nachname: fd.get('nachname').trim(),
            funktion: (fd.get('funktion') || '').trim(),
            email: (fd.get('email') || '').trim(),
            telefon: (fd.get('telefon') || '').trim()
          };
          const arr = (firma.ansprechpartner || []).slice();
          if (p) {
            const i = arr.findIndex(x => x.id === p.id);
            if (i >= 0) arr[i] = Object.assign({}, arr[i], rec);
            ui.toast('Ansprechpartner aktualisiert');
          } else {
            rec.id = arr.reduce((m, x) => Math.max(m, Number(x.id) || 0), 0) + 1;
            arr.push(rec);
            ui.toast('Ansprechpartner erstellt');
          }
          db.update('companies', companyId, { ansprechpartner: arr });
          close();
          if (onSaved) onSaved();
        });
      }
    });
  }

  /* ---------- Liste ---------- */
  function renderList(container, openNew) {
    let suche = '', statusFilter = '', sortKey = 'name', sortDir = 1;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Unternehmen</h1>
          <div class="subtitle" id="u-subtitle"></div>
        </div>
        <div class="actions">
          <button class="btn btn-primary" id="u-new">${ui.icon('plus', 16)} Neues Unternehmen</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="searchbox">${ui.icon('search', 16)}<input type="text" id="u-search" placeholder="Suchen: Name, Branche, Ort, Nr. …" autocomplete="off"></div>
        <select id="u-status" style="width:170px">
          <option value="">Alle Status</option>
          ${STATUS.map(s => `<option>${s}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <div class="count" id="u-count"></div>
      </div>
      <div class="card">
        <div class="table-wrap" id="u-table"></div>
      </div>`;

    const tableEl = container.querySelector('#u-table');
    const countEl = container.querySelector('#u-count');
    const subEl = container.querySelector('#u-subtitle');

    function sortArrow(key) { return sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : ''; }

    function renderTable() {
      const alle = db.list('companies');
      subEl.textContent = `${alle.length} Unternehmen erfasst`;
      const q = suche.trim().toLowerCase();
      const rows = alle.filter(fa => {
        if (statusFilter && fa.status !== statusFilter) return false;
        if (!q) return true;
        return [fa.name, fa.branche, fa.ort, fa.nr].some(s => String(s || '').toLowerCase().includes(q));
      }).sort((a, b) => String(a[sortKey] || '').toLowerCase().localeCompare(String(b[sortKey] || '').toLowerCase(), 'de') * sortDir);
      countEl.textContent = `${rows.length} von ${alle.length} Unternehmen`;

      if (rows.length === 0) {
        tableEl.innerHTML = ui.emptyState({
          icon: 'building', title: 'Keine Unternehmen gefunden',
          text: 'Passen Sie Suche oder Filter an oder erfassen Sie ein neues Unternehmen.'
        });
        return;
      }

      tableEl.innerHTML = `
        <table class="table">
          <thead><tr>
            <th class="sortable" data-sort="nr">Nr.${sortArrow('nr')}</th>
            <th class="sortable" data-sort="name">Firma${sortArrow('name')}</th>
            <th>Ort</th>
            <th>Ansprechpartner</th>
            <th>Offene Vakanzen</th>
            <th>Honorarsatz</th>
            <th>Status</th>
            <th>Betreuer</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${rows.map(fa => `
              <tr class="clickable" data-id="${fa.id}">
                <td class="text-muted">${ui.esc(fa.nr)}</td>
                <td>
                  <div class="flex" style="gap:10px">
                    ${firmenAvatar(fa.name, 36, 8)}
                    <div><div class="cell-main">${ui.esc(fa.name)}</div><div class="cell-sub">${ui.esc(fa.branche || '')}</div></div>
                  </div>
                </td>
                <td>${ui.esc(fa.ort || '–')}</td>
                <td>${(fa.ansprechpartner || []).length}</td>
                <td>${offeneVakanzen(fa.id).length}</td>
                <td>${ui.esc(honorarText(fa))}</td>
                <td>${ui.badge(fa.status)}</td>
                <td title="${ui.esc(ui.userName(fa.betreuerId))}">${ui.userAvatar(fa.betreuerId, 28)}</td>
                <td class="actions-cell">
                  <button class="btn-icon" data-act="edit" title="Bearbeiten">${ui.icon('edit', 15)}</button>
                  <button class="btn-icon danger" data-act="delete" title="Löschen">${ui.icon('trash', 15)}</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>`;

      tableEl.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const key = th.dataset.sort;
          if (sortKey === key) { sortDir = -sortDir; } else { sortKey = key; sortDir = 1; }
          renderTable();
        });
      });
      tableEl.querySelectorAll('tbody tr').forEach(tr => {
        const id = Number(tr.dataset.id);
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button, a')) return;
          App.navigate('/unternehmen/' + id);
        });
        tr.querySelector('[data-act="edit"]').addEventListener('click', () => {
          openCompanyModal(db.get('companies', id), renderTable);
        });
        tr.querySelector('[data-act="delete"]').addEventListener('click', () => {
          deleteCompany(db.get('companies', id), renderTable);
        });
      });
    }

    container.querySelector('#u-new').addEventListener('click', () => {
      openCompanyModal(null, (rec) => App.navigate('/unternehmen/' + rec.id));
    });
    container.querySelector('#u-search').addEventListener('input', (e) => { suche = e.target.value; renderTable(); });
    container.querySelector('#u-status').addEventListener('change', (e) => { statusFilter = e.target.value; renderTable(); });

    renderTable();

    if (openNew) {
      // Hash bereinigen, damit «neu» nach dem Schliessen des Modals nicht bestehen bleibt
      history.replaceState(null, '', '#/unternehmen');
      openCompanyModal(null, (rec) => App.navigate('/unternehmen/' + rec.id));
    }
  }

  /* ---------- Detail ---------- */
  function renderDetail(container, id) {
    let activeTab = 'uebersicht';

    function draw() {
      const f = db.get('companies', id);
      if (!f) {
        container.innerHTML = ui.emptyState({
          icon: 'building', title: 'Unternehmen nicht gefunden',
          text: 'Der gewünschte Eintrag existiert nicht oder wurde gelöscht.',
          action: '<a class="btn btn-secondary" href="#/unternehmen">Zur Übersicht</a>'
        });
        return;
      }

      const ap = f.ansprechpartner || [];
      const vaks = firmaVakanzen(id);
      const acts = firmaAktivitaeten(id);
      const offene = offeneVakanzen(id);
      const placements = firmaPlacements(id);
      const laufend = placements.filter(p => !['Vermittelt', 'Absage'].includes(p.phase));
      const umsatz = placements.filter(p => p.phase === 'Vermittelt').reduce((s, p) => s + (Number(p.honorar) || 0), 0);
      const adresse = [f.strasse, [f.plz, f.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');

      const apCards = ap.map(p => `
        <div class="card" style="padding:16px" data-ap="${p.id}">
          <div style="display:flex;gap:12px;align-items:flex-start">
            ${ui.avatar(`${p.vorname} ${p.nachname}`, 40)}
            <div style="flex:1;min-width:0">
              <div class="fw-600">${ui.esc(apName(p))}</div>
              <div class="text-muted fs-12">${ui.esc(p.funktion || '–')}</div>
            </div>
            <div style="display:flex;gap:2px">
              <button class="btn-icon" data-act="edit-ap" title="Bearbeiten">${ui.icon('edit', 15)}</button>
              <button class="btn-icon danger" data-act="delete-ap" title="Löschen">${ui.icon('trash', 15)}</button>
            </div>
          </div>
          <div class="mt-10" style="display:grid;gap:6px;font-size:12.5px">
            <div class="flex text-muted">${ui.icon('mail', 14)} ${p.email ? `<a href="mailto:${ui.esc(p.email)}">${ui.esc(p.email)}</a>` : '<span>–</span>'}</div>
            <div class="flex text-muted">${ui.icon('phone', 14)} ${p.telefon ? `<a href="tel:${ui.esc(p.telefon)}">${ui.esc(p.telefon)}</a>` : '<span>–</span>'}</div>
          </div>
        </div>`).join('');

      const vakRows = vaks.map(v => {
        const overdue = v.deadline && ui.isOverdue(v.deadline) && ['Offen', 'In Bearbeitung'].includes(v.status);
        const kand = db.list('placements').filter(p => p.vacancyId === v.id && p.phase !== 'Absage').length;
        return `
          <tr class="clickable" data-vak="${v.id}">
            <td class="text-muted">${ui.esc(v.nr)}</td>
            <td>
              <a href="#/vakanzen/${v.id}" class="cell-main">${ui.esc(v.titel)}</a>
              <div class="cell-sub">${ui.esc(v.einsatzort || '')}</div>
            </td>
            <td>${ui.esc(v.pensum || '–')}</td>
            <td>${ui.badge(v.prioritaet)}</td>
            <td class="${overdue ? 'overdue' : ''}">${ui.formatDate(v.deadline)}</td>
            <td>${ui.badge(v.status)}</td>
            <td>${kand}</td>
          </tr>`;
      }).join('');

      container.innerHTML = `
        <a class="back-link" href="#/unternehmen">${ui.icon('arrow-left', 15)} Zurück zur Übersicht</a>
        <div class="detail-head">
          ${firmenAvatar(f.name, 56, 14)}
          <div class="dh-info">
            <h1>${ui.esc(f.name)} ${ui.badge(f.status)}</h1>
            <div class="sub">
              ${f.branche ? `<span>${ui.esc(f.branche)}</span>` : ''}
              ${(f.plz || f.ort) ? `<span>${ui.icon('map-pin', 13)} ${ui.esc([f.plz, f.ort].filter(Boolean).join(' '))}</span>` : ''}
              <span>${ui.esc(f.nr)}</span>
              ${f.website ? `<a href="${ui.esc(webUrl(f.website))}" target="_blank" rel="noopener">${ui.icon('globe', 13)} ${ui.esc(f.website)}</a>` : ''}
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" id="u-btn-activity">${ui.icon('calendar-check', 16)} Aktivität</button>
            <button class="btn btn-secondary" id="u-btn-vacancy">${ui.icon('briefcase', 16)} Neue Vakanz</button>
            <button class="btn btn-primary" id="u-btn-edit">${ui.icon('edit', 16)} Bearbeiten</button>
            <button class="btn-icon danger" id="u-btn-delete" title="Löschen">${ui.icon('trash', 17)}</button>
          </div>
        </div>

        <div class="tabs">
          <button class="tab" data-tab="uebersicht">Übersicht</button>
          <button class="tab" data-tab="ansprechpartner">Ansprechpartner <span class="tab-count">${ap.length}</span></button>
          <button class="tab" data-tab="vakanzen">Vakanzen <span class="tab-count">${vaks.length}</span></button>
          <button class="tab" data-tab="aktivitaeten">Aktivitäten <span class="tab-count">${acts.length}</span></button>
        </div>

        <div class="tab-panel" data-panel="uebersicht">
          <div class="detail-grid">
            <div>
              <div class="card mb-20">
                <div class="card-header"><h3>Firmendaten</h3></div>
                <div class="card-body">
                  <dl class="info-list">
                    <dt>Telefon</dt><dd>${f.telefon ? `<a href="tel:${ui.esc(f.telefon)}">${ui.esc(f.telefon)}</a>` : '–'}</dd>
                    <dt>E-Mail</dt><dd>${f.email ? `<a href="mailto:${ui.esc(f.email)}">${ui.esc(f.email)}</a>` : '–'}</dd>
                    <dt>Website</dt><dd>${f.website ? `<a href="${ui.esc(webUrl(f.website))}" target="_blank" rel="noopener">${ui.esc(f.website)} ${ui.icon('external', 12)}</a>` : '–'}</dd>
                    <dt>Adresse</dt><dd>${ui.esc(adresse || '–')}</dd>
                    <dt>Honorarsatz</dt><dd>${ui.esc(honorarText(f))}</dd>
                    <dt>Betreuer/in</dt><dd><span class="flex">${ui.userAvatar(f.betreuerId, 24)} ${ui.esc(ui.userName(f.betreuerId))}</span></dd>
                    <dt>Erfasst am</dt><dd>${ui.formatDate(f.erstelltAm)}</dd>
                    <dt>Status</dt><dd>${ui.badge(f.status)}</dd>
                  </dl>
                </div>
              </div>
              <div class="card">
                <div class="card-header"><h3>Notizen</h3></div>
                <div class="card-body">
                  ${f.notizen ? `<p style="line-height:1.6;white-space:pre-wrap">${ui.esc(f.notizen)}</p>` : '<span class="text-muted">Keine Notizen vorhanden.</span>'}
                </div>
              </div>
            </div>
            <div style="display:grid;gap:14px;align-content:start">
              <div class="kpi"><div class="kpi-icon blue">${ui.icon('briefcase', 20)}</div><div><div class="kpi-value">${offene.length}</div><div class="kpi-label">Offene Vakanzen</div></div></div>
              <div class="kpi"><div class="kpi-icon amber">${ui.icon('handshake', 20)}</div><div><div class="kpi-value">${laufend.length}</div><div class="kpi-label">Laufende Vermittlungen</div></div></div>
              <div class="kpi"><div class="kpi-icon green">${ui.icon('trending-up', 20)}</div><div><div class="kpi-value">${ui.formatCHF(umsatz)}</div><div class="kpi-label">Umsatz total</div></div></div>
            </div>
          </div>
        </div>

        <div class="tab-panel" data-panel="ansprechpartner">
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
            <button class="btn btn-secondary" id="u-btn-newap">${ui.icon('plus', 15)} Neuer Ansprechpartner</button>
          </div>
          ${ap.length ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px">${apCards}</div>`
            : ui.emptyState({ icon: 'users', title: 'Keine Ansprechpartner', text: 'Erfassen Sie die erste Kontaktperson dieses Unternehmens.' })}
        </div>

        <div class="tab-panel" data-panel="vakanzen">
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
            <button class="btn btn-secondary" id="u-btn-vacancy2">${ui.icon('plus', 15)} Neue Vakanz</button>
          </div>
          ${vaks.length ? `
            <div class="card">
              <div class="table-wrap">
                <table class="table">
                  <thead><tr>
                    <th>Nr.</th><th>Titel</th><th>Pensum</th><th>Priorität</th><th>Deadline</th><th>Status</th><th>Kandidaten</th>
                  </tr></thead>
                  <tbody>${vakRows}</tbody>
                </table>
              </div>
            </div>`
            : ui.emptyState({ icon: 'briefcase', title: 'Keine Vakanzen', text: 'Für dieses Unternehmen sind noch keine Vakanzen erfasst.' })}
        </div>

        <div class="tab-panel" data-panel="aktivitaeten">
          <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
            <button class="btn btn-secondary" id="u-btn-newact">${ui.icon('plus', 15)} Neue Aktivität</button>
          </div>
          <div class="card"><div class="card-body" id="u-act-timeline"></div></div>
        </div>`;

      // Aktiven Tab wiederherstellen (bleibt über Re-Renders erhalten)
      container.querySelectorAll('.tab[data-tab]').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
      container.querySelectorAll('.tab-panel[data-panel]').forEach(p => p.classList.toggle('active', p.dataset.panel === activeTab));
      ui.bindTabs(container, (name) => { activeTab = name; });

      const onActivitySaved = () => { App.updateNavBadges(); draw(); };
      container.querySelector('#u-btn-activity').addEventListener('click', () => {
        shared.openActivityModal({ bezug: { typ: 'unternehmen', id: id }, onSaved: onActivitySaved });
      });
      container.querySelector('#u-btn-newact').addEventListener('click', () => {
        shared.openActivityModal({ bezug: { typ: 'unternehmen', id: id }, onSaved: onActivitySaved });
      });
      container.querySelector('#u-btn-vacancy').addEventListener('click', () => App.navigate('/vakanzen/neu/' + id));
      container.querySelector('#u-btn-vacancy2').addEventListener('click', () => App.navigate('/vakanzen/neu/' + id));
      container.querySelector('#u-btn-edit').addEventListener('click', () => openCompanyModal(f, () => draw()));
      container.querySelector('#u-btn-delete').addEventListener('click', () => {
        deleteCompany(f, () => App.navigate('/unternehmen'));
      });
      container.querySelector('#u-btn-newap').addEventListener('click', () => openContactModal(id, null, draw));

      container.querySelectorAll('[data-ap]').forEach(card => {
        const apId = Number(card.dataset.ap);
        card.querySelector('[data-act="edit-ap"]').addEventListener('click', () => {
          const cont = (db.get('companies', id).ansprechpartner || []).find(x => Number(x.id) === apId);
          if (cont) openContactModal(id, cont, draw);
        });
        card.querySelector('[data-act="delete-ap"]').addEventListener('click', () => {
          const arr = db.get('companies', id).ansprechpartner || [];
          const cont = arr.find(x => Number(x.id) === apId);
          if (!cont) return;
          ui.confirm(`Ansprechpartner «${apName(cont)}» wirklich löschen?`, () => {
            db.update('companies', id, { ansprechpartner: arr.filter(x => Number(x.id) !== apId) });
            ui.toast('Ansprechpartner gelöscht');
            draw();
          });
        });
      });

      container.querySelectorAll('[data-vak]').forEach(tr => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button, a')) return;
          App.navigate('/vakanzen/' + Number(tr.dataset.vak));
        });
      });

      shared.activityTimeline(container.querySelector('#u-act-timeline'), {
        bezug: { typ: 'unternehmen', id: id },
        emptyText: 'Für dieses Unternehmen sind noch keine Aktivitäten erfasst.',
        onChange: () => { App.updateNavBadges(); draw(); }
      });
    }

    draw();
  }

  /* ---------- Registrierung ---------- */
  App.registerView('unternehmen', {
    title: 'Unternehmen',
    icon: 'building',
    nav: true,
    order: 3,
    render(container, params) {
      if (!params || params.length === 0) { renderList(container, false); return; }
      if (params[0] === 'neu') { renderList(container, true); return; }
      renderDetail(container, Number(params[0]));
    }
  });
})();
