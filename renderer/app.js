const $ = (id) => document.getElementById(id);
const W = window.widget;

let store = null;
let usage = null;
let tokenStatus = null;

// ---------- 유틸 ----------
function fmtDur(ms) {
  const m = Math.max(0, Math.floor(ms / 60000));
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60;
  if (d > 0) return t('dh', { d, h });
  if (h > 0) return t('hm', { h, m: mm });
  return t('min', { n: mm });
}
const fmtLeft = (ms) => (ms == null ? '' : ms <= 0 ? t('resetDone') : t('left', { t: fmtDur(ms) }));
function fmtShort(ms) {
  if (ms == null || ms <= 0) return '';
  const m = Math.floor(ms / 60000);
  if (m >= 1440) return t('dayS', { d: Math.floor(m / 1440) });
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  return t('min', { n: m });
}
function fmtAgo(ts) {
  if (!ts) return '';
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return t('ago_now');
  if (m < 60) return t('ago_m', { n: m });
  if (m < 1440) return t('ago_h', { n: Math.floor(m / 60) });
  return t('ago_d', { n: Math.floor(m / 1440) });
}
function fmtMD(ts) {
  const d = new Date(ts);
  const wd = d.toLocaleDateString(LANG, { weekday: 'short' });
  return `${d.getMonth() + 1}/${d.getDate()}(${wd}) ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function fmtClock(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString(LANG, { month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtClockTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clampPct = (w) => Math.max(0, Math.min(100, Math.round(w.percent)));
const SVC = { claude: 'Claude', codex: 'Codex' };
const svcOn = (s) => store[s === 'claude' ? 'showClaude' : 'showCodex'] !== false;
const svcData = (s) => (usage && usage[s] && usage[s].ok ? usage[s] : null);

// ---------- 친구 관계와 해금한 모습 ----------
const bondView = (s) => Companions.view(store.companions, store.theme || 'cyber', s);
const bondName = (rank) => t('bond_' + Companions.stages[rank].id);
const fmtTokens = (n) => new Intl.NumberFormat(LANG, { notation: 'compact', maximumFractionDigits: 1 }).format(n);
function bondStatus(s) {
  const friend = bondView(s);
  const stage = Companions.stages[friend.unlocked];
  const hint = friend.next ? t('bondNext', { stage: bondName(friend.unlocked + 1), n: fmtTokens(Math.max(0, friend.next.tokens - friend.tokens)) }) : t('bondComplete');
  return `<div class="bond-status" title="${esc(hint)}"><span>${stage.icon} ${esc(bondName(friend.unlocked))}</span><div class="bond-track" role="progressbar" aria-label="${esc(hint)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(friend.progress)}"><i style="width:${friend.progress}%"></i></div></div>`;
}
function renderBondCollection() {
  if (!store) return;
  const theme = store.theme || 'cyber';
  const preview = $('bondPreview').value || 'fresh';
  $('bondCollection').innerHTML = ['claude', 'codex'].map((s) => {
    const friend = bondView(s);
    return `<div class="bond-friend"><div class="bond-heading"><b>${SVC[s]} · ${esc(bondName(friend.unlocked))}</b><label><input type="checkbox" data-bond-active="${s}" ${svcOn(s) ? 'checked' : ''}> ${esc(t('bondActive'))}</label></div>
      ${bondStatus(s)}<div class="bond-designs">${Companions.stages.map((stage, rank) => {
        const locked = rank > friend.unlocked;
        const label = bondName(rank);
        return `<button type="button" class="bond-design ${rank === friend.selected ? 'selected' : ''}" data-bond-service="${s}" data-bond-rank="${rank}" ${locked ? 'disabled' : ''} aria-label="${esc(label + (locked ? ' · ' + t('bondLocked') : ''))}" aria-pressed="${rank === friend.selected}" title="${esc(locked ? t('bondUnlockAt', { n: fmtTokens(Math.ceil(stage.share * friend.goal)) }) : label)}"><span class="bond-preview">${drawCharacter(theme, s, preview, null, rank)}</span><span>${locked ? '🔒 ' : ''}${esc(label)}</span></button>`;
      }).join('')}</div><div class="bond-footer"><span title="${friend.tokens.toLocaleString(LANG)} / ${friend.goal.toLocaleString(LANG)}">${fmtTokens(friend.tokens)} / ${fmtTokens(friend.goal)} ${esc(t('bondPoints'))}</span><button type="button" class="chip" data-bond-service="${s}" data-bond-rank="auto" aria-pressed="${store.companions?.friends?.[Companions.key(theme, s)]?.selected == null}">${esc(t('bondAuto'))}</button></div>
      <label class="bond-target">${esc(t('bondTarget'))}<input type="number" min="1" max="10000" step="1" data-token-target="${s}" value="${friend.goal / 1000000}"> ${esc(t('bondMillion'))}</label>
      <p class="note">${esc(!svcOn(s) ? t('bondPaused') : tokenStatus?.[s]?.error ? t('bondReadError') : !tokenStatus?.[s]?.available ? t('bondNeedsData') : friend.next ? t('bondNext', { stage: bondName(friend.unlocked + 1), n: fmtTokens(Math.max(0, friend.next.tokens - friend.tokens)) }) : t('bondComplete'))}</p></div>`;
  }).join('');
}

// ---------- 표시 기준: 남은 한도(기본) 또는 사용량 ----------
const useRemain = () => store.basis !== 'used';
const useResetClock = () => store.timeBasis !== 'remaining';
function resetDisplay(ts, { date = false, expired = '–' } = {}) {
  if (!ts) return '–';
  if (ts <= Date.now()) return expired;
  return useResetClock() ? (date ? fmtClock(ts) : fmtClockTime(ts)) : fmtShort(ts - Date.now());
}
// 초소형은 날짜만, 캐릭터·전체는 시간 표시 설정에 맞춰 주간 리셋을 자세히 보여준다.
function fmtWeeklyDuration(ms) {
  // 아직 리셋 전이면 0분으로 보이지 않도록 분 단위로 올림한다.
  const minutes = Math.max(1, Math.ceil(ms / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = String(Math.floor((minutes % 1440) / 60)).padStart(2, '0');
  const mins = String(minutes % 60).padStart(2, '0');
  const time = t('hm', { h: hours, m: mins });
  return days > 0 ? `${t('dayS', { d: days })} ${time}` : time;
}
function weeklyResetDisplay(ts, { compact = false } = {}) {
  if (!Number.isFinite(ts) || ts <= 0) return '–';
  const left = ts - Date.now();
  if (left <= 0) return t('resetDone');
  if (compact) return left < 60000 ? t('min', { n: 1 }) : t('dayS', { d: Math.ceil(left / 86400000) });
  const duration = fmtWeeklyDuration(left);
  if (!useResetClock()) return t('weeklyLeft', { duration });
  const days = left >= 86400000 ? t('dayS', { d: Math.ceil(left / 86400000) }) : duration;
  return t('weeklyClock', { days, time: fmtClockTime(ts) });
}
const expiredW = (w) => w && w.resetsAt && w.resetsAt < Date.now();
const remainOf = (w) => (w ? (expiredW(w) ? 100 : 100 - clampPct(w)) : null);
const shown = (w) => (w ? (useRemain() ? remainOf(w) : expiredW(w) ? 0 : clampPct(w)) : null);
// 위험할수록 빨강: 남은 한도 기준이면 적을수록, 사용량 기준이면 많을수록
const dangerColor = (v) => {
  const used = useRemain() ? 100 - v : v;
  return used >= 85 ? 'var(--bad)' : used >= 70 ? 'var(--warn)' : null;
};

// ---------- 전체 모드: TokenBattery 카드 ----------
const SRC_KEY = { oauth: 'src_oauth', web: 'src_web', manual: 'src_manual', 'codex-log': 'src_codex' };
const BADGE = { fresh: ['✓', 'good'], ok: ['✓', 'good'], tired: ['!', 'warn'], dizzy: ['!', 'bad'], sleep: ['z', 'bad'], none: ['?', 'none'] };
function ringSVG(v, color) {
  const r = 34, C = 2 * Math.PI * r;
  const val = v ?? 0;
  return `<svg viewBox="0 0 80 80" class="bigring">
    <circle class="ticks" cx="40" cy="40" r="39" fill="none" stroke="var(--muted)" stroke-width="2" stroke-dasharray="1.4 4.7" opacity=".5"/>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="var(--track)" style="stroke-width:calc(var(--ring-w) * 1.3px)"/>
    <circle cx="40" cy="40" r="${r}" fill="none" stroke="${color}" stroke-linecap="round" style="stroke-width:calc(var(--ring-w) * 1.3px);filter:drop-shadow(0 0 4px ${color})"
      stroke-dasharray="${(C * val) / 100} ${C}" transform="rotate(-90 40 40)"/>
  </svg>`;
}
function segsHTML(v, color) {
  let h = '';
  for (let i = 0; i < 5; i++) {
    const f = Math.max(0, Math.min(1, ((v ?? 0) - i * 20) / 20));
    h += `<i><b style="width:${f * 100}%;background:${color}"></b></i>`;
  }
  return h;
}
function crewCard(s) {
  const theme = store.theme || 'cyber';
  const worlds = CHAR_WORLD[theme] || CHAR_WORLD.cyber;
  const world = worlds[LANG] || worlds.ko;
  const d = svcData(s);
  const st = charState(d);
  const bubble = { fresh: t('b_fresh'), ok: t('b_ok'), tired: t('b_tired'), dizzy: t('b_dizzy'), sleep: t('b_sleep'), none: t('b_none') }[st];
  const v5 = d ? shown(d.fiveHour) : null;
  const vw = d ? shown(d.weekly) : null;
  const accent = `var(--${s})`;
  const c5 = (v5 != null && dangerColor(v5)) || accent;
  const cw = (vw != null && dangerColor(vw)) || accent;
  const reset5 = d && d.fiveHour ? resetDisplay(d.fiveHour.resetsAt) : '–';
  const resetWeek = d && d.weekly ? weeklyResetDisplay(d.weekly.resetsAt) : '–';
  const [bIcon, bCls] = BADGE[st];
  const friend = bondView(s);
  return `
    <div class="crewcard ${s} st-${st}" ${!d && s === 'claude' ? 'data-act="login"' : ''}>
      <div class="portrait">
        <span class="speech">${bubble}</span>
        ${drawHeroSprite(theme, s, st, friend.selected)}
        <div class="avatar">${drawCharacter(theme, s, st, cssVar('--' + s) || '#888', friend.selected)}</div>
        <span class="stbadge ${bCls}">${bIcon}</span>
      </div>
      <div class="cname"><b>${SVC[s]}</b><small>${world[s === 'claude' ? 3 : 4]}</small></div>
      ${bondStatus(s)}
      <div class="cstats">
        <div class="ringwrap">${ringSVG(v5, c5)}<div class="rval"><b style="${v5 != null && dangerColor(v5) ? `color:${dangerColor(v5)}` : ''}">${v5 ?? '–'}<small>%</small></b></div></div>
        <div class="cside">
          <span class="clbl">${useRemain() ? t('remainLbl') : t('usedLbl')}<em> · ${t('h5s')}</em></span>
          <span class="pill">${useResetClock() ? t('resetAt') : t('resetIn')} <b>${reset5}</b></span>
        </div>
      </div>
      <div class="segs" title="${esc(t('wk'))} ${vw ?? '–'}%"><span>${t('weekShort')}</span><div class="segbar">${segsHTML(vw, cw)}</div><b>${vw ?? '–'}%</b></div>
      <div class="weekly-reset" title="${esc(d?.weekly?.resetsAt ? fmtClock(d.weekly.resetsAt) : '')}">↻ ${t('weekShort')} ${resetWeek}</div>
    </div>`;
}
function renderThemePreview() {
  if (!store) return;
  const theme = store.theme || 'cyber';
  $('themePreview').innerHTML = ['claude', 'codex'].map((service) => {
    const friend = bondView(service);
    const state = charState(svcData(service));
    const label = `${SVC[service]} · ${bondName(friend.selected)}`;
    return `<figure class="theme-preview-card ${service}"><div class="theme-preview-art" role="img" aria-label="${esc(label)}">${drawHeroSprite(theme, service, state, friend.selected)}</div><figcaption><b>${SVC[service]}</b><span>${esc(bondName(friend.selected))}</span></figcaption></figure>`;
  }).join('');
}
function renderUsage() {
  if (!store) return;
  renderThemePreview();
  if (!usage) return;
  const cards = ['claude', 'codex'].filter(svcOn).map(crewCard);
  $('crew').innerHTML = cards.length ? cards.join('') : `<div class="mneed">${t('turnOn')}</div>`;
  $('crew').classList.toggle('single', cards.length === 1);
  const claude = usage.claude;
  $('claudeNote').innerHTML = !svcOn('claude') ? '' : claude && claude.ok ? (claude.manual ? t('manualNote') : '') : t('needClaude');
  const codex = usage.codex;
  $('codexNote').textContent = !svcOn('codex') ? ''
    : codex?.ok ? (codex.loggedIn ? t('codexLoginSeen') : '')
      : codex?.code === 'codex-read-error' ? t('codexReadError')
      : codex?.loggedIn ? t('codexUsagePending') : t('codexLoginMissing');

  // 오늘의 한마디: 가장 지친 캐릭터 기준
  const states = ['claude', 'codex'].filter(svcOn).map((x) => charState(svcData(x)));
  $('dayMsg').textContent = states.some((x) => x === 'dizzy' || x === 'sleep') ? t('day_rest') : states.includes('tired') ? t('day_pace') : t('day_good');

  // 다음 회복: 5시간 리셋 (주간은 작게)
  $('recover').innerHTML = ['claude', 'codex'].filter(svcOn).map((x) => {
    const d = svcData(x);
    const l5 = d && d.fiveHour ? resetDisplay(d.fiveHour.resetsAt) : '–';
    const lw = d && d.weekly ? weeklyResetDisplay(d.weekly.resetsAt) : '–';
    return `<span class="rc"><i class="rdot ${x}"></i><span>${SVC[x]}</span><b>${l5}</b><small title="${esc(d?.weekly?.resetsAt ? fmtClock(d.weekly.resetsAt) : '')}">${t('weekShort')} ${lw}</small></span>`;
  }).join('<span class="rsep"></span>');

  $('syncTime').textContent = new Date(usage.now || Date.now()).toLocaleTimeString(LANG, { hour: '2-digit', minute: '2-digit', hour12: false });
  $('syncTime').title = [claude && claude.ok ? `Claude: ${t(SRC_KEY[claude.source] || 'src_manual')} · ${fmtAgo(claude.updatedAt)}` : '',
    usage.codex && usage.codex.ok ? `Codex: ${t('src_codex')} · ${t('basis', { t: fmtAgo(usage.codex.updatedAt) })}` : ''].filter(Boolean).join('\n');
  renderCost();
  fit();
}

// ---------- 미니 모드: 퍼센트와 리셋 시간만 ----------
function miniCell(w, weekly = false) {
  if (!w) return '<b style="color:var(--muted)">–</b><em></em>';
  const v = shown(w);
  const reset = weekly ? weeklyResetDisplay(w.resetsAt, { compact: true }) : resetDisplay(w.resetsAt);
  return `<b style="color:${dangerColor(v) || 'var(--text)'}">${v}%</b><em>${reset === t('resetDone') ? '–' : reset}</em>`;
}
function renderMini() {
  if (!usage || !store) return;
  const rows = [];
  for (const s of ['claude', 'codex']) {
    if (!svcOn(s)) continue;
    const d = svcData(s);
      if (!d) {
      const codexState = usage.codex?.code === 'codex-read-error' ? t('codexReadErrorS')
        : usage.codex?.loggedIn ? t('codexUsagePendingS') : t('codexLoginMissingS');
      rows.push(`<span class="mdot ${s}"></span><span class="mneed" ${s === 'claude' ? 'data-act="expand-login"' : ''}>${s === 'claude' ? t('needShort') : codexState}</span>`);
      continue;
    }
    const tip = t('miniTip', {
      s: SVC[s],
      p5: d.fiveHour ? clampPct(d.fiveHour) : '–', r5: d.fiveHour ? resetDisplay(d.fiveHour.resetsAt, { date: true }) : '–',
      pw: d.weekly ? clampPct(d.weekly) : '–', rw: d.weekly ? weeklyResetDisplay(d.weekly.resetsAt) : '–',
    });
    rows.push(`<span class="mdot ${s}" title="${esc(tip)}"></span>${miniCell(d.fiveHour)}<i class="msep"></i>${miniCell(d.weekly, true)}`);
  }
  $('miniRows').innerHTML = rows.length ? rows.join('') : `<span class="mneed">${t('turnOn')}</span>`;
  fit();
}

// One compact row per enabled service; the main process anchors it to the taskbar.
function renderTaskbar() {
  if (!store) return;
  const rows = ['claude', 'codex'].filter(svcOn).map((s) => {
    const d = svcData(s);
    const v5 = shown(d?.fiveHour), vw = shown(d?.weekly);
    const hint = `${SVC[s]} · ${useRemain() ? t('remainLbl') : t('usedLbl')}\n${t('h5')}: ${v5 ?? '–'}% · ${d?.fiveHour ? resetDisplay(d.fiveHour.resetsAt, { date: true }) : '–'}\n${t('wk')}: ${vw ?? '–'}% · ${d?.weekly ? weeklyResetDisplay(d.weekly.resetsAt) : '–'}`;
    return `<div class="taskbar-row" title="${esc(hint)}"><span class="taskbar-service ${s}"><i></i>${SVC[s]}</span><b style="color:${v5 != null && dangerColor(v5) || 'inherit'}">${v5 ?? '–'}%</b><span class="taskbar-week">${esc(t('weekShort'))} <b style="color:${vw != null && dangerColor(vw) || 'inherit'}">${vw ?? '–'}%</b></span></div>`;
  });
  $('taskbarRows').innerHTML = rows.join('') || `<div class="taskbar-empty">${esc(t('turnOn'))}</div>`;
  fit();
}

// ---------- 캐릭터 모드 ----------
const cssVar = (name) => getComputedStyle(document.body).getPropertyValue(name).trim();
function renderChar() {
  if (!usage || !store) return;
  const theme = store.theme || 'cyber';
  const worlds = CHAR_WORLD[theme] || CHAR_WORLD.cyber;
  const world = worlds[LANG] || worlds.ko;
  const html = [];
  for (const s of ['claude', 'codex']) {
    if (!svcOn(s)) continue;
    const d = svcData(s);
    const st = charState(d);
    const bubble = { fresh: t('b_fresh'), ok: t('b_ok'), tired: t('b_tired'), dizzy: t('b_dizzy'), sleep: t('b_sleep'), none: t('b_none') }[st];
    const rem = (w) => (w ? (w.resetsAt && w.resetsAt < Date.now() ? 100 : 100 - clampPct(w)) : null);
    const r5 = d ? rem(d.fiveHour) : null, rw = d ? rem(d.weekly) : null;
    const meter = (label, r, cls) => `<div class="meter ${cls}"><span>${label}</span><div class="mbar"><i style="width:${r ?? 0}%;background:${r != null && r <= 15 ? 'var(--bad)' : `var(--${s})`}"></i></div><b>${r == null ? '–' : r + '%'}</b></div>`;
    const reset = d && d.fiveHour && d.fiveHour.resetsAt && d.fiveHour.resetsAt > Date.now()
      ? `↻ ${useResetClock() ? t('resetAt') : world[2]} ${resetDisplay(d.fiveHour.resetsAt)}` : '';
    const wReset = d && d.weekly && d.weekly.resetsAt
      ? `${t('weekShort')} ↻ ${weeklyResetDisplay(d.weekly.resetsAt)}`
      : `${t('weekShort')} ↻ –`;
    html.push(`
      <div class="actor st-${st}" ${!d && s === 'claude' ? 'data-act="expand-login"' : ''}>
        <div class="bubble">${bubble}</div>
        <div class="avatar" style="color:var(--${s})">${drawCharacter(theme, s, st, cssVar('--' + s) || '#888', bondView(s).selected)}</div>
        <div class="aname"><b style="color:var(--${s})">${world[s === 'claude' ? 3 : 4]}</b> <small>${SVC[s]}</small></div>
        ${bondStatus(s)}
        ${meter(world[0], r5, 'h5')}
        ${meter(world[1], rw, 'wk')}
        <div class="areset">${reset}</div>
        <div class="areset wkreset" title="${esc(d?.weekly?.resetsAt ? fmtClock(d.weekly.resetsAt) : '')}">${wReset}</div>
      </div>`);
  }
  $('scene').innerHTML = html.length ? html.join('') : `<div class="mneed">${t('turnOn')}</div>`;
  fit();
}
// ---------- 사용량 알림 (70/85/95%) ----------
function checkAlerts() {
  if (!store || store.alertsOn === false || !usage) return;
  const levels = (store.alertLevels || [70, 85, 95]).slice().sort((a, b) => a - b);
  const fired = { ...(store.alertFired || {}) };
  let changed = false;
  for (const s of ['claude', 'codex']) {
    const d = svcOn(s) && svcData(s);
    if (!d) continue;
    for (const [key, label] of [['fiveHour', t('h5')], ['weekly', t('wk')]]) {
      const w = d[key];
      if (!w || !w.resetsAt || w.resetsAt < Date.now()) continue;
      const p = clampPct(w);
      const win = Math.round(w.resetsAt / 600000); // 리셋 시각을 10분 단위로 묶어 같은 기간을 식별
      const crossed = levels.filter((l) => p >= l && !fired[`${s}:${key}:${win}:${l}`]);
      if (!crossed.length) continue;
      const top = crossed[crossed.length - 1];
      for (const l of crossed) fired[`${s}:${key}:${win}:${l}`] = w.resetsAt;
      changed = true;
      W.notify(t('n_title', { s: SVC[s], w: label, p: top }), t('n_body', { t: fmtDur(w.resetsAt - Date.now()) }));
    }
  }
  // 지난 기간 기록 정리
  for (const [k, until] of Object.entries(fired)) if (until < Date.now()) { delete fired[k]; changed = true; }
  if (changed) { store.alertFired = fired; W.setStore({ alertFired: fired }); }
}

// ---------- 주간 사용률 기록 (비용 분석용) ----------
function recordHistory() {
  const hist = { claude: {}, codex: {}, ...(store.history || {}) };
  let changed = false;
  for (const s of ['claude', 'codex']) {
    const w = svcData(s) && svcData(s).weekly;
    if (!w || !w.resetsAt || w.resetsAt < Date.now()) continue;
    const key = String(Math.round(w.resetsAt / 3600000)); // 주간 기간을 리셋 시각(시간 단위)으로 구분
    const p = clampPct(w);
    if ((hist[s][key] ?? -1) < p) { hist[s] = { ...hist[s], [key]: p }; changed = true; }
    const keys = Object.keys(hist[s]).sort((a, b) => a - b);
    while (keys.length > 10) { delete hist[s][keys.shift()]; changed = true; }
  }
  if (changed) { store.history = hist; W.setStore({ history: hist }); }
}

// ---------- 비용 분석 ----------
const SUB_MATCH = { claude: /claude|anthropic/i, codex: /chatgpt|codex|openai|gpt/i };
const money = (v, cur) => (cur === 'KRW' ? `₩${Math.round(v).toLocaleString('ko-KR')}` : `$${(Math.round(v * 100) / 100).toLocaleString('en-US')}`);
function renderCost() {
  const on = store && store.costOn !== false;
  $('costFold').classList.toggle('hidden', !on);
  if (!on || !usage || !store) return;
  const subs = store.subscriptions || [];
  const rows = [];
  const used = new Set();
  let summary = '';
  for (const s of ['claude', 'codex']) {
    const sub = subs.find((x) => SUB_MATCH[s].test(x.name));
    if (!sub) continue;
    used.add(sub);
    const w = svcData(s) && svcData(s).weekly;
    let projected = null;
    if (w && w.resetsAt && w.resetsAt > Date.now()) {
      const elapsed = 1 - (w.resetsAt - Date.now()) / (10080 * 60000);
      projected = elapsed > 0.05 ? Math.min(100, Math.round(clampPct(w) / elapsed)) : clampPct(w);
    }
    const curKey = w && w.resetsAt ? String(Math.round(w.resetsAt / 3600000)) : null;
    const past = Object.entries((store.history || {})[s] || {}).filter(([k]) => k !== curKey).map(([, v]) => v);
    const basis = past.length ? past.reduce((a, b) => a + b, 0) / past.length : projected;
    const price = Number(sub.price) || 0;
    const valueUsed = basis != null ? (price * basis) / 100 : null;
    const per1 = basis ? (price * 12) / 52 / basis : null;
    let rec = '';
    if (basis != null) rec = basis < 30 ? t('rec_low') : basis >= 95 ? t('rec_high') : t('rec_ok');
    if (basis != null) summary += `${summary ? ' · ' : ''}${SVC[s]} ${Math.round(basis)}%`;
    rows.push(`
      <div class="cost">
        <div class="chead"><span class="svc ${s}">${SVC[s]}</span><span class="smeta">${esc(sub.plan)}</span><span class="cprice">${t('perMonth', { v: money(price, sub.currency) })}</span></div>
        <div class="cgrid">
          <span>${t('costThisWeek')}</span><b>${projected != null ? projected + '%' : '–'}</b>
          <span>${t('costAvg')}</span><b>${past.length ? Math.round(basis) + '%' : `<i>${t('costNoHist')}</i>`}</b>
          <span>${t('costValue')}</span><b>${valueUsed != null ? money(valueUsed, sub.currency) : '–'}</b>
          <span>${t('costIdle')}</span><b>${valueUsed != null ? money(price - valueUsed, sub.currency) : '–'}</b>
          <span>${t('costPer1')}</span><b>${per1 ? money(per1, sub.currency) : '–'}</b>
        </div>
        ${rec ? `<div class="crec">${rec}</div>` : ''}
      </div>`);
  }
  const others = subs.filter((x) => !used.has(x));
  if (others.length) {
    rows.push(`<div class="cost"><div class="chead"><span class="ptitle">${t('costOther')}</span></div>
      ${others.map((x) => `<div class="crow"><span>${esc(x.name)}</span><b>${t('perMonth', { v: money(Number(x.price) || 0, x.currency) })}</b></div>`).join('')}</div>`);
  }
  $('costBody').innerHTML = rows.length ? rows.join('') : `<div class="note">${t('costNoSub')}</div>`;
  $('costSummary').textContent = summary;
}

// ---------- 새로고침 ----------
async function refresh() {
  $('btnRefresh').disabled = true;
  document.querySelector('.titlebar .dot').classList.add('loading');
  try {
    usage = await W.getUsage();
    if (usage.companions) store.companions = usage.companions;
    if (usage.tokens) tokenStatus = usage.tokens;
    if (usage.unlocks?.length) {
      $('bondNotice').textContent = usage.unlocks.map((x) => t('bondEvolved', { service: SVC[x.service], stage: bondName(x.to) })).join(' · ');
      $('bondNotice').classList.remove('hidden');
    }
    renderUsage();
    renderMini();
    renderChar();
    renderTaskbar();
    if (!document.activeElement?.matches('[data-token-target]')) renderBondCollection();
    checkAlerts();
    recordHistory();
  } finally {
    $('btnRefresh').disabled = false;
    document.querySelector('.titlebar .dot').classList.remove('loading');
  }
}

// ---------- Claude 직접 입력 ----------
const toLocalInput = (ts) => {
  if (!ts) return '';
  const d = new Date(ts);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
function toggleManual(show) {
  const f = $('manualForm');
  const on = show ?? f.classList.contains('hidden');
  f.classList.toggle('hidden', !on);
  if (on) {
    const m = store.claudeManual || {};
    const c = svcData('claude');
    $('m5').value = m.fiveHour ?? (c?.fiveHour?.percent ?? '');
    $('mw').value = m.weekly ?? (c?.weekly?.percent ?? '');
    $('m5r').value = m.fiveHourResetsAt ? toLocalInput(Date.parse(m.fiveHourResetsAt)) : toLocalInput(c?.fiveHour?.resetsAt);
    $('mwr').value = m.weeklyResetsAt ? toLocalInput(Date.parse(m.weeklyResetsAt)) : toLocalInput(c?.weekly?.resetsAt);
  }
  fit();
}
$('manualForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  store = await W.setStore({
    claudeManual: {
      fiveHour: Number($('m5').value) || 0,
      fiveHourResetsAt: iso($('m5r').value),
      weekly: Number($('mw').value) || 0,
      weeklyResetsAt: iso($('mwr').value),
      savedAt: Date.now(),
    },
  });
  toggleManual(false);
  refresh();
});
$('btnOpenClaudeUsage').onclick = () => W.openUrl('https://claude.ai/settings/usage');

// ---------- 구독 ----------
function nextBilling(day) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const make = (y, m) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
  let d = make(today.getFullYear(), today.getMonth());
  if (d < today) d = make(today.getFullYear(), today.getMonth() + 1);
  return { date: d, days: Math.round((d - today) / 86400000) };
}
const AI_SERVICES = [
  'Claude', 'ChatGPT', 'Gemini', 'Perplexity', 'Cursor', 'GitHub Copilot', 'Grok', 'Midjourney',
  'Suno', 'Genspark', 'Gamma', 'Notion AI', 'Windsurf', 'Lovable', 'v0', 'Replit', 'ElevenLabs', 'Runway', '뤼튼',
];
$('aiServices').innerHTML = AI_SERVICES.map((s) => `<option value="${s}">`).join('');

function renderSubs() {
  const subs = [...(store.subscriptions || [])]
    .map((s) => ({ ...s, nb: nextBilling(Number(s.day) || 1) }))
    .sort((a, b) => a.nb.days - b.nb.days);
  $('subsList').innerHTML = subs.length
    ? subs.map((s) => {
      const dd = s.nb.days === 0 ? t('today') : `D-${s.nb.days}`;
      const cls = s.nb.days <= 2 ? 'soon' : s.nb.days <= 7 ? 'near' : '';
      const d = s.nb.date;
      return `<li class="sub">
        <span class="dday ${cls}">${dd}</span>
        <div><div class="sname">${esc(s.name)} <span class="smeta">${esc(s.plan)}</span></div>
        <div class="smeta">${t('monthly', { d: Number(s.day) })} · ${t('next', { md: `${d.getMonth() + 1}/${d.getDate()}` })}${s.memo ? ' · ' + esc(s.memo) : ''}</div></div>
        <span class="sprice">${money(s.price || 0, s.currency)}</span>
      </li>`;
    }).join('')
    : `<li class="smeta">${t('noSubs')}</li>`;
  const totals = {};
  for (const s of subs) totals[s.currency] = (totals[s.currency] || 0) + (Number(s.price) || 0);
  $('subsTotal').textContent = Object.entries(totals).map(([c, v]) => t('perMonth', { v: money(v, c) })).join(' + ');
  const nxt = subs[0];
  $('subsSub').textContent = nxt ? `${t('subsNext', { s: nxt.name, d: nxt.nb.days === 0 ? t('today') : 'D-' + nxt.nb.days })} · ${$('subsTotal').textContent}` : t('subsSub');
  const editing = !$('subsEditor').classList.contains('hidden');
  $('subsList').classList.toggle('hidden', editing);
  $('subsActions').classList.toggle('hidden', editing);
  renderCost();
  fit();
}

let draft = [];
function renderEditor() {
  $('subsEditList').innerHTML = draft.map((s, i) => `
    <div class="sedit" data-i="${i}">
      <div class="full"><input data-k="name" list="aiServices" value="${esc(s.name)}" placeholder="${esc(t('ph_name'))}"><button class="chip ghost del" data-del="${i}" title="${esc(t('del'))}">🗑</button></div>
      <input data-k="plan" value="${esc(s.plan)}" placeholder="${esc(t('ph_plan'))}">
      <label>${t('dayOf')} <input data-k="day" type="number" min="1" max="31" value="${esc(s.day)}"> ${t('dayUnit')}</label>
      <input data-k="price" type="number" min="0" step="0.01" value="${esc(s.price)}" placeholder="${esc(t('ph_price'))}">
      <select data-k="currency"><option ${s.currency === 'USD' ? 'selected' : ''}>USD</option><option ${s.currency === 'KRW' ? 'selected' : ''}>KRW</option></select>
      <div class="full"><input data-k="memo" value="${esc(s.memo)}" placeholder="${esc(t('ph_memo'))}"></div>
    </div>`).join('');
  fit();
}
$('subsEditList').addEventListener('input', (e) => {
  const box = e.target.closest('.sedit');
  if (!box || !e.target.dataset.k) return;
  draft[Number(box.dataset.i)][e.target.dataset.k] = e.target.value;
});
$('subsEditList').addEventListener('click', (e) => {
  const i = e.target.dataset.del;
  if (i === undefined) return;
  draft.splice(Number(i), 1);
  renderEditor();
});
$('btnEditSubs').onclick = () => {
  draft = (store.subscriptions || []).map((s) => ({ ...s }));
  $('subsEditor').classList.remove('hidden');
  $('subsList').classList.add('hidden');
  $('subsActions').classList.add('hidden');
  renderEditor();
};
$('btnAddSub').onclick = () => {
  draft.push({ id: 's' + Date.now(), name: '', plan: '', price: 0, currency: 'KRW', day: new Date().getDate(), memo: '' });
  renderEditor();
};
$('btnSaveSubs').onclick = async () => {
  const cleaned = draft
    .filter((s) => s.name.trim())
    .map((s) => ({ ...s, day: Math.min(31, Math.max(1, Number(s.day) || 1)), price: Number(s.price) || 0 }));
  store = await W.setStore({ subscriptions: cleaned });
  $('subsEditor').classList.add('hidden');
  renderSubs();
};

// ---------- BGM ----------
const MOOD_QUERIES = [
  ['lofi', 'lofi hip hop coding music no ads'],
  ['deep', 'deep focus ambient music for programming no ads'],
  ['jazz', 'jazz cafe music for work no ads'],
  ['piano', 'calm piano music for studying no ads'],
  ['night', 'late night coding music chill no ads'],
  ['synth', 'synthwave retrowave coding music no ads'],
  ['hacker', 'dark techno programming music no ads'],
  ['upbeat', 'upbeat electronic music for coding energy no ads'],
  ['game', 'relaxing video game music for studying no ads'],
  ['ghibli', 'ghibli relaxing piano music no ads'],
  ['classical', 'classical music for concentration no ads'],
  ['kcafe', '광고없는 카페 노동요 플레이리스트'],
  ['rain', 'rain lofi music for coding no ads'],
  ['noise', 'brown noise for focus no ads 10 hours'],
];
// sp=EgIYAg%3D%3D : 20분 이상 영상만 (중간광고 적은 긴 믹스 위주)
const ytUrl = (q) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIYAg%253D%253D`;
$('bgmMood').onchange = () => W.setStore({ bgmLast: $('bgmMood').value });
$('btnBgm').onclick = () => {
  const m = MOOD_QUERIES.find((x) => x[0] === $('bgmMood').value) || MOOD_QUERIES[0];
  W.openUrl(ytUrl(m[1]));
};
const customSearch = () => {
  const q = $('bgmCustom').value.trim();
  if (q) W.openUrl(ytUrl(`${q} no ads`));
};
$('btnBgmCustom').onclick = customSearch;
$('btnMusic').onclick = () => $('btnBgm').click();
$('btnBgmSearch').onclick = () => { $('bgmSearchRow').classList.toggle('hidden'); fit(); };
$('wave').innerHTML = Array.from({ length: 18 }, (_, i) => `<i style="animation-delay:${(i * 0.13) % 1.1}s;height:${30 + ((i * 37) % 60)}%"></i>`).join('');
$('btnNewTask').onclick = (e) => { e.stopPropagation(); $('ctaMenu').classList.toggle('hidden'); };
$('ctaMenu').onclick = (e) => {
  const url = e.target.dataset && e.target.dataset.open;
  if (url) W.openUrl(url);
  $('ctaMenu').classList.add('hidden');
};
document.addEventListener('click', (e) => { if (!e.target.closest('#ctaMenu, #btnNewTask')) $('ctaMenu').classList.add('hidden'); });
$('bgmCustom').addEventListener('keydown', (e) => { if (e.key === 'Enter') customSearch(); });

// ---------- 테마 ----------
const THEMES = [
  { id: 'cyber', logo: '◆', sub: 'ONLINE', foot: 'BETTER IDEAS. TOGETHER. //_' },
  { id: 'engine', logo: '✈', sub: 'GOOD IDEAS · FURTHER TOGETHER', foot: '// BUILD WITH AI //' },
  { id: 'mascot', logo: '🐾', sub: '', foot: 'A QUIETER MIND, A BRIGHTER YOU' },
  { id: 'arcade', logo: '🪐', sub: 'YOUR AI SIDEKICKS', foot: 'SMALL PROMPTS · BIGGER TOMORROW' },
  { id: 'glass', logo: '●', sub: '', foot: 'CLEAR TO CREATE —' },
  { id: 'crt', logo: '■', sub: '', foot: '> READY FOR THE NEXT IDEA_' },
  { id: 'industrial', logo: '⚙', sub: 'WORK SMARTER TOGETHER', foot: 'SMALL STEPS · BIG PROGRESS' },
  { id: 'garden', logo: '🌱', sub: '', foot: 'A kinder internet grows brighter people.' },
  { id: 'anime', logo: '✦', sub: 'GOOD TOOLS · BRIGHTER TOMORROW', foot: '✦ MORE IDEAS · A BRIGHTER TOMORROW ✦' },
  { id: 'editorial', logo: '●', sub: '', foot: 'FOCUS CREATES A KINDER TOMORROW.' },
];
function applyTheme(id) {
  const th = THEMES.find((x) => x.id === id) || THEMES[0];
  for (const x of THEMES) document.body.classList.toggle('theme-' + x.id, x.id === th.id);
  $('themeSel').value = th.id;
  $('themeLogo').textContent = th.logo;
  $('themeSub').textContent = th.sub;
  $('themeFoot').textContent = th.foot;
  if (store) { store.theme = th.id; renderChar(); renderUsage(); renderBondCollection(); }
  fit();
}
$('themeSel').onchange = async () => {
  store = await W.setStore({ theme: $('themeSel').value });
  $('bondNotice').classList.add('hidden');
  applyTheme(store.theme);
};

// ---------- 언어 ----------
function fillSelect(el, items, value) {
  el.innerHTML = items.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join('');
  if (value != null) el.value = value;
}
function setNotifyMessage(message, ok = true) {
  $('notifyResult').textContent = message || '';
  $('notifyResult').classList.toggle('bad', !ok);
}
async function refreshNotificationSettings() {
  try {
    const state = await W.notificationState();
    const prefs = state.preferences || {};
    $('notifyEnabled').checked = prefs.enabled === true;
    $('notifyProvider').value = prefs.provider || 'telegram';
    $('notifyMinMinutes').value = prefs.minDurationMinutes || 10;
    $('notifySkipForeground').checked = prefs.suppressWhenForeground !== false;
    $('telegramPane').classList.toggle('hidden', $('notifyProvider').value !== 'telegram');
    $('kakaoPane').classList.toggle('hidden', $('notifyProvider').value !== 'kakao');
    $('kakaoRedirectUri').textContent = state.kakaoRedirectUri || '';
    $('notifyHelpRedirectUri').textContent = state.kakaoRedirectUri || '';
    const providerReady = $('notifyProvider').value === 'kakao'
      ? state.kakaoConnected
      : state.telegramConfigured && state.telegramChatConfigured;
    $('notifyConnectionState').textContent = providerReady ? t('notifyStateReady')
      : $('notifyProvider').value === 'kakao' ? t('notifyStateNeedKakao') : t('notifyStateNeedTelegram');
    const hooks = state.hooks || {};
    $('notifyHooksState').textContent = t('notifyHooksReady', {
      claude: hooks.claude ? '✓' : '—', codex: hooks.codex ? '✓' : '—',
    });
    const missingHooks = [!hooks.claude && 'Claude Code', !hooks.codex && 'Codex'].filter(Boolean);
    $('notifyHookSetupStatus').textContent = missingHooks.length
      ? t('notifyHooksMissing', { services: missingHooks.join(', ') })
      : prefs.enabled ? t('notifyHooksReadyNote') : '';
    $('notifyHookSetupStatus').classList.toggle('warn', missingHooks.length > 0);
    if (state.lastResult?.message) setNotifyMessage(state.lastResult.message, state.lastResult.ok);
  } catch (error) {
    setNotifyMessage(error.message, false);
  }
}
async function saveNotifyPreferences() {
  await W.setNotificationPreferences({
    enabled: $('notifyEnabled').checked,
    provider: $('notifyProvider').value,
    minDurationMinutes: Number($('notifyMinMinutes').value) || 10,
    suppressWhenForeground: $('notifySkipForeground').checked,
  });
  await refreshNotificationSettings();
}
async function notifyAction(button, action) {
  button.disabled = true;
  try {
    const result = await action();
    if (result?.message) setNotifyMessage(result.message, result.ok !== false);
    await refreshNotificationSettings();
    return result;
  } catch (error) {
    setNotifyMessage(error.message, false);
    return null;
  } finally {
    button.disabled = false;
  }
}
function renderNotifyGuide() {
  const guide = NOTIFY_GUIDE_STEPS[LANG] || NOTIFY_GUIDE_STEPS.ko;
  for (const [id, steps] of [
    ['notifyHelpTelegramSteps', guide.telegram],
    ['notifyHelpKakaoSteps', guide.kakao],
    ['notifyHelpAgentSteps', guide.agents],
  ]) {
    const list = $(id);
    list.replaceChildren(...steps.map((step) => {
      const item = document.createElement('li');
      item.textContent = step;
      return item;
    }));
  }
}
function applyLang(lang) {
  LANG = I18N[lang] ? lang : 'ko';
  document.documentElement.lang = LANG;
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria-label]')) el.setAttribute('aria-label', t(el.dataset.i18nAriaLabel));
  for (const el of document.querySelectorAll('[data-i18n-ph]')) el.placeholder = t(el.dataset.i18nPh);
  renderNotifyGuide();
  fillSelect($('langSel'), LANGS.map((l) => [l.id, l.name]), LANG);
  fillSelect($('bondPreview'), [['fresh', '100%'], ['ok', '60%'], ['tired', '20%'], ['dizzy', '5%'], ['sleep', '0%']], $('bondPreview').value || 'fresh');
  fillSelect($('themeSel'), THEMES.map((th, i) => [th.id, `${String(i + 1).padStart(2, '0')} ${THEME_NAMES[LANG][i]}`]), store.theme || 'cyber');
  fillSelect($('bgmMood'), MOOD_QUERIES.map(([id], i) => [id, MOOD_NAMES[LANG][i]]), store.bgmLast || 'lofi');
  W.setTrayLabels({ tip: t('tray_tip'), toggle: t('tray_toggle'), reset: t('tray_reset'), quit: t('tray_quit'), taskbar: t('taskbarMode'), mini: t('mini'), char: t('charMode'), full: t('expand'), update: t('updateCheck') });
  fillSelect($('modeSel'), [['taskbar', t('taskbarMode')], ['mini', t('mini')], ['char', t('charMode')], ['full', t('expand')]], store.mode || 'mini');
  renderSubs();
  renderUsage();
  renderMini();
  renderChar();
  renderBondCollection();
  renderTaskbar();
  window.renderUpdates?.();
  refreshNotificationSettings();
}
$('langSel').onchange = async () => { store = await W.setStore({ lang: $('langSel').value }); applyLang(store.lang); };

