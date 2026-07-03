/* ============================================================
   PersoCRM – Datenhaltung (localStorage)
   API: App.db.list / get / insert / update / remove / nextNr /
        reset / exportJson / importJson / settings
   Sammlungen: users, candidates, companies, vacancies,
               placements, activities
   ============================================================ */
window.App = window.App || {};

App.db = (() => {
  const KEY = 'persocrm_data_v1';
  let data = null;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    if (!data || !data.candidates) {
      data = Seed.create();
      persist();
    }
  }

  function persist() {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  function coll(name) {
    if (!data) load();
    if (!Array.isArray(data[name])) throw new Error('Unbekannte Sammlung: ' + name);
    return data[name];
  }

  function list(name) { return coll(name); }

  function get(name, id) {
    id = Number(id);
    return coll(name).find(r => r.id === id) || null;
  }

  function insert(name, obj) {
    const c = coll(name);
    data.meta.lastId = (data.meta.lastId || 600) + 1;
    obj.id = data.meta.lastId;
    if (!obj.erstelltAm) obj.erstelltAm = new Date().toISOString().slice(0, 10);
    c.push(obj);
    persist();
    return obj;
  }

  function update(name, id, patch) {
    const rec = get(name, id);
    if (!rec) return null;
    Object.assign(rec, patch);
    persist();
    return rec;
  }

  function remove(name, id) {
    id = Number(id);
    const c = coll(name);
    const i = c.findIndex(r => r.id === id);
    if (i >= 0) { c.splice(i, 1); persist(); return true; }
    return false;
  }

  function nextNr(prefix) {
    if (!data) load();
    data.meta.counters[prefix] = (data.meta.counters[prefix] || 1000) + 1;
    persist();
    return `${prefix}-${data.meta.counters[prefix]}`;
  }

  function settings(patch) {
    if (!data) load();
    if (patch) { Object.assign(data.settings, patch); persist(); }
    return data.settings;
  }

  function reset() {
    data = Seed.create();
    persist();
  }

  function exportJson() {
    if (!data) load();
    return JSON.stringify(data, null, 2);
  }

  function importJson(str) {
    try {
      const parsed = JSON.parse(str);
      if (!parsed || !Array.isArray(parsed.candidates) || !Array.isArray(parsed.companies)) return false;
      data = parsed;
      persist();
      return true;
    } catch (e) { return false; }
  }

  load();

  return { list, get, insert, update, remove, nextNr, settings, reset, exportJson, importJson, persist };
})();
