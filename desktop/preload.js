const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rebirthDesktop', {
  version: '1.0.4',
  platform: process.platform,
  getAgentArt: () => ipcRenderer.invoke('get-agent-art'),
  onUpdateStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-status', handler);
    return () => ipcRenderer.removeListener('update-status', handler);
  }
});
