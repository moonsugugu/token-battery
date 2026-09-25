// AI 크루 (AI CREW) — 항상 위에 떠 있는 Claude/Codex 한도 + 구독 + BGM 위젯 · made by 문수네집
const { app, BrowserWindow, ipcMain, shell, screen, Menu, Tray, nativeImage, Notification, globalShortcut, safeStorage } = require('electron');
const fsSync = require('fs');
const path = require('path');
const fs = require('fs/promises');
const os = require('os');
const http = require('http');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const HOME = os.homedir();
const CODEX_HOME = process.env.CODEX_HOME ? path.resolve(process.env.CODEX_HOME) : path.join(HOME, '.codex');
const CODEX_SESSIONS = path.join(CODEX_HOME, 'sessions');
const CODEX_AUTH = path.join(CODEX_HOME, 'auth.json');
const CLAUDE_CREDS = path.join(HOME, '.claude', '.credentials.json');
const CLAUDE_PARTITION = 'persist:claudeai';
const AGENT_BRIDGE_PORT = 43192;
const KAKAO_REDIRECT_URI = `http://127.0.0.1:${AGENT_BRIDGE_PORT}/oauth/kakao/callback`;
const CODEX_HOOK_MARKER_START = '# >>> AI CREW task notifications';
const CODEX_HOOK_MARKER_END = '# <<< AI CREW task notifications';
const execFileAsync = promisify(execFile);
const ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const TRAY_ICON = path.join(__dirname, 'assets', 'tray.png'); // tray@2x.png는 고해상도 화면에서 자동 사용

let win = null;
let tray = null;
let claudeFetchWin = null; // claude.ai 세션으로 사용량을 조회하는 숨김 창
let store = null;
let bridgeServer = null;
let bridgeStarting = null;
let bridgeToken = null;
let pendingKakaoState = null;
let activeAgentWork = new Map();
let lastNotifyResult = { ok: true, message: '' };

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
  notifications: { enabled: false, provider: 'telegram', minDurationMinutes: 10, suppressWhenForeground: true, hooksInstalled: false },
  history: { claude: {}, codex: {} },
  compactMode: 'mini',
  hotkeys: { toggle: 'F3', full: 'F4' },
  scale: { mini: 1, char: 1, full: 1 },
};

