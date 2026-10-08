// Keep the update lifecycle independent of Electron so failures/retries can be tested.
const RELEASES_URL = 'https://github.com/moonsugugu/token-battery/releases/latest';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

function createUpdater({ updater, version, enabled, onState = () => {}, notify = () => {}, beforeInstall = async () => {}, log = () => {} }) {
  let state = { status: enabled ? 'idle' : 'disabled', currentVersion: version, version: null, progress: 0, error: '', releasesUrl: RELEASES_URL };
  let checking = null;
  let downloading = null;
  let installing = false;
  let timer;
  let startup;
  const notified = new Set();
  const getState = () => ({ ...state });
  const setState = (patch) => { state = { ...state, ...patch }; onState(getState()); };
  const fail = (error) => {
    const retry = state.status === 'error' ? state.retry : ({ downloading: 'download', installing: 'install' }[state.status] || 'check');
    log('update failed', error.message);
    setState({ status: 'error', retry, error: String(error.message || error) });
  };
  const announce = (info, downloaded) => {
    const key = `${info.version}:${downloaded}`;
    if (notified.has(key)) return;
    notified.add(key);
    notify(info.version, downloaded);
  };
  if (enabled) {
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = false;
    updater.disableWebInstaller = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.logger = { info: (...args) => log('updater', ...args), warn: (...args) => log('updater', ...args), error: (...args) => log('updater', ...args), debug: () => {} };
    updater.on('checking-for-update', () => setState({ status: 'checking', error: '' }));
    updater.on('update-available', (info) => {
      setState({ status: 'available', version: info.version, progress: 0, error: '' });
      announce(info, false);
    });
    updater.on('update-not-available', () => setState({ status: 'current', version: null, progress: 0, error: '' }));
    updater.on('download-progress', (info) => setState({ status: 'downloading', progress: Math.max(0, Math.min(100, Math.round(info.percent))), error: '' }));
    updater.on('update-downloaded', (info) => {
      setState({ status: 'downloaded', version: info.version, progress: 100, error: '' });
      announce(info, true);
    });
    updater.on('error', fail);
  }
  const check = () => {
    if (!enabled || downloading || installing || ['downloaded', 'installing'].includes(state.status) || (state.status === 'error' && state.retry === 'install')) return Promise.resolve(getState());
    if (checking) return checking;
    checking = Promise.resolve().then(() => updater.checkForUpdates()).catch(fail).then(getState).finally(() => { checking = null; });
    return checking;
  };
  const download = () => {
    if (downloading) return downloading;
    if (!enabled || checking || !state.version || !(state.status === 'available' || (state.status === 'error' && state.retry === 'download'))) return Promise.resolve(getState());
    setState({ status: 'downloading', progress: 0, error: '' });
    downloading = Promise.resolve().then(() => updater.downloadUpdate()).catch(fail).then(getState).finally(() => { downloading = null; });
    return downloading;
  };
  const install = async () => {
    if (!enabled || installing || !(state.status === 'downloaded' || (state.status === 'error' && state.retry === 'install'))) return getState();
    installing = true;
    setState({ status: 'installing', error: '' });
    try {
      await beforeInstall();
      // electron-updater 6 uses positional arguments: show installer, then reopen app.
      updater.quitAndInstall(false, true);
    } catch (error) {
      fail(error);
    } finally { installing = false; }
    return getState();
  };
  return {
    getState, check, download, install,
    start() {
      if (!enabled || timer) return;
      startup = setTimeout(check, 15000);
      timer = setInterval(check, CHECK_INTERVAL);
      startup.unref?.(); timer.unref?.();
    },
    stop() { clearTimeout(startup); clearInterval(timer); timer = null; },
  };
}
module.exports = { createUpdater, RELEASES_URL, CHECK_INTERVAL };