// ---------- 표시·기능 설정 ----------
function applyOptions() {
  $('showClaude').checked = svcOn('claude');
  $('showCodex').checked = svcOn('codex');
  $('optAlerts').checked = store.alertsOn !== false;
  $('optCost').checked = store.costOn !== false;
  $('basisRemain').checked = useRemain();
  $('basisUsed').checked = !useRemain();
  $('timeBasisClock').checked = useResetClock();
  $('timeBasisRemaining').checked = !useResetClock();
  $('alertLevelsRow').classList.toggle('hidden', store.alertsOn === false);
  const lv = store.alertLevels || [70, 85, 95];
  for (const c of document.querySelectorAll('.lvl')) c.checked = lv.includes(Number(c.value));
  renderUsage();
  renderMini();
  renderChar();
  renderTaskbar();
  renderBondCollection();
  fit();
}
const bindOpt = (id, key) => {
  $(id).onchange = async (e) => { store = await W.setStore({ [key]: e.target.checked }); applyOptions(); };
};
bindOpt('showClaude', 'showClaude');
bindOpt('showCodex', 'showCodex');
$('bondCollection').addEventListener('change', async (event) => {
  const targetService = event.target.dataset.tokenTarget;
  if (targetService) {
    const millions = Number(event.target.value);
    if (!event.target.checkValidity() || !Number.isInteger(millions)) { event.target.reportValidity(); return; }
    store.companions = await W.setTokenTarget({ service: targetService, tokens: millions * 1000000 });
    renderChar(); renderUsage(); renderBondCollection(); return;
  }
  const service = event.target.dataset.bondActive;
  if (!service) return;
  store = await W.setStore({ [service === 'claude' ? 'showClaude' : 'showCodex']: event.target.checked });
  applyOptions();
});
$('bondPreview').onchange = renderBondCollection;
W.onCompanions((state) => {
  if (!store) return;
  store.companions = state.companions;
  tokenStatus = state.tokens;
  if (state.unlocks?.length) {
    $('bondNotice').textContent = state.unlocks.map((x) => t('bondEvolved', { service: SVC[x.service], stage: bondName(x.to) })).join(' · ');
    $('bondNotice').classList.remove('hidden');
  }
  renderUsage(); renderChar();
  if (!$('settings').classList.contains('hidden') && !document.activeElement?.dataset.tokenTarget) renderBondCollection();
});
$('bondCollection').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-bond-rank]');
  if (!button) return;
  const theme = store.theme || 'cyber';
  button.disabled = true;
  try {
    store.companions = await W.selectCompanion({ theme, service: button.dataset.bondService, selected: button.dataset.bondRank === 'auto' ? null : Number(button.dataset.bondRank) });
    renderChar(); renderUsage();
  } finally { renderBondCollection(); fit(); }
});
bindOpt('optAlerts', 'alertsOn');
bindOpt('optCost', 'costOn');
for (const r of document.querySelectorAll('input[name=basis]')) {
  r.onchange = async () => { store = await W.setStore({ basis: r.value }); applyOptions(); };
}
for (const r of document.querySelectorAll('input[name=timeBasis]')) {
  r.onchange = async () => { store = await W.setStore({ timeBasis: r.value }); applyOptions(); };
}
for (const c of document.querySelectorAll('.lvl')) {
  c.onchange = async () => {
    const levels = [...document.querySelectorAll('.lvl')].filter((x) => x.checked).map((x) => Number(x.value));
    store = await W.setStore({ alertLevels: levels });
  };
}

