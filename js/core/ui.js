/* ============================================================
   PersoCRM – UI-Bibliothek
   API (App.ui.*):
     esc(s)                        HTML-escaping
     icon(name, size)              Inline-SVG als String
     toast(msg, type)              type: success | error | info
     modal({title, content, footer, width, onMount}) → {el, close}
     confirm(message, onOk)
     badge(text)                   Status-Badge mit Farb-Mapping
     formatDate / formatDateTime / relDate
     formatCHF(n)
     avatar(name, size)            Initialen-Kreis (HTML-String)
     emptyState({icon, title, text, action})
     bindTabs(rootEl, onChange)    .tabs>.tab[data-tab] + .tab-panel[data-panel]
     statusColor(text)             Farbschlüssel (blue/green/…)
     today() / nowLocal()
     userName(id) / userAvatar(id, size)
   ============================================================ */
window.App = window.App || {};

App.ui = (() => {

  /* ---------- Escaping ---------- */
  function esc(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  /* ---------- Icons (Lucide-Stil, stroke) ---------- */
  const ICONS = {
    'dashboard':   '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    'users':       '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    'user':        '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'building':    '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01"/>',
    'briefcase':   '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
    'handshake':   '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4"/><path d="m21 3 1 11h-2"/><path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3"/><path d="M3 4h8"/>',
    'calendar':    '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'calendar-check': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="m9 16 2 2 4-4"/>',
    'chart':       '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    'settings':    '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'search':      '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
    'plus':        '<path d="M5 12h14M12 5v14"/>',
    'edit':        '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>',
    'trash':       '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    'x':           '<path d="M18 6 6 18M6 6l12 12"/>',
    'check':       '<path d="M20 6 9 17l-5-5"/>',
    'check-circle':'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    'chevron-down':'<path d="m6 9 6 6 6-6"/>',
    'chevron-right':'<path d="m9 18 6-6-6-6"/>',
    'chevron-left':'<path d="m15 18-6-6 6-6"/>',
    'arrow-left':  '<path d="m12 19-7-7 7-7M19 12H5"/>',
    'arrow-up-right':'<path d="M7 7h10v10M7 17 17 7"/>',
    'phone':       '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    'mail':        '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
    'map-pin':     '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    'clock':       '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'logout':      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    'file':        '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>',
    'file-text':   '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8M16 17H8M10 9H8"/>',
    'download':    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    'upload':      '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    'star':        '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
    'filter':      '<path d="M22 3H2l8 9.46V19l4 2v-8.54Z"/>',
    'refresh':     '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    'menu':        '<path d="M4 12h16M4 6h16M4 18h16"/>',
    'eye':         '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    'alert':       '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
    'note':        '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    'target':      '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'trending-up': '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
    'award':       '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/>',
    'globe':       '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    'columns':     '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 3v18"/>',
    'list':        '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    'database':    '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    'shield':      '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    'key':         '<path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
    'external':    '<path d="M15 3h6v6M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    'sparkles':    '<path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/>',
    'link':        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
  };

  function icon(name, size) {
    size = size || 18;
    const path = ICONS[name] || ICONS['file'];
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  /* ---------- Status-Farb-Mapping ---------- */
  const STATUS_COLORS = {
    // Kandidaten
    'Neu': 'blue', 'In Prüfung': 'amber', 'Aktiv': 'green', 'Vermittelt': 'purple', 'Inaktiv': 'gray', 'Gesperrt': 'red',
    // Unternehmen
    'Interessent': 'cyan',
    // Vakanzen
    'Offen': 'blue', 'In Bearbeitung': 'amber', 'Besetzt': 'green', 'On Hold': 'gray', 'Storniert': 'red',
    // Vermittlungs-Phasen
    'Vorgeschlagen': 'blue', 'Interview': 'amber', 'Angebot': 'purple', 'Absage': 'red',
    // Prioritäten
    'Hoch': 'red', 'Mittel': 'amber', 'Niedrig': 'gray',
    // Anstellungsarten
    'Festanstellung': 'indigo', 'Temporär': 'cyan', 'Try & Hire': 'purple',
    // Aktivitäten
    'Erledigt': 'green',
    'Anruf': 'blue', 'E-Mail': 'cyan', 'Termin': 'purple', 'Aufgabe': 'amber', 'Notiz': 'gray',
    // Rollen
    'Administrator': 'purple', 'Berater': 'blue', 'Beraterin': 'blue'
  };

  function statusColor(text) { return STATUS_COLORS[text] || 'gray'; }

  function badge(text) {
    if (!text) return '';
    return `<span class="badge badge-${statusColor(text)}">${esc(text)}</span>`;
  }

  /* ---------- Formatierung ---------- */
  function pad(n) { return String(n).padStart(2, '0'); }

  function parseDate(v) {
    if (!v) return null;
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  function formatDate(v) {
    const d = parseDate(v);
    if (!d) return '–';
    return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
  }

  function formatDateTime(v) {
    const d = parseDate(v);
    if (!d) return '–';
    return `${formatDate(v)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  function relDate(v) {
    const d = parseDate(v);
    if (!d) return '–';
    const diff = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
    if (diff === 0) return 'Heute';
    if (diff === 1) return 'Morgen';
    if (diff === -1) return 'Gestern';
    if (diff < 0) return `vor ${-diff} Tagen`;
    return `in ${diff} Tagen`;
  }

  function isOverdue(v) {
    const d = parseDate(v);
    if (!d) return false;
    return d.getTime() < Date.now();
  }

  function formatCHF(n) {
    if (n === null || n === undefined || n === '' || isNaN(n)) return '–';
    return "CHF " + Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  }

  function today() {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function nowLocal() {
    const d = new Date();
    return `${today()}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  /* ---------- Avatar ---------- */
  const AVATAR_COLORS = ['#2563eb', '#7c3aed', '#0e7490', '#16a34a', '#d97706', '#dc2626', '#4f46e5', '#0f766e', '#be185d', '#a16207'];

  function avatarColor(name) {
    let h = 0;
    for (const ch of String(name || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
  }

  function avatar(name, size) {
    size = size || 36;
    const fs = Math.round(size * 0.38);
    return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${fs}px;background:${avatarColor(name)}">${esc(initials(name))}</span>`;
  }

  function userName(id) {
    const u = App.db.get('users', id);
    return u ? u.name : '–';
  }

  function userAvatar(id, size) {
    const u = App.db.get('users', id);
    return avatar(u ? u.name : '?', size);
  }

  /* ---------- Toast ---------- */
  function toast(msg, type) {
    type = type || 'success';
    const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert' : 'alert';
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `${icon(iconName, 18)}<span>${esc(msg)}</span>`;
    document.getElementById('toast-container').appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(8px)';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  }

  /* ---------- Modal ---------- */
  function modal(opts) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal" style="${opts.width ? `max-width:${opts.width}px` : ''}" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h3>${esc(opts.title || '')}</h3>
          <button class="btn-icon close-btn" type="button" aria-label="Schliessen">${icon('x', 18)}</button>
        </div>
        <div class="modal-body">${opts.content || ''}</div>
        ${opts.footer ? `<div class="modal-footer">${opts.footer}</div>` : ''}
      </div>`;
    document.body.appendChild(backdrop);

    function close() {
      backdrop.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') close(); }

    backdrop.querySelector('.close-btn').addEventListener('click', close);
    backdrop.addEventListener('mousedown', (e) => { if (e.target === backdrop) close(); });
    document.addEventListener('keydown', onKey);

    const modalEl = backdrop.querySelector('.modal');
    if (opts.onMount) opts.onMount(modalEl, close);

    const firstInput = modalEl.querySelector('input, select, textarea');
    if (firstInput) setTimeout(() => firstInput.focus(), 50);

    return { el: modalEl, close };
  }

  function confirmDialog(message, onOk) {
    modal({
      title: 'Bestätigung',
      content: `<p style="font-size:14px;line-height:1.5">${esc(message)}</p>`,
      footer: `
        <button class="btn btn-secondary" data-action="cancel" type="button">Abbrechen</button>
        <button class="btn btn-danger" data-action="ok" type="button">Löschen</button>`,
      width: 420,
      onMount(el, close) {
        el.querySelector('[data-action="cancel"]').addEventListener('click', close);
        el.querySelector('[data-action="ok"]').addEventListener('click', () => { close(); onOk(); });
      }
    });
  }

  /* ---------- Tabs ---------- */
  function bindTabs(rootEl, onChange) {
    const tabs = rootEl.querySelectorAll('.tab[data-tab]');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const name = tab.dataset.tab;
        tabs.forEach(t => t.classList.toggle('active', t === tab));
        rootEl.querySelectorAll('.tab-panel[data-panel]').forEach(p => {
          p.classList.toggle('active', p.dataset.panel === name);
        });
        if (onChange) onChange(name);
      });
    });
  }

  /* ---------- Empty State ---------- */
  function emptyState(opts) {
    return `
      <div class="empty-state">
        <div class="es-icon">${icon(opts.icon || 'search', 26)}</div>
        <h4>${esc(opts.title || 'Keine Einträge')}</h4>
        <p>${esc(opts.text || '')}</p>
        ${opts.action || ''}
      </div>`;
  }

  return {
    esc, icon, badge, statusColor,
    formatDate, formatDateTime, relDate, isOverdue, formatCHF, today, nowLocal,
    avatar, avatarColor, initials, userName, userAvatar,
    toast, modal, confirm: confirmDialog,
    bindTabs, emptyState
  };
})();
