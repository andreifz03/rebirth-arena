const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rebirthDesktop', {
  version: '1.0.5',
  platform: process.platform,
  getAgentArt: () => ipcRenderer.invoke('get-agent-art'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  }
});
