/* ============================================================
   PersoCRM – Login-Ansicht
   Nachbau der Anmeldemaske: Benutzername, Passwort,
   «Anmelden», «Passwort vergessen?»
   ============================================================ */
window.App = window.App || {};
App.views = App.views || {};

App.views.renderLoginPage = function (root) {
  const ui = App.ui;
  root.innerHTML = `
    <div class="login-page">
      <div style="width:100%;max-width:400px">
        <div class="login-card">
          <div class="logo-row">
            <div class="logo-mark">P</div>
            <div>
              <h1>PersoCRM</h1>
              <div class="tagline">Personalvermittlung &amp; Recruiting</div>
            </div>
          </div>
          <div id="login-error" style="display:none" class="login-error">
            ${ui.icon('alert', 16)} <span>Benutzername oder Passwort ist ungültig.</span>
          </div>
          <form id="login-form">
            <div class="field">
              <label for="login-username">Benutzername</label>
              <input type="text" id="login-username" name="username" autocomplete="username" required autofocus>
            </div>
            <div class="field">
              <label for="login-password">Passwort</label>
              <input type="password" id="login-password" name="password" autocomplete="current-password" required>
            </div>
            <button type="submit" class="btn btn-primary btn-block" style="height:40px;margin-top:6px">Anmelden</button>
          </form>
          <a href="#" class="forgot" id="forgot-link">Passwort vergessen?</a>
          <div class="demo-hint">
            <strong>Demo-Zugang:</strong> Benutzername <code>admin</code>, Passwort <code>admin</code><br>
            (oder <code>mmueller</code> / <code>demo</code>)
          </div>
        </div>
        <div class="login-footer">© 2026 PersoCRM · Alle Daten werden lokal im Browser gespeichert</div>
      </div>
    </div>`;

  const form = root.querySelector('#login-form');
  const errorBox = root.querySelector('#login-error');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = form.elements.username.value;
    const password = form.elements.password.value;
    if (App.auth.login(username, password)) {
      errorBox.style.display = 'none';
      App.navigate('/dashboard');
      App.router.resolve();
    } else {
      errorBox.style.display = '';
      form.elements.password.value = '';
      form.elements.password.focus();
    }
  });

  root.querySelector('#forgot-link').addEventListener('click', (e) => {
    e.preventDefault();
    ui.toast('Demo-Modus: Bitte admin / admin verwenden.', 'info');
  });
};
