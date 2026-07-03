/* ============================================================
   PersoCRM – View: Kandidaten
   Liste (Suche, Filter, Sortierung), Erfassen/Bearbeiten,
   Detailansicht mit Profil, Vermittlungen, Aktivitäten, Dokumenten.
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  const STATUS_LISTE = ['Neu', 'In Prüfung', 'Aktiv', 'Vermittelt', 'Inaktiv'];
  const QUELLEN = ['jobs.ch', 'LinkedIn', 'Website', 'Empfehlung', 'Headhunting', 'Sonstige'];
  const ANSTELLUNGSARTEN = ['Festanstellung', 'Temporär', 'Try & Hire'];
  const DOK_TYPEN = ['Lebenslauf', 'Arbeitszeugnis', 'Diplom', 'Zertifikat', 'Sonstiges'];

  function fullName(c) { return `${c.vorname} ${c.nachname}`; }

  function alter(geburtsdatum) {
    if (!geburtsdatum) return null;
    const g = new Date(geburtsdatum);
    if (isNaN(g.getTime())) return null;
    const h = new Date();
    let a = h.getFullYear() - g.getFullYear();
    if (h.getMonth() < g.getMonth() || (h.getMonth() === g.getMonth() && h.getDate() < g.getDate())) a--;
    return a;
  }

  // "Deutsch: Muttersprache, Englisch: B2" → [{sprache, niveau}]; Niveau darf fehlen
  function parseSprachen(text) {
    return String(text || '').split(',').map(t => t.trim()).filter(Boolean).map(t => {
      const i = t.indexOf(':');
      if (i < 0) return { sprache: t, niveau: '' };
      return { sprache: t.slice(0, i).trim(), niveau: t.slice(i + 1).trim() };
    });
  }

  function candidatePlacements(id) {
    return db.list('placements').filter(p => p.candidateId === id)
      .sort((a, b) => String(b.erstelltAm).localeCompare(String(a.erstelltAm)));
  }

  function candidateActivities(id) {
    return db.list('activities').filter(a => a.bezug && a.bezug.typ === 'kandidat' && Number(a.bezug.id) === id);
  }

  /* ---------- Löschen inkl. abhängiger Datensätze ---------- */
  function deleteCandidate(c, after) {
    ui.confirm(`Kandidat «${fullName(c)}» wirklich löschen? Alle Vermittlungen und Aktivitäten dieses Kandidaten werden ebenfalls gelöscht.`, () => {
      candidatePlacements(c.id).map(p => p.id).forEach(pid => db.remove('placements', pid));
      candidateActivities(c.id).map(a => a.id).forEach(aid => db.remove('activities', aid));
      db.remove('candidates', c.id);
      ui.toast('Kandidat gelöscht');
      App.updateNavBadges();
      after();
    });
  }

  /* ---------- KI-Import: Formular vorbefüllen, Fehlendes rot markieren ---------- */
  function applyImport(modalEl, form, imp) {
    const d = imp.data || {};
    const setVal = (name, v) => {
      if (form.elements[name] && v !== undefined && v !== null && v !== '' && v !== 0) form.elements[name].value = v;
    };
    ['anrede', 'vorname', 'nachname', 'geburtsdatum', 'email', 'telefon', 'strasse', 'plz', 'ort',
      'beruf', 'ausbildung', 'verfuegbarAb', 'pensum', 'anstellungsart', 'berufserfahrung', 'lohnvorstellung']
      .forEach(k => setVal(k, d[k]));
    if (Array.isArray(d.qualifikationen) && d.qualifikationen.length) {
      form.elements.qualifikationen.value = d.qualifikationen.join(', ');
    }
    if (Array.isArray(d.sprachen) && d.sprachen.length) {
      form.elements.sprachen.value = d.sprachen.map(s => s.niveau ? `${s.sprache}: ${s.niveau}` : s.sprache).join(', ');
    }

    const body = modalEl.querySelector('.modal-body');
    const banner = document.createElement('div');
    banner.className = 'import-banner';
    banner.innerHTML = `${ui.icon('sparkles', 16)}<div><strong>Lebenslauf ausgewertet</strong> ${imp.quelle === 'ki' ? 'per KI (Claude)' : 'per lokaler Texterkennung'}.
      Rot markierte Felder konnten nicht aus dem Lebenslauf gelesen werden – bitte prüfen und ergänzen.</div>`;
    body.insertBefore(banner, body.firstChild);

    (imp.missing || []).forEach(name => {
      const input = form.elements[name];
      if (!input || !input.closest) return;
      const field = input.closest('.field');
      if (!field) return;
      field.classList.add('field-missing');
      const hint = document.createElement('div');
      hint.className = 'missing-hint';
      hint.innerHTML = `${ui.icon('alert', 12)} Nicht aus dem Lebenslauf erkannt`;
      field.appendChild(hint);
      const clear = () => {
        if (String(input.value).trim()) { field.classList.remove('field-missing'); hint.remove(); }
      };
      input.addEventListener('input', clear);
      input.addEventListener('change', clear);
    });
  }

  function showDupBanner(modalEl, dup) {
    const body = modalEl.querySelector('.modal-body');
    const alt = body.querySelector('.import-banner.warn');
    if (alt) alt.remove();
    const banner = document.createElement('div');
    banner.className = 'import-banner warn';
    banner.innerHTML = `${ui.icon('alert', 16)}<div><strong>Mögliches Duplikat:</strong> ${ui.esc(fullName(dup))} (${ui.esc(dup.nr)}) ist bereits erfasst.
      Erneut auf «Erstellen» klicken, um trotzdem zu speichern.</div>`;
    body.insertBefore(banner, body.firstChild);
    body.scrollTop = 0;
  }

  /* ---------- Erfassen / Bearbeiten ---------- */
  function openCandidateModal(candidate, onSaved, importResult) {
    const c = candidate || null;
    const users = db.list('users');
    const cur = App.auth.currentUser();
    const betreuerVal = c ? c.betreuerId : (cur ? cur.id : (users[0] ? users[0].id : 1));
    const qualiText = c && Array.isArray(c.qualifikationen) ? c.qualifikationen.join(', ') : '';
    const sprachenText = c && Array.isArray(c.sprachen)
      ? c.sprachen.map(s => s.niveau ? `${s.sprache}: ${s.niveau}` : s.sprache).join(', ') : '';
    const sel = (opts, val) => opts.map(o => `<option ${o === val ? 'selected' : ''}>${ui.esc(o)}</option>`).join('');
    const val = (v) => c && v !== null && v !== undefined ? ui.esc(v) : '';

    ui.modal({
      title: c ? 'Kandidat bearbeiten' : 'Neuer Kandidat',
      width: 720,
      content: `
        <form id="candidate-form">
          <div class="form-grid">
            <div class="form-section-title">Person</div>
            <div class="field"><label>Anrede</label><select name="anrede">${sel(['Herr', 'Frau'], c ? c.anrede : 'Herr')}</select></div>
            <div class="field"><label>Vorname *</label><input type="text" name="vorname" required value="${val(c && c.vorname)}"></div>
            <div class="field"><label>Nachname *</label><input type="text" name="nachname" required value="${val(c && c.nachname)}"></div>
            <div class="field"><label>Geburtsdatum</label><input type="date" name="geburtsdatum" value="${val(c && c.geburtsdatum)}"></div>
            <div class="field"><label>E-Mail</label><input type="email" name="email" value="${val(c && c.email)}"></div>
            <div class="field"><label>Telefon</label><input type="text" name="telefon" value="${val(c && c.telefon)}" placeholder="+41 79 …"></div>

            <div class="form-section-title">Adresse</div>
            <div class="field span-2"><label>Strasse</label><input type="text" name="strasse" value="${val(c && c.strasse)}"></div>
            <div class="field"><label>PLZ</label><input type="text" name="plz" value="${val(c && c.plz)}"></div>
            <div class="field"><label>Ort</label><input type="text" name="ort" value="${val(c && c.ort)}"></div>

            <div class="form-section-title">Beruf &amp; Verfügbarkeit</div>
            <div class="field"><label>Beruf *</label><input type="text" name="beruf" required value="${val(c && c.beruf)}"></div>
            <div class="field"><label>Ausbildung</label><input type="text" name="ausbildung" value="${val(c && c.ausbildung)}"></div>
            <div class="field"><label>Berufserfahrung (Jahre)</label><input type="number" name="berufserfahrung" min="0" step="1" value="${c && c.berufserfahrung != null ? c.berufserfahrung : ''}"></div>
            <div class="field"><label>Lohnvorstellung (CHF)</label><input type="number" name="lohnvorstellung" min="0" step="1000" value="${c && c.lohnvorstellung != null ? c.lohnvorstellung : ''}"></div>
            <div class="field span-2"><label>Qualifikationen</label><input type="text" name="qualifikationen" value="${ui.esc(qualiText)}" placeholder="z.B. JavaScript, SQL, Projektleitung">
              <div class="hint">Mehrere Einträge mit Komma trennen.</div></div>
            <div class="field span-2"><label>Sprachen</label><input type="text" name="sprachen" value="${ui.esc(sprachenText)}" placeholder="z.B. Deutsch: Muttersprache, Englisch: B2">
              <div class="hint">Format: Sprache: Niveau – mehrere mit Komma trennen.</div></div>
            <div class="field"><label>Verfügbar ab</label><input type="date" name="verfuegbarAb" value="${val(c && c.verfuegbarAb)}"></div>
            <div class="field"><label>Pensum</label><input type="text" name="pensum" value="${val(c && c.pensum)}" placeholder="z.B. 100%"></div>
            <div class="field"><label>Anstellungsart</label><select name="anstellungsart">${sel(ANSTELLUNGSARTEN, c ? c.anstellungsart : 'Festanstellung')}</select></div>

            <div class="form-section-title">Sonstiges</div>
            <div class="field"><label>Status</label><select name="status">${sel(STATUS_LISTE, c ? c.status : 'Neu')}</select></div>
            <div class="field"><label>Quelle</label><select name="quelle">${sel(QUELLEN, c ? c.quelle : 'jobs.ch')}</select></div>
            <div class="field span-2"><label>Betreuer</label><select name="betreuerId">
              ${users.map(u => `<option value="${u.id}" ${u.id === betreuerVal ? 'selected' : ''}>${ui.esc(u.name)}</option>`).join('')}
            </select></div>
            <div class="field span-2"><label>Notizen</label><textarea name="notizen" placeholder="Interne Bemerkungen…">${c ? ui.esc(c.notizen || '') : ''}</textarea></div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${c ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        const form = el.querySelector('#candidate-form');
        if (importResult) applyImport(el, form, importResult);
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const rec = {
            anrede: fd.get('anrede'),
            vorname: fd.get('vorname').trim(),
            nachname: fd.get('nachname').trim(),
            geburtsdatum: fd.get('geburtsdatum') || null,
            email: (fd.get('email') || '').trim(),
            telefon: (fd.get('telefon') || '').trim(),
            strasse: (fd.get('strasse') || '').trim(),
            plz: (fd.get('plz') || '').trim(),
            ort: (fd.get('ort') || '').trim(),
            beruf: fd.get('beruf').trim(),
            ausbildung: (fd.get('ausbildung') || '').trim(),
            berufserfahrung: fd.get('berufserfahrung') ? Number(fd.get('berufserfahrung')) : null,
            qualifikationen: String(fd.get('qualifikationen') || '').split(',').map(s => s.trim()).filter(Boolean),
            sprachen: parseSprachen(fd.get('sprachen')),
            verfuegbarAb: fd.get('verfuegbarAb') || null,
            pensum: (fd.get('pensum') || '').trim(),
            anstellungsart: fd.get('anstellungsart'),
            lohnvorstellung: fd.get('lohnvorstellung') ? Number(fd.get('lohnvorstellung')) : null,
            status: fd.get('status'),
            quelle: fd.get('quelle'),
            betreuerId: Number(fd.get('betreuerId')),
            notizen: (fd.get('notizen') || '').trim()
          };
          let id;
          if (c) {
            db.update('candidates', c.id, rec);
            id = c.id;
            ui.toast('Kandidat aktualisiert');
          } else {
            // Automatische Duplikaterkennung (E-Mail oder identischer Name)
            const dup = db.list('candidates').find(x =>
              (rec.email && x.email && x.email.toLowerCase() === rec.email.toLowerCase()) ||
              `${x.vorname} ${x.nachname}`.toLowerCase() === `${rec.vorname} ${rec.nachname}`.toLowerCase());
            if (dup && !form.dataset.dupOk) {
              form.dataset.dupOk = '1';
              showDupBanner(el, dup);
              return;
            }
            rec.nr = db.nextNr('K');
            rec.dokumente = [];
            if (importResult && importResult.dokumentName) {
              rec.dokumente.push({ id: 1, name: importResult.dokumentName, typ: 'Lebenslauf', datum: ui.today() });
            }
            id = db.insert('candidates', rec).id;
            ui.toast('Kandidat erstellt');
          }
          close();
          if (onSaved) onSaved(id);
        });
      }
    });
  }

  /* ---------- KI: Lebenslauf-Import ---------- */
  function openCvImportModal(onSaved) {
    let file = null;
    ui.modal({
      title: 'Lebenslauf importieren',
      width: 560,
      content: `
        <div class="import-banner">${ui.icon('sparkles', 16)}<div>
          ${App.ai.hasKey()
            ? 'Die Auswertung erfolgt per <strong>KI (Claude)</strong>.'
            : 'Kein KI-Schlüssel hinterlegt – es wird die <strong>lokale Texterkennung</strong> verwendet. Bessere Resultate mit API-Schlüssel unter <a href="#/einstellungen">Einstellungen → KI</a>.'}
          Erkannte Angaben werden ins Formular übernommen, nicht Lesbares wird rot markiert.
        </div></div>
        <div class="dropzone" id="cv-drop">
          <div class="dz-icon">${ui.icon('upload', 26)}</div>
          <div><strong>PDF- oder Textdatei</strong> hierhin ziehen oder klicken</div>
          <div class="dz-file" id="cv-filename"></div>
          <input type="file" id="cv-file" accept=".pdf,.txt,.md,text/plain,application/pdf" style="display:none">
        </div>
        <div class="divider"></div>
        <div class="field mb-0">
          <label>… oder Lebenslauf-Text direkt einfügen</label>
          <textarea id="cv-text" style="min-height:130px" placeholder="Text des Lebenslaufs hier einfügen…"></textarea>
        </div>
        <div id="cv-status" class="mt-10" style="display:none"></div>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="analyze" type="button">${ui.icon('sparkles', 15)} Analysieren</button>`,
      onMount(el, close) {
        const drop = el.querySelector('#cv-drop');
        const fileInput = el.querySelector('#cv-file');
        const nameEl = el.querySelector('#cv-filename');
        const status = el.querySelector('#cv-status');
        const analyzeBtn = el.querySelector('[data-action="analyze"]');

        function setFile(f) { file = f; nameEl.textContent = f ? f.name : ''; }
        drop.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', () => setFile(fileInput.files[0] || null));
        drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('drag-over'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('drag-over'));
        drop.addEventListener('drop', (e) => {
          e.preventDefault();
          drop.classList.remove('drag-over');
          if (e.dataTransfer.files && e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]);
        });
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);

        analyzeBtn.addEventListener('click', async () => {
          const pasted = el.querySelector('#cv-text').value.trim();
          if (!file && pasted.length < 30) { ui.toast('Bitte Datei wählen oder Text einfügen.', 'error'); return; }
          analyzeBtn.disabled = true;
          status.style.display = '';
          status.innerHTML = `<span class="ai-spinner"></span> <span class="text-muted" style="margin-left:8px">Lebenslauf wird ausgewertet…</span>`;
          try {
            const text = (!file && pasted.length >= 30) ? pasted : await App.ai.readFile(file);
            const result = await App.ai.extractCandidate(text);
            result.dokumentName = file ? file.name : null;
            close();
            ui.toast(result.quelle === 'ki' ? 'Lebenslauf per KI ausgewertet' : 'Lebenslauf per Texterkennung ausgewertet');
            openCandidateModal(null, onSaved, result);
          } catch (err) {
            analyzeBtn.disabled = false;
            status.innerHTML = `<span class="text-danger fs-12">${ui.esc(err.message)}</span>`;
          }
        });
      }
    });
  }

  /* ---------- Liste ---------- */
  function renderList(container, openNew) {
    let query = '', statusFilter = '', betreuerFilter = '';
    let sortKey = 'nr', sortDir = 1;
    const users = db.list('users');

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Kandidaten</h1>
          <div class="subtitle"></div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" id="btn-import">${ui.icon('sparkles', 16)} Lebenslauf-Import</button>
          <button class="btn btn-primary" id="btn-new">${ui.icon('plus', 16)} Neuer Kandidat</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="searchbox">${ui.icon('search', 16)}<input type="text" id="kand-search" placeholder="Suchen: Name, Beruf, Nr, Ort, Qualifikationen…"></div>
        <select id="kand-status">
          <option value="">Alle Status</option>
          ${STATUS_LISTE.map(s => `<option>${ui.esc(s)}</option>`).join('')}
        </select>
        <select id="kand-betreuer">
          <option value="">Alle Betreuer</option>
          ${users.map(u => `<option value="${u.id}">${ui.esc(u.name)}</option>`).join('')}
        </select>
        <div class="spacer"></div>
        <span class="count" id="kand-count"></span>
      </div>
      <div class="card"><div class="table-wrap" id="kand-table"></div></div>`;

    function filtered() {
      const q = query.trim().toLowerCase();
      const rows = db.list('candidates').filter(c => {
        if (statusFilter && c.status !== statusFilter) return false;
        if (betreuerFilter && c.betreuerId !== Number(betreuerFilter)) return false;
        if (!q) return true;
        const hay = [fullName(c), c.beruf, c.nr, c.ort].concat(c.qualifikationen || []).join(' ').toLowerCase();
        return hay.includes(q);
      });
      rows.sort((a, b) => {
        let va, vb;
        if (sortKey === 'name') { va = fullName(a).toLowerCase(); vb = fullName(b).toLowerCase(); }
        else if (sortKey === 'verfuegbarAb') { va = a.verfuegbarAb || ''; vb = b.verfuegbarAb || ''; }
        else { va = a.nr || ''; vb = b.nr || ''; }
        return String(va).localeCompare(String(vb)) * sortDir;
      });
      return rows;
    }

    function renderTable() {
      const rows = filtered();
      const total = db.list('candidates').length;
      container.querySelector('.page-header .subtitle').textContent = `${total} Kandidaten insgesamt`;
      container.querySelector('#kand-count').textContent = `${rows.length} von ${total}`;
      const wrap = container.querySelector('#kand-table');

      if (rows.length === 0) {
        wrap.innerHTML = ui.emptyState({
          icon: 'users', title: 'Keine Kandidaten gefunden',
          text: 'Passen Sie Suche oder Filter an oder erfassen Sie einen neuen Kandidaten.'
        });
        return;
      }

      const arrow = (key) => sortKey === key ? (sortDir === 1 ? ' ▲' : ' ▼') : '';
      wrap.innerHTML = `
        <table class="table">
          <thead><tr>
            <th class="sortable" data-sort="nr">Nr${arrow('nr')}</th>
            <th class="sortable" data-sort="name">Name${arrow('name')}</th>
            <th>Ort</th>
            <th>Qualifikationen</th>
            <th class="sortable" data-sort="verfuegbarAb">Verfügbar ab${arrow('verfuegbarAb')}</th>
            <th>Pensum</th>
            <th>Status</th>
            <th>Betreuer</th>
            <th></th>
          </tr></thead>
          <tbody>
            ${rows.map(c => {
              const quali = c.qualifikationen || [];
              const tags = quali.slice(0, 3).map(qu => `<span class="tag">${ui.esc(qu)}</span>`).join('')
                + (quali.length > 3 ? `<span class="tag">+${quali.length - 3}</span>` : '');
              return `
              <tr class="clickable" data-id="${c.id}">
                <td class="text-muted">${ui.esc(c.nr)}</td>
                <td><div class="flex">${ui.avatar(fullName(c), 34)}<div><div class="cell-main">${ui.esc(fullName(c))}</div><div class="cell-sub">${ui.esc(c.beruf)}</div></div></div></td>
                <td>${ui.esc(c.ort)}</td>
                <td>${tags}</td>
                <td>${ui.formatDate(c.verfuegbarAb)}</td>
                <td>${ui.esc(c.pensum)}</td>
                <td>${ui.badge(c.status)}</td>
                <td><span title="${ui.esc(ui.userName(c.betreuerId))}">${ui.userAvatar(c.betreuerId, 26)}</span></td>
                <td class="actions-cell">
                  <button class="btn-icon" data-act="edit" title="Bearbeiten">${ui.icon('edit', 15)}</button>
                  <button class="btn-icon danger" data-act="delete" title="Löschen">${ui.icon('trash', 15)}</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>`;

      wrap.querySelectorAll('th.sortable').forEach(th => th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (sortKey === key) sortDir = -sortDir; else { sortKey = key; sortDir = 1; }
        renderTable();
      }));

      wrap.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', (e) => {
        if (e.target.closest('button, a')) return;
        App.navigate('/kandidaten/' + tr.dataset.id);
      }));

      wrap.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = db.get('candidates', Number(btn.closest('tr').dataset.id));
        if (!c) return;
        if (btn.dataset.act === 'edit') openCandidateModal(c, renderTable);
        else deleteCandidate(c, renderTable);
      }));
    }

    container.querySelector('#kand-search').addEventListener('input', (e) => { query = e.target.value; renderTable(); });
    container.querySelector('#kand-status').addEventListener('change', (e) => { statusFilter = e.target.value; renderTable(); });
    container.querySelector('#kand-betreuer').addEventListener('change', (e) => { betreuerFilter = e.target.value; renderTable(); });
    container.querySelector('#btn-new').addEventListener('click', () =>
      openCandidateModal(null, (id) => App.navigate('/kandidaten/' + id)));
    container.querySelector('#btn-import').addEventListener('click', () =>
      openCvImportModal((id) => App.navigate('/kandidaten/' + id)));

    renderTable();
    if (openNew) openCandidateModal(null, (id) => App.navigate('/kandidaten/' + id));
  }

  /* ---------- Detail: Teil-HTML ---------- */
  function profilHtml(c) {
    const age = alter(c.geburtsdatum);
    const quali = c.qualifikationen || [];
    const sprachen = c.sprachen || [];
    const adresse = [c.strasse, `${c.plz || ''} ${c.ort || ''}`.trim()].filter(Boolean).join(', ');
    return `
      <div class="detail-grid">
        <div>
          <div class="card mb-20">
            <div class="card-header"><h3>Kontakt &amp; Persönliches</h3></div>
            <div class="card-body"><dl class="info-list">
              <dt>E-Mail</dt><dd>${c.email ? `<a href="mailto:${ui.esc(c.email)}">${ui.esc(c.email)}</a>` : '–'}</dd>
              <dt>Telefon</dt><dd>${c.telefon ? `<a href="tel:${ui.esc(c.telefon)}">${ui.esc(c.telefon)}</a>` : '–'}</dd>
              <dt>Adresse</dt><dd>${adresse ? ui.esc(adresse) : '–'}</dd>
              <dt>Geburtsdatum</dt><dd>${ui.formatDate(c.geburtsdatum)}${age !== null ? ` (${age} Jahre)` : ''}</dd>
              <dt>Quelle</dt><dd>${c.quelle ? ui.esc(c.quelle) : '–'}</dd>
              <dt>Betreuer</dt><dd>${ui.esc(ui.userName(c.betreuerId))}</dd>
              <dt>Erfasst am</dt><dd>${ui.formatDate(c.erstelltAm)}</dd>
            </dl></div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Notizen</h3></div>
            <div class="card-body">${c.notizen ? `<p>${ui.esc(c.notizen)}</p>` : '<span class="text-muted">Keine Notizen vorhanden.</span>'}</div>
          </div>
        </div>
        <div>
          <div class="card mb-20">
            <div class="card-header"><h3>Beruf &amp; Verfügbarkeit</h3></div>
            <div class="card-body"><dl class="info-list">
              <dt>Beruf</dt><dd>${ui.esc(c.beruf)}</dd>
              <dt>Ausbildung</dt><dd>${c.ausbildung ? ui.esc(c.ausbildung) : '–'}</dd>
              <dt>Erfahrung</dt><dd>${c.berufserfahrung != null ? `${ui.esc(c.berufserfahrung)} Jahre` : '–'}</dd>
              <dt>Verfügbar ab</dt><dd>${ui.formatDate(c.verfuegbarAb)}${c.verfuegbarAb ? ` <span class="text-muted">(${ui.relDate(c.verfuegbarAb)})</span>` : ''}</dd>
              <dt>Pensum</dt><dd>${c.pensum ? ui.esc(c.pensum) : '–'}</dd>
              <dt>Anstellungsart</dt><dd>${ui.badge(c.anstellungsart)}</dd>
              <dt>Lohnvorstellung</dt><dd>${ui.formatCHF(c.lohnvorstellung)}</dd>
            </dl></div>
          </div>
          <div class="card mb-20">
            <div class="card-header"><h3>Qualifikationen</h3></div>
            <div class="card-body">${quali.length ? quali.map(q => `<span class="tag">${ui.esc(q)}</span>`).join('') : '<span class="text-muted">Keine Qualifikationen erfasst.</span>'}</div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Sprachen</h3></div>
            <div class="card-body">${sprachen.length
              ? sprachen.map(s => `<div class="mb-10">${ui.esc(s.sprache)}${s.niveau ? ` – ${ui.esc(s.niveau)}` : ''}</div>`).join('')
              : '<span class="text-muted">Keine Sprachen erfasst.</span>'}</div>
          </div>
        </div>
      </div>`;
  }

  function vermittlungenHtml(placements) {
    const header = `
      <div class="card-header"><h3>Vermittlungen</h3>
        <div class="actions"><button class="btn btn-sm btn-primary" id="btn-new-placement">${ui.icon('plus', 14)} Neue Vermittlung</button></div>
      </div>`;
    if (placements.length === 0) {
      return `<div class="card">${header}${ui.emptyState({
        icon: 'handshake', title: 'Keine Vermittlungen',
        text: 'Dieser Kandidat ist noch in keinem Vermittlungsprozess.'
      })}</div>`;
    }
    return `
      <div class="card">${header}
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Vakanz</th><th>Phase</th><th>Erstellt</th><th>Honorar</th><th></th></tr></thead>
            <tbody>
              ${placements.map(p => {
                const v = db.get('vacancies', p.vacancyId);
                const f = v ? db.get('companies', v.companyId) : null;
                return `
                <tr data-id="${p.id}">
                  <td>
                    <div class="cell-main">${v ? `<a href="#/vakanzen/${v.id}">${ui.esc(v.titel)}</a>` : '–'}</div>
                    <div class="cell-sub">${ui.esc(f ? f.name : '')}</div>
                  </td>
                  <td>${ui.badge(p.phase)}</td>
                  <td>${ui.formatDate(p.erstelltAm)}</td>
                  <td>${ui.formatCHF(p.honorar)}</td>
                  <td class="actions-cell"><button class="btn-icon" data-act="edit-placement" title="Bearbeiten">${ui.icon('edit', 15)}</button></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function dokumenteHtml(docs) {
    const header = `
      <div class="card-header"><h3>Dokumente</h3>
        <div class="actions"><button class="btn btn-sm btn-primary" id="btn-new-doc">${ui.icon('plus', 14)} Dokument hinzufügen</button></div>
      </div>`;
    if (docs.length === 0) {
      return `<div class="card">${header}${ui.emptyState({
        icon: 'file-text', title: 'Keine Dokumente',
        text: 'Für diesen Kandidaten sind noch keine Dokumente hinterlegt.'
      })}</div>`;
    }
    return `
      <div class="card">${header}
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Name</th><th>Typ</th><th>Datum</th><th></th></tr></thead>
            <tbody>
              ${docs.map(d => `
              <tr data-doc-id="${d.id}">
                <td><div class="flex">${ui.icon('file-text', 16)}<span class="cell-main">${ui.esc(d.name)}</span></div></td>
                <td>${ui.esc(d.typ)}</td>
                <td>${ui.formatDate(d.datum)}</td>
                <td class="actions-cell">
                  <button class="btn-icon" data-act="doc-download" title="Herunterladen">${ui.icon('download', 15)}</button>
                  <button class="btn-icon danger" data-act="doc-delete" title="Löschen">${ui.icon('trash', 15)}</button>
                </td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function openDocumentModal(c, onSaved) {
    ui.modal({
      title: 'Dokument hinzufügen',
      width: 440,
      content: `
        <form id="doc-form">
          <div class="field">
            <label>Name *</label>
            <input type="text" name="name" required placeholder="z.B. Lebenslauf_Muster.pdf">
          </div>
          <div class="field">
            <label>Typ</label>
            <select name="typ">${DOK_TYPEN.map(t => `<option>${ui.esc(t)}</option>`).join('')}</select>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">Hinzufügen</button>`,
      onMount(el, close) {
        const form = el.querySelector('#doc-form');
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const docs = (c.dokumente || []).slice();
          const nextId = docs.reduce((m, d) => Math.max(m, d.id || 0), 0) + 1;
          docs.push({ id: nextId, name: form.elements.name.value.trim(), typ: form.elements.typ.value, datum: ui.today() });
          db.update('candidates', c.id, { dokumente: docs });
          ui.toast('Dokument hinzugefügt');
          close();
          if (onSaved) onSaved();
        });
      }
    });
  }

  /* ---------- Detail ---------- */
  function renderDetail(container, id, activeTab) {
    const c = db.get('candidates', id);
    if (!c) {
      container.innerHTML = `
        <a class="back-link" href="#/kandidaten">${ui.icon('arrow-left', 16)} Zurück zur Liste</a>
        ${ui.emptyState({
          icon: 'user', title: 'Kandidat nicht gefunden',
          text: 'Der gewünschte Kandidat existiert nicht oder wurde gelöscht.'
        })}`;
      return;
    }

    // Nach Mutationen neu aufbauen und den aktiven Tab beibehalten
    function rerender() {
      const act = container.querySelector('.tab.active');
      renderDetail(container, id, act ? act.dataset.tab : activeTab);
    }
    const afterChange = () => { App.updateNavBadges(); rerender(); };

    const placements = candidatePlacements(c.id);
    const actCount = candidateActivities(c.id).length;
    const docs = c.dokumente || [];

    container.innerHTML = `
      <a class="back-link" href="#/kandidaten">${ui.icon('arrow-left', 16)} Zurück zur Liste</a>
      <div class="detail-head">
        ${ui.avatar(fullName(c), 56)}
        <div class="dh-info">
          <h1>${ui.esc(fullName(c))} ${ui.badge(c.status)}</h1>
          <div class="sub">
            <span>${ui.esc(c.beruf)}</span>
            <span>${ui.icon('map-pin', 14)} ${ui.esc(c.plz)} ${ui.esc(c.ort)}</span>
            <span>${ui.esc(c.nr)}</span>
            <span>${ui.esc(c.quelle)}</span>
          </div>
        </div>
        <div class="actions">
          <button class="btn btn-secondary" id="btn-activity">${ui.icon('calendar-check', 16)} Aktivität</button>
          <button class="btn btn-primary" id="btn-propose">${ui.icon('handshake', 16)} Vorschlagen</button>
          <button class="btn btn-secondary" id="btn-edit">${ui.icon('edit', 16)} Bearbeiten</button>
          <button class="btn-icon danger" id="btn-delete" title="Löschen">${ui.icon('trash', 17)}</button>
        </div>
      </div>
      <div class="tabs">
        <button class="tab" data-tab="profil" type="button">Profil</button>
        <button class="tab" data-tab="vermittlungen" type="button">Vermittlungen <span class="tab-count">${placements.length}</span></button>
        <button class="tab" data-tab="aktivitaeten" type="button">Aktivitäten <span class="tab-count">${actCount}</span></button>
        <button class="tab" data-tab="dokumente" type="button">Dokumente <span class="tab-count">${docs.length}</span></button>
      </div>
      <div class="tab-panel" data-panel="profil">${profilHtml(c)}</div>
      <div class="tab-panel" data-panel="vermittlungen">${vermittlungenHtml(placements)}</div>
      <div class="tab-panel" data-panel="aktivitaeten">
        <div class="card">
          <div class="card-header"><h3>Aktivitäten</h3>
            <div class="actions"><button class="btn btn-sm btn-primary" id="btn-new-activity">${ui.icon('plus', 14)} Neue Aktivität</button></div>
          </div>
          <div class="card-body"><div id="act-timeline"></div></div>
        </div>
      </div>
      <div class="tab-panel" data-panel="dokumente">${dokumenteHtml(docs)}</div>`;

    const tabBtn = container.querySelector(`.tab[data-tab="${activeTab || 'profil'}"]`) || container.querySelector('.tab');
    tabBtn.classList.add('active');
    container.querySelector(`.tab-panel[data-panel="${tabBtn.dataset.tab}"]`).classList.add('active');
    ui.bindTabs(container);

    /* Kopf-Aktionen */
    container.querySelector('#btn-activity').addEventListener('click', () =>
      shared.openActivityModal({ bezug: { typ: 'kandidat', id: c.id }, onSaved: afterChange }));
    container.querySelector('#btn-propose').addEventListener('click', () =>
      shared.openPlacementModal({ candidateId: c.id, onSaved: afterChange }));
    container.querySelector('#btn-edit').addEventListener('click', () =>
      openCandidateModal(c, rerender));
    container.querySelector('#btn-delete').addEventListener('click', () =>
      deleteCandidate(c, () => App.navigate('/kandidaten')));

    /* Vermittlungen */
    container.querySelector('#btn-new-placement').addEventListener('click', () =>
      shared.openPlacementModal({ candidateId: c.id, onSaved: afterChange }));
    container.querySelectorAll('[data-act="edit-placement"]').forEach(btn => btn.addEventListener('click', () => {
      const p = db.get('placements', Number(btn.closest('tr').dataset.id));
      if (p) shared.openPlacementModal({ placement: p, onSaved: afterChange });
    }));

    /* Aktivitäten */
    container.querySelector('#btn-new-activity').addEventListener('click', () =>
      shared.openActivityModal({ bezug: { typ: 'kandidat', id: c.id }, onSaved: afterChange }));
    shared.activityTimeline(container.querySelector('#act-timeline'), {
      bezug: { typ: 'kandidat', id: c.id },
      onChange: afterChange
    });

    /* Dokumente */
    container.querySelector('#btn-new-doc').addEventListener('click', () =>
      openDocumentModal(c, rerender));
    container.querySelectorAll('[data-act="doc-download"]').forEach(btn => btn.addEventListener('click', () =>
      ui.toast('Demo: Download nicht verfügbar', 'info')));
    container.querySelectorAll('[data-act="doc-delete"]').forEach(btn => btn.addEventListener('click', () => {
      const docId = Number(btn.closest('tr').dataset.docId);
      const doc = (c.dokumente || []).find(d => d.id === docId);
      if (!doc) return;
      ui.confirm(`Dokument «${doc.name}» wirklich löschen?`, () => {
        db.update('candidates', c.id, { dokumente: (c.dokumente || []).filter(d => d.id !== docId) });
        ui.toast('Dokument gelöscht');
        rerender();
      });
    }));
  }

  /* ---------- Registrierung ---------- */
  App.registerView('kandidaten', {
    title: 'Kandidaten',
    icon: 'users',
    nav: true,
    order: 2,
    render(container, params) {
      if (params.length === 0) { renderList(container, false); return; }
      if (params[0] === 'neu') { renderList(container, true); return; }
      renderDetail(container, Number(params[0]), 'profil');
    }
  });
})();
