/* ============================================================
   PersoCRM – Dashboard
   Begrüssung, KPIs, Vermittlungs-Chart, Pipeline, Aufgaben,
   neueste Kandidaten und dringende Vakanzen.
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  const TAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
  const MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const MONATE_KURZ = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

  /* ---------- Daten-Hilfen ---------- */
  function endeHeute() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d;
  }

  // Anzahl Vermittlungen: Placements mit Verlaufseintrag «Vermittelt» im Monat
  function vermitteltImMonat(jahr, monat) {
    return db.list('placements').filter(p =>
      (p.verlauf || []).some(v => {
        if (v.phase !== 'Vermittelt' || !v.datum) return false;
        const d = new Date(v.datum);
        return !isNaN(d.getTime()) && d.getFullYear() === jahr && d.getMonth() === monat;
      })
    ).length;
  }

  function offeneFaellige() {
    const ende = endeHeute();
    return db.list('activities')
      .filter(a => !a.erledigt && a.faelligAm && new Date(a.faelligAm) <= ende)
      .sort((a, b) => String(a.faelligAm).localeCompare(String(b.faelligAm)));
  }

  /* ---------- Kopfzeile ---------- */
  function headerHtml() {
    const user = App.auth.currentUser();
    const vorname = user && user.name ? user.name.split(/\s+/)[0] : '';
    const jetzt = new Date();
    const datum = `${TAGE[jetzt.getDay()]}, ${jetzt.getDate()}. ${MONATE[jetzt.getMonth()]} ${jetzt.getFullYear()}`;
    return `
      <div class="page-header">
        <div>
          <h1>Guten Tag, ${ui.esc(vorname)}!</h1>
          <div class="subtitle">${ui.esc(datum)}</div>
        </div>
      </div>`;
  }

  /* ---------- KPI-Zeile ---------- */
  function kpiHtml() {
    const kandidaten = db.list('candidates').filter(c => ['Neu', 'In Prüfung', 'Aktiv'].includes(c.status)).length;
    const vakanzen = db.list('vacancies').filter(v => ['Offen', 'In Bearbeitung'].includes(v.status)).length;
    const pipeline = db.list('placements').filter(p => p.phase !== 'Vermittelt' && p.phase !== 'Absage').length;
    const jetzt = new Date();
    const abschluesse = vermitteltImMonat(jetzt.getFullYear(), jetzt.getMonth());
    const aufgaben = offeneFaellige();
    const aufgabenFarbe = aufgaben.some(a => ui.isOverdue(a.faelligAm)) ? 'red' : 'cyan';

    const kpi = (href, iconName, farbe, wert, label) => `
      <a href="${href}" style="text-decoration:none;color:inherit">
        <div class="kpi" style="height:100%">
          <div class="kpi-icon ${farbe}">${ui.icon(iconName, 22)}</div>
          <div>
            <div class="kpi-value">${wert}</div>
            <div class="kpi-label">${ui.esc(label)}</div>
          </div>
        </div>
      </a>`;

    return `
      <div class="kpi-grid">
        ${kpi('#/kandidaten', 'users', 'blue', kandidaten, 'Aktive Kandidaten')}
        ${kpi('#/vakanzen', 'briefcase', 'amber', vakanzen, 'Offene Vakanzen')}
        ${kpi('#/vermittlungen', 'handshake', 'purple', pipeline, 'Pipeline')}
        ${kpi('#/vermittlungen', 'award', 'green', abschluesse, 'Vermittlungen diesen Monat')}
        ${kpi('#/aktivitaeten', 'calendar-check', aufgabenFarbe, aufgaben.length, 'Fällige Aufgaben')}
      </div>`;
  }

  /* ---------- Balkendiagramm (SVG, letzte 6 Monate) ---------- */
  function chartSvg() {
    const jetzt = new Date();
    const monate = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(jetzt.getFullYear(), jetzt.getMonth() - i, 1);
      monate.push({ jahr: d.getFullYear(), monat: d.getMonth(), anzahl: vermitteltImMonat(d.getFullYear(), d.getMonth()) });
    }
    const max = Math.max(1, ...monate.map(m => m.anzahl));
    const topPad = 30, baseY = 184, plotH = baseY - topPad;
    const barW = 44, gap = 12;
    const startX = (560 - (monate.length * barW + (monate.length - 1) * gap)) / 2;

    const teile = [];
    // Recessive Gitterlinien + Grundlinie
    [0.25, 0.5, 0.75].forEach(f => {
      const y = (baseY - plotH * f).toFixed(1);
      teile.push(`<line x1="24" y1="${y}" x2="536" y2="${y}" stroke="#f1f5f9" stroke-width="1"/>`);
    });
    teile.push(`<line x1="24" y1="${baseY}" x2="536" y2="${baseY}" stroke="#e2e8f0" stroke-width="1"/>`);

    monate.forEach((m, i) => {
      const x = startX + i * (barW + gap);
      const h = m.anzahl === 0 ? 2 : Math.max(6, (m.anzahl / max) * plotH);
      const top = baseY - h;
      const titel = `${m.anzahl} Vermittlung${m.anzahl === 1 ? '' : 'en'} im ${MONATE[m.monat]} ${m.jahr}`;
      let form;
      if (m.anzahl === 0) {
        // 2px-Stummel bei Nullwerten
        form = `<rect x="${x}" y="${top}" width="${barW}" height="${h}" fill="#2563eb"/>`;
      } else {
        // Nur die oberen Ecken abrunden (4px)
        form = `<path d="M${x} ${baseY} V${(top + 4).toFixed(1)} Q${x} ${top.toFixed(1)} ${x + 4} ${top.toFixed(1)} H${x + barW - 4} Q${x + barW} ${top.toFixed(1)} ${x + barW} ${(top + 4).toFixed(1)} V${baseY} Z" fill="#2563eb"/>`;
      }
      teile.push(`<g class="chart-tooltip-target"><title>${ui.esc(titel)}</title>${form}</g>`);
      if (m.anzahl > 0) {
        teile.push(`<text x="${x + barW / 2}" y="${(top - 8).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="600" fill="#0f172a">${m.anzahl}</text>`);
      }
      teile.push(`<text x="${x + barW / 2}" y="205" text-anchor="middle" font-size="12" fill="#64748b">${MONATE_KURZ[m.monat]}</text>`);
    });

    return `<svg viewBox="0 0 560 220" width="100%" role="img" aria-label="Vermittlungen der letzten 6 Monate">${teile.join('')}</svg>`;
  }

  /* ---------- Pipeline-Übersicht ---------- */
  function pipelineHtml() {
    const zaehler = shared.PHASEN.map(ph => ({
      phase: ph,
      anzahl: db.list('placements').filter(p => p.phase === ph).length
    }));
    const max = Math.max(1, ...zaehler.map(z => z.anzahl));
    return zaehler.map(z => {
      const farbe = shared.PHASE_FARBEN[z.phase] || 'var(--gray)';
      const breite = Math.round((z.anzahl / max) * 100);
      return `
        <a href="#/vermittlungen" style="display:flex;align-items:center;gap:10px;padding:7px 0;text-decoration:none;color:inherit">
          <span style="width:9px;height:9px;border-radius:50%;background:${farbe};flex-shrink:0"></span>
          <span style="width:112px;font-size:13px;font-weight:600">${ui.esc(z.phase)}</span>
          <span style="flex:1;height:8px;border-radius:4px;background:var(--bg);overflow:hidden"><span style="display:block;height:100%;width:${breite}%;background:${farbe};border-radius:4px"></span></span>
          <span style="width:26px;text-align:right;font-size:13px;font-weight:700">${z.anzahl}</span>
        </a>`;
    }).join('');
  }

  /* ---------- Fällige Aufgaben ---------- */
  function aufgabenHtml() {
    const aufgaben = offeneFaellige().slice(0, 7);
    if (aufgaben.length === 0) {
      return ui.emptyState({
        icon: 'check-circle',
        title: 'Keine fälligen Aufgaben',
        text: 'Alle Aufgaben sind erledigt – gut gemacht!'
      });
    }
    return `<ul class="timeline">` + aufgaben.map(a => {
      const bi = shared.bezugInfo(a.bezug);
      const overdue = ui.isOverdue(a.faelligAm);
      const titel = bi
        ? `<a href="${ui.esc(bi.hash)}" style="color:var(--text)">${ui.esc(a.betreff)}</a>`
        : ui.esc(a.betreff);
      return `
        <li class="timeline-item">
          <div class="tl-icon ${a.typ.toLowerCase().replace('ä', 'a')}">${ui.icon(shared.activityIcon(a.typ), 16)}</div>
          <div class="tl-body">
            <div class="tl-title">${titel}</div>
            <div class="tl-meta">
              <span class="${overdue ? 'overdue' : ''}">${ui.icon('clock', 12)} ${ui.relDate(a.faelligAm)}</span>
              ${bi ? `<span>${ui.icon(bi.icon, 12)} ${ui.esc(bi.label)}</span>` : ''}
            </div>
          </div>
          <div class="tl-actions">
            <button class="btn-icon" type="button" data-done="${a.id}" title="Als erledigt markieren">${ui.icon('check', 15)}</button>
          </div>
        </li>`;
    }).join('') + `</ul>`;
  }

  /* ---------- Neueste Kandidaten ---------- */
  function kandidatenHtml() {
    const neueste = db.list('candidates').slice()
      .sort((a, b) => String(b.erstelltAm || '').localeCompare(String(a.erstelltAm || '')))
      .slice(0, 5);
    if (neueste.length === 0) {
      return ui.emptyState({ icon: 'users', title: 'Keine Kandidaten', text: 'Es sind noch keine Kandidaten erfasst.' });
    }
    return neueste.map((c, i) => {
      const name = shared.candidateName(c);
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;${i < neueste.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
          ${ui.avatar(name, 34)}
          <div style="flex:1;min-width:0">
            <a class="fw-600" href="#/kandidaten/${c.id}" style="color:var(--text)">${ui.esc(name)}</a>
            <div class="text-muted fs-12">${ui.esc(c.beruf)}</div>
          </div>
          ${ui.badge(c.status)}
        </div>`;
    }).join('');
  }

  /* ---------- Dringende Vakanzen ---------- */
  function vakanzenHtml() {
    const dringend = db.list('vacancies')
      .filter(v => v.status === 'Offen' || v.status === 'In Bearbeitung')
      .sort((a, b) =>
        ((a.prioritaet === 'Hoch' ? 0 : 1) - (b.prioritaet === 'Hoch' ? 0 : 1)) ||
        String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')))
      .slice(0, 5);
    if (dringend.length === 0) {
      return ui.emptyState({ icon: 'briefcase', title: 'Keine offenen Vakanzen', text: 'Zurzeit sind keine Vakanzen offen.' });
    }
    return dringend.map((v, i) => {
      const firma = db.get('companies', v.companyId);
      const overdue = v.deadline && ui.isOverdue(v.deadline);
      return `
        <div style="display:flex;align-items:center;gap:12px;padding:8px 0;${i < dringend.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
          <div style="flex:1;min-width:0">
            <a class="fw-600" href="#/vakanzen/${v.id}" style="color:var(--text)">${ui.esc(v.titel)}</a>
            <div class="text-muted fs-12">${ui.esc(firma ? firma.name : '–')}</div>
          </div>
          ${ui.badge(v.prioritaet)}
          <span class="fs-12 ${overdue ? 'overdue' : 'text-muted'}" style="min-width:82px;text-align:right">${ui.relDate(v.deadline)}</span>
        </div>`;
    }).join('');
  }

  /* ---------- Rendern ---------- */
  function render(container) {
    function draw() {
      container.innerHTML = `
        ${headerHtml()}
        ${kpiHtml()}
        <div class="grid-2" style="align-items:start">
          <div style="display:flex;flex-direction:column;gap:18px">
            <div class="card">
              <div class="card-header"><h3>Vermittlungen (letzte 6 Monate)</h3></div>
              <div class="card-body">${chartSvg()}</div>
            </div>
            <div class="card">
              <div class="card-header"><h3>Pipeline-Übersicht</h3></div>
              <div class="card-body">${pipelineHtml()}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:18px">
            <div class="card">
              <div class="card-header">
                <h3>Fällige Aufgaben</h3>
                <div class="actions"><a href="#/aktivitaeten" class="fs-12 fw-600">Alle anzeigen</a></div>
              </div>
              <div class="card-body">${aufgabenHtml()}</div>
            </div>
            <div class="card">
              <div class="card-header">
                <h3>Neueste Kandidaten</h3>
                <div class="actions"><a href="#/kandidaten" class="fs-12 fw-600">Alle anzeigen</a></div>
              </div>
              <div class="card-body">${kandidatenHtml()}</div>
            </div>
            <div class="card">
              <div class="card-header">
                <h3>Dringende Vakanzen</h3>
                <div class="actions"><a href="#/vakanzen" class="fs-12 fw-600">Alle anzeigen</a></div>
              </div>
              <div class="card-body">${vakanzenHtml()}</div>
            </div>
          </div>
        </div>`;

      // Aufgabe abhaken → speichern, komplett neu zeichnen, Badges aktualisieren
      container.querySelectorAll('[data-done]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          db.update('activities', Number(btn.dataset.done), { erledigt: true });
          ui.toast('Aufgabe als erledigt markiert');
          draw();
          App.updateNavBadges();
        });
      });
    }
    draw();
  }

  App.registerView('dashboard', {
    title: 'Dashboard',
    icon: 'dashboard',
    nav: true,
    order: 1,
    render(container) { render(container); }
  });
})();
