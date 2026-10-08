const { test } = require('node:test');
const assert = require('node:assert/strict');
const { agentHookScriptPath, buildAgentHookScript, agentHookCommand } = require('../agent-hooks');

test('Windows completion hook keeps using PowerShell and its existing local bridge format', () => {
  const script = buildAgentHookScript('bridge-token', 'win32');
  const command = agentHookCommand({ platform: 'win32', systemRoot: 'C:\\Windows', scriptPath: 'C:\\Users\\Me\\hooks\\agent-event.ps1' }, 'codex', 'start');
  assert.match(script, /127\.0\.0\.1:43192\/agent-event/);
  assert.match(command, /powershell\.exe.*agent-event\.ps1.*codex start/);
  assert.equal(agentHookScriptPath('C:\\Users\\Me\\AppData\\Roaming\\ai-usage-widget', 'win32').endsWith('agent-event.ps1'), true);
});

test('macOS completion hook invokes the packaged Node runtime with safely quoted paths', () => {
  const script = buildAgentHookScript("token-'quoted", 'darwin');
  const command = agentHookCommand({
    platform: 'darwin',
    executable: "/Applications/Token Battery.app/Contents/MacOS/TokenBattery",
    scriptPath: "/Users/O'Neil/Library/Application Support/TokenBattery/hooks/agent-event.js",
  }, 'codex', 'stop');
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /127\.0\.0\.1/);
  assert.ok(script.includes(JSON.stringify("Bearer token-'quoted")));
  assert.match(command, /^ELECTRON_RUN_AS_NODE=1 '/);
  assert.match(command, /Token Battery\.app/);
  assert.match(command, /O'\\''Neil/);
  assert.match(command, /'codex' 'stop'$/);
});

test('completion hooks reject platforms without a supported command runner', () => {
  assert.throws(() => buildAgentHookScript('token', 'linux'), /Unsupported hook platform/);
});