async function loadStore() {
  try {
    const saved = JSON.parse(await fs.readFile(storePath(), 'utf8'));
    store = { ...DEFAULT_STORE, ...saved, notifications: { ...DEFAULT_STORE.notifications, ...(saved.notifications || {}) } };
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
  for (let d = 0; d < 31; d++) {
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
    let offset = 0;
    while (offset < buf.length) {
      const { bytesRead } = await fh.read(buf, offset, buf.length - offset, start + offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    return buf.subarray(0, offset).toString('utf8');
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

async function codexLoginDetected() {
  try {
    const auth = JSON.parse(await fs.readFile(CODEX_AUTH, 'utf8'));
    return !!(auth.tokens?.access_token || auth.OPENAI_API_KEY);
  } catch {
    return false;
  }
}

async function getCodexUsage() {
  const files = await listRecentCodexFiles();
  const loggedIn = await codexLoginDetected();
  // Codex keeps rolling session logs that can grow very large. Search a wider,
  // bounded tail across more recent sessions so a noisy/active session cannot
  // hide the last token_count event that carries rate_limits.
  for (const f of files.slice(0, 24)) {
    let text;
    try { text = await readTail(f.full, 2 * 1024 * 1024); } catch { continue; }
    const lines = text.split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      if (!line.includes('rate_limits')) continue;
      try {
        const obj = JSON.parse(line);
        const rl = findRateLimits(obj);
        if (!rl) continue;
        const ts = obj.timestamp ? Date.parse(obj.timestamp) : f.mtime;
        return {
          ok: true,
          source: 'codex-log',
          loggedIn,
          updatedAt: ts,
          fiveHour: normCodexWindow(rl.primary, ts),
          weekly: normCodexWindow(rl.secondary, ts),
        };
      } catch {}
    }
  }
  return { ok: false, loggedIn, code: loggedIn ? 'codex-no-usage' : 'codex-login', scannedFiles: Math.min(files.length, 24) };
}

// ---------- 작업 완료 알림: 비밀정보는 safeStorage에만 저장 ----------
const notificationSecretsPath = () => path.join(app.getPath('userData'), 'notification-secrets.enc');
const agentHookScriptPath = () => path.join(app.getPath('userData'), 'hooks', 'agent-event.ps1');
const claudeSettingsPath = () => path.join(HOME, '.claude', 'settings.json');
const codexConfigPath = () => path.join(CODEX_HOME, 'config.toml');

async function readNotificationSecrets() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return {};
    const encrypted = await fs.readFile(notificationSecretsPath());
    return JSON.parse(safeStorage.decryptString(encrypted));
  } catch {
    return {};
  }
}

async function writeNotificationSecrets(patch) {
  if (!safeStorage.isEncryptionAvailable()) throw new Error('이 Windows 계정에서 OS 보안 저장소를 사용할 수 없어 비밀 키를 저장할 수 없습니다.');
  const previous = await readNotificationSecrets();
  const next = { ...previous, ...patch };
  await fs.mkdir(path.dirname(notificationSecretsPath()), { recursive: true });
  await fs.writeFile(notificationSecretsPath(), safeStorage.encryptString(JSON.stringify(next)));
  return next;
}

function secretBridgeToken(secrets) {
  return secrets.bridgeToken || crypto.randomBytes(32).toString('hex');
}

function htmlResponse(res, status, message) {
  const safe = String(message).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(`<!doctype html><meta charset="utf-8"><title>AI Crew</title><body style="font:16px sans-serif;padding:40px">${safe}<p>이 창을 닫고 AI Crew로 돌아가세요.</p></body>`);
}

async function requestBody(req, limit = 8192) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error('요청이 너무 큽니다.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function isLoopback(req) {
  const addr = req.socket.remoteAddress || '';
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

function authorizedBridgeRequest(req) {
  const got = Buffer.from(String(req.headers.authorization || ''));
  const expected = Buffer.from(`Bearer ${bridgeToken || ''}`);
  return got.length === expected.length && got.length > 0 && crypto.timingSafeEqual(got, expected);
}

function notifyRenderer(message) {
  lastNotifyResult = { ok: !!message.ok, message: message.message || '', at: Date.now() };
  if (win && !win.isDestroyed()) win.webContents.send('notify:status', lastNotifyResult);
}

async function finishKakaoOAuth(url, res) {
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const oauthError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (!pendingKakaoState || !state || state !== pendingKakaoState.state) {
    pendingKakaoState = null;
    return htmlResponse(res, 400, '카카오 연결 요청을 확인할 수 없습니다. 앱에서 다시 연결을 눌러 주세요.');
  }
  const { appKey, clientSecret } = pendingKakaoState;
  pendingKakaoState = null;
  if (oauthError || !code) {
    notifyRenderer({ ok: false, message: `카카오 로그인 실패: ${oauthError || '인증 코드가 없습니다.'}` });
    return htmlResponse(res, 400, '카카오 로그인이 취소되었거나 실패했습니다. 앱으로 돌아가 다시 시도해 주세요.');
  }
  try {
    const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: appKey, redirect_uri: KAKAO_REDIRECT_URI, code });
    if (clientSecret) form.set('client_secret', clientSecret);
    const response = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form,
    });
    const data = await response.json();
    if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || '토큰을 받을 수 없습니다.');
    const secrets = await readNotificationSecrets();
    await writeNotificationSecrets({
      kakao: {
        appKey, clientSecret,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || secrets.kakao?.refreshToken || '',
        expiresAt: Date.now() + Number(data.expires_in || 0) * 1000,
      },
    });
    notifyRenderer({ ok: true, message: '카카오 나에게 보내기 연결 완료' });
    htmlResponse(res, 200, '카카오톡 연결이 완료되었습니다.');
  } catch (error) {
    notifyRenderer({ ok: false, message: `카카오 연결 실패: ${error.message}` });
    htmlResponse(res, 502, '카카오 연결에 실패했습니다. 앱으로 돌아가 설정과 동의 항목을 확인해 주세요.');
  }
}

