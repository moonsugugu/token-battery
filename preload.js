const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('widget', {
  getUsage: () => ipcRenderer.invoke('usage:get'),
  getStore: () => ipcRenderer.invoke('store:get'),
  setStore: (patch) => ipcRenderer.invoke('store:set', patch),
  claudeLogin: () => ipcRenderer.invoke('claude:login'),
  openUrl: (url) => ipcRenderer.invoke('open:url', url),
  hide: () => ipcRenderer.invoke('win:hide'),
  setOpacity: (v) => ipcRenderer.invoke('win:opacity', v),
  fitSize: (w, h, anchor) => ipcRenderer.invoke('win:fitSize', w, h, anchor),
  setZoom: (z) => ipcRenderer.invoke('win:zoom', z),
  onNear: (cb) => ipcRenderer.on('near', (_e, v) => cb(v)),
  autostart: (on) => ipcRenderer.invoke('app:autostart', on),
  onRefresh: (cb) => ipcRenderer.on('refresh-now', cb),
  setTrayLabels: (labels) => ipcRenderer.invoke('tray:labels', labels),
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  setHotkeys: (hk) => ipcRenderer.invoke('hotkeys:set', hk),
  suspendHotkeys: () => ipcRenderer.invoke('hotkeys:suspend'),
  hotkeyStatus: () => ipcRenderer.invoke('hotkeys:status'),
  onHotkey: (cb) => ipcRenderer.on('hotkey', (_e, name, wasVisible) => cb(name, wasVisible)),
});
