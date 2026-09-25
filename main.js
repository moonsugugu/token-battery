// AI 크루 (AI CREW) — 항상 위에 떠 있는 Claude/Codex 한도 + 구독 + BGM 위젯 · made by 문수네집
const { app, BrowserWindow, ipcMain, shell, screen, Menu, Tray, nativeImage, Notification, globalShortcut } = require('electron');
const fsSync = require('fs');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');

const HOME = os.homedir();
const CODEX_SESSIONS = path.join(HOME, '.codex', 'sessions');
const CLAUDE_CREDS = path.join(HOME, '.claude', '.credentials.json');
const CLAUDE_PARTITION = 'persist:claudeai';
const ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const TRAY_ICON = path.join(__dirname, 'assets', 'tray.png'); // tray@2x.png는 고해상도 화면에서 자동 사용

let win = null;
let tray = null;
let claudeFetchWin = null; // claude.ai 세션으로 사용량을 조회하는 숨김 창
let store = null;

// ---------- 설정 저장소 ----------
const storePath = () => path.join(app.getPath('userData'), 'widget-store.json');
const DEFAULT_STORE = {
  bounds: null,
  mode: 'mini',
  opacity: 0.96,
  collapsed: {},
  claudeManual: null, // { fiveHour, fiveHourResetsAt, weekly, weeklyResetsAt, savedAt }
  subscriptions: [
    { id: 's1', name: 'Claude', plan: 'Pro', price: 22, currency: 'USD', day: 1, memo: '' },
    { id: 's2', name: 'ChatGPT (Codex)', plan: 'Plus', price: 20, currency: 'USD', day: 1, memo: '' },
  ],
  bgmLast: 'lofi',
  lang: 'ko',
  theme: 'cyber',
  timeBasis: 'clock',
  showClaude: true,
  showCodex: true,
  alertsOn: true,
  alertLevels: [70, 85, 95],
  alertFired: {},
  costOn: true,
  taskWarnOn: true,
  history: { claude: {}, codex: {} },
  compactMode: 'mini',
  hotkeys: { toggle: 'F3', full: 'F4' },
  scale: { mini: 1, char: 1, full: 1 },
};

async function loadStore() {
  try {
    store = { ...DEFAULT_STORE, ...JSON.parse(await fs.readFile(storePath(), 'utf8')) };
  } catch {
    store = { ...DEFAULT_STORE };
  }
}
let saveTimer = null;
function saveStore() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fs.writeFile(storePath(), JSON.stringify(store, null, 2), 'utf8').catch(() => {});
  }, 300);
}

// ---------- Codex: 로컬 세션 로그에서 rate_limits 읽기 ----------
async function listRecentCodexFiles() {
  const files = [];
  const now = new Date();
  for (let d = 0; d < 10; d++) {
    const day = new Date(now.getTime() - d * 86400000);
    const dir = path.join(
      CODEX_SESSIONS,
      String(day.getFullYear()),
      String(day.getMonth() + 1).padStart(2, '0'),
      String(day.getDate()).padStart(2, '0'),
    );
    let names;
    try { names = await fs.readdir(dir); } catch { continue; }
    for (const n of names) {
      if (!n.endsWith('.jsonl')) continue;
      const full = path.join(dir, n);
      try { files.push({ full, mtime: (await fs.stat(full)).mtimeMs }); } catch {}
    }
  }
  return files.sort((a, b) => b.mtime - a.mtime);
}

async function readTail(file, bytes) {
  const fh = await fs.open(file, 'r');
  try {
    const { size } = await fh.stat();
    const start = Math.max(0, size - bytes);
    const buf = Buffer.alloc(size - start);
    await fh.read(buf, 0, buf.length, start);
    return buf.toString('utf8');
  } finally {
    await fh.close();
  }
}

function findRateLimits(obj) {
  if (!obj || typeof obj !== 'object') return null;
  if (obj.rate_limits && (obj.rate_limits.primary || obj.rate_limits.secondary)) return obj.rate_limits;
  for (const v of Object.values(obj)) {
    const r = findRateLimits(v);
    if (r) return r;
  }
  return null;
}