async function startAgentBridge() {
  if (bridgeServer && bridgeServer.listening) return true;
  if (bridgeStarting) return bridgeStarting;
  bridgeStarting = (async () => {
    const secrets = await readNotificationSecrets();
    bridgeToken = secretBridgeToken(secrets);
    if (!secrets.bridgeToken) await writeNotificationSecrets({ bridgeToken });
    const server = http.createServer((req, res) => {
      if (!isLoopback(req)) return htmlResponse(res, 403, '로컬 앱에서만 사용할 수 있습니다.');
      const url = new URL(req.url, `http://127.0.0.1:${AGENT_BRIDGE_PORT}`);
      if (req.method === 'GET' && url.pathname === '/oauth/kakao/callback') {
        finishKakaoOAuth(url, res).catch((error) => {
          notifyRenderer({ ok: false, message: `카카오 연결 실패: ${error.message}` });
          if (!res.headersSent) htmlResponse(res, 500, '카카오 연결 중 오류가 발생했습니다.');
        });
        return;
      }
      if (req.method !== 'POST' || url.pathname !== '/agent-event' || !authorizedBridgeRequest(req)) {
        res.writeHead(404, { 'cache-control': 'no-store' });
        res.end('not found');
        return;
      }
      requestBody(req).then((raw) => {
        let event;
        try { event = JSON.parse(raw); } catch { throw new Error('invalid event'); }
        const service = ['claude', 'codex'].includes(event.service) ? event.service : null;
        const action = ['start', 'stop'].includes(event.action) ? event.action : null;
        const sessionId = typeof event.sessionId === 'string' ? event.sessionId.slice(0, 180) : '';
        if (!service || !action || !sessionId) throw new Error('invalid event');
        if (action === 'start') {
          const now = Date.now();
          for (const [key, item] of activeAgentWork) if (now - item.startedAt > 24 * 60 * 60 * 1000) activeAgentWork.delete(key);
          activeAgentWork.set(`${service}:${sessionId}`, { service, startedAt: now });
        } else {
          const key = `${service}:${sessionId}`;
          const active = activeAgentWork.get(key);
          activeAgentWork.delete(key);
          if (active) void processAgentCompletion(active);
        }
      }).catch(() => {}).finally(() => {
        if (!res.headersSent) { res.writeHead(202, { 'cache-control': 'no-store' }); res.end('accepted'); }
      });
    });
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(AGENT_BRIDGE_PORT, '127.0.0.1', resolve);
    });
    bridgeServer = server;
    log('agent bridge listening', { address: '127.0.0.1', port: AGENT_BRIDGE_PORT });
    return true;
  })().catch((error) => {
    bridgeServer = null;
    throw error;
  }).finally(() => { bridgeStarting = null; });
  return bridgeStarting;
}

async function isAgentWindowForeground() {
  if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) return true;
  if (process.platform !== 'win32') return false;
  const script = `$src='using System; using System.Runtime.InteropServices; public static class ForegroundWindow { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint p); }'; Add-Type -TypeDefinition $src -ErrorAction SilentlyContinue; $foregroundPid=[uint32]0; [void][ForegroundWindow]::GetWindowThreadProcessId([ForegroundWindow]::GetForegroundWindow(), [ref]$foregroundPid); $foregroundProcess=Get-Process -Id $foregroundPid -ErrorAction SilentlyContinue; if($foregroundProcess){ @{name=$foregroundProcess.ProcessName; title=$foregroundProcess.MainWindowTitle} | ConvertTo-Json -Compress }`;
  try {
    const { stdout } = await execFileAsync(path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'), ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-Command', script], { timeout: 1500, windowsHide: true });
    const active = JSON.parse(stdout.trim() || '{}');
    return /^(codex|claude|code|cursor|windowsterminal|wezterm|alacritty|tabby|powershell|pwsh|cmd|mintty|hyper)$/i.test(active.name || '')
      || /\b(codex|claude code)\b/i.test(active.title || '');
  } catch {
    return false;
  }
}

async function telegramCall(token, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error(data.description || `Telegram API 오류 (${response.status})`);
  return data.result;
}

async function ensureKakaoAccessToken() {
  const secrets = await readNotificationSecrets();
  const kakao = secrets.kakao;
  if (!kakao?.appKey || !kakao.refreshToken) throw new Error('카카오 연결이 필요합니다.');
  if (kakao.accessToken && kakao.expiresAt > Date.now() + 60000) return kakao.accessToken;
  const form = new URLSearchParams({ grant_type: 'refresh_token', client_id: kakao.appKey, refresh_token: kakao.refreshToken });
  if (kakao.clientSecret) form.set('client_secret', kakao.clientSecret);
  const response = await fetch('https://kauth.kakao.com/oauth/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' }, body: form,
  });
  const data = await response.json();
  if (!response.ok || !data.access_token) throw new Error(data.error_description || data.error || '카카오 토큰 갱신 실패');
  await writeNotificationSecrets({ kakao: {
    ...kakao,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || kakao.refreshToken,
    expiresAt: Date.now() + Number(data.expires_in || 0) * 1000,
  } });
  return data.access_token;
}

