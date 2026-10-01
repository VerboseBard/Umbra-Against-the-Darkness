/* Apply the saved theme before paint; keep the preference local to this browser. */
(() => {
  'use strict';
  const key = 'umbra-research-theme';
  const root = document.documentElement;
  const read = () => {
    try { return localStorage.getItem(key) === 'light' ? 'light' : 'dark'; }
    catch { return 'dark'; }
  };
  function apply(theme) {
    root.dataset.theme = theme;
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      const next = theme === 'dark' ? 'light' : 'dark';
      button.textContent = next === 'light' ? 'Light mode' : 'Dark mode';
      button.setAttribute('aria-label', 'Switch to ' + next + ' mode');
      button.title = (theme === 'dark' ? 'Dark' : 'Light') + ' mode is active';
    });
  }
  apply(read());
  function bind() {
    apply(root.dataset.theme);
    document.querySelectorAll('[data-theme-toggle]').forEach(button => {
      button.addEventListener('click', () => {
        const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
        apply(next);
        try { localStorage.setItem(key, next); } catch { /* Current page still works. */ }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, {once:true});
  else bind();
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) apply(read()); });
  window.addEventListener('pageshow', event => { if (event.persisted) apply(read()); });
})();
