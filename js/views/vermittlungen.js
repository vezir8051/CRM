/* ============================================================
   PersoCRM – Vermittlungen (Kanban-Board + Liste)
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  // Suchtext auf Modulebene, damit er Rerenders und Modus-Wechsel überlebt
  let suchText = '';

  /* ---------- Daten ---------- */
  function angereichert() {
    return db.list('placements').map(p => {
      const k = db.get('candidates', p.candidateId);
      const v = db.get('vacancies', p.vacancyId);
      const f = v ? db.get('companies', v.companyId) : null;
      return { p, k, v, f };
    });
  }

  function gefiltert() {
    const q = suchText.trim().toLowerCase();
    let rows = angereichert();
    if (q) {
      rows = rows.filter(({ k, v, f }) =>
        shared.candidateName(k).toLowerCase().includes(q) ||
        (v ? v.titel : '').toLowerCase().includes(q) ||
        (f ? f.name : '').toLowerCase().includes(q));
    }
    return rows;
  }

  function tageSeit(datum) {
    const d = new Date(datum);
    if (isNaN(d.getTime())) return 0;
    return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
  }

  /* ---------- HTML-Bausteine ---------- */
  function kartenHtml(r) {
    const { p, k, v, f } = r;
    return `
      <div class="kanban-card" draggable="true" data-id="${p.id}">
        <div class="kc-title">${ui.esc(shared.candidateName(k))}</div>
        <div class="kc-sub">${ui.esc((v ? v.titel : '–') + ' – ' + (f ? f.name : '–'))}</div>
        <div class="kc-footer">
          ${ui.icon('clock', 12)}
          <span>seit ${tageSeit(p.erstelltAm)} Tg.</span>
          ${p.honorar != null ? `<span class="fw-600">${ui.esc(ui.formatCHF(p.honorar))}</span>` : ''}
          <span style="flex:1"></span>
          ${v ? ui.userAvatar(v.betreuerId, 22) : ''}
        </div>
      </div>`;
  }

  function zeileHtml(r) {
    const { p, k, v, f } = r;
    const kName = shared.candidateName(k);
    return `
      <tr class="clickable" data-id="${p.id}">
        <td>
          <div class="flex">
            ${ui.avatar(kName, 32)}
            <div>
              <a class="cell-main" href="#/kandidaten/${p.candidateId}">${ui.esc(kName)}</a>
              <div class="cell-sub">${ui.esc(k ? k.beruf : '')}</div>
            </div>
          </div>
        </td>
        <td>
          <a class="cell-main" href="#/vakanzen/${p.vacancyId}">${ui.esc(v ? v.titel : '–')}</a>
          <div class="cell-sub">${ui.esc(f ? f.name : '')}</div>
        </td>
        <td>${ui.badge(p.phase)}</td>
        <td>${ui.esc(ui.formatDate(p.erstelltAm))}</td>
        <td>${ui.esc(ui.formatDate(p.startdatum))}</td>
        <td>${ui.esc(ui.formatCHF(p.honorar))}</td>
        <td class="actions-cell">
          <button type="button" class="btn-icon" data-act="detail" title="Details">${ui.icon('eye', 16)}</button>
          <button type="button" class="btn-icon" data-act="edit" title="Bearbeiten">${ui.icon('edit', 16)}</button>
          <button type="button" class="btn-icon danger" data-act="delete" title="Löschen">${ui.icon('trash', 16)}</button>
        </td>
      </tr>`;
  }

  /* ---------- View ---------- */
  function render(container, params) {
    const modus = params && params[0] === 'liste' ? 'liste' : 'board';

    function rerender() { render(container, params); }

    const aktive = db.list('placements')
      .filter(p => p.phase !== 'Vermittelt' && p.phase !== 'Absage').length;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Vermittlungen</h1>
          <div class="subtitle">${aktive} aktive${aktive === 1 ? 'r Prozess' : ' Prozesse'}</div>
        </div>
        <div class="actions">
          <button type="button" class="btn ${modus === 'board' ? 'btn-primary' : 'btn-secondary'}" data-modus="board">${ui.icon('columns', 16)} Board</button>
          <button type="button" class="btn ${modus === 'liste' ? 'btn-primary' : 'btn-secondary'}" data-modus="liste">${ui.icon('list', 16)} Liste</button>
          <button type="button" class="btn btn-primary" id="verm-neu">${ui.icon('plus', 16)} Neue Vermittlung</button>
        </div>
      </div>
      <div class="toolbar">
        <div class="searchbox">
          ${ui.icon('search', 16)}
          <input type="text" id="verm-suche" placeholder="Kandidat, Vakanz oder Unternehmen suchen…" value="${ui.esc(suchText)}" autocomplete="off">
        </div>
        <span class="count" id="verm-count"></span>
      </div>
      <div id="verm-body"></div>`;

    const body = container.querySelector('#verm-body');

    container.querySelectorAll('[data-modus]').forEach(btn => {
      btn.addEventListener('click', () => {
        App.navigate(btn.dataset.modus === 'liste' ? '/vermittlungen/liste' : '/vermittlungen');
      });
    });

    container.querySelector('#verm-neu').addEventListener('click', () => {
      shared.openPlacementModal({ onSaved: () => { App.updateNavBadges(); rerender(); } });
    });

    const sucheInput = container.querySelector('#verm-suche');
    sucheInput.addEventListener('input', () => {
      suchText = sucheInput.value;
      renderBody();
    });

    /* ----- Detail-Modal ----- */
    function openDetail(id) {
      const p = db.get('placements', id);
      if (!p) return;
      const k = db.get('candidates', p.candidateId);
      const v = db.get('vacancies', p.vacancyId);
      const f = v ? db.get('companies', v.companyId) : null;
      const kName = shared.candidateName(k);
      const verlauf = (p.verlauf || []).slice()
        .sort((a, b) => String(b.datum).localeCompare(String(a.datum)));

      ui.modal({
        title: 'Vermittlung',
        width: 620,
        content: `
          <div class="flex mb-10">
            ${ui.avatar(kName, 38)}
            <div>
              <a href="#/kandidaten/${p.candidateId}" class="fw-600" data-nav>${ui.esc(kName)}</a>
              <div class="cell-sub">${ui.esc(k ? k.beruf : '–')}</div>
            </div>
          </div>
          <div class="flex mb-20">
            <span class="avatar" style="width:38px;height:38px;font-size:13px;background:var(--indigo);border-radius:9px">${ui.icon('briefcase', 16)}</span>
            <div>
              <a href="#/vakanzen/${p.vacancyId}" class="fw-600" data-nav>${ui.esc(v ? v.titel : '–')}</a>
              <div class="cell-sub">${ui.esc(f ? f.name : '–')}</div>
            </div>
          </div>
          <dl class="info-list mb-20">
            <dt>Phase</dt><dd>${ui.badge(p.phase)}</dd>
            <dt>Erstellt</dt><dd>${ui.esc(ui.formatDate(p.erstelltAm))}</dd>
            <dt>Antritt</dt><dd>${ui.esc(ui.formatDate(p.startdatum))}</dd>
            <dt>Honorar</dt><dd>${ui.esc(ui.formatCHF(p.honorar))}</dd>
            <dt>Notiz</dt><dd>${p.notiz ? ui.esc(p.notiz) : '–'}</dd>
          </dl>
          <div class="form-section-title">Phase ändern</div>
          <div class="field">
            <div class="flex">
              <select id="detail-phase" style="max-width:220px">
                ${shared.PHASEN.map(ph => `<option ${ph === p.phase ? 'selected' : ''}>${ph}</option>`).join('')}
              </select>
              <button type="button" class="btn btn-primary btn-sm" id="detail-phase-btn">Übernehmen</button>
            </div>
            <div class="hint">«Vermittelt» setzt gleichzeitig den Kandidaten auf «Vermittelt» und die Vakanz auf «Besetzt».</div>
          </div>
          <div class="form-section-title">Verlauf</div>
          ${verlauf.length ? `
            <ul class="timeline">
              ${verlauf.map(e => `
                <li class="timeline-item">
                  <div class="tl-body">
                    <div class="tl-meta"><span>${ui.esc(ui.formatDateTime(e.datum))}</span>${ui.badge(e.phase)}</div>
                    ${e.notiz ? `<div class="tl-desc">${ui.esc(e.notiz)}</div>` : ''}
                  </div>
                </li>`).join('')}
            </ul>` : `<div class="text-muted fs-12">Noch kein Verlauf vorhanden.</div>`}
        `,
        footer: `
          <button type="button" class="btn btn-secondary" data-action="edit">${ui.icon('edit', 15)} Bearbeiten</button>
          <button type="button" class="btn btn-primary" data-action="close">Schliessen</button>`,
        onMount(el, close) {
          el.querySelectorAll('a[data-nav]').forEach(a => a.addEventListener('click', () => close()));
          el.querySelector('[data-action="close"]').addEventListener('click', close);
          el.querySelector('[data-action="edit"]').addEventListener('click', () => {
            close();
            shared.openPlacementModal({ placement: p, onSaved: () => { App.updateNavBadges(); rerender(); } });
          });
          el.querySelector('#detail-phase-btn').addEventListener('click', () => {
            const neu = el.querySelector('#detail-phase').value;
            if (neu === p.phase) { ui.toast('Diese Phase ist bereits gesetzt.', 'info'); return; }
            shared.changePhase(p.id, neu, 'Phase manuell geändert.');
            ui.toast(`Phase geändert: ${neu}`);
            App.updateNavBadges();
            close();
            rerender();
          });
        }
      });
    }

    /* ----- Board ----- */
    function renderBoard(rows) {
      body.innerHTML = `<div class="kanban">` + shared.PHASEN.map(phase => {
        const karten = rows
          .filter(r => r.p.phase === phase)
          .sort((a, b) => String(b.p.erstelltAm).localeCompare(String(a.p.erstelltAm)));
        return `
          <div class="kanban-col" data-phase="${ui.esc(phase)}">
            <div class="kanban-col-header">
              <span class="dot" style="background:${shared.PHASE_FARBEN[phase]}"></span>
              <span>${ui.esc(phase)}</span>
              <span class="count">${karten.length}</span>
            </div>
            <div class="kanban-cards">
              ${karten.length ? karten.map(kartenHtml).join('') : `<div class="text-soft fs-12" style="padding:4px 2px">Keine Einträge</div>`}
            </div>
          </div>`;
      }).join('') + `</div>`;

      body.querySelectorAll('.kanban-card').forEach(card => {
        const id = Number(card.dataset.id);
        card.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', String(id));
          e.dataTransfer.effectAllowed = 'move';
          card.classList.add('dragging');
        });
        card.addEventListener('dragend', () => card.classList.remove('dragging'));
        card.addEventListener('click', (e) => {
          if (e.target.closest('button, a')) return;
          openDetail(id);
        });
      });

      body.querySelectorAll('.kanban-col').forEach(col => {
        const phase = col.dataset.phase;
        col.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          col.classList.add('drag-over');
        });
        col.addEventListener('dragleave', (e) => {
          if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over');
        });
        col.addEventListener('drop', (e) => {
          e.preventDefault();
          col.classList.remove('drag-over');
          const id = Number(e.dataTransfer.getData('text/plain'));
          const p = db.get('placements', id);
          if (!p || p.phase === phase) return;
          shared.changePhase(id, phase, 'Per Drag & Drop verschoben.');
          ui.toast(`Phase geändert: ${phase}`);
          App.updateNavBadges();
          rerender();
        });
      });
    }

    /* ----- Liste ----- */
    function renderListe(rows) {
      rows = rows.slice().sort((a, b) =>
        String(b.p.erstelltAm).localeCompare(String(a.p.erstelltAm)) || b.p.id - a.p.id);

      if (!rows.length) {
        body.innerHTML = `<div class="card">${ui.emptyState({
          icon: 'handshake',
          title: 'Keine Vermittlungen',
          text: suchText.trim()
            ? 'Keine Vermittlungen entsprechen der aktuellen Suche.'
            : 'Erfassen Sie die erste Vermittlung über «Neue Vermittlung».'
        })}</div>`;
        return;
      }

      body.innerHTML = `
        <div class="card">
          <div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Kandidat</th><th>Vakanz</th><th>Phase</th>
                  <th>Erstellt</th><th>Antritt</th><th>Honorar</th><th></th>
                </tr>
              </thead>
              <tbody>${rows.map(zeileHtml).join('')}</tbody>
            </table>
          </div>
        </div>`;

      body.querySelectorAll('tbody tr').forEach(tr => {
        tr.addEventListener('click', (e) => {
          if (e.target.closest('button, a')) return;
          openDetail(Number(tr.dataset.id));
        });
      });

      body.querySelectorAll('[data-act]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = Number(btn.closest('tr').dataset.id);
          const p = db.get('placements', id);
          if (!p) return;
          const act = btn.dataset.act;
          if (act === 'detail') {
            openDetail(id);
          } else if (act === 'edit') {
            shared.openPlacementModal({ placement: p, onSaved: () => { App.updateNavBadges(); rerender(); } });
          } else if (act === 'delete') {
            ui.confirm(`Vermittlung von ${shared.candidateName(p.candidateId)} wirklich löschen?`, () => {
              db.remove('placements', id);
              ui.toast('Vermittlung gelöscht');
              App.updateNavBadges();
              rerender();
            });
          }
        });
      });
    }

    function renderBody() {
      const rows = gefiltert();
      const countEl = container.querySelector('#verm-count');
      if (countEl) countEl.textContent = `${rows.length} von ${db.list('placements').length} Vermittlungen`;
      if (modus === 'board') renderBoard(rows); else renderListe(rows);
    }

    renderBody();
  }

  App.registerView('vermittlungen', {
    title: 'Vermittlungen',
    icon: 'handshake',
    nav: true,
    order: 5,
    render
  });
})();