function normCodexWindow(w, lineTs) {
  if (!w) return null;
  let resetsAt = null;
  if (w.resets_at) resetsAt = w.resets_at * 1000;
  else if (w.resets_in_seconds != null && lineTs) resetsAt = lineTs + w.resets_in_seconds * 1000;
  let pct = Number(w.used_percent) || 0;
  // 리셋 시각이 지났으면 새 창이 시작된 것 → 0%
  if (resetsAt && resetsAt < Date.now()) pct = 0;
  return { percent: pct, resetsAt, windowMinutes: w.window_minutes || null };
}

async function getCodexUsage() {
  const files = await listRecentCodexFiles();
  for (const f of files.slice(0, 8)) {
    let text;
    try { text = await readTail(f.full, 512 * 1024); } catch { continue; }
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.includes('"rate_limits"')) continue;
      try {
        const obj = JSON.parse(line);
        const rl = findRateLimits(obj);
        if (!rl) continue;
        const ts = obj.timestamp ? Date.parse(obj.timestamp) : f.mtime;
        return {
          ok: true,
          source: 'codex-log',
          updatedAt: ts,
          fiveHour: normCodexWindow(rl.primary, ts),
          weekly: normCodexWindow(rl.secondary, ts),
        };
      } catch {}
    }
  }
  return { ok: false, code: 'codex-none' };
}

// ---------- Claude: (1) Claude Code OAuth 토큰 → (2) claude.ai 로그인 세션 → (3) 수동 ----------
function normClaude(data, source) {
  const pick = (w) => (w ? {
    percent: Math.round(Number(w.utilization) || 0),
    resetsAt: w.resets_at ? Date.parse(w.resets_at) : null,
  } : null);
  const five = pick(data.five_hour);
  const week = pick(data.seven_day);
  if (!five && !week) return null;
  for (const w of [five, week]) if (w && w.resetsAt && w.resetsAt < Date.now()) w.percent = 0;
  const extra = [];
  if (data.seven_day_opus) extra.push({ label: 'Opus', ...pick(data.seven_day_opus) });
  if (data.seven_day_sonnet) extra.push({ label: 'Sonnet', ...pick(data.seven_day_sonnet) });
  return { ok: true, source, updatedAt: Date.now(), fiveHour: five, weekly: week, extra };
}

async function claudeViaOAuth() {
  let creds;
  try { creds = JSON.parse(await fs.readFile(CLAUDE_CREDS, 'utf8')).claudeAiOauth; } catch { return null; }
  if (!creds || !creds.accessToken || (creds.expiresAt && creds.expiresAt < Date.now())) return null;
  try {
    const r = await fetch('https://api.anthropic.com/api/oauth/usage', {
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'anthropic-beta': 'oauth-2025-04-20' },
    });
    if (!r.ok) return null;
    return normClaude(await r.json(), 'oauth');
  } catch { return null; }
}

function getClaudeFetchWin() {
  if (claudeFetchWin && !claudeFetchWin.isDestroyed()) return Promise.resolve(claudeFetchWin);
  claudeFetchWin = new BrowserWindow({
    show: false,
    webPreferences: { partition: CLAUDE_PARTITION, contextIsolation: true, sandbox: true },
  });
  return claudeFetchWin.loadURL('https://claude.ai/api/organizations')
    .then(() => claudeFetchWin)
    .catch(() => claudeFetchWin);
}

async function claudeViaWebSession() {
  try {
    const w = await getClaudeFetchWin();
    const result = await w.webContents.executeJavaScript(`
      (async () => {
        const r = await fetch('/api/organizations', { credentials: 'include' });
        if (!r.ok) return { status: r.status };
        const orgs = await r.json();
        const org = orgs.find(o => (o.capabilities || []).includes('chat')) || orgs[0];
        if (!org) return { status: 404 };
        const u = await fetch('/api/organizations/' + org.uuid + '/usage', { credentials: 'include' });
        if (!u.ok) return { status: u.status };
        return { status: 200, data: await u.json() };
      })()
    `, true);
    if (result.status === 200) return normClaude(result.data, 'web');
    if (result.status === 401 || result.status === 403) return { ok: false, needLogin: true };
    return null;
  } catch {
    return null;
  }
}

