const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopCutout', {
  status: () => ipcRenderer.invoke('cutout:status'),
  chooseInstall: () => ipcRenderer.invoke('cutout:choose-install'),
  installPaths: () => ipcRenderer.invoke('cutout:install-paths'),
  start: (request) => ipcRenderer.invoke('cutout:start', request),
});
