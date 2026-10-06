const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdater } = require('../updater');

function fixture(options = {}) {
  const updater = new EventEmitter();
  const calls = { checks: 0, downloads: 0, installs: [], notices: [], saved: false };
  updater.checkForUpdates = async () => { calls.checks++; updater.emit('checking-for-update'); updater.emit('update-available', { version: '1.3.3' }); };
  updater.downloadUpdate = async () => { calls.downloads++; updater.emit('download-progress', { percent: 54.4 }); updater.emit('update-downloaded', { version: '1.3.3' }); };
  updater.quitAndInstall = (...args) => { assert.equal(calls.saved, true); calls.installs.push(args); };
  const controller = createUpdater({ updater, version: '1.3.2', enabled: true, notify: (...args) => calls.notices.push(args), beforeInstall: async () => { calls.saved = true; }, ...options });
  return { updater, controller, calls };
}
test('updates notify, download only on request, save before explicit restart/install', async () => {
  const { controller, updater, calls } = fixture();
  assert.equal(updater.autoDownload, false);
  assert.equal(updater.autoInstallOnAppQuit, false);
  assert.equal(updater.allowPrerelease, false);
  assert.equal(updater.allowDowngrade, false);
  await controller.check();
  assert.equal(controller.getState().status, 'available');
  assert.equal(calls.downloads, 0);
  await controller.install();
  assert.equal(calls.installs.length, 0);
  await controller.download();
  assert.equal(controller.getState().status, 'downloaded');
  await controller.check(); // never discard an already downloaded update
  assert.equal(calls.checks, 1);
  assert.equal(calls.installs.length, 0);
  await controller.install();
  assert.deepEqual(calls.installs, [[false, true]]);
  assert.deepEqual(calls.notices, [['1.3.3', false], ['1.3.3', true]]);
});
test('polls and manual clicks share one in-flight check and one notice per version', async () => {
  const { controller, calls } = fixture();
  await Promise.all([controller.check(), controller.check(), controller.check()]);
  assert.equal(calls.checks, 1);
  await controller.check();
  assert.equal(calls.notices.length, 1);
});
test('network errors remain recoverable; stale versions cannot be downloaded after a failed check', async () => {
  const { controller, updater, calls } = fixture();
  await controller.check();
  updater.checkForUpdates = async () => { updater.emit('checking-for-update'); throw new Error('offline'); };
  await controller.check();
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().retry, 'check');
  await controller.download();
  assert.equal(calls.downloads, 0);
  updater.checkForUpdates = async () => updater.emit('update-not-available');
  await controller.check();
  assert.equal(controller.getState().status, 'current');
  assert.equal(controller.getState().version, null);
});
test('failed download can be retried and concurrent clicks share one transfer', async () => {
  const { controller, updater, calls } = fixture();
  await controller.check();
  const goodDownload = updater.downloadUpdate;
  updater.downloadUpdate = async () => { throw new Error('checksum mismatch'); };
  await controller.download();
  assert.equal(controller.getState().retry, 'download');
  assert.equal(calls.installs.length, 0);
  updater.downloadUpdate = goodDownload;
  await Promise.all([controller.download(), controller.download()]);
  assert.equal(calls.downloads, 1);
  assert.equal(controller.getState().status, 'downloaded');
});
test('download blocks timer checks while the transfer is active', async () => {
  const { controller, updater, calls } = fixture();
  await controller.check();
  let finish;
  updater.downloadUpdate = () => new Promise((resolve) => { finish = resolve; });
  const pending = controller.download();
  await Promise.resolve();
  await controller.check();
  assert.equal(calls.checks, 1);
  updater.emit('update-downloaded', { version: '1.3.3' });
  finish();
  await pending;
});
test('installer failure is retryable and never triggers a second download', async () => {
  const { controller, updater, calls } = fixture();
  await controller.check(); await controller.download();
  const goodInstall = updater.quitAndInstall;
  updater.quitAndInstall = () => { throw new Error('installer unavailable'); };
  await controller.install();
  assert.equal(controller.getState().retry, 'install');
  updater.quitAndInstall = goodInstall;
  await controller.install();
  assert.equal(calls.installs.length, 1);
  assert.equal(calls.downloads, 1);
});
test('development and unsupported platforms never access a feed or install', async () => {
  const { controller, calls } = fixture({ enabled: false });
  controller.start(); controller.stop();
  await controller.check(); await controller.download(); await controller.install();
  assert.equal(controller.getState().status, 'disabled');
  assert.equal(calls.checks + calls.downloads + calls.installs.length, 0);
});
