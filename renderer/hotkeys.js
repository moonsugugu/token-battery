(function (root) {
  const defaults = Object.freeze({ full: 'F7', toggle: 'F8' });
  function migrate(saved) {
    // Only replace the old default pair; keep custom keys and disabled shortcuts.
    if (saved?.toggle === 'F3' && saved?.full === 'F4') return { ...defaults };
    return { ...defaults, ...(saved || {}) };
  }
  const api = { defaults, migrate };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.Hotkeys = api;
})(typeof globalThis === 'object' ? globalThis : this);
