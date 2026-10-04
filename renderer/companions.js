// Shared relationship rules. Only token metadata from local logs earns progress.
(function (root) {
  const themes = ['cyber', 'engine', 'mascot', 'arcade', 'glass', 'crt', 'industrial', 'garden', 'anime', 'editorial'];
  const defaultTarget = 30000000; // Estimate: one million processed tokens/day for 30 days, not a Pro entitlement.
  const stages = [
    { id: 'acquaintance', share: 0, icon: '○' },
    { id: 'friend', share: .02, icon: '✿' },
    { id: 'close', share: .12, icon: '♥' },
    { id: 'best', share: .4, icon: '★' },
    { id: 'soulmate', share: 1, icon: '✦' },
  ];
  const key = (theme, service) => `${theme}:${service}`;
  const valid = (theme, service) => themes.includes(theme) && ['claude', 'codex'].includes(service);
  const target = (state, service) => Number.isSafeInteger(state?.targets?.[service]) && state.targets[service] >= 1000000 ? state.targets[service] : defaultTarget;
  function level(tokens = 0, goal = defaultTarget) {
    return stages.reduce((rank, stage, i) => tokens >= Math.ceil(stage.share * goal) ? i : rank, 0);
  }
  function migrate(state) {
    state.friends ||= {};
    for (const friend of Object.values(state.friends)) {
      if (friend.tokens == null) {
        // Retain earned looks from v1.1.0 without inventing historical token counts.
        friend.achieved = [0, 15, 70, 200, 100 * 30 / 7].reduce((rank, n, i) => friend.points >= n ? i : rank, 0);
        friend.tokens = 0;
        delete friend.points;
      }
    }
    delete state.meters;
    return state;
  }
  function view(state, theme, service) {
    const friend = state?.friends?.[key(theme, service)] || {};
    const tokens = Number.isSafeInteger(friend.tokens) ? Math.max(0, friend.tokens) : 0;
    const goal = target(state, service);
    const achieved = Number.isInteger(friend.achieved) ? Math.min(4, Math.max(0, friend.achieved)) : 0;
    const unlocked = Math.max(achieved, level(tokens, goal));
    const selected = Number.isInteger(friend.selected) ? Math.max(0, Math.min(unlocked, friend.selected)) : unlocked;
    const next = stages[unlocked + 1] && { ...stages[unlocked + 1], tokens: Math.ceil(stages[unlocked + 1].share * goal) };
    const start = Math.ceil(stages[unlocked].share * goal);
    const progress = next ? Math.max(0, Math.min(100, (tokens - start) / (next.tokens - start) * 100)) : 100;
    return { tokens, goal, unlocked, selected, next, progress };
  }
  function select(state, theme, service, selected) {
    if (!valid(theme, service) || (selected !== null && (!Number.isInteger(selected) || selected < 0 || selected > view(state, theme, service).unlocked))) return false;
    state.friends ||= {};
    const id = key(theme, service);
    state.friends[id] = { ...state.friends[id], selected };
    return true;
  }
  function setTarget(state, service, tokens) {
    if (!['claude', 'codex'].includes(service) || !Number.isSafeInteger(tokens) || tokens < 1000000 || tokens > 10000000000) return false;
    for (const theme of themes) {
      const friend = state.friends?.[key(theme, service)];
      if (friend) friend.achieved = view(state, theme, service).unlocked;
    }
    state.targets ||= {};
    state.targets[service] = tokens;
    return true;
  }
  function earn(state, events, options) {
    state.friends ||= {};
    const unlocked = [];
    for (const service of ['claude', 'codex']) {
      if (!valid(options.theme, service) || options[service] === false) continue;
      const amount = events.filter((event) => event.service === service && Number.isSafeInteger(event.tokens) && event.tokens > 0 && event.at >= options.since[service]).reduce((sum, event) => sum + event.tokens, 0);
      if (!amount) continue;
      const id = key(options.theme, service);
      const before = view(state, options.theme, service).unlocked;
      const friend = state.friends[id] ||= { tokens: 0, selected: null };
      friend.tokens = (Number.isSafeInteger(friend.tokens) ? Math.max(0, friend.tokens) : 0) + amount;
      const after = view(state, options.theme, service).unlocked;
      friend.achieved = after;
      if (after > before) unlocked.push({ theme: options.theme, service, from: before, to: after });
    }
    return unlocked;
  }
  const api = { themes, stages, defaultTarget, key, level, target, view, migrate, select, setTarget, earn };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Companions = api;
})(globalThis);