// ---------- 창/모드 (taskbar · mini · char · full) ----------
let mode = 'mini';
const CARD = { taskbar: 'taskbarCard', mini: 'miniCard', char: 'charCard', full: 'card' };
let fitAnchor = 'right';
let fitRequest = 0;
function fit() {
  const request = ++fitRequest;
  requestAnimationFrame(() => {
    if ($('hotkeySetupDialog').open) {
      W.fitSize(392, Math.max(340, $('hotkeySetupDialog').scrollHeight + 44), fitAnchor).catch(() => {});
      return;
    }
    const el = $(CARD[mode]);
    const width = mode === 'full' ? 392 : el.offsetWidth + (mode === 'taskbar' ? 0 : 8);
    const height = el.offsetHeight + (mode === 'taskbar' ? 0 : mode === 'full' ? 14 : 8);
    W.fitSize(width, height, fitAnchor).then(async (bounds) => {
      if (request !== fitRequest) return;
      if ($('hotkeySetupDialog').open) { fit(); return; }
      if (mode === 'full' && bounds?.maxFullCardHeight) {
        const maxHeight = `${bounds.maxFullCardHeight}px`;
        if (el.style.maxHeight !== maxHeight) {
          el.style.maxHeight = maxHeight;
          await new Promise((resolve) => requestAnimationFrame(resolve));
        }
      } else if (mode !== 'full') {
        $('card').style.maxHeight = '';
      }
      if (request !== fitRequest) return;
      if (mode !== 'taskbar') W.fitSize(width, el.offsetHeight + (mode === 'full' ? 14 : 8), fitAnchor);
    }).catch(() => {});
  });
}

