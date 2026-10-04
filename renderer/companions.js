// Shared by Electron and the renderer. One point = 1% of a weekly quota.
(function (root) {
  const themes = ['cyber', 'engine', 'mascot', 'arcade', 'glass', 'crt', 'industrial', 'garden', 'anime', 'editorial'];
  const stages = [
    { id: 'acquaintance', points: 0, icon: '○' },
    { id: 'friend', points: 15, icon: '✿' },
    { id: 'close', points: 70, icon: '♥' },
    { id: 'best', points: 200, icon: '★' },
    { id: 'soulmate', points: 100 * 30 / 7, icon: '✦' },
  ];
  const key = (theme, service) => `${theme}:${service}`;
  const valid = (theme, service) => themes.includes(theme) && ['claude', 'codex'].includes(service);
  function level(points = 0) {
    return stages.reduce((rank, stage, i) => points >= stage.points ? i : rank, 0);
  }
  function view(state, theme, service) {
    const friend = state?.friends?.[key(theme, service)] || {};
    const points = Number.isFinite(friend.points) ? Math.max(0, friend.points) : 0;
    const unlocked = level(points);
    const selected = Number.isInteger(friend.selected) ? Math.max(0, Math.min(unlocked, friend.selected)) : unlocked;
    const next = stages[unlocked + 1];
    const progress = next ? Math.min(100, (points - stages[unlocked].points) / (next.points - stages[unlocked].points) * 100) : 100;
    return { points, unlocked, selected, next, progress };
  }
  function select(state, theme, service, selected) {
    if (!valid(theme, service) || (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected > view(state, theme, service).unlocked))) return false;
    state.friends ||= {};
    const id = key(theme, service);
    state.friends[id] = { ...state.friends[id], selected };
    return true;
  }
  // A pause, theme switch or restart establishes a new baseline. Never award offline usage.
  function pause(state) {
    for (const meter of Object.values(state.meters || {})) meter.active = null;
  }
  function observe(state, usage, options, now = Date.now()) {
    state.friends ||= {};
    state.meters ||= {};
    const unlocked = [];
    for (const service of ['claude', 'codex']) {
      const data = usage?.[service];
      if (!data?.ok || data.manual || data.source === 'manual') {
        if (state.meters[service]) state.meters[service].active = null;
        continue;
      }
      const usable = (w) => w && Number.isFinite(w.percent) && w.percent >= 0 && w.percent <= 100 && Number.isFinite(w.resetsAt) && w.resetsAt > now;
      const type = usable(data.weekly) ? 'weekly' : usable(data.fiveHour) ? 'fiveHour' : null;
      if (!type || !Number.isFinite(data.updatedAt) || data.updatedAt > now + 60000) {
        if (state.meters[service]) state.meters[service].active = null;
        continue;
      }
      const window = data[type];
      const active = valid(options.theme, service) && options[service] !== false ? key(options.theme, service) : null;
      const prev = state.meters[service];
      // Old log events and repeated reads cannot roll the meter back or earn twice.
      if (prev && data.updatedAt <= prev.updatedAt) continue;
      const same = prev && prev.type === type && prev.resetsAt === window.resetsAt;
      const high = same ? Math.max(prev.high, window.percent) : window.percent;
      let delta = 0;
      if (active && prev?.active === active && prev.type === type) {
        if (same) delta = Math.max(0, window.percent - prev.high);
        else if (prev.resetsAt <= now && window.resetsAt > prev.resetsAt && data.updatedAt >= prev.resetsAt) delta = window.percent;
      }
      state.meters[service] = { type, resetsAt: window.resetsAt, high, updatedAt: data.updatedAt, active };
      if (!delta) continue;
      // Fallback: a full five-hour window is 5/168 of a weekly window.
      const points = delta * (type === 'weekly' ? 1 : 5 / 168);
      const friend = state.friends[active] ||= { points: 0, selected: null };
      const before = level(friend.points);
      friend.points = (Number.isFinite(friend.points) ? Math.max(0, friend.points) : 0) + points;
      const after = level(friend.points);
      if (after > before) unlocked.push({ theme: options.theme, service, from: before, to: after });
    }
    return unlocked;
  }
  const api = { themes, stages, key, level, view, select, pause, observe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Companions = api;
})(globalThis);