function manualClaude() {
  const m = store.claudeManual;
  if (!m) return null;
  const mk = (pct, at) => {
    const resetsAt = at ? Date.parse(at) : null;
    return { percent: resetsAt && resetsAt < Date.now() ? 0 : Number(pct) || 0, resetsAt };
  };
  return {
    ok: true,
    manual: true,
    source: 'manual',
    updatedAt: m.savedAt,
    fiveHour: mk(m.fiveHour, m.fiveHourResetsAt),
    weekly: mk(m.weekly, m.weeklyResetsAt),
  };
}

async function getClaudeUsage() {
  const viaOAuth = await claudeViaOAuth();
  if (viaOAuth) return viaOAuth;
  const viaWeb = await claudeViaWebSession();
  if (viaWeb && viaWeb.ok) return viaWeb;
  const manual = manualClaude();
  if (manual) return { ...manual, needLogin: !!(viaWeb && viaWeb.needLogin) };
  return { ok: false, needLogin: true, code: 'claude-login' };
}

function openClaudeLogin() {
  const login = new BrowserWindow({
    width: 480, height: 720, title: 'claude.ai login',
    alwaysOnTop: true, autoHideMenuBar: true,
    webPreferences: { partition: CLAUDE_PARTITION, contextIsolation: true, sandbox: true },
  });
  login.loadURL('https://claude.ai/login');
  // 로그인 후 채팅 화면으로 넘어가면 자동으로 닫고 새로고침
  login.webContents.on('did-navigate', (_e, url) => {
    if (/claude\.ai\/(new|chat|recents|project)/.test(url)) {
      setTimeout(() => {
        if (!login.isDestroyed()) login.close();
        if (claudeFetchWin && !claudeFetchWin.isDestroyed()) claudeFetchWin.destroy();
        claudeFetchWin = null;
        win && win.webContents.send('refresh-now');
      }, 800);
    }
  });
}

// ---------- 창 ----------
function createWindow() {
  const { workArea } = screen.getPrimaryDisplay();
  const W = 250, H = 120;
  const b = store.bounds || { x: workArea.x + workArea.width - W - 16, y: workArea.y + 16, width: W, height: H };

  win = new BrowserWindow({
    ...b,
    minWidth: 40, minHeight: 20,
    frame: false,
    transparent: !process.env.WIDGET_SNAPSHOT,
    resizable: false, // 크기는 내용에 맞춰 코드로만 바꾼다(윈도우 최소 크기 제한 회피)
    alwaysOnTop: true,
    skipTaskbar: false,
    hasShadow: false,
    title: 'AI Crew',
    icon: ICON,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true);
  win.setOpacity(store.opacity || 0.96);
  win.loadFile(path.join(__dirname, 'renderer', 'index.html')).catch((e) => log('load-fail', e.message));
  win.webContents.on('did-finish-load', () => log('renderer loaded'));

  const remember = () => { if (!win.isDestroyed()) { store.bounds = win.getBounds(); saveStore(); } };
  win.on('moved', remember);
  win.on('resized', remember);
}

let trayLabels = { tip: 'AI Crew', toggle: 'Show / Hide', reset: 'Reset position', quit: 'Quit' };
function resetPosition() {
  store.bounds = null;
  saveStore();
  const { workArea } = screen.getPrimaryDisplay();
  win.setBounds({ x: workArea.x + workArea.width - 266, y: workArea.y + 16, width: 250, height: 120 });
  win.show();
}
function buildTrayMenu() {
  if (!tray) return;
  tray.setToolTip(trayLabels.tip);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: trayLabels.toggle, click: () => (win.isVisible() ? win.hide() : win.show()) },
    { label: trayLabels.reset, click: resetPosition },
    { type: 'separator' },
    { label: trayLabels.quit, click: () => app.quit() },
  ]));
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(TRAY_ICON));
  buildTrayMenu();
  tray.on('click', () => (win.isVisible() ? win.hide() : win.show()));
}

