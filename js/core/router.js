/* ============================================================
   PersoCRM – Hash-Router (#/route/param1/param2)
   API:
     App.registerView(name, {title, icon, nav, order, render})
       render(container, params) – params = Array der Segmente
     App.navigate(path)  z.B. App.navigate('/kandidaten/101')
     App.router.init()   – startet Routing (ruft app.js auf)
     App.router.views    – Registry (für Sidebar-Aufbau)
     App.router.current  – Name der aktiven Route
   ============================================================ */
window.App = window.App || {};

App.router = (() => {
  const views = {};
  let current = null;

  function register(name, def) {
    views[name] = def;
  }

  function parse() {
    let h = location.hash || '#/';
    if (h.startsWith('#')) h = h.slice(1);
    if (h.startsWith('/')) h = h.slice(1);
    const seg = h.split('/').filter(Boolean).map(decodeURIComponent);
    return { name: seg[0] || 'dashboard', params: seg.slice(1) };
  }

  function resolve() {
    // Nicht eingeloggt → immer Login anzeigen
    if (!App.auth.isLoggedIn()) {
      current = 'login';
      App.renderLogin();
      return;
    }
    const { name, params } = parse();
    const view = views[name] || views['dashboard'];
    const viewName = views[name] ? name : 'dashboard';
    current = viewName;
    App.renderShell(viewName, view, params);
  }

  function navigate(path) {
    if (!path.startsWith('/')) path = '/' + path;
    const target = '#' + path;
    if (location.hash === target) {
      resolve(); // gleicher Hash → manuell neu rendern
    } else {
      location.hash = target;
    }
  }

  function init() {
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  return { register, navigate, init, resolve,
    get views() { return views; },
    get current() { return current; } };
})();

App.registerView = App.router.register;
App.navigate = App.router.navigate;