// ---------- 크기 조절: 왼쪽/오른쪽 아래 손잡이를 끌면 위젯 전체 배율이 바뀐다 ----------
const SCALE_MIN = 0.6, SCALE_MAX = 2.5;
const modeScale = () => mode === 'taskbar' ? 1 : Math.min(SCALE_MAX, Math.max(SCALE_MIN, (store.scale || {})[mode] || 1));
function applyScale() { W.setZoom(modeScale()); fit(); }
for (const g of document.querySelectorAll('.grip')) {
  g.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    // 손잡이를 빠르게 두 번 누르면 원래 크기(100%)로
    const now = Date.now();
    if (now - (g._lastUp || 0) < 450) {
      g._lastUp = 0;
      store.scale = { ...(store.scale || {}), [mode]: 1 };
      W.setStore({ scale: store.scale });
      return applyScale();
    }
    g.setPointerCapture(e.pointerId);
    const side = g.dataset.grip;
    const card = $(CARD[mode]);
    const start = { x: e.screenX, y: e.screenY, s: modeScale(), w: card.offsetWidth * modeScale(), h: card.offsetHeight * modeScale() };
    fitAnchor = side === 'right' ? 'left' : 'right'; // 끄는 반대쪽 모서리를 고정
    document.body.classList.add('resizing');
    let raf = 0;
    const move = (ev) => {
      const dx = (side === 'right' ? 1 : -1) * (ev.screenX - start.x);
      const dy = ev.screenY - start.y;
      const f = Math.abs(dx / start.w) > Math.abs(dy / start.h) ? dx / start.w : dy / start.h;
      const s = Math.round(Math.min(SCALE_MAX, Math.max(SCALE_MIN, start.s * (1 + f))) * 100) / 100;
      store.scale = { ...(store.scale || {}), [mode]: s };
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(applyScale);
    };
    const up = () => {
      g._lastUp = Date.now();
      g.removeEventListener('pointermove', move);
      g.removeEventListener('pointerup', up);
      g.removeEventListener('pointercancel', up);
      document.body.classList.remove('resizing');
      fitAnchor = 'right';
      W.setStore({ scale: store.scale });
    };
    g.addEventListener('pointermove', move);
    g.addEventListener('pointerup', up);
    g.addEventListener('pointercancel', up);
  });
}

