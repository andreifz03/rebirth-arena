const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const https = require('https');

function getJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'RebirthArena/1.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(getJson(res.headers.location));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

ipcMain.handle('get-agent-art', async () => {
  try {
    const json = await getJson('https://valorant-api.com/v1/agents?isPlayableCharacter=true');
    const art = {};
    for (const agent of (json.data || [])) {
      art[agent.displayName] = agent.fullPortraitV2 || agent.fullPortrait || agent.displayIcon || '';
    }
    return art;
  } catch (e) {
    console.error('Failed to load agent artwork:', e);
    return {};
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#070a10',
    autoHideMenuBar: true,
    show: false,
    title: 'Rebirth Arena',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  win.loadFile('index.html');
  win.once('ready-to-show', () => {
    win.center();
    win.show();
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
