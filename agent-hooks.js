const path = require('node:path');

function agentHookScriptPath(userData, platform) {
  return path.join(userData, 'hooks', platform === 'win32' ? 'agent-event.ps1' : 'agent-event.js');
}

function buildAgentHookScript(token, platform) {
  if (platform === 'win32') {
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
  Invoke-RestMethod -Method Post -Uri 'http://127.0.0.1:43192/agent-event' -Headers @{ Authorization = 'Bearer ${token}' } -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($payload)) -TimeoutSec 2 | Out-Null
} catch {}
exit 0
`;
  }

  if (platform !== 'darwin') throw new Error(`Unsupported hook platform: ${platform}`);
  return `const http = require('node:http');
const authorization = ${JSON.stringify(`Bearer ${token}`)};
const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  let event;
  try { event = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { return; }
  const sessionId = event.session_id || event.sessionId;
  if (!sessionId) return;
  const body = JSON.stringify({ service: process.argv[2], action: process.argv[3], sessionId });
  const request = http.request({
    hostname: '127.0.0.1', port: 43192, path: '/agent-event', method: 'POST', timeout: 2000,
    headers: { authorization, 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(body) },
  }, (response) => response.resume());
  request.on('error', () => {});
  request.on('timeout', () => request.destroy());
  request.end(body);
});
`;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function agentHookCommand({ platform, systemRoot, executable, scriptPath }, service, action) {
  if (platform === 'win32') {
    const powershell = path.win32.join(systemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    const quote = (value) => String(value).replace(/"/g, '\\"');
    return `"${quote(powershell)}" -NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "${quote(scriptPath)}" ${service} ${action}`;
  }
  if (platform !== 'darwin') throw new Error(`Unsupported hook platform: ${platform}`);
  return `ELECTRON_RUN_AS_NODE=1 ${[executable, scriptPath, service, action].map(shellQuote).join(' ')}`;
}

module.exports = { agentHookScriptPath, buildAgentHookScript, agentHookCommand };
