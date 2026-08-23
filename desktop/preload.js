const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rebirthDesktop', {
  version: '1.0.2',
  platform: process.platform,
  getAgentArt: () => ipcRenderer.invoke('get-agent-art')
});
