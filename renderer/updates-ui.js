(() => {
  let updateState;
  function renderUpdates() {
    if (!updateState) return;
    const s = updateState;
    const ready = ['available', 'downloading', 'downloaded', 'installing'].includes(s.status) || (s.status === 'error' && s.version);
    document.body.classList.toggle('update-ready', !!ready);
    for (const button of document.querySelectorAll('[data-go="settings"], #btnSettings, #taskbarCard')) {
      button.title = ready ? t('updateAvailable', { v: s.version }) : t(button.dataset.i18nTitle);
    }
    $('appVersion').textContent = `v${s.currentVersion}`;
    const key = { idle: 'updateIdle', checking: 'updateChecking', current: 'updateCurrent', available: 'updateAvailable', downloading: 'updateDownloading', downloaded: 'updateDownloaded', installing: 'updateInstalling', disabled: 'updateDisabled', error: 'updateError' }[s.status] || 'updateIdle';
    const message = t(key, { v: s.version || '', n: s.progress || 0 });
    $('updateStatus').textContent = message;
    // Technical diagnostics are available on hover; keep the normal flow actionable.
    $('updateStatus').title = s.error || '';
    $('updateBannerText').textContent = t('updateAvailable', { v: s.version || '' });
    $('updateBanner').classList.toggle('hidden', !ready || !$('settings').classList.contains('hidden'));
    $('btnCheckUpdate').disabled = ['checking', 'downloading', 'downloaded', 'installing', 'disabled'].includes(s.status) || (s.status === 'error' && s.retry === 'install');
    $('btnDownloadUpdate').classList.toggle('hidden', !(s.status === 'available' || (s.status === 'error' && s.retry === 'download')));
    $('btnInstallUpdate').classList.toggle('hidden', !(s.status === 'downloaded' || (s.status === 'error' && s.retry === 'install')));
    $('updateProgress').classList.toggle('hidden', s.status !== 'downloading');
    $('updateProgress').value = s.progress || 0;
    fit();
  }
  window.renderUpdates = renderUpdates;
  const receive = (state) => { if (state) { updateState = state; renderUpdates(); } };
  async function act(action) {
    try { receive(await action()); }
    catch { $('updateStatus').textContent = t('updateError'); }
  }
  $('btnCheckUpdate').onclick = () => act(() => W.checkForUpdates());
  $('btnDownloadUpdate').onclick = () => act(() => W.downloadUpdate());
  $('btnInstallUpdate').onclick = () => act(() => W.installUpdate());
  $('btnUpdateReleases').onclick = () => W.openUrl(updateState?.releasesUrl || 'https://github.com/moonsugugu/token-battery/releases/latest');
  $('btnUpdateBanner').onclick = async () => { await openSettings(); $('updatePanel').scrollIntoView({ block: 'nearest' }); };
  W.onUpdateState(receive);
  W.onOpenUpdates(() => $('btnUpdateBanner').click());
  W.getUpdateState().then(receive).catch(() => {});
})();