// ---------- IPC ----------
ipcMain.handle('usage:get', async () => {
  const [claude, codex] = await Promise.all([getClaudeUsage(), getCodexUsage().catch(() => ({ ok: false, code: 'codex-none' }))]);
  return { claude, codex, now: Date.now() };
});
ipcMain.handle('store:get', () => store);
ipcMain.handle('store:set', (_e, patch) => { store = { ...store, ...patch }; saveStore(); return store; });
ipcMain.handle('claude:login', () => openClaudeLogin());
ipcMain.handle('open:url', (_e, url) => {
  const ok = /^https:\/\/(www\.)?(youtube\.com|claude\.ai|chatgpt\.com)\//.test(url)
    || ['https://moonsunezipbrand.vercel.app', 'https://www.instagram.com/moonsune.zip/', 'https://moonsune-zip.vercel.app/'].includes(url);
  if (ok) shell.openExternal(url);
});
ipcMain.handle('tray:labels', (_e, labels) => { trayLabels = { ...trayLabels, ...labels }; buildTrayMenu(); });
ipcMain.handle('notify', (_e, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body, icon: ICON }).show();
});
ipcMain.handle('win:hide', () => win.hide());
ipcMain.handle('win:opacity', (_e, v) => { win.setOpacity(v); store.opacity = v; saveStore(); });
// 확대 배율: 화면 내용(글자·캐릭터)을 통째로 키우거나 줄인다
let zoom = 1;
ipcMain.handle('win:zoom', (_e, z) => { zoom = z; win.webContents.setZoomFactor(z); });
// anchor: 'right' = 오른쪽 모서리 고정(기본), 'left' = 왼쪽 모서리 고정(오른쪽 아래 손잡이로 키울 때)
ipcMain.handle('win:fitSize', (_e, w, h, anchor) => {
  const b = win.getBounds();
  const { workArea } = screen.getDisplayMatching(b);
  const width = Math.min(Math.round(w * zoom), workArea.width);
  const height = Math.min(Math.max(20, Math.round(h * zoom)), workArea.height - 20);
  const want = anchor === 'left' ? b.x : b.x + b.width - width;
  const x = Math.min(Math.max(workArea.x, want), workArea.x + workArea.width - width);
  win.setBounds({ x, y: b.y, width, height });
});

// 마우스가 위젯 근처에 오면 조작 버튼을 보여준다.
// (창을 끌 수 있는 영역은 hover 이벤트를 받지 못해서 커서 위치를 직접 확인한다)
let near = false;
setInterval(() => {
  if (!win || win.isDestroyed() || !win.isVisible()) return;
  const p = screen.getCursorScreenPoint();
  const b = win.getBounds();
  const m = 18;
  const now = p.x >= b.x - m && p.x <= b.x + b.width + m && p.y >= b.y - m && p.y <= b.y + b.height + m;
  if (now !== near) { near = now; win.webContents.send('near', near); }
}, 120);
// ---------- 전역 단축키 ----------
let hotkeyStatus = {};
function registerHotkeys() {
  globalShortcut.unregisterAll();
  hotkeyStatus = {};
  const hk = { toggle: 'F3', full: 'F4', ...(store.hotkeys || {}) };
  for (const [name, acc] of Object.entries(hk)) {
    if (!acc) continue;
    try {
      hotkeyStatus[name] = globalShortcut.register(acc, () => {
        const wasVisible = win.isVisible() && !win.isMinimized();
        log('hotkey', name, { wasVisible });
        if (name === 'full') { // 위젯 전체 보이기/숨기기
          if (wasVisible) win.hide(); else win.showInactive();
          return;
        }
        if (!wasVisible) win.showInactive(); // 작업 중인 창의 포커스를 뺏지 않는다
        win.webContents.send('hotkey', name, wasVisible);
      });
    } catch {
      hotkeyStatus[name] = false;
    }
  }
  log('hotkeys', hk, hotkeyStatus);
  return hotkeyStatus;
}
ipcMain.handle('hotkeys:set', (_e, hk) => { store.hotkeys = hk; saveStore(); return registerHotkeys(); });
ipcMain.handle('hotkeys:suspend', () => globalShortcut.unregisterAll());
ipcMain.handle('hotkeys:status', () => hotkeyStatus);
app.on('will-quit', () => globalShortcut.unregisterAll());

ipcMain.handle('app:autostart', (_e, on) => {
  if (on === undefined) return app.getLoginItemSettings().openAtLogin;
  app.setLoginItemSettings({ openAtLogin: !!on, path: process.execPath, args: [path.resolve(__dirname)] });
  return !!on;
});

