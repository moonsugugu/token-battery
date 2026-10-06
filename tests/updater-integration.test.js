const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { NsisUpdater } = require('electron-updater');
const { NodeHttpExecutor } = require('builder-util/out/nodeHttpExecutor');
const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor');
const { createUpdater } = require('../updater');

test('real NSIS updater checks a feed, verifies downloads and recovers from checksum failure', async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'token-battery-feed-'));
  const bytes = Buffer.alloc(65536, 'installer fixture');
  const checksum = crypto.createHash('sha512').update(bytes).digest('base64');
  let version = '1.3.2';
  let corrupt = false;
  let downloads = 0;
  const server = http.createServer((request, response) => {
    if (request.url.startsWith('/latest.yml')) {
      response.end(`version: ${version}\nfiles:\n  - url: update.exe\n    sha512: ${checksum}\n    size: ${bytes.length}\npath: update.exe\nsha512: ${checksum}\n`);
    } else if (request.url.startsWith('/update.exe')) {
      downloads++;
      response.setHeader('Content-Length', bytes.length);
      response.end(corrupt ? Buffer.alloc(bytes.length, 'corrupted') : bytes);
    } else { response.writeHead(404); response.end(); }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  const configPath = path.join(dir, 'app-update.yml');
  fs.writeFileSync(configPath, `provider: generic\nurl: ${url}\nupdaterCacheDirName: test-updater\n`);
  const adapter = { version: '1.3.2', name: 'TestTokenBattery', isPackaged: true, appUpdateConfigPath: configPath, userDataPath: dir, baseCachePath: dir, whenReady: async () => {}, onQuit: () => { throw new Error('Automatic install must stay off'); } };
  const updater = new NsisUpdater(null, adapter);
  updater.httpExecutor = new NodeHttpExecutor();
  // Use the real updater download/checksum pipeline with Node's HTTP transport in CI.
  updater.httpExecutor.download = ElectronHttpExecutor.prototype.download.bind(updater.httpExecutor);
  updater.setFeedURL({ provider: 'generic', url });
  updater.disableDifferentialDownload = true;
  const controller = createUpdater({ updater, version: adapter.version, enabled: true });
  await controller.check();
  assert.equal(controller.getState().status, 'current', controller.getState().error);
  version = '1.3.1';
  await controller.check();
  assert.equal(controller.getState().status, 'current');
  version = '1.3.3';
  await controller.check();
  assert.equal(controller.getState().status, 'available');
  assert.equal(downloads, 0);
  corrupt = true;
  await controller.download();
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().retry, 'download');
  assert.match(controller.getState().error, /checksum/i);
  corrupt = false;
  await controller.download();
  assert.equal(controller.getState().status, 'downloaded');
  assert.equal(downloads, 2);
  assert.deepEqual(fs.readFileSync(updater.installerPath), bytes);
});
