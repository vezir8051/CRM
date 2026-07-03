/* ============================================================
   PersoCRM – Vakanzen
   Liste mit Suche/Filter/Sortierung, Erfassungs-Modal,
   Detailansicht mit Pipeline, Matching und Aktivitäten.
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  const STATUS = ['Offen', 'In Bearbeitung', 'Besetzt', 'On Hold', 'Storniert'];
  const PRIOS = ['Hoch', 'Mittel', 'Niedrig'];
  const ARTEN = ['Festanstellung', 'Temporär', 'Try & Hire'];

  /* ---------- Helfer ---------- */
  function firmenName(id) {
    const f = db.get('companies', id);
    return f ? f.name : '–';
  }

  function lohnText(v) {
    if (v.lohnMin != null && v.lohnMax != null) return `${ui.formatCHF(v.lohnMin)} - ${ui.formatCHF(v.lohnMax)}`;
    if (v.lohnMin != null) return ui.formatCHF(v.lohnMin);
    if (v.lohnMax != null) return ui.formatCHF(v.lohnMax);
    return '–';
  }

  function pipelineCount(vacancyId) {
    return db.list('placements').filter(p => p.vacancyId === vacancyId && p.phase !== 'Absage').length;
  }

  // Deadline gilt nur als überfällig, solange die Vakanz noch aktiv bearbeitet wird
  function deadlineUeberfaellig(v) {
    return !!v.deadline && v.deadline < ui.today() && (v.status === 'Offen' || v.status === 'In Bearbeitung');
  }

  function deleteVacancy(v, after) {
    ui.confirm(`Vakanz «${v.titel}» inklusive aller zugehörigen Vermittlungen wirklich löschen?`, () => {
      db.list('placements').filter(p => p.vacancyId === v.id).map(p => p.id)
        .forEach(pid => db.remove('placements', pid));
      db.remove('vacancies', v.id);
      ui.toast('Vakanz gelöscht');
      App.updateNavBadges();
      if (after) after();
    });
  }

  /* ---------- Erfassungs-/Bearbeitungs-Modal ---------- */
  function openVacancyModal(opts) {
    opts = opts || {};
    const v = opts.vacancy || null;
    const companies = db.list('companies');
    const users = db.list('users');
    const user = App.auth.currentUser();
    const preCompanyId = v ? v.companyId : (opts.companyId || null);
    const preBetreuerId = v ? v.betreuerId : (user ? user.id : 1);

    function apOptions(companyId, selectedId) {
      const f = db.get('companies', companyId);
      const liste = f ? (f.ansprechpartner || []) : [];
      return `<option value="">– Kein Ansprechpartner –</option>` + liste.map(a =>
        `<option value="${a.id}" ${selectedId != null && Number(selectedId) === a.id ? 'selected' : ''}>` +
        `${ui.esc(`${a.vorname} ${a.nachname}`)}${a.funktion ? ` – ${ui.esc(a.funktion)}` : ''}</option>`).join('');
    }

    ui.modal({
      title: v ? 'Vakanz bearbeiten' : 'Neue Vakanz',
      width: 720,
      content: `
        <form id="vacancy-form">
          <div class="form-grid">
            <div class="field span-2"><label>Titel *</label>
              <input type="text" name="titel" required value="${v ? ui.esc(v.titel) : ''}" placeholder="z.B. Softwareentwickler Fullstack"></div>
            <div class="field"><label>Unternehmen *</label>
              <select name="companyId" required>
                <option value="">– wählen –</option>
                ${companies.map(f => `<option value="${f.id}" ${preCompanyId === f.id ? 'selected' : ''}>${ui.esc(f.name)} (${ui.esc(f.nr)})</option>`).join('')}
              </select></div>
            <div class="field"><label>Ansprechpartner</label>
              <select name="ansprechpartnerId">${apOptions(preCompanyId, v ? v.ansprechpartnerId : null)}</select></div>
            <div class="field"><label>Einsatzort</label>
              <input type="text" name="einsatzort" value="${v ? ui.esc(v.einsatzort || '') : ''}" placeholder="z.B. Zürich"></div>
            <div class="field"><label>Pensum</label>
              <input type="text" name="pensum" value="${v ? ui.esc(v.pensum || '') : ''}" placeholder="z.B. 80-100%"></div>
            <div class="field"><label>Anstellungsart</label>
              <select name="anstellungsart">${ARTEN.map(a => `<option ${(v ? v.anstellungsart : 'Festanstellung') === a ? 'selected' : ''}>${ui.esc(a)}</option>`).join('')}</select></div>
            <div class="field"><label>Priorität</label>
              <select name="prioritaet">${PRIOS.map(p => `<option ${(v ? v.prioritaet : 'Mittel') === p ? 'selected' : ''}>${p}</option>`).join('')}</select></div>
            <div class="field"><label>Lohn min. (CHF)</label>
              <input type="number" name="lohnMin" min="0" step="1000" value="${v && v.lohnMin != null ? v.lohnMin : ''}" placeholder="z.B. 80000"></div>
            <div class="field"><label>Lohn max. (CHF)</label>
              <input type="number" name="lohnMax" min="0" step="1000" value="${v && v.lohnMax != null ? v.lohnMax : ''}" placeholder="z.B. 95000"></div>
            <div class="field span-2"><label>Anforderungen</label>
              <input type="text" name="anforderungen" value="${v ? ui.esc((v.anforderungen || []).join(', ')) : ''}" placeholder="z.B. JavaScript, React, SQL">
              <div class="hint">Mehrere Anforderungen mit Komma trennen.</div></div>
            <div class="field"><label>Deadline</label>
              <input type="date" name="deadline" value="${v && v.deadline ? ui.esc(v.deadline) : ''}"></div>
            <div class="field"><label>Status</label>
              <select name="status">${STATUS.map(s => `<option ${(v ? v.status : 'Offen') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
            <div class="field"><label>Betreuer</label>
              <select name="betreuerId">${users.map(u => `<option value="${u.id}" ${preBetreuerId === u.id ? 'selected' : ''}>${ui.esc(u.name)}</option>`).join('')}</select></div>
            <div class="field span-2"><label>Beschreibung</label>
              <textarea name="beschreibung" placeholder="Aufgaben, Umfeld, Besonderheiten…">${v ? ui.esc(v.beschreibung || '') : ''}</textarea></div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${v ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        const form = el.querySelector('#vacancy-form');
        form.elements.companyId.addEventListener('change', () => {
          form.elements.ansprechpartnerId.innerHTML = apOptions(Number(form.elements.companyId.value), null);
        });
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const rec = {
            titel: fd.get('titel').trim(),
            companyId: Number(fd.get('companyId')),
            ansprechpartnerId: fd.get('ansprechpartnerId') ? Number(fd.get('ansprechpartnerId')) : null,
            einsatzort: (fd.get('einsatzort') || '').trim(),
            pensum: (fd.get('pensum') || '').trim(),
            anstellungsart: fd.get('anstellungsart'),
            lohnMin: fd.get('lohnMin') ? Number(fd.get('lohnMin')) : null,
            lohnMax: fd.get('lohnMax') ? Number(fd.get('lohnMax')) : null,
            anforderungen: (fd.get('anforderungen') || '').split(',').map(s => s.trim()).filter(Boolean),
            prioritaet: fd.get('prioritaet'),
            deadline: fd.get('deadline') || null,
            status: fd.get('status'),
            betreuerId: Number(fd.get('betreuerId')),
            beschreibung: (fd.get('beschreibung') || '').trim()
          };
          let saved;
          if (v) {
            saved = db.update('vacancies', v.id, rec);
            ui.toast('Vakanz aktualisiert');
          } else {
            rec.nr = db.nextNr('V');
            saved = db.insert('vacancies', rec);
            ui.toast('Vakanz erstellt');
          }
          App.updateNavBadges();
          close();
          if (opts.onSaved) opts.onSaved(saved);
        });
      }
    });
  }

  /* ---------- Liste ---------- */
  function renderList(container) {
    const state = { q: '', status: 'Alle', prio: 'Alle', art: 'Alle', sortKey: 'nr', sortDir: 1 };

    function filtered() {
      let rows = db.list('vacancies').slice();
      const q = state.q.trim().toLowerCase();
      if (q) {
        rows = rows.filter(v =>
          [v.titel, v.nr, v.einsatzort, firmenName(v.companyId)]
            .some(s => String(s || '').toLowerCase().includes(q)));
      }
      if (state.status !== 'Alle') rows = rows.filter(v => v.status === state.status);
      if (state.prio !== 'Alle') rows = rows.filter(v => v.prioritaet === state.prio);
      if (state.art !== 'Alle') rows = rows.filter(v => v.anstellungsart === state.art);
      rows.sort((a, b) => {
        let x, y;
        if (state.sortKey === 'deadline') {
          x = a.deadline || '9999-99-99'; y = b.deadline || '9999-99-99';
        } else {
          x = a[state.sortKey] || ''; y = b[state.sortKey] || '';
        }
        return String(x).localeCompare(String(y), 'de', { numeric: true }) * state.sortDir;
      });
      return rows;
    }

    function sortArrow(key) {
      if (state.sortKey !== key) return '';
      return state.sortDir === 1 ? ' ▲' : ' ▼';
    }

    function renderTable() {
      const rows = filtered();
      const wrap = container.querySelector('#vak-table');
      container.querySelector('#vak-count').textContent = `${rows.length} von ${db.list('vacancies').length} Vakanzen`;

      if (rows.length === 0) {
        wrap.innerHTML = `<div class="card">${ui.emptyState({
          icon: 'briefcase', title: 'Keine Vakanzen gefunden',
          text: 'Passen Sie Suche oder Filter an, oder erfassen Sie eine neue Vakanz.'
        })}</div>`;
        return;
      }

      wrap.innerHTML = `
        <div class="card"><div class="table-wrap">
          <table class="table">
            <thead><tr>
              <th class="sortable" data-sort="nr">Nr${sortArrow('nr')}</th>
              <th class="sortable" data-sort="titel">Titel${sortArrow('titel')}</th>
              <th>Einsatzort</th>
              <th>Pensum</th>
              <th>Art</th>
              <th>Lohn</th>
              <th>Priorität</th>
              <th class="sortable" data-sort="deadline">Deadline${sortArrow('deadline')}</th>
              <th>Kandidaten</th>
              <th>Status</th>
              <th></th>
            </tr></thead>
            <tbody>
              ${rows.map(v => `
                <tr class="clickable" data-id="${v.id}">
                  <td>${ui.esc(v.nr)}</td>
                  <td><div class="cell-main">${ui.esc(v.titel)}</div><div class="cell-sub">${ui.esc(firmenName(v.companyId))}</div></td>
                  <td>${ui.esc(v.einsatzort || '–')}</td>
                  <td>${ui.esc(v.pensum || '–')}</td>
                  <td>${ui.badge(v.anstellungsart)}</td>
                  <td>${ui.esc(lohnText(v))}</td>
                  <td>${ui.badge(v.prioritaet)}</td>
                  <td class="${deadlineUeberfaellig(v) ? 'overdue' : ''}">${ui.esc(ui.relDate(v.deadline))}</td>
                  <td>${pipelineCount(v.id)}</td>
                  <td>${ui.badge(v.status)}</td>
                  <td class="actions-cell">
                    <button class="btn-icon" data-act="edit" title="Bearbeiten">${ui.icon('edit', 15)}</button>
                    <button class="btn-icon danger" data-act="delete" title="Löschen">${ui.icon('trash', 15)}</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div></div>`;

      wrap.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDir = -state.sortDir;
        else { state.sortKey = key; state.sortDir = 1; }
        renderTable();
      }));

      wrap.querySelectorAll('tbody tr[data-id]').forEach(tr => tr.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) return;
        App.navigate('/vakanzen/' + tr.dataset.id);
      }));

      wrap.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', () => {
        const v = db.get('vacancies', Number(btn.closest('tr').dataset.id));
        if (!v) return;
        if (btn.dataset.act === 'edit') openVacancyModal({ vacancy: v, onSaved: draw });
        else if (btn.dataset.act === 'delete') deleteVacancy(v, draw);
      }));
    }

    function draw() {
      const alle = db.list('vacancies');
      const offen = alle.filter(v => v.status === 'Offen').length;
      container.innerHTML = `
        <div class="page-header">
          <div>
            <h1>Vakanzen</h1>
            <div class="subtitle">${offen} offen · ${alle.length} insgesamt</div>
          </div>
          <div class="actions">
            <button class="btn btn-primary" id="vak-neu">${ui.icon('plus', 16)} Neue Vakanz</button>
          </div>
        </div>
        <div class="toolbar">
          <div class="searchbox">
            ${ui.icon('search', 16)}
            <input type="text" id="vak-search" placeholder="Suchen: Titel, Nr, Ort, Firma…" value="${ui.esc(state.q)}">
          </div>
          <select id="vak-f-status"><option>Alle</option>${STATUS.map(s => `<option>${s}</option>`).join('')}</select>
          <select id="vak-f-prio"><option>Alle</option>${PRIOS.map(p => `<option>${p}</option>`).join('')}</select>
          <select id="vak-f-art"><option>Alle</option>${ARTEN.map(a => `<option>${ui.esc(a)}</option>`).join('')}</select>
          <div class="spacer"></div>
          <span class="count" id="vak-count"></span>
        </div>
        <div id="vak-table"></div>`;

      container.querySelector('#vak-f-status').value = state.status;
      container.querySelector('#vak-f-prio').value = state.prio;
      container.querySelector('#vak-f-art').value = state.art;

      container.querySelector('#vak-neu').addEventListener('click', () => {
        openVacancyModal({ onSaved: (rec) => App.navigate('/vakanzen/' + rec.id) });
      });
      container.querySelector('#vak-search').addEventListener('input', (e) => { state.q = e.target.value; renderTable(); });
      container.querySelector('#vak-f-status').addEventListener('change', (e) => { state.status = e.target.value; renderTable(); });
      container.querySelector('#vak-f-prio').addEventListener('change', (e) => { state.prio = e.target.value; renderTable(); });
      container.querySelector('#vak-f-art').addEventListener('change', (e) => { state.art = e.target.value; renderTable(); });

      renderTable();
    }

    draw();
  }

  /* ---------- Detail ---------- */
  function renderDetail(container, id) {
    let activeTab = 'uebersicht';

    function skillHit(kandidat, anforderung) {
      const a = String(anforderung).toLowerCase();
      return (kandidat.qualifikationen || []).some(s => {
        const t = String(s).toLowerCase();
        return t.includes(a) || a.includes(t);
      });
    }

    function uebersichtHtml(vak, firma) {
      const ap = firma ? (firma.ansprechpartner || []).find(a => a.id === Number(vak.ansprechpartnerId)) : null;
      let apHtml = '–';
      if (ap) {
        apHtml = `${ui.esc(`${ap.vorname} ${ap.nachname}`)}
          ${ap.funktion ? `<div class="cell-sub">${ui.esc(ap.funktion)}</div>` : ''}
          <div class="fs-12" style="margin-top:3px">
            ${ap.email ? `<a href="mailto:${ui.esc(ap.email)}">${ui.icon('mail', 12)} ${ui.esc(ap.email)}</a><br>` : ''}
            ${ap.telefon ? `<a href="tel:${ui.esc(ap.telefon)}">${ui.icon('phone', 12)} ${ui.esc(ap.telefon)}</a>` : ''}
          </div>`;
      }
      const anf = vak.anforderungen || [];
      return `
        <div class="detail-grid">
          <div>
            <div class="card mb-20">
              <div class="card-header"><h3>Stellenbeschreibung</h3></div>
              <div class="card-body"><p style="white-space:pre-line">${vak.beschreibung ? ui.esc(vak.beschreibung) : '<span class="text-muted">Keine Beschreibung erfasst.</span>'}</p></div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Anforderungen</h3></div>
              <div class="card-body">
                ${anf.length ? anf.map(a => `<span class="tag">${ui.esc(a)}</span>`).join('') : '<span class="text-muted">Keine Anforderungen erfasst.</span>'}
              </div>
            </div>
          </div>
          <div>
            <div class="card mb-20">
              <div class="card-header"><h3>Eckdaten</h3></div>
              <div class="card-body"><dl class="info-list">
                <dt>Unternehmen</dt><dd><a href="#/unternehmen/${vak.companyId}">${ui.esc(firma ? firma.name : '–')}</a></dd>
                <dt>Ansprechpartner</dt><dd>${apHtml}</dd>
                <dt>Lohnband</dt><dd>${ui.esc(lohnText(vak))}</dd>
                <dt>Pensum</dt><dd>${ui.esc(vak.pensum || '–')}</dd>
                <dt>Anstellungsart</dt><dd>${ui.badge(vak.anstellungsart)}</dd>
                <dt>Deadline</dt><dd class="${deadlineUeberfaellig(vak) ? 'overdue' : ''}">${ui.esc(ui.formatDate(vak.deadline))}</dd>
                <dt>Betreuer</dt><dd>${ui.esc(ui.userName(vak.betreuerId))}</dd>
                <dt>Erstellt am</dt><dd>${ui.esc(ui.formatDate(vak.erstelltAm))}</dd>
              </dl></div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Status ändern</h3></div>
              <div class="card-body">
                <select id="vak-status-select">${STATUS.map(s => `<option ${vak.status === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
              </div>
            </div>
          </div>
        </div>`;
    }

    function pipelineHtml(pipeline) {
      const inner = pipeline.length === 0
        ? ui.emptyState({
            icon: 'handshake', title: 'Noch keine Kandidaten im Prozess',
            text: 'Schlagen Sie passende Kandidaten für diese Vakanz vor.',
            action: `<button class="btn btn-primary" data-act="vorschlagen">${ui.icon('plus', 15)} Kandidat vorschlagen</button>`
          })
        : `<div class="table-wrap"><table class="table">
            <thead><tr><th>Kandidat</th><th>Phase</th><th>Seit</th><th>Honorar</th><th></th></tr></thead>
            <tbody>
              ${pipeline.map(p => {
                const k = db.get('candidates', p.candidateId);
                const name = shared.candidateName(p.candidateId);
                const seit = (p.verlauf && p.verlauf.length) ? p.verlauf[p.verlauf.length - 1].datum : p.erstelltAm;
                return `
                  <tr data-pid="${p.id}">
                    <td><div class="flex">${ui.avatar(name, 30)}<div>
                      <a class="cell-main" href="#/kandidaten/${p.candidateId}">${ui.esc(name)}</a>
                      <div class="cell-sub">${ui.esc(k ? k.beruf : '–')}</div>
                    </div></div></td>
                    <td>${ui.badge(p.phase)}</td>
                    <td>${ui.esc(ui.formatDate(seit))}</td>
                    <td>${ui.esc(ui.formatCHF(p.honorar))}</td>
                    <td class="actions-cell">
                      <select data-pact="phase" style="width:150px;height:30px;font-size:12.5px;display:inline-block;vertical-align:middle">
                        ${shared.PHASEN.map(ph => `<option ${p.phase === ph ? 'selected' : ''}>${ph}</option>`).join('')}
                      </select>
                      <button class="btn-icon" data-pact="edit" title="Bearbeiten">${ui.icon('edit', 15)}</button>
                      <button class="btn-icon danger" data-pact="delete" title="Löschen">${ui.icon('trash', 15)}</button>
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table></div>`;
      return `
        <div class="card">
          <div class="card-header"><h3>Pipeline</h3>
            <div class="actions"><button class="btn btn-secondary btn-sm" data-act="vorschlagen">${ui.icon('plus', 14)} Kandidat vorschlagen</button></div>
          </div>
          <div class="card-body ${pipeline.length ? 'flush' : ''}">${inner}</div>
        </div>`;
    }

    function matchingHtml(vak) {
      const imProzess = new Set(db.list('placements')
        .filter(p => p.vacancyId === id && p.phase !== 'Absage')
        .map(p => p.candidateId));
      const treffer = db.list('candidates')
        .filter(c => !imProzess.has(c.id) && ['Neu', 'In Prüfung', 'Aktiv'].includes(c.status))
        .map(c => ({ c, score: shared.matchScore(c, vak) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      const inner = treffer.length === 0
        ? ui.emptyState({
            icon: 'target', title: 'Keine passenden Kandidaten',
            text: 'Aktuell sind keine verfügbaren Kandidaten ausserhalb der Pipeline vorhanden.'
          })
        : `<div class="table-wrap"><table class="table">
            <thead><tr><th>Kandidat</th><th>Skills</th><th>Verfügbar ab</th><th>Match</th><th></th></tr></thead>
            <tbody>
              ${treffer.map(({ c, score }) => `
                <tr>
                  <td><div class="flex">${ui.avatar(`${c.vorname} ${c.nachname}`, 30)}<div>
                    <a class="cell-main" href="#/kandidaten/${c.id}">${ui.esc(`${c.vorname} ${c.nachname}`)}</a>
                    <div class="cell-sub">${ui.esc(c.beruf || '–')} · ${ui.esc(c.ort || '–')}</div>
                  </div></div></td>
                  <td>${(vak.anforderungen || []).map(a => skillHit(c, a)
                    ? `<span class="badge badge-green">${ui.esc(a)}</span> `
                    : `<span class="tag">${ui.esc(a)}</span>`).join('')}</td>
                  <td>${ui.esc(ui.relDate(c.verfuegbarAb))}</td>
                  <td>${shared.matchBar(score)}</td>
                  <td class="actions-cell">
                    <button class="btn btn-sm btn-primary" data-match-id="${c.id}">Vorschlagen</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table></div>`;

      return `
        <p class="text-muted mb-10">Kandidaten sortiert nach Übereinstimmung mit den Anforderungen.</p>
        <div class="card"><div class="card-body ${treffer.length ? 'flush' : ''}">${inner}</div></div>`;
    }

    function draw() {
      const vak = db.get('vacancies', id);
      if (!vak) {
        container.innerHTML = ui.emptyState({
          icon: 'briefcase', title: 'Vakanz nicht gefunden',
          text: 'Die gewünschte Vakanz existiert nicht oder wurde gelöscht.',
          action: `<a class="btn btn-secondary" href="#/vakanzen">Zur Übersicht</a>`
        });
        return;
      }
      const firma = db.get('companies', vak.companyId);
      const pipeline = db.list('placements').filter(p => p.vacancyId === id);
      const actCount = db.list('activities')
        .filter(a => a.bezug && a.bezug.typ === 'vakanz' && Number(a.bezug.id) === id).length;

      container.innerHTML = `
        <a class="back-link" href="#/vakanzen">${ui.icon('arrow-left', 15)} Zurück zur Übersicht</a>
        <div class="detail-head">
          <div class="dh-info">
            <h1>${ui.esc(vak.titel)} ${ui.badge(vak.status)} ${ui.badge(vak.prioritaet)}</h1>
            <div class="sub">
              <span>${ui.icon('building', 14)} <a href="#/unternehmen/${vak.companyId}">${ui.esc(firma ? firma.name : '–')}</a></span>
              <span>${ui.icon('map-pin', 14)} ${ui.esc(vak.einsatzort || '–')}</span>
              <span>${ui.esc(vak.pensum || '–')}</span>
              <span>${ui.badge(vak.anstellungsart)}</span>
              <span class="${deadlineUeberfaellig(vak) ? 'overdue' : ''}">${ui.icon('clock', 14)} Deadline: ${ui.esc(ui.relDate(vak.deadline))}</span>
            </div>
          </div>
          <div class="actions">
            <button class="btn btn-secondary" data-act="aktivitaet">${ui.icon('calendar-check', 16)} Aktivität</button>
            <button class="btn btn-secondary" data-act="vorschlagen">${ui.icon('handshake', 16)} Kandidat vorschlagen</button>
            <button class="btn btn-primary" data-act="edit">${ui.icon('edit', 15)} Bearbeiten</button>
            <button class="btn-icon danger" data-act="delete" title="Löschen">${ui.icon('trash', 17)}</button>
          </div>
        </div>
        <div class="tabs">
          <button class="tab ${activeTab === 'uebersicht' ? 'active' : ''}" data-tab="uebersicht">Übersicht</button>
          <button class="tab ${activeTab === 'pipeline' ? 'active' : ''}" data-tab="pipeline">Pipeline <span class="tab-count">${pipeline.length}</span></button>
          <button class="tab ${activeTab === 'matching' ? 'active' : ''}" data-tab="matching">Matching</button>
          <button class="tab ${activeTab === 'aktivitaeten' ? 'active' : ''}" data-tab="aktivitaeten">Aktivitäten <span class="tab-count">${actCount}</span></button>
        </div>
        <div class="tab-panel ${activeTab === 'uebersicht' ? 'active' : ''}" data-panel="uebersicht">${uebersichtHtml(vak, firma)}</div>
        <div class="tab-panel ${activeTab === 'pipeline' ? 'active' : ''}" data-panel="pipeline">${pipelineHtml(pipeline)}</div>
        <div class="tab-panel ${activeTab === 'matching' ? 'active' : ''}" data-panel="matching">${matchingHtml(vak)}</div>
        <div class="tab-panel ${activeTab === 'aktivitaeten' ? 'active' : ''}" data-panel="aktivitaeten">
          <div class="card">
            <div class="card-header"><h3>Aktivitäten</h3>
              <div class="actions"><button class="btn btn-secondary btn-sm" data-act="aktivitaet">${ui.icon('plus', 14)} Neue Aktivität</button></div>
            </div>
            <div class="card-body" id="vak-timeline"></div>
          </div>
        </div>`;

      ui.bindTabs(container, (name) => { activeTab = name; });

      /* Kopf-Aktionen (mehrfach vorhandene Buttons via data-act binden) */
      container.querySelectorAll('[data-act="aktivitaet"]').forEach(btn => btn.addEventListener('click', () => {
        shared.openActivityModal({ bezug: { typ: 'vakanz', id }, onSaved: () => { App.updateNavBadges(); draw(); } });
      }));
      container.querySelectorAll('[data-act="vorschlagen"]').forEach(btn => btn.addEventListener('click', () => {
        shared.openPlacementModal({ vacancyId: id, onSaved: () => { App.updateNavBadges(); draw(); } });
      }));
      container.querySelector('[data-act="edit"]').addEventListener('click', () => {
        openVacancyModal({ vacancy: vak, onSaved: draw });
      });
      container.querySelector('[data-act="delete"]').addEventListener('click', () => {
        deleteVacancy(vak, () => App.navigate('/vakanzen'));
      });

      /* Übersicht: Status ändern */
      container.querySelector('#vak-status-select').addEventListener('change', (e) => {
        db.update('vacancies', id, { status: e.target.value });
        ui.toast('Status aktualisiert');
        App.updateNavBadges();
        draw();
      });

      /* Pipeline-Aktionen */
      container.querySelectorAll('[data-pact]').forEach(el => {
        const pid = Number(el.closest('tr').dataset.pid);
        if (el.dataset.pact === 'phase') {
          el.addEventListener('change', () => {
            shared.changePhase(pid, el.value);
            ui.toast('Phase aktualisiert');
            App.updateNavBadges();
            draw();
          });
        } else {
          el.addEventListener('click', () => {
            const p = db.get('placements', pid);
            if (!p) return;
            if (el.dataset.pact === 'edit') {
              shared.openPlacementModal({ placement: p, onSaved: () => { App.updateNavBadges(); draw(); } });
            } else if (el.dataset.pact === 'delete') {
              ui.confirm(`Vermittlung von «${shared.candidateName(p.candidateId)}» wirklich löschen?`, () => {
                db.remove('placements', pid);
                ui.toast('Vermittlung gelöscht');
                draw();
              });
            }
          });
        }
      });

      /* Matching: direkt vorschlagen */
      container.querySelectorAll('[data-match-id]').forEach(btn => btn.addEventListener('click', () => {
        db.insert('placements', {
          candidateId: Number(btn.dataset.matchId), vacancyId: id,
          phase: 'Vorgeschlagen', honorar: null, startdatum: null, notiz: '',
          verlauf: [{ datum: ui.nowLocal(), phase: 'Vorgeschlagen', notiz: 'Via Matching vorgeschlagen.' }]
        });
        ui.toast('Kandidat vorgeschlagen');
        draw();
      }));

      /* Aktivitäten-Timeline */
      shared.activityTimeline(container.querySelector('#vak-timeline'), {
        bezug: { typ: 'vakanz', id },
        emptyText: 'Für diese Vakanz sind noch keine Aktivitäten erfasst.',
        onChange: () => { App.updateNavBadges(); draw(); }
      });
    }

    draw();
  }

  /* ---------- Registrierung ---------- */
  App.registerView('vakanzen', {
    title: 'Vakanzen',
    icon: 'briefcase',
    nav: true,
    order: 4,
    render(container, params) {
      params = params || [];
      if (params[0] === 'neu') {
        renderList(container);
        openVacancyModal({
          companyId: params[1] ? Number(params[1]) : null,
          onSaved: (rec) => App.navigate('/vakanzen/' + rec.id)
        });
        return;
      }
      if (params[0]) {
        renderDetail(container, Number(params[0]));
        return;
      }
      renderList(container);
    }
  });
})();