// ---------- 시작 ----------
app.setAppUserModelId('com.moonsunezip.ai-usage-widget');
// 개발 확인용 스냅샷 모드는 실제 설정을 건드리지 않도록 별도 폴더 사용
if (process.env.WIDGET_SNAPSHOT) app.setPath('userData', path.join(os.tmpdir(), 'ai-usage-widget-snapshot'));
// 일부 PC(보안 프로그램·샌드박스 환경)에서 GPU 샌드박스가 뜨지 않아 앱이 바로 꺼지는 문제 방지
app.commandLine.appendSwitch('disable-gpu-sandbox');
// 한국 금융·키보드 보안 프로그램(AhnLab Safe Transaction, nProtect 등)이 설치된 PC에서는
// 화면 프로세스 샌드박스가 시작하자마자 죽는다(0x80000003). 한 번 감지되면 표시 파일을 남기고
// 이후로는 샌드박스 없이 실행한다. 로컬 화면은 contextIsolation으로 Node 접근이 막혀 있다.
const NO_SANDBOX_FLAG = path.join(app.getPath('userData'), 'no-sandbox.flag');
const noSandbox = process.argv.includes('--no-sandbox') || fsSync.existsSync(NO_SANDBOX_FLAG);
if (noSandbox) app.commandLine.appendSwitch('no-sandbox');
const startedAt = Date.now();

// 문제 추적용 로그: %APPDATA%/ai-usage-widget/widget.log (자식 프로세스가 죽은 이유 등)
function log(...a) {
  try {
    const line = `${new Date().toISOString()} ${a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' ')}
`;
    require('fs').appendFileSync(path.join(app.getPath('userData'), 'widget.log'), line);
  } catch {}
}
app.on('child-process-gone', (_e, d) => log('child-process-gone', d));
app.on('render-process-gone', (_e, wc, d) => {
  log('render-process-gone', d);
  const isMain = win && !win.isDestroyed() && wc === win.webContents;
  if (isMain && !noSandbox && d.reason === 'crashed' && Date.now() - startedAt < 15000) {
    log('sandbox crash detected -> relaunch without sandbox');
    try { fsSync.writeFileSync(NO_SANDBOX_FLAG, new Date().toISOString()); } catch {}
    app.relaunch({ args: [...process.argv.slice(1), '--no-sandbox'] });
    app.exit(0);
  }
});

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); } });
  app.whenReady().then(async () => {
    await loadStore();
    log('start', { dir: __dirname, noSandbox });
    createWindow();
    createTray();
    registerHotkeys();
    // 개발 확인용: WIDGET_SNAPSHOT=경로 로 실행하면 화면을 캡처하고 종료
    if (process.env.WIDGET_SNAPSHOT) {
      win.webContents.on('console-message', (e) => console.log('[renderer]', e.message));
      if (process.env.WIDGET_SNAPSHOT_JS) {
        setTimeout(() => win.webContents.executeJavaScript(process.env.WIDGET_SNAPSHOT_JS).catch((e) => console.log('[js]', e.message)), 5000);
      }
      setTimeout(async () => {
        // WIDGET_SNAPSHOT_ALL=폴더 → 모든 테마 × (미니/자세히)를 차례로 캡처
        if (process.env.WIDGET_SNAPSHOT_ALL) {
          const ids = await win.webContents.executeJavaScript('THEMES.map((t) => t.id)');
          for (const id of ids) {
            for (const mode of ['mini', 'char', 'full']) {
              await win.webContents.executeJavaScript(`applyTheme('${id}'); setMode('${mode}');`);
              await new Promise((r) => setTimeout(r, 900));
              const shot = await win.webContents.capturePage();
              await fs.writeFile(path.join(process.env.WIDGET_SNAPSHOT_ALL, `${id}-${mode}.png`), shot.toPNG());
            }
          }
        }
        const img = await win.webContents.capturePage();
        await fs.writeFile(process.env.WIDGET_SNAPSHOT, img.toPNG());
        app.quit();
      }, 9000);
    }
  });
  app.on('window-all-closed', () => app.quit());
}