async function deliverNotification(text) {
  const prefs = store.notifications || DEFAULT_STORE.notifications;
  const secrets = await readNotificationSecrets();
  if (prefs.provider === 'kakao') {
    const token = await ensureKakaoAccessToken();
    const template = {
      object_type: 'text', text: text.slice(0, 200),
      link: { web_url: 'https://github.com/moonsugugu/ai-crew-widget', mobile_web_url: 'https://github.com/moonsugugu/ai-crew-widget' },
      button_title: 'AI Crew 열기',
    };
    const response = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: new URLSearchParams({ template_object: JSON.stringify(template) }),
    });
    const data = await response.json();
    if (!response.ok || data.result_code !== 0) throw new Error(data.msg || `카카오 메시지 전송 오류 (${response.status})`);
    return '카카오 나와의 채팅으로 전송했습니다.';
  }
  const telegram = secrets.telegram;
  if (!telegram?.botToken || !telegram?.chatId) throw new Error('텔레그램 Bot Token과 Chat ID를 먼저 저장해 주세요.');
  await telegramCall(telegram.botToken, 'sendMessage', { chat_id: telegram.chatId, text });
  return '텔레그램으로 전송했습니다.';
}

async function makeCompletionMessage(active, durationMs) {
  const service = active.service === 'claude' ? 'Claude' : 'Codex';
  const mins = Math.max(1, Math.floor(durationMs / 60000));
  const duration = mins >= 60 ? `${Math.floor(mins / 60)}시간 ${mins % 60}분` : `${mins}분`;
  let text = `✅ ${service} 작업 완료 · ${duration} 작업`;
  try {
    const usage = active.service === 'claude' ? await getClaudeUsage() : await getCodexUsage();
    const window = usage?.ok && usage.fiveHour;
    if (window) {
      const remaining = Math.max(0, Math.min(100, 100 - Math.round(window.percent)));
      const reset = window.resetsAt ? new Date(window.resetsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : '';
      text += ` · 5시간 한도 ${remaining}% 남음${reset ? ` (리셋 ${reset})` : ''}`;
    }
  } catch {}
  return text;
}

async function processAgentCompletion(active) {
  const prefs = store.notifications || DEFAULT_STORE.notifications;
  const durationMs = Date.now() - active.startedAt;
  if (!prefs.enabled || durationMs < (Number(prefs.minDurationMinutes) || 10) * 60000) return;
  if (prefs.suppressWhenForeground && await isAgentWindowForeground()) return;
  try {
    const message = await makeCompletionMessage(active, durationMs);
    const result = await deliverNotification(message);
    notifyRenderer({ ok: true, message: result });
  } catch (error) {
    log('completion notification failed', error.message);
    notifyRenderer({ ok: false, message: error.message });
  }
}

function buildAgentHookScript(token) {
  return `param([string]$Service, [string]$Action)
$ErrorActionPreference = 'SilentlyContinue'
$raw = [Console]::In.ReadToEnd()
$event = $null
try { $event = $raw | ConvertFrom-Json } catch { exit 0 }
$sessionId = [string]$event.session_id
if (-not $sessionId) { $sessionId = [string]$event.sessionId }
if (-not $sessionId) { exit 0 }
$payload = @{ service = $Service; action = $Action; sessionId = $sessionId } | ConvertTo-Json -Compress
try {
  Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:${AGENT_BRIDGE_PORT}/agent-event' -Headers @{ Authorization = 'Bearer ${token}' } -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 2 | Out-Null
} catch {}
exit 0
`;
}

function escapeCommandPath(value) { return String(value).replace(/"/g, '\\"'); }
function agentHookCommand(service, action) {
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return `"${escapeCommandPath(powershell)}" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${escapeCommandPath(agentHookScriptPath())}" ${service} ${action}`;
}

function removeManagedClaudeHooks(config, scriptPath) {
  const hooks = config.hooks;
  if (!hooks || typeof hooks !== 'object') return false;
  let changed = false;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    hooks[event] = groups.map((group) => {
      if (!group || !Array.isArray(group.hooks)) return group;
      const remaining = group.hooks.filter((hook) => !(hook && typeof hook.command === 'string' && hook.command.toLowerCase().includes(scriptPath.toLowerCase())));
      if (remaining.length !== group.hooks.length) changed = true;
      return remaining.length ? { ...group, hooks: remaining } : null;
    }).filter(Boolean);
    if (!hooks[event].length) delete hooks[event];
  }
  if (!Object.keys(hooks).length) delete config.hooks;
  return changed;
}

function codexManagedBlock(command) {
  const lines = [
    CODEX_HOOK_MARKER_START,
    '[[hooks.UserPromptSubmit]]',
    '[[hooks.UserPromptSubmit.hooks]]',
    'type = "command"',
    `command = ${JSON.stringify(command('codex', 'start'))}`,
    'async = true',
    'timeout = 3',
    '',
    '[[hooks.Stop]]',
    '[[hooks.Stop.hooks]]',
    'type = "command"',
    `command = ${JSON.stringify(command('codex', 'stop'))}`,
    'async = true',
    'timeout = 3',
    CODEX_HOOK_MARKER_END,
  ];
  return lines.join('\r\n');
}

function replaceCodexManagedBlock(config, block) {
  const escapedStart = CODEX_HOOK_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedEnd = CODEX_HOOK_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const range = new RegExp(`${escapedStart}[\\s\\S]*?${escapedEnd}`, 'g');
  const stripped = config.replace(range, '').replace(/[\r\n]+$/, '');
  return `${stripped}${stripped ? '\r\n\r\n' : ''}${block}\r\n`;
}

async function backupAndWrite(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  try {
    const existing = await fs.readFile(file, 'utf8');
    if (existing === content) return;
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await fs.copyFile(file, `${file}.ai-crew-${stamp}.bak`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const temp = `${file}.ai-crew-tmp`;
  await fs.writeFile(temp, content, 'utf8');
  await fs.rename(temp, file);
}

async function installClaudeHooks() {
  if (process.platform !== 'win32') throw new Error('현재 알림 훅 설치는 Windows용입니다.');
  const file = claudeSettingsPath();
  let config = {};
  try { config = JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('~/.claude/settings.json이 올바른 JSON이 아니어서 덮어쓰지 않았습니다.');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Claude settings.json의 최상위 항목이 객체가 아니어서 수정하지 않았습니다.');
  if (config.hooks != null && (typeof config.hooks !== 'object' || Array.isArray(config.hooks))) throw new Error('Claude settings.json의 hooks 형식이 올바르지 않아 수정하지 않았습니다.');
  const scriptPath = agentHookScriptPath();
  removeManagedClaudeHooks(config, scriptPath);
  config.hooks = config.hooks || {};
  for (const event of ['UserPromptSubmit', 'Stop']) {
    if (config.hooks[event] != null && !Array.isArray(config.hooks[event])) throw new Error(`Claude settings.json의 ${event} 훅 형식이 올바르지 않습니다.`);
    config.hooks[event] = config.hooks[event] || [];
    config.hooks[event].push({ hooks: [{ type: 'command', command: agentHookCommand('claude', event === 'UserPromptSubmit' ? 'start' : 'stop'), async: true, timeout: 3 }] });
  }
  await backupAndWrite(file, JSON.stringify(config, null, 2) + '\n');
  return true;
}

async function installCodexHooks() {
  if (process.platform !== 'win32') throw new Error('현재 알림 훅 설치는 Windows용입니다.');
  const file = codexConfigPath();
  let config = '';
  try { config = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const featureStart = config.search(/^\[features\]\s*$/m);
  if (featureStart >= 0) {
    const bodyStart = config.indexOf('\n', featureStart) + 1;
    const nextTable = config.slice(bodyStart).search(/^\s*\[/m);
    const featureBody = nextTable < 0 ? config.slice(bodyStart) : config.slice(bodyStart, bodyStart + nextTable);
    if (/^\s*hooks\s*=\s*false(?:\s*#.*)?\s*$/mi.test(featureBody)) throw new Error('Codex config.toml에서 hooks=false라 설치하지 않았습니다.');
  }
  const block = codexManagedBlock(agentHookCommand);
  const next = replaceCodexManagedBlock(config, block);
  await backupAndWrite(file, next);
  return true;
}

async function getNotificationHookStatus() {
  const scriptPath = agentHookScriptPath();
  const status = { claude: false, codex: false };
  try {
    const config = JSON.parse(await fs.readFile(claudeSettingsPath(), 'utf8'));
    const hooks = config.hooks || {};
    status.claude = Object.values(hooks).some((groups) => Array.isArray(groups) && groups.some((g) => (g.hooks || []).some((h) => h.command?.toLowerCase().includes(scriptPath.toLowerCase()))));
  } catch {}
  try { status.codex = (await fs.readFile(codexConfigPath(), 'utf8')).includes(CODEX_HOOK_MARKER_START); } catch {}
  return status;
}

async function installNotificationHooks() {
  if (process.platform !== 'win32') throw new Error('현재 알림 훅 설치는 Windows용입니다.');
  await startAgentBridge();
  const secrets = await readNotificationSecrets();
  await fs.mkdir(path.dirname(agentHookScriptPath()), { recursive: true });
  await fs.writeFile(agentHookScriptPath(), buildAgentHookScript(secrets.bridgeToken || bridgeToken), 'utf8');
  const result = {};
  try { await installClaudeHooks(); result.claude = true; } catch (error) { result.claude = false; result.claudeError = error.message; }
  try { await installCodexHooks(); result.codex = true; } catch (error) { result.codex = false; result.codexError = error.message; }
  const hooksInstalled = result.claude && result.codex;
  store.notifications = { ...(store.notifications || DEFAULT_STORE.notifications), hooksInstalled: result.claude || result.codex };
  saveStore();
  return { ...result, hooksInstalled };
}

async function removeNotificationHooks() {
  const scriptPath = agentHookScriptPath();
  const claudeFile = claudeSettingsPath();
  const codexFile = codexConfigPath();
  const result = { claude: false, codex: false };
  try {
    const config = JSON.parse(await fs.readFile(claudeFile, 'utf8'));
    if (removeManagedClaudeHooks(config, scriptPath)) { await backupAndWrite(claudeFile, JSON.stringify(config, null, 2) + '\n'); result.claude = true; }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  try {
    const config = await fs.readFile(codexFile, 'utf8');
    if (config.includes(CODEX_HOOK_MARKER_START)) {
      const next = config.replace(new RegExp(`${CODEX_HOOK_MARKER_START}[\\s\\S]*?${CODEX_HOOK_MARKER_END}`, 'g'), '').replace(/[\r\n]+$/, '');
      await backupAndWrite(codexFile, next ? `${next}\r\n` : '');
      result.codex = true;
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  store.notifications = { ...(store.notifications || DEFAULT_STORE.notifications), hooksInstalled: false };
  saveStore();
  return result;
}

async function notificationState() {
  const secrets = await readNotificationSecrets();
  return {
    preferences: store.notifications || DEFAULT_STORE.notifications,
    telegramConfigured: !!(secrets.telegram?.botToken),
    telegramChatConfigured: !!(secrets.telegram?.chatId),
    kakaoKeyConfigured: !!(secrets.kakao?.appKey),
    kakaoConnected: !!(secrets.kakao?.refreshToken),
    kakaoRedirectUri: KAKAO_REDIRECT_URI,
    hooks: await getNotificationHookStatus(),
    lastResult: lastNotifyResult,
  };
}

async function beginKakaoConnection({ appKey, clientSecret }) {
  const key = String(appKey || '').trim();
  if (!key) throw new Error('카카오 REST API 키를 입력해 주세요.');
  await startAgentBridge();
  const previousKakao = (await readNotificationSecrets()).kakao || {};
  const sameApp = previousKakao.appKey === key;
  await writeNotificationSecrets({ kakao: {
    ...(sameApp ? previousKakao : {}), appKey: key, clientSecret: String(clientSecret || '').trim(),
    ...(sameApp ? {} : { accessToken: '', refreshToken: '', expiresAt: 0 }),
  } });
  const state = crypto.randomBytes(24).toString('hex');
  pendingKakaoState = { state, appKey: key, clientSecret: String(clientSecret || '').trim() };
  const authUrl = new URL('https://kauth.kakao.com/oauth/authorize');
  authUrl.search = new URLSearchParams({ client_id: key, redirect_uri: KAKAO_REDIRECT_URI, response_type: 'code', scope: 'talk_message', state }).toString();
  await shell.openExternal(authUrl.toString());
  return { ok: true };
}

async function saveTelegramCredentials({ botToken, chatId }) {
  const previous = (await readNotificationSecrets()).telegram || {};
  const token = String(botToken || '').trim() || previous.botToken;
  const chat = String(chatId || '').trim() || previous.chatId || '';
  if (!token) throw new Error('텔레그램 Bot Token을 입력해 주세요.');
  await telegramCall(token, 'getMe', {});
  await writeNotificationSecrets({ telegram: { botToken: token, chatId: chat } });
  return { ok: true, chatConfigured: !!chat };
}

async function findTelegramChat() {
  const telegram = (await readNotificationSecrets()).telegram;
  if (!telegram?.botToken) throw new Error('Bot Token을 먼저 저장해 주세요.');
  const updates = await telegramCall(telegram.botToken, 'getUpdates', { allowed_updates: ['message'] });
  const chats = [...new Map(updates.filter((u) => u.message?.chat?.type === 'private')
    .map((u) => [String(u.message.chat.id), u.message.chat])).values()];
  if (!chats.length) throw new Error('봇과 텔레그램에서 대화를 시작해 주세요. 봇 채팅방에서 /start를 보낸 뒤 다시 눌러 주세요.');
  if (chats.length > 1) throw new Error('이 봇과 대화한 개인 채팅이 여러 개라 자동 선택하지 않았어요. 본인 Chat ID를 직접 입력해 주세요.');
  const chatId = String(chats[0].id);
  await writeNotificationSecrets({ telegram: { ...telegram, chatId } });
  return { ok: true, chatId };
}

async function testNotification() {
  const result = await deliverNotification('AI Crew 알림 테스트입니다. 연결이 잘 되었어요!');
  notifyRenderer({ ok: true, message: result });
  return { ok: true, message: result };
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
  const [claude, codex] = await Promise.all([
    getClaudeUsage(),
    getCodexUsage().catch(async (error) => {
      log('codex usage read failed', error.message);
      return { ok: false, loggedIn: await codexLoginDetected(), code: 'codex-read-error' };
    }),
  ]);
  return { claude, codex, now: Date.now() };
});
ipcMain.handle('store:get', () => store);
ipcMain.handle('store:set', (_e, patch) => { store = { ...store, ...patch }; saveStore(); return store; });
ipcMain.handle('notifications:state', () => notificationState());
ipcMain.handle('notifications:preferences:set', (_e, patch = {}) => {
  const prev = store.notifications || DEFAULT_STORE.notifications;
  const provider = ['kakao', 'telegram'].includes(patch.provider) ? patch.provider : prev.provider;
  const minDurationMinutes = Math.min(1440, Math.max(1, Math.round(Number(patch.minDurationMinutes) || prev.minDurationMinutes || 10)));
  store.notifications = {
    ...prev,
    enabled: patch.enabled === undefined ? prev.enabled : !!patch.enabled,
    provider,
    minDurationMinutes,
    suppressWhenForeground: patch.suppressWhenForeground === undefined ? prev.suppressWhenForeground !== false : !!patch.suppressWhenForeground,
  };
  saveStore();
  return store.notifications;
});
ipcMain.handle('notifications:telegram:save', (_e, data) => saveTelegramCredentials(data || {}));
ipcMain.handle('notifications:telegram:find-chat', () => findTelegramChat());
ipcMain.handle('notifications:kakao:connect', (_e, data) => beginKakaoConnection(data || {}));
ipcMain.handle('notifications:kakao:disconnect', async () => {
  const secrets = await readNotificationSecrets();
  const kakao = { ...(secrets.kakao || {}), accessToken: '', refreshToken: '', expiresAt: 0 };
  await writeNotificationSecrets({ kakao });
  return notificationState();
});
ipcMain.handle('notifications:test', () => testNotification());
ipcMain.handle('notifications:hooks:install', () => installNotificationHooks());
ipcMain.handle('notifications:hooks:remove', () => removeNotificationHooks());
ipcMain.handle('notifications:status-message', (_e, data) => { notifyRenderer(data || {}); return lastNotifyResult; });
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
  return { maxFullCardHeight: Math.max(180, Math.floor((workArea.height - 20) / zoom) - 14) };
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
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (bridgeServer) bridgeServer.close();
});

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
    if (store.notifications?.hooksInstalled) startAgentBridge().catch((error) => log('agent bridge start failed', error.message));
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
