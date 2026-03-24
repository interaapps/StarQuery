import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('starqueryDesktop', {
  isElectron: true,
  getConfig: () => ipcRenderer.invoke('starquery:desktop-config:get'),
  setConfig: (config) => ipcRenderer.invoke('starquery:desktop-config:set', config),
  getLocalServerUrl: () => ipcRenderer.invoke('starquery:local-server:url'),
  pickSqliteFile: () => ipcRenderer.invoke('starquery:sqlite-file:pick'),
});