// 마우스가 가까이 오면 버튼·손잡이 표시
W.onNear((v) => document.body.classList.toggle('near', v));
document.fonts.ready.then(() => fit());
document.fonts.addEventListener('loadingdone', () => fit());
function setMode(m) {
  mode = ['taskbar', 'mini', 'char', 'full'].includes(m) ? m : 'mini';
  for (const x of ['taskbar', 'mini', 'char', 'full']) document.body.classList.toggle('mode-' + x, x === mode);
  const patch = { mode };
  if (mode !== 'full') patch.compactMode = mode;
  store = { ...store, ...patch };
  W.setStore(patch);
  $('modeSel').value = mode;
  if (mode === 'taskbar') renderTaskbar();
  if (mode === 'char') renderChar();
  applyScale();
}
const compactMode = () => ['taskbar', 'char'].includes(store.compactMode) ? store.compactMode : 'mini';
$('modeSel').onchange = () => setMode($('modeSel').value);
W.onMode(setMode);
$('taskbarCard').addEventListener('dblclick', () => setMode('full'));
$('taskbarCard').addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setMode('full'); } });
async function openSettings() {
  setMode('full');
  $('settings').classList.remove('hidden');
  $('autostart').checked = await W.autostart();
  renderHotkeys();
  refreshNotificationSettings();
  window.renderUpdates?.();
  fit();
}
document.addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]');
  if (!go) return;
  const g = go.dataset.go;
  if (g === 'settings') openSettings();
  else if (g === 'hide') W.hide();
  else setMode(g);
});
$('miniCard').addEventListener('dblclick', () => setMode('full'));
$('charCard').addEventListener('dblclick', () => setMode('full'));
$('btnRefresh').onclick = refresh;
$('btnSettings').onclick = async () => {
  if ($('settings').classList.contains('hidden')) return openSettings();
  $('settings').classList.add('hidden');
  window.renderUpdates?.();
  fit();
};
for (const d of document.querySelectorAll('details.fold')) d.addEventListener('toggle', fit);

