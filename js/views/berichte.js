/* ============================================================
   PersoCRM – Berichte (Auswertungen & Kennzahlen)
   Alle Diagramme sind reines Inline-SVG, berechnet aus App.db.
   ============================================================ */
(() => {
  const ui = App.ui, db = App.db, shared = App.shared;

  /* Diagramm-Farben: Text immer Textfarben, nie Serienfarbe */
  const TEXT = '#0f172a', TEXT_SOFT = '#64748b', GITTER = '#e2e8f0', BLAU = '#2563eb';
  const STATUS_HEX = {
    blue: '#2563eb', green: '#16a34a', amber: '#d97706', red: '#dc2626',
    purple: '#7c3aed', cyan: '#0891b2', gray: '#94a3b8', indigo: '#4f46e5'
  };
  const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const KANDIDAT_STATUS = ['Neu', 'In Prüfung', 'Aktiv', 'Vermittelt', 'Inaktiv', 'Gesperrt'];
  const VAKANZ_STATUS = ['Offen', 'In Bearbeitung', 'Besetzt', 'On Hold', 'Storniert'];

  /* ---------- Hilfsfunktionen ---------- */
  function rd(n) { return Math.round(n * 10) / 10; }

  function statusHex(status) { return STATUS_HEX[ui.statusColor(status)] || STATUS_HEX.gray; }

  function kurz(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  // «Vermittelt am» = Datum des Verlaufseintrags mit Phase Vermittelt, sonst erstelltAm
  function vermitteltAm(p) {
    const e = (p.verlauf || []).find(v => v.phase === 'Vermittelt');
    return (e && e.datum) ? e.datum : p.erstelltAm;
  }

  function kLabel(v) {
    if (!v) return '0';
    const k = v / 1000;
    if (k < 1) return String(v);
    return (k >= 10 || Number.isInteger(k)) ? `${Math.round(k)}k` : `${rd(k)}k`;
  }

  function nettesMaximum(max, stufen) {
    const roh = Math.max(max, 1) / stufen;
    const pot = Math.pow(10, Math.floor(Math.log10(roh)));
    const f = roh / pot;
    const schritt = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot;
    return schritt * stufen;
  }

  // Säule mit abgerundetem oberem Ende (4px)
  function saeulePfad(x, y, w, h) {
    const r = Math.min(4, w / 2, h);
    return `M${rd(x)},${rd(y + h)} L${rd(x)},${rd(y + r)} Q${rd(x)},${rd(y)} ${rd(x + r)},${rd(y)} ` +
           `L${rd(x + w - r)},${rd(y)} Q${rd(x + w)},${rd(y)} ${rd(x + w)},${rd(y + r)} L${rd(x + w)},${rd(y + h)} Z`;
  }

  // Balken mit abgerundetem rechtem Ende (4px)
  function balkenPfad(x, y, w, h) {
    const r = Math.min(4, h / 2, w);
    return `M${rd(x)},${rd(y)} L${rd(x + w - r)},${rd(y)} Q${rd(x + w)},${rd(y)} ${rd(x + w)},${rd(y + r)} ` +
           `L${rd(x + w)},${rd(y + h - r)} Q${rd(x + w)},${rd(y + h)} ${rd(x + w - r)},${rd(y + h)} L${rd(x)},${rd(y + h)} Z`;
  }

  /* ---------- Säulendiagramm (12 Monate, eine Serie) ---------- */
  function saeulenDiagramm(items, opts) {
    opts = opts || {};
    const W = 560, H = 210, padT = 18, padB = 24, padR = 6;
    const padL = opts.yFormat ? 40 : 6;
    const bW = W - padL - padR, bH = H - padT - padB;
    const stufen = 4;
    const maxWert = Math.max(...items.map(i => i.wert), 1);
    const skala = opts.yFormat ? nettesMaximum(maxWert, stufen) : maxWert;
    const slot = bW / items.length;
    const balken = Math.min(22, Math.max(4, rd(slot - 2)));
    let s = '';
    if (opts.yFormat) {
      for (let i = 0; i <= stufen; i++) {
        const y = rd(padT + bH - (bH * i / stufen));
        s += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${GITTER}"/>`;
        s += `<text x="${padL - 6}" y="${rd(y + 3.5)}" text-anchor="end" font-size="10" fill="${TEXT_SOFT}">${ui.esc(opts.yFormat(skala * i / stufen))}</text>`;
      }
    } else {
      s += `<line x1="${padL}" y1="${padT + bH}" x2="${W - padR}" y2="${padT + bH}" stroke="${GITTER}"/>`;
    }
    items.forEach((it, i) => {
      const mitte = rd(padL + slot * i + slot / 2);
      const x = mitte - balken / 2;
      const h = rd(bH * it.wert / skala);
      const y = padT + bH - h;
      s += `<g class="chart-tooltip-target"><title>${ui.esc(it.tooltip)}</title>`;
      s += `<rect x="${rd(padL + slot * i + 1)}" y="${padT}" width="${rd(slot - 2)}" height="${bH}" fill="transparent"/>`;
      if (it.wert > 0) {
        s += `<path d="${saeulePfad(x, y, balken, h)}" fill="${BLAU}"/>`;
        s += `<text x="${mitte}" y="${rd(y - 5)}" text-anchor="middle" font-size="11" font-weight="600" fill="${TEXT}">${ui.esc(it.wertLabel)}</text>`;
      }
      s += `</g>`;
      s += `<text x="${mitte}" y="${H - 8}" text-anchor="middle" font-size="10" fill="${TEXT_SOFT}">${ui.esc(it.label)}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${s}</svg>`;
  }

  /* ---------- Horizontales Balkendiagramm ---------- */
  function balkenDiagramm(items) {
    const W = 480, zeileH = 30, labelW = 132, padT = 4, padB = 4, wertPlatz = 46;
    const H = padT + items.length * zeileH + padB;
    const bW = W - labelW - wertPlatz - 6;
    const maxWert = Math.max(...items.map(i => i.wert), 1);
    let s = `<line x1="${labelW}" y1="${padT}" x2="${labelW}" y2="${H - padB}" stroke="${GITTER}"/>`;
    items.forEach((it, i) => {
      const y = padT + i * zeileH;
      const bh = 16, by = rd(y + (zeileH - bh) / 2);
      const bl = Math.max(rd(bW * it.wert / maxWert), 3);
      s += `<text x="${labelW - 10}" y="${rd(y + zeileH / 2 + 4)}" text-anchor="end" font-size="12" fill="${TEXT_SOFT}">${ui.esc(kurz(it.label, 17))}</text>`;
      s += `<g class="chart-tooltip-target"><title>${ui.esc(it.tooltip)}</title>`;
      s += `<rect x="${labelW}" y="${y}" width="${bW + wertPlatz}" height="${zeileH}" fill="transparent"/>`;
      if (it.wert > 0) {
        s += `<path d="${balkenPfad(labelW, by, bl, bh)}" fill="${it.farbe}"/>`;
        s += `<text x="${rd(labelW + bl + 8)}" y="${rd(y + zeileH / 2 + 4)}" font-size="12" font-weight="600" fill="${TEXT}">${ui.esc(it.wert)}</text>`;
      }
      s += `</g>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img">${s}</svg>`;
  }

  /* ---------- Donut mit Legende ---------- */
  function bogenPunkt(cx, cy, r, a) { return `${rd(cx + r * Math.cos(a))},${rd(cy + r * Math.sin(a))}`; }

  function segmentPfad(cx, cy, r, ir, a1, a2) {
    const gross = (a2 - a1) > Math.PI ? 1 : 0;
    return `M${bogenPunkt(cx, cy, r, a1)} A${r},${r} 0 ${gross} 1 ${bogenPunkt(cx, cy, r, a2)} ` +
           `L${bogenPunkt(cx, cy, ir, a2)} A${ir},${ir} 0 ${gross} 0 ${bogenPunkt(cx, cy, ir, a1)} Z`;
  }

  function donutSvg(items, total, zentrumWort) {
    const G = 200, cx = 100, cy = 100, r = 90, ir = 58;
    const aktive = items.filter(i => i.wert > 0);
    let s = '';
    if (aktive.length === 1) {
      // Voller Ring: Bogen mit identischem Start/Ende ist in SVG nicht darstellbar
      const it = aktive[0];
      s += `<g class="chart-tooltip-target"><title>${ui.esc(`${it.label}: ${it.wert} (100%)`)}</title>` +
           `<circle cx="${cx}" cy="${cy}" r="${(r + ir) / 2}" fill="none" stroke="${it.farbe}" stroke-width="${r - ir}"/></g>`;
    } else {
      let a = -Math.PI / 2;
      aktive.forEach(it => {
        const a2 = a + (it.wert / total) * Math.PI * 2;
        const pct = Math.round(it.wert / total * 100);
        s += `<g class="chart-tooltip-target"><title>${ui.esc(`${it.label}: ${it.wert} (${pct}%)`)}</title>` +
             `<path d="${segmentPfad(cx, cy, r, ir, a, a2)}" fill="${it.farbe}" stroke="#ffffff" stroke-width="2"/></g>`;
        a = a2;
      });
    }
    s += `<text x="${cx}" y="${cy}" text-anchor="middle" font-size="28" font-weight="700" fill="${TEXT}">${total}</text>`;
    s += `<text x="${cx}" y="${cy + 20}" text-anchor="middle" font-size="11" fill="${TEXT_SOFT}">${ui.esc(zentrumWort)}</text>`;
    return `<svg viewBox="0 0 ${G} ${G}" width="100%" role="img">${s}</svg>`;
  }

  function donutMitLegende(items, zentrumWort, leerText) {
    const total = items.reduce((s, i) => s + i.wert, 0);
    if (total === 0) {
      return ui.emptyState({ icon: 'users', title: 'Keine Daten', text: leerText });
    }
    const legende = items.filter(i => i.wert > 0).map(it => `
      <div class="li">
        <span class="sw" style="background:${it.farbe}"></span>
        <span>${ui.esc(it.label)}</span>
        <span class="fw-600" style="color:${TEXT}">${it.wert}</span>
      </div>`).join('');
    return `
      <div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">
        <div style="flex:0 1 180px;min-width:140px">${donutSvg(items, total, zentrumWort)}</div>
        <div class="legend" style="flex-direction:column;gap:8px;margin-top:0;align-items:flex-start">${legende}</div>
      </div>`;
  }

  /* ---------- Karten-Hülle mit Definitionszeile ---------- */
  function chartKarte(titel, definition, inhalt) {
    return `
      <div class="card">
        <div class="card-header"><h3>${ui.esc(titel)}</h3></div>
        <div class="card-body">
          <div class="fs-12 text-soft mb-10">${ui.esc(definition)}</div>
          ${inhalt}
        </div>
      </div>`;
  }

  function kpiHtml(iconName, farbe, wert, label) {
    return `
      <div class="kpi">
        <div class="kpi-icon ${farbe}">${ui.icon(iconName, 20)}</div>
        <div>
          <div class="kpi-value">${ui.esc(wert)}</div>
          <div class="kpi-label">${ui.esc(label)}</div>
        </div>
      </div>`;
  }

  /* ---------- Top-Unternehmen-Tabelle ---------- */
  function topFirmenHtml(top) {
    if (top.length === 0) {
      return ui.emptyState({
        icon: 'building', title: 'Noch kein Umsatz',
        text: 'Es sind noch keine abgeschlossenen Vermittlungen mit Honorar vorhanden.'
      });
    }
    const totalAnzahl = top.reduce((s, e) => s + e.anzahl, 0);
    const totalUmsatz = top.reduce((s, e) => s + e.umsatz, 0);
    return `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th style="width:56px">Rang</th>
              <th>Unternehmen</th>
              <th style="text-align:right">Vermittlungen</th>
              <th style="text-align:right">Umsatz</th>
            </tr>
          </thead>
          <tbody>
            ${top.map((e, i) => `
              <tr>
                <td class="text-muted">${i + 1}</td>
                <td class="cell-main">
                  <a href="#/unternehmen/${e.firma.id}">${ui.esc(e.firma.name)}</a>
                  <div class="cell-sub">${ui.esc(e.firma.branche || '')}</div>
                </td>
                <td style="text-align:right">${e.anzahl}</td>
                <td style="text-align:right" class="fw-600">${ui.esc(ui.formatCHF(e.umsatz))}</td>
              </tr>`).join('')}
            <tr>
              <td></td>
              <td class="cell-main">Total</td>
              <td style="text-align:right" class="fw-600">${totalAnzahl}</td>
              <td style="text-align:right" class="fw-600">${ui.esc(ui.formatCHF(totalUmsatz))}</td>
            </tr>
          </tbody>
        </table>
      </div>`;
  }

  /* ---------- Render ---------- */
  function render(container) {
    const jetzt = new Date();
    const jahr = jetzt.getFullYear();
    const placements = db.list('placements');
    const kandidaten = db.list('candidates');
    const vakanzen = db.list('vacancies');

    const vermittelt = placements.filter(p => p.phase === 'Vermittelt');
    const absagen = placements.filter(p => p.phase === 'Absage');
    const vermitteltJahr = vermittelt.filter(p => {
      const d = new Date(vermitteltAm(p));
      return !isNaN(d.getTime()) && d.getFullYear() === jahr;
    });

    /* KPIs */
    const umsatzJahr = vermitteltJahr.reduce((s, p) => s + (p.honorar || 0), 0);
    const honorare = vermittelt.map(p => p.honorar).filter(h => h !== null && h !== undefined);
    const durchschnitt = honorare.length ? honorare.reduce((s, h) => s + h, 0) / honorare.length : null;
    const quoteBasis = vermittelt.length + absagen.length;
    const quote = quoteBasis > 0 ? `${Math.round(vermittelt.length / quoteBasis * 100)}%` : '–';

    /* Letzte 12 Monate */
    const monate = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(jahr, jetzt.getMonth() - i, 1);
      monate.push({ jahr: d.getFullYear(), monat: d.getMonth(), label: MONATE[d.getMonth()], anzahl: 0, umsatz: 0 });
    }
    vermittelt.forEach(p => {
      const d = new Date(vermitteltAm(p));
      if (isNaN(d.getTime())) return;
      const m = monate.find(x => x.jahr === d.getFullYear() && x.monat === d.getMonth());
      if (m) { m.anzahl += 1; m.umsatz += p.honorar || 0; }
    });

    const anzahlItems = monate.map(m => ({
      label: m.label, wert: m.anzahl, wertLabel: String(m.anzahl),
      tooltip: `${m.label} ${m.jahr}: ${m.anzahl} ${m.anzahl === 1 ? 'Vermittlung' : 'Vermittlungen'}`
    }));
    const umsatzItems = monate.map(m => ({
      label: m.label, wert: m.umsatz, wertLabel: kLabel(m.umsatz),
      tooltip: `${m.label} ${m.jahr}: ${ui.formatCHF(m.umsatz)}`
    }));

    /* Kandidaten nach Status (Donut) */
    const statusZaehler = {};
    kandidaten.forEach(c => { statusZaehler[c.status] = (statusZaehler[c.status] || 0) + 1; });
    const statusReihe = KANDIDAT_STATUS.concat(Object.keys(statusZaehler).filter(s => !KANDIDAT_STATUS.includes(s)));
    const donutItems = statusReihe
      .filter(s => statusZaehler[s])
      .map(s => ({ label: s, wert: statusZaehler[s], farbe: statusHex(s) }));

    /* Pipeline nach Phase */
    const phasenItems = shared.PHASEN.map(ph => {
      const n = placements.filter(p => p.phase === ph).length;
      return {
        label: ph, wert: n, farbe: shared.PHASE_FARBEN[ph] || STATUS_HEX.gray,
        tooltip: `${ph}: ${n} ${n === 1 ? 'Vermittlung' : 'Vermittlungen'}`
      };
    });

    /* Vakanzen nach Status */
    const vakStatusReihe = VAKANZ_STATUS.concat(
      vakanzen.map(v => v.status).filter(s => s && !VAKANZ_STATUS.includes(s))
        .filter((s, i, arr) => arr.indexOf(s) === i));
    const vakanzItems = vakStatusReihe.map(st => {
      const n = vakanzen.filter(v => v.status === st).length;
      return {
        label: st, wert: n, farbe: statusHex(st),
        tooltip: `${st}: ${n} ${n === 1 ? 'Vakanz' : 'Vakanzen'}`
      };
    });

    /* Kandidatenquellen */
    const quellen = {};
    kandidaten.forEach(c => { const q = c.quelle || 'Unbekannt'; quellen[q] = (quellen[q] || 0) + 1; });
    const quellenItems = Object.keys(quellen)
      .map(q => ({
        label: q, wert: quellen[q], farbe: BLAU,
        tooltip: `${q}: ${quellen[q]} ${quellen[q] === 1 ? 'Kandidat' : 'Kandidaten'}`
      }))
      .sort((a, b) => b.wert - a.wert || a.label.localeCompare(b.label));

    /* Top-Unternehmen nach Umsatz */
    const proFirma = new Map();
    vermittelt.forEach(p => {
      const v = db.get('vacancies', p.vacancyId);
      if (!v) return;
      const f = db.get('companies', v.companyId);
      if (!f) return;
      const e = proFirma.get(f.id) || { firma: f, anzahl: 0, umsatz: 0 };
      e.anzahl += 1;
      e.umsatz += p.honorar || 0;
      proFirma.set(f.id, e);
    });
    const topFirmen = Array.from(proFirma.values())
      .filter(e => e.umsatz > 0)
      .sort((a, b) => b.umsatz - a.umsatz)
      .slice(0, 5);

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Berichte</h1>
          <div class="subtitle">Kennzahlen und Auswertungen zu Vermittlungen, Umsatz und Pipeline</div>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpiHtml('award', 'green', String(vermitteltJahr.length), `Vermittlungen ${jahr}`)}
        ${kpiHtml('trending-up', 'blue', ui.formatCHF(umsatzJahr), `Honorarumsatz ${jahr}`)}
        ${kpiHtml('chart', 'purple', durchschnitt !== null ? ui.formatCHF(durchschnitt) : '–', 'Durchschnittshonorar (gesamt)')}
        ${kpiHtml('target', 'amber', quote, 'Abschlussquote (gesamt)')}
      </div>

      <div class="chart-grid mb-20">
        ${chartKarte('Vermittlungen pro Monat',
          'Anzahl Vermittlungen mit Abschluss (Phase «Vermittelt») pro Monat, letzte 12 Monate.',
          saeulenDiagramm(anzahlItems))}
        ${chartKarte('Honorarumsatz pro Monat',
          'Summe der Honorare aller im jeweiligen Monat abgeschlossenen Vermittlungen, letzte 12 Monate.',
          saeulenDiagramm(umsatzItems, { yFormat: kLabel }))}
        ${chartKarte('Kandidaten nach Status',
          'Alle erfassten Kandidaten, gruppiert nach aktuellem Status.',
          donutMitLegende(donutItems, 'Kandidaten', 'Es sind noch keine Kandidaten erfasst.'))}
        ${chartKarte('Pipeline nach Phase',
          'Alle Vermittlungen, gruppiert nach aktueller Phase im Prozess.',
          balkenDiagramm(phasenItems))}
        ${chartKarte('Vakanzen nach Status',
          'Alle erfassten Vakanzen, gruppiert nach aktuellem Status.',
          balkenDiagramm(vakanzItems))}
        ${chartKarte('Kandidatenquellen',
          'Alle erfassten Kandidaten, gruppiert nach Quelle, absteigend sortiert.',
          kandidaten.length
            ? balkenDiagramm(quellenItems)
            : ui.emptyState({ icon: 'users', title: 'Keine Daten', text: 'Es sind noch keine Kandidaten erfasst.' }))}
      </div>

      <div class="card mb-20">
        <div class="card-header"><h3>Top-Unternehmen nach Umsatz</h3></div>
        <div class="card-body flush">
          <div class="fs-12 text-soft" style="padding:12px 18px ${topFirmen.length ? '4px' : '0'}">
            Honorarsumme abgeschlossener Vermittlungen pro Unternehmen (Zuordnung über die zugehörige Vakanz), Top 5.
          </div>
          ${topFirmenHtml(topFirmen)}
        </div>
      </div>

      <p class="text-soft fs-12">Alle Auswertungen basieren auf den lokal gespeicherten Daten.</p>`;
  }

  App.registerView('berichte', {
    title: 'Berichte',
    icon: 'chart',
    nav: true,
    order: 7,
    render(container) { render(container); }
  });
})();
