/* ============================================================
   PersoCRM – Authentifizierung (Demo, clientseitig)
   API: App.auth.login / logout / currentUser / isLoggedIn
   ============================================================ */
window.App = window.App || {};

App.auth = (() => {
  const KEY = 'persocrm_session';

  function login(username, password) {
    const user = App.db.list('users').find(u =>
      u.username.toLowerCase() === String(username || '').trim().toLowerCase() &&
      u.password === password
    );
    if (!user) return false;
    localStorage.setItem(KEY, JSON.stringify({ userId: user.id, seit: new Date().toISOString() }));
    return true;
  }

  function logout() {
    localStorage.removeItem(KEY);
  }

  function currentUser() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (!s) return null;
      return App.db.get('users', s.userId);
    } catch (e) { return null; }
  }

  function isLoggedIn() { return !!currentUser(); }

  return { login, logout, currentUser, isLoggedIn };
})();
