const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rebirthDesktop', {
  version: '2.0.3',
  platform: process.platform,
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAgentArt: () => ipcRenderer.invoke('get-agent-art'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  minimizeWindow: () => ipcRenderer.send('window-minimize'),
  maximizeWindow: () => ipcRenderer.send('window-maximize'),
  closeWindow: () => ipcRenderer.send('window-close'),
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  }
});