// ---------- 단축키 (기본 F7 보이기/숨기기, F8 모드 전환) ----------
let hkStatus = {};
const DEFAULT_HK = Hotkeys.defaults;
let cancelHotkeyCapture = null;
let hotkeySetupMode = null;
let tutorialStep = 0;
function renderHotkeys() {
  const hk = { ...DEFAULT_HK, ...(store.hotkeys || {}) };
  for (const b of document.querySelectorAll('.hk')) {
    b.textContent = hk[b.dataset.hk] || t('hkNone');
    b.classList.toggle('bad', hkStatus[b.dataset.hk] === false);
  }
  const plainNow = Object.values(hk).find((a) => a && !a.includes('+') && !/^(F\d{1,2}|Insert|Pause|ScrollLock|PrintScreen|num\d)$/.test(a));
  setHotkeyMessage(Object.values(hkStatus).includes(false) ? t('hkBusy') : plainNow ? t('hkPrintable', { k: plainNow }) : '');
}
function setHotkeyMessage(message) {
  $('hkMsg').textContent = message;
  $('hkSetupMsg').textContent = message;
}
function toAccelerator(e) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  let key = e.key;
  if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
  else if (/^Digit\d$/.test(e.code)) key = e.code.slice(5);
  else if (/^Numpad\d$/.test(e.code)) key = 'num' + e.code.slice(6);
  else if (key === ' ') key = 'Space';
  else if (key.startsWith('Arrow')) key = key.slice(5);
  else if (key.length === 1) key = key.toUpperCase();
  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');
  return [...parts, key].join('+');
}
for (const b of document.querySelectorAll('.hk')) {
  b.onclick = async () => {
    cancelHotkeyCapture?.();
    await W.suspendHotkeys(); // 녹화 중에는 전역 단축키가 키를 가로채지 않게 잠시 해제
    b.textContent = t('hkPress');
    const finish = () => {
      window.removeEventListener('keydown', onKey, true);
      cancelHotkeyCapture = null;
    };
    const onKey = async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        finish();
        hkStatus = await W.setHotkeys({ ...DEFAULT_HK, ...(store.hotkeys || {}) });
        return renderHotkeys();
      }
      const acc = e.key === 'Backspace' || e.key === 'Delete' ? '' : toAccelerator(e);
      if (acc === null) return; // 조합키만 누른 상태 → 다음 키 대기
      // 글자·숫자·기호 키를 단독으로 전역 단축키로 잡으면 모든 프로그램에서 그 글자를 칠 수 없게 된다
      const plain = acc && !acc.includes('+') && !/^(F\d{1,2}|Insert|Pause|ScrollLock|PrintScreen|num\d)$/.test(acc);
      if (plain) { setHotkeyMessage(t('hkPrintable', { k: acc })); return; }
      const hk = { ...DEFAULT_HK, ...(store.hotkeys || {}), [b.dataset.hk]: acc };
      if (acc && Object.entries(hk).some(([name, key]) => name !== b.dataset.hk && key === acc)) {
        setHotkeyMessage(t('hkDuplicate')); return;
      }
      finish();
      store.hotkeys = hk;
      hkStatus = await W.setHotkeys(hk);
      renderHotkeys();
    };
    cancelHotkeyCapture = finish;
    window.addEventListener('keydown', onKey, true);
  };
}
async function finishHotkeySetup() {
  cancelHotkeyCapture?.();
  hkStatus = await W.setHotkeys({ ...DEFAULT_HK, ...(store.hotkeys || {}) });
  store.hotkeySetupDone = true;
  await W.setStore({ hotkeySetupDone: true });
  $('hotkeySetupDialog').close();
  renderHotkeys();
  setMode(hotkeySetupMode || 'mini');
  hotkeySetupMode = null;
}
$('btnHotkeyDefaults').onclick = async () => {
  cancelHotkeyCapture?.();
  store.hotkeys = { ...DEFAULT_HK };
  hkStatus = await W.setHotkeys(store.hotkeys);
  renderHotkeys();
};
$('btnHotkeySetupDone').onclick = finishHotkeySetup;
$('btnTutorialSkip').onclick = finishHotkeySetup;
function showTutorialStep(step) {
  tutorialStep = Math.max(0, Math.min(2, step));
  for (const section of document.querySelectorAll('[data-tutorial-step]')) {
    section.classList.toggle('hidden', Number(section.dataset.tutorialStep) !== tutorialStep);
  }
  $('tutorialProgress').textContent = `${tutorialStep + 1} / 3`;
  $('btnTutorialBack').classList.toggle('hidden', tutorialStep === 0);
  $('btnTutorialNext').classList.toggle('hidden', tutorialStep === 2);
  $('btnHotkeySetupDone').classList.toggle('hidden', tutorialStep !== 2);
  $('hotkeySetupDialog').setAttribute('aria-labelledby', ['hotkeySetupTitle', 'tutorialModesTitle', 'tutorialConnectTitle'][tutorialStep]);
  if (tutorialStep === 0) $('hotkeySetupDialog').setAttribute('aria-describedby', 'hotkeySetupIntro');
  else $('hotkeySetupDialog').removeAttribute('aria-describedby');
  fit();
}
async function changeTutorialStep(step) {
  cancelHotkeyCapture?.();
  hkStatus = await W.setHotkeys({ ...DEFAULT_HK, ...(store.hotkeys || {}) });
  renderHotkeys();
  showTutorialStep(step);
}
$('btnTutorialNext').onclick = () => changeTutorialStep(tutorialStep + 1);
$('btnTutorialBack').onclick = () => changeTutorialStep(tutorialStep - 1);
$('btnTutorialReplay').onclick = openHotkeySetup;
$('hotkeySetupDialog').addEventListener('cancel', (event) => {
  event.preventDefault();
  finishHotkeySetup();
});
function openHotkeySetup() {
  hotkeySetupMode = mode;
  setMode('full'); // Leave taskbar placement before sizing the first-run popup.
  $('hotkeySetupDialog').showModal();
  showTutorialStep(0);
  renderHotkeys();
  fit();
}
W.onHotkey((name, wasVisible) => {
  if ($('hotkeySetupDialog').open) return;
  if (name === 'toggle') {
    if (!wasVisible) setMode('taskbar');
    else if (mode === 'taskbar') setMode('mini');
    else if (mode === 'mini') setMode('char');
    else if (mode === 'char') setMode('full');
    else W.hide();
  }
});
$('opacity').oninput = (e) => W.setOpacity(Number(e.target.value));
$('autostart').onchange = (e) => W.autostart(e.target.checked);
$('btnClaudeLogin2').onclick = () => W.claudeLogin();
$('btnManual2').onclick = () => toggleManual(true);
for (const id of ['notifyEnabled', 'notifyProvider', 'notifySkipForeground', 'notifyMinMinutes']) {
  $(id).onchange = () => saveNotifyPreferences().catch((error) => setNotifyMessage(error.message, false));
}
$('btnTelegramSave').onclick = () => notifyAction($('btnTelegramSave'), async () => {
  const result = await W.saveTelegramCredentials({ botToken: $('telegramBotToken').value, chatId: $('telegramChatId').value });
  $('telegramBotToken').value = '';
  return { ...result, message: result.chatConfigured ? t('notifyStateReady') : t('notifyCopied') };
});
$('btnTelegramFindChat').onclick = () => notifyAction($('btnTelegramFindChat'), async () => {
  const result = await W.findTelegramChat();
  $('telegramChatId').value = result.chatId;
  return { ...result, message: t('notifyStateReady') };
});
$('btnKakaoConnect').onclick = () => notifyAction($('btnKakaoConnect'), async () => {
  await W.connectKakao({ appKey: $('kakaoRestKey').value, clientSecret: $('kakaoClientSecret').value });
  setNotifyMessage(t('notifyKakaoPending'), true);
  return { ok: true };
});
$('btnKakaoDisconnect').onclick = () => {
  notifyAction($('btnKakaoDisconnect'), () => W.disconnectKakao());
};
$('btnNotificationTest').onclick = () => notifyAction($('btnNotificationTest'), () => W.testNotification());
$('btnNotifyHelp').onclick = () => $('notifyHelpDialog').showModal();
for (const id of ['btnNotifyHelpClose', 'btnNotifyHelpDone']) $(id).onclick = () => $('notifyHelpDialog').close();
$('notifyHelpDialog').addEventListener('click', (event) => {
  if (event.target === $('notifyHelpDialog')) $('notifyHelpDialog').close();
});
for (const button of document.querySelectorAll('[data-guide-url]')) {
  button.onclick = () => W.openUrl(button.dataset.guideUrl);
}
$('btnInstallNotifyHooks').onclick = () => {
  if (!confirm(t('notifyConfirmInstall'))) return;
  notifyAction($('btnInstallNotifyHooks'), async () => {
    const result = await W.installNotificationHooks();
    const status = await W.notificationState();
    const state = t('notifyHooksReady', { claude: status.hooks?.claude ? '✓' : '—', codex: status.hooks?.codex ? '✓' : '—' });
    const problems = [result.claudeError, result.codexError].filter(Boolean).join(' · ');
    return { ok: result.hooksInstalled, message: problems || (result.hooksInstalled ? `${t('notifyInstalled')} ${state}` : state) };
  });
};
$('btnRemoveNotifyHooks').onclick = () => {
  if (!confirm(t('notifyConfirmRemove'))) return;
  notifyAction($('btnRemoveNotifyHooks'), async () => {
    await W.removeNotificationHooks();
    return { ok: true, message: t('notifyRemoved') };
  });
};
W.onNotificationStatus((status) => {
  if (status?.message) setNotifyMessage(status.message, status.ok);
  refreshNotificationSettings();
});
document.addEventListener('click', (e) => {
  const act = e.target.dataset && e.target.dataset.act;
  if (act === 'login') W.claudeLogin();
  if (act === 'manual') toggleManual(true);
  if (act === 'expand-login') { setMode('full'); W.claudeLogin(); }
});
W.onRefresh(() => refresh());
// 문수네집 링크 버튼 (기본 브라우저 새 창으로)
for (const b of document.querySelectorAll('.brand-btn')) b.onclick = (e) => { e.preventDefault(); W.openUrl(b.href); };

// ---------- 시작 ----------
(async () => {
  store = await W.getStore();
  applyLang(store.lang || 'ko');
  applyTheme(store.theme || 'cyber');
  setMode(store.mode || 'mini');
  $('opacity').value = store.opacity || 0.96;
  applyOptions();
  hkStatus = await W.hotkeyStatus();
  renderHotkeys();
  if (!store.hotkeySetupDone) openHotkeySetup();
  await refresh();
  setInterval(refresh, 60 * 1000); // 1분마다 사용량 갱신
  setInterval(() => { renderUsage(); renderMini(); renderChar(); renderTaskbar(); }, 20 * 1000); // 남은 시간 카운트다운
  setInterval(renderSubs, 30 * 60 * 1000); // 날짜 바뀌면 D-day 갱신
})();
