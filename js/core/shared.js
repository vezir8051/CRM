/* ============================================================
   PersoCRM – Geteilte Geschäftskomponenten
   API (App.shared.*):
     PHASEN                        ['Vorgeschlagen','Interview','Angebot','Vermittelt','Absage']
     PHASE_FARBEN                  {Phase: CSS-Farbwert}
     candidateName(cOrId)          'Vorname Nachname'
     bezugInfo(bezug)              {label, hash, icon} | null
     matchScore(candidate, vacancy)  0..100
     openActivityModal({bezug, activity, onSaved})
     activityTimeline(container, {bezug, limit, showBezug, emptyText, onChange})
     openPlacementModal({candidateId, vacancyId, placement, onSaved})
     changePhase(placementId, phase, notiz)   inkl. Statuspflege Kandidat/Vakanz
   ============================================================ */
window.App = window.App || {};

App.shared = (() => {
  const ui = () => App.ui;
  const db = () => App.db;

  const PHASEN = ['Vorgeschlagen', 'Interview', 'Angebot', 'Vermittelt', 'Absage'];
  const PHASE_FARBEN = {
    'Vorgeschlagen': '#2563eb',
    'Interview': '#d97706',
    'Angebot': '#7c3aed',
    'Vermittelt': '#16a34a',
    'Absage': '#dc2626'
  };
  const AKTIVITAET_TYPEN = ['Anruf', 'E-Mail', 'Termin', 'Aufgabe', 'Notiz'];

  function candidateName(cOrId) {
    const c = typeof cOrId === 'object' ? cOrId : db().get('candidates', cOrId);
    return c ? `${c.vorname} ${c.nachname}` : '–';
  }

  function bezugInfo(bezug) {
    if (!bezug || !bezug.id) return null;
    if (bezug.typ === 'kandidat') {
      const c = db().get('candidates', bezug.id);
      return c ? { label: candidateName(c), hash: `#/kandidaten/${c.id}`, icon: 'user' } : null;
    }
    if (bezug.typ === 'unternehmen') {
      const f = db().get('companies', bezug.id);
      return f ? { label: f.name, hash: `#/unternehmen/${f.id}`, icon: 'building' } : null;
    }
    if (bezug.typ === 'vakanz') {
      const v = db().get('vacancies', bezug.id);
      return v ? { label: v.titel, hash: `#/vakanzen/${v.id}`, icon: 'briefcase' } : null;
    }
    return null;
  }

  /* ---------- Matching ---------- */
  function matchScore(candidate, vacancy) {
    if (!candidate || !vacancy || !Array.isArray(vacancy.anforderungen) || vacancy.anforderungen.length === 0) return 0;
    const skills = (candidate.qualifikationen || []).map(s => s.toLowerCase());
    let hits = 0;
    for (const anf of vacancy.anforderungen) {
      const a = anf.toLowerCase();
      if (skills.some(s => s.includes(a) || a.includes(s))) hits++;
    }
    let score = (hits / vacancy.anforderungen.length) * 90;
    // Bonus: Berufsbezeichnung überschneidet sich mit Vakanztitel
    const berufWorte = (candidate.beruf || '').toLowerCase().split(/[\s/]+/).filter(w => w.length > 3);
    const titel = (vacancy.titel || '').toLowerCase();
    if (berufWorte.some(w => titel.includes(w))) score += 10;
    return Math.min(100, Math.round(score));
  }

  function matchBar(score) {
    const color = score >= 70 ? 'var(--green)' : score >= 40 ? 'var(--amber)' : 'var(--text-soft)';
    return `
      <div class="match-bar">
        <div class="bar"><div style="width:${score}%;background:${color}"></div></div>
        <span class="pct" style="color:${color}">${score}%</span>
      </div>`;
  }

  /* ---------- Aktivitäten ---------- */
  function openActivityModal(opts) {
    opts = opts || {};
    const a = opts.activity || null;
    const _ui = ui();
    const user = App.auth.currentUser();

    // Bezugsauswahl vorbereiten
    const kandOpts = db().list('candidates').map(c => `<option value="kandidat:${c.id}">${_ui.esc(candidateName(c))} (${_ui.esc(c.nr)})</option>`).join('');
    const firmaOpts = db().list('companies').map(f => `<option value="unternehmen:${f.id}">${_ui.esc(f.name)} (${_ui.esc(f.nr)})</option>`).join('');
    const vakOpts = db().list('vacancies').map(v => `<option value="vakanz:${v.id}">${_ui.esc(v.titel)} (${_ui.esc(v.nr)})</option>`).join('');
    const bezugValue = (a && a.bezug) ? `${a.bezug.typ}:${a.bezug.id}` :
                       (opts.bezug ? `${opts.bezug.typ}:${opts.bezug.id}` : '');

    _ui.modal({
      title: a ? 'Aktivität bearbeiten' : 'Neue Aktivität',
      width: 560,
      content: `
        <form id="activity-form">
          <div class="form-grid">
            <div class="field">
              <label>Typ *</label>
              <select name="typ" required>
                ${AKTIVITAET_TYPEN.map(t => `<option ${a && a.typ === t ? 'selected' : ''}>${t}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Fällig am</label>
              <input type="datetime-local" name="faelligAm" value="${a && a.faelligAm ? _ui.esc(a.faelligAm) : ''}">
            </div>
            <div class="field span-2">
              <label>Betreff *</label>
              <input type="text" name="betreff" required value="${a ? _ui.esc(a.betreff) : ''}" placeholder="z.B. Rückruf Kandidat">
            </div>
            <div class="field span-2">
              <label>Beschreibung</label>
              <textarea name="beschreibung" placeholder="Details…">${a ? _ui.esc(a.beschreibung || '') : ''}</textarea>
            </div>
            <div class="field span-2">
              <label>Bezug</label>
              <select name="bezug">
                <option value="">– Kein Bezug –</option>
                <optgroup label="Kandidaten">${kandOpts}</optgroup>
                <optgroup label="Unternehmen">${firmaOpts}</optgroup>
                <optgroup label="Vakanzen">${vakOpts}</optgroup>
              </select>
            </div>
            <div class="field span-2 checkbox-row">
              <input type="checkbox" name="erledigt" id="act-done" ${a && a.erledigt ? 'checked' : ''}>
              <label for="act-done">Erledigt</label>
            </div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${a ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        const form = el.querySelector('#activity-form');
        if (bezugValue) form.elements.bezug.value = bezugValue;
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          let bezug = null;
          const bz = fd.get('bezug');
          if (bz) {
            const [typ, id] = bz.split(':');
            bezug = { typ, id: Number(id) };
          }
          const rec = {
            typ: fd.get('typ'),
            betreff: fd.get('betreff').trim(),
            beschreibung: (fd.get('beschreibung') || '').trim(),
            faelligAm: fd.get('faelligAm') || null,
            erledigt: form.elements.erledigt.checked,
            bezug,
            userId: a ? a.userId : (user ? user.id : 1)
          };
          if (a) {
            db().update('activities', a.id, rec);
            ui().toast('Aktivität aktualisiert');
          } else {
            db().insert('activities', rec);
            ui().toast('Aktivität erstellt');
          }
          close();
          if (opts.onSaved) opts.onSaved();
        });
      }
    });
  }

  function activityTimeline(container, opts) {
    opts = opts || {};
    const _ui = ui();

    function matching() {
      let acts = db().list('activities').slice();
      if (opts.bezug) {
        acts = acts.filter(a => a.bezug && a.bezug.typ === opts.bezug.typ && Number(a.bezug.id) === Number(opts.bezug.id));
      }
      acts.sort((x, y) => String(y.faelligAm || y.erstelltAm).localeCompare(String(x.faelligAm || x.erstelltAm)));
      if (opts.limit) acts = acts.slice(0, opts.limit);
      return acts;
    }

    function render() {
      const acts = matching();
      if (acts.length === 0) {
        container.innerHTML = _ui.emptyState({
          icon: 'calendar-check', title: 'Keine Aktivitäten',
          text: opts.emptyText || 'Für diesen Eintrag sind noch keine Aktivitäten erfasst.'
        });
        return;
      }
      container.innerHTML = `<ul class="timeline">` + acts.map(a => {
        const overdue = !a.erledigt && a.faelligAm && _ui.isOverdue(a.faelligAm);
        const bi = opts.showBezug ? bezugInfo(a.bezug) : null;
        return `
          <li class="timeline-item" data-id="${a.id}">
            <div class="tl-icon ${a.typ.toLowerCase().replace('ä','a')}">${_ui.icon(activityIcon(a.typ), 16)}</div>
            <div class="tl-body">
              <div class="tl-title ${a.erledigt ? 'done' : ''}">${_ui.esc(a.betreff)}</div>
              ${a.beschreibung ? `<div class="tl-desc">${_ui.esc(a.beschreibung)}</div>` : ''}
              <div class="tl-meta">
                <span>${_ui.badge(a.typ)}</span>
                ${a.faelligAm ? `<span class="${overdue ? 'overdue' : ''}">${_ui.icon('clock', 12)} ${_ui.formatDateTime(a.faelligAm)} (${_ui.relDate(a.faelligAm)})</span>` : ''}
                <span>${_ui.esc(_ui.userName(a.userId))}</span>
                ${bi ? `<a href="${bi.hash}">${_ui.icon(bi.icon, 12)} ${_ui.esc(bi.label)}</a>` : ''}
              </div>
            </div>
            <div class="tl-actions">
              <button class="btn-icon" data-act="toggle" title="${a.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'}">${_ui.icon(a.erledigt ? 'refresh' : 'check', 15)}</button>
              <button class="btn-icon" data-act="edit" title="Bearbeiten">${_ui.icon('edit', 15)}</button>
              <button class="btn-icon danger" data-act="delete" title="Löschen">${_ui.icon('trash', 15)}</button>
            </div>
          </li>`;
      }).join('') + `</ul>`;

      container.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = Number(btn.closest('.timeline-item').dataset.id);
          const act = db().get('activities', id);
          if (!act) return;
          const action = btn.dataset.act;
          if (action === 'toggle') {
            db().update('activities', id, { erledigt: !act.erledigt });
            render();
            if (opts.onChange) opts.onChange();
          } else if (action === 'edit') {
            openActivityModal({ activity: act, onSaved: () => { render(); if (opts.onChange) opts.onChange(); } });
          } else if (action === 'delete') {
            _ui.confirm(`Aktivität «${act.betreff}» wirklich löschen?`, () => {
              db().remove('activities', id);
              _ui.toast('Aktivität gelöscht');
              render();
              if (opts.onChange) opts.onChange();
            });
          }
        });
      });
    }

    render();
    return { refresh: render };
  }

  function activityIcon(typ) {
    return { 'Anruf': 'phone', 'E-Mail': 'mail', 'Termin': 'calendar', 'Aufgabe': 'check-circle', 'Notiz': 'note' }[typ] || 'note';
  }

  /* ---------- Vermittlungen ---------- */
  function openPlacementModal(opts) {
    opts = opts || {};
    const p = opts.placement || null;
    const _ui = ui();

    const kandidaten = db().list('candidates').filter(c => c.status !== 'Gesperrt');
    const vakanzen = db().list('vacancies').filter(v => ['Offen', 'In Bearbeitung'].includes(v.status) || (p && v.id === p.vacancyId));

    const kandOpts = kandidaten.map(c =>
      `<option value="${c.id}">${_ui.esc(candidateName(c))} – ${_ui.esc(c.beruf)} (${_ui.esc(c.nr)})</option>`).join('');
    const vakOpts = vakanzen.map(v => {
      const f = db().get('companies', v.companyId);
      return `<option value="${v.id}">${_ui.esc(v.titel)} – ${_ui.esc(f ? f.name : '?')} (${_ui.esc(v.nr)})</option>`;
    }).join('');

    _ui.modal({
      title: p ? 'Vermittlung bearbeiten' : 'Neue Vermittlung',
      width: 560,
      content: `
        <form id="placement-form">
          <div class="form-grid">
            <div class="field span-2">
              <label>Kandidat *</label>
              <select name="candidateId" required ${p ? 'disabled' : ''}>
                <option value="">– wählen –</option>${kandOpts}
              </select>
            </div>
            <div class="field span-2">
              <label>Vakanz *</label>
              <select name="vacancyId" required ${p ? 'disabled' : ''}>
                <option value="">– wählen –</option>${vakOpts}
              </select>
            </div>
            <div class="field">
              <label>Phase</label>
              <select name="phase">
                ${PHASEN.map(ph => `<option ${p && p.phase === ph ? 'selected' : ''}>${ph}</option>`).join('')}
              </select>
            </div>
            <div class="field">
              <label>Honorar (CHF)</label>
              <input type="number" name="honorar" min="0" step="100" value="${p && p.honorar != null ? p.honorar : ''}" placeholder="z.B. 25000">
            </div>
            <div class="field">
              <label>Stellenantritt</label>
              <input type="date" name="startdatum" value="${p && p.startdatum ? _ui.esc(p.startdatum) : ''}">
            </div>
            <div class="field span-2">
              <label>Notiz</label>
              <textarea name="notiz" placeholder="Bemerkungen…">${p ? _ui.esc(p.notiz || '') : ''}</textarea>
            </div>
          </div>
        </form>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-primary" data-action="save" type="button">${p ? 'Speichern' : 'Erstellen'}</button>`,
      onMount(el, close) {
        const form = el.querySelector('#placement-form');
        if (p) {
          form.elements.candidateId.value = p.candidateId;
          form.elements.vacancyId.value = p.vacancyId;
        } else {
          if (opts.candidateId) form.elements.candidateId.value = opts.candidateId;
          if (opts.vacancyId) form.elements.vacancyId.value = opts.vacancyId;
        }
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="save"]').addEventListener('click', () => {
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const phase = fd.get('phase');
          const honorar = fd.get('honorar') ? Number(fd.get('honorar')) : null;
          const startdatum = fd.get('startdatum') || null;
          const notiz = (fd.get('notiz') || '').trim();

          if (p) {
            const patch = { honorar, startdatum, notiz };
            db().update('placements', p.id, patch);
            if (phase !== p.phase) changePhase(p.id, phase, 'Phase manuell geändert.');
            _ui.toast('Vermittlung aktualisiert');
          } else {
            const candidateId = Number(form.elements.candidateId.value);
            const vacancyId = Number(form.elements.vacancyId.value);
            if (!candidateId || !vacancyId) { _ui.toast('Kandidat und Vakanz wählen', 'error'); return; }
            const exists = db().list('placements').some(x => x.candidateId === candidateId && x.vacancyId === vacancyId && x.phase !== 'Absage');
            if (exists) { _ui.toast('Dieser Kandidat ist für diese Vakanz bereits im Prozess.', 'error'); return; }
            const rec = db().insert('placements', {
              candidateId, vacancyId, phase: 'Vorgeschlagen', honorar, startdatum, notiz,
              verlauf: [{ datum: _ui.nowLocal(), phase: 'Vorgeschlagen', notiz: notiz || 'Kandidat vorgeschlagen.' }]
            });
            if (phase !== 'Vorgeschlagen') changePhase(rec.id, phase, 'Initiale Phase gesetzt.');
            _ui.toast('Vermittlung erstellt');
          }
          close();
          if (opts.onSaved) opts.onSaved();
        });
      }
    });
  }

  function changePhase(placementId, phase, notiz) {
    const p = db().get('placements', placementId);
    if (!p || p.phase === phase) return p;
    const verlauf = (p.verlauf || []).slice();
    verlauf.push({ datum: ui().nowLocal(), phase, notiz: notiz || '' });
    db().update('placements', placementId, { phase, verlauf });
    // Statuspflege bei erfolgreichem Abschluss
    if (phase === 'Vermittelt') {
      db().update('candidates', p.candidateId, { status: 'Vermittelt' });
      db().update('vacancies', p.vacancyId, { status: 'Besetzt' });
    }
    return db().get('placements', placementId);
  }

  return {
    PHASEN, PHASE_FARBEN, AKTIVITAET_TYPEN,
    candidateName, bezugInfo,
    matchScore, matchBar,
    openActivityModal, activityTimeline, activityIcon,
    openPlacementModal, changePhase
  };
})();
