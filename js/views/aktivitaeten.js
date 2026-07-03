/* ============================================================
   PersoCRM – Ansicht: Aktivitäten & Aufgaben
   Gruppierte Aufgabenliste (Überfällig / Heute / Morgen / …)
   mit Suche, Typ- und Statusfilter sowie «Nur meine».
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  /* Tages-Differenz zu heute (negativ = Vergangenheit), null bei ungültig */
  function tagDiff(v) {
    if (!v) return null;
    const d = new Date(v);
    if (isNaN(d.getTime())) return null;
    const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const n = new Date();
    const b = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((a - b) / 86400000);
  }

  function typKlasse(typ) {
    return String(typ || '').toLowerCase().replace('ä', 'a');
  }

  App.registerView('aktivitaeten', {
    title: 'Aktivitäten',
    icon: 'calendar-check',
    nav: true,
    order: 6,

    render(container, params) {
      const filter = { q: '', typ: '', status: 'offen', nurMeine: false };

      /* ---------- Filterung ---------- */
      function gefiltert() {
        const q = filter.q.trim().toLowerCase();
        const me = App.auth.currentUser();
        return db.list('activities').filter(a => {
          if (q) {
            const text = `${a.betreff || ''} ${a.beschreibung || ''}`.toLowerCase();
            if (!text.includes(q)) return false;
          }
          if (filter.typ && a.typ !== filter.typ) return false;
          if (filter.nurMeine && me && a.userId !== me.id) return false;
          if (filter.status === 'offen' && a.erledigt) return false;
          if (filter.status === 'erledigt' && !a.erledigt) return false;
          return true;
        });
      }

      /* ---------- Gruppierung offener Aufgaben nach Fälligkeit ---------- */
      function gruppieren(acts) {
        const g = { ueberfaellig: [], heute: [], morgen: [], woche: [], spaeter: [], ohne: [], erledigt: [] };
        acts.forEach(a => {
          if (a.erledigt) { g.erledigt.push(a); return; }
          const diff = tagDiff(a.faelligAm);
          if (diff === null) g.ohne.push(a);
          else if (diff < 0) g.ueberfaellig.push(a);
          else if (diff === 0) g.heute.push(a);
          else if (diff === 1) g.morgen.push(a);
          else if (diff <= 7) g.woche.push(a);
          else g.spaeter.push(a);
        });
        const auf = (x, y) => String(x.faelligAm).localeCompare(String(y.faelligAm));
        ['ueberfaellig', 'heute', 'morgen', 'woche', 'spaeter'].forEach(k => g[k].sort(auf));
        g.ohne.sort((x, y) => String(y.erstelltAm).localeCompare(String(x.erstelltAm)));
        // Erledigte: neueste zuerst, maximal 30
        g.erledigt.sort((x, y) => String(y.faelligAm || y.erstelltAm).localeCompare(String(x.faelligAm || x.erstelltAm)));
        g.erledigt = g.erledigt.slice(0, 30);
        return g;
      }

      /* ---------- Einzelner Listeneintrag ---------- */
      function itemHtml(a) {
        const overdue = !a.erledigt && a.faelligAm && ui.isOverdue(a.faelligAm);
        const bi = shared.bezugInfo(a.bezug);
        return `
          <li class="timeline-item" data-id="${a.id}">
            <button class="btn-icon" data-act="toggle" type="button"
              title="${a.erledigt ? 'Als offen markieren' : 'Als erledigt markieren'}">
              ${ui.icon(a.erledigt ? 'refresh' : 'check', 16)}
            </button>
            <div class="tl-icon ${typKlasse(a.typ)}">${ui.icon(shared.activityIcon(a.typ), 16)}</div>
            <div class="tl-body">
              <div class="tl-title ${a.erledigt ? 'done' : ''}">${ui.esc(a.betreff)}</div>
              ${a.beschreibung ? `<div class="tl-desc">${ui.esc(a.beschreibung)}</div>` : ''}
              <div class="tl-meta">
                <span>${ui.badge(a.typ)}</span>
                ${a.faelligAm ? `<span class="${overdue ? 'overdue' : ''}">${ui.icon('clock', 12)} ${ui.formatDateTime(a.faelligAm)} (${ui.relDate(a.faelligAm)})</span>` : ''}
                <span>${ui.esc(ui.userName(a.userId))}</span>
                ${bi ? `<a href="${bi.hash}">${ui.icon(bi.icon, 12)} ${ui.esc(bi.label)}</a>` : ''}
              </div>
            </div>
            <div class="tl-actions">
              <button class="btn-icon" data-act="edit" type="button" title="Bearbeiten">${ui.icon('edit', 15)}</button>
              <button class="btn-icon danger" data-act="delete" type="button" title="Löschen">${ui.icon('trash', 15)}</button>
            </div>
          </li>`;
      }

      function sectionHtml(titel, acts, headerStyle) {
        return `
          <div class="card mb-20">
            <div class="card-header">
              <h3 ${headerStyle ? `style="${headerStyle}"` : ''}>${ui.esc(titel)}</h3>
              <span class="badge badge-gray">${acts.length}</span>
            </div>
            <div class="card-body flush" style="padding:0 18px">
              <ul class="timeline">${acts.map(itemHtml).join('')}</ul>
            </div>
          </div>`;
      }

      /* ---------- Liste (neu) aufbauen ---------- */
      function renderList() {
        const listEl = container.querySelector('#act-list');
        const acts = gefiltert();
        const g = gruppieren(acts);

        // Kopfzeile: offene / überfällige Aufgaben (über alle Aktivitäten)
        const alleOffen = db.list('activities').filter(a => !a.erledigt);
        const alleUeberfaellig = alleOffen.filter(a => {
          const diff = tagDiff(a.faelligAm);
          return diff !== null && diff < 0;
        });
        const subEl = container.querySelector('#act-subtitle');
        subEl.textContent =
          `${alleOffen.length} offene ${alleOffen.length === 1 ? 'Aufgabe' : 'Aufgaben'}, ` +
          `davon ${alleUeberfaellig.length} überfällig`;

        const shown = g.ueberfaellig.length + g.heute.length + g.morgen.length +
                      g.woche.length + g.spaeter.length + g.ohne.length + g.erledigt.length;
        container.querySelector('#act-count').textContent =
          `${shown} ${shown === 1 ? 'Aktivität' : 'Aktivitäten'}`;

        if (shown === 0) {
          listEl.innerHTML = ui.emptyState({
            icon: 'calendar-check',
            title: 'Keine Aktivitäten gefunden',
            text: 'Passen Sie die Filter an oder erfassen Sie eine neue Aktivität.',
            action: `<button class="btn btn-primary" data-empty-new type="button">${ui.icon('plus', 16)} Neue Aktivität</button>`
          });
          listEl.querySelector('[data-empty-new]').addEventListener('click', neueAktivitaet);
          return;
        }

        const sections = [
          { key: 'ueberfaellig', titel: 'Überfällig', style: 'color:var(--red)' },
          { key: 'heute', titel: 'Heute' },
          { key: 'morgen', titel: 'Morgen' },
          { key: 'woche', titel: 'Diese Woche' },
          { key: 'spaeter', titel: 'Später' },
          { key: 'ohne', titel: 'Ohne Termin' }
        ];
        let html = sections
          .filter(s => g[s.key].length > 0)
          .map(s => sectionHtml(s.titel, g[s.key], s.style))
          .join('');
        if ((filter.status === 'erledigt' || filter.status === 'alle') && g.erledigt.length > 0) {
          html += sectionHtml('Erledigt', g.erledigt);
        }
        listEl.innerHTML = html;

        listEl.querySelectorAll('[data-act]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = Number(btn.closest('.timeline-item').dataset.id);
            const act = db.get('activities', id);
            if (!act) return;
            const action = btn.dataset.act;
            if (action === 'toggle') {
              db.update('activities', id, { erledigt: !act.erledigt });
              ui.toast(act.erledigt ? 'Aktivität wieder geöffnet' : 'Aktivität erledigt');
              refresh();
            } else if (action === 'edit') {
              shared.openActivityModal({ activity: act, onSaved: refresh });
            } else if (action === 'delete') {
              ui.confirm(`Aktivität «${act.betreff}» wirklich löschen?`, () => {
                db.remove('activities', id);
                ui.toast('Aktivität gelöscht');
                refresh();
              });
            }
          });
        });
      }

      /* Nach jeder Mutation: Liste neu, Filter bleiben, Nav-Badges aktualisieren */
      function refresh() {
        renderList();
        App.updateNavBadges();
      }

      function neueAktivitaet() {
        shared.openActivityModal({ onSaved: refresh });
      }

      /* ---------- Seitengerüst (einmalig) ---------- */
      function renderAll() {
        container.innerHTML = `
          <div class="page-header">
            <div>
              <h1>Aktivitäten &amp; Aufgaben</h1>
              <div class="subtitle" id="act-subtitle"></div>
            </div>
            <div class="actions">
              <button class="btn btn-primary" id="act-new" type="button">${ui.icon('plus', 16)} Neue Aktivität</button>
            </div>
          </div>
          <div class="toolbar">
            <div class="searchbox">
              ${ui.icon('search', 16)}
              <input type="text" id="act-search" placeholder="Betreff oder Beschreibung suchen…" autocomplete="off">
            </div>
            <select id="act-typ" style="width:150px">
              <option value="">Alle Typen</option>
              ${shared.AKTIVITAET_TYPEN.map(t => `<option value="${ui.esc(t)}">${ui.esc(t)}</option>`).join('')}
            </select>
            <select id="act-status" style="width:130px">
              <option value="offen">Offen</option>
              <option value="erledigt">Erledigt</option>
              <option value="alle">Alle</option>
            </select>
            <div class="checkbox-row">
              <input type="checkbox" id="act-mine">
              <label for="act-mine">Nur meine</label>
            </div>
            <div class="spacer"></div>
            <span class="count" id="act-count"></span>
          </div>
          <div id="act-list"></div>`;

        container.querySelector('#act-new').addEventListener('click', neueAktivitaet);
        container.querySelector('#act-search').addEventListener('input', (e) => {
          filter.q = e.target.value;
          renderList();
        });
        container.querySelector('#act-typ').addEventListener('change', (e) => {
          filter.typ = e.target.value;
          renderList();
        });
        container.querySelector('#act-status').addEventListener('change', (e) => {
          filter.status = e.target.value;
          renderList();
        });
        container.querySelector('#act-mine').addEventListener('change', (e) => {
          filter.nurMeine = e.target.checked;
          renderList();
        });

        renderList();
      }

      renderAll();

      /* Route #/aktivitaeten/neu → Modal sofort öffnen, Hash bereinigen
         (replaceState löst kein erneutes Routing aus) */
      if (params && params[0] === 'neu') {
        history.replaceState(null, '', '#/aktivitaeten');
        neueAktivitaet();
      }
    }
  });
})();
