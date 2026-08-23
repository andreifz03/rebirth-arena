const { app, BrowserWindow, ipcMain, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const https = require('https');

let mainWindow = null;

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

ipcMain.on('window-minimize', () => mainWindow?.minimize());
ipcMain.on('window-maximize', () => { if (!mainWindow) return; mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on('window-close', () => mainWindow?.close());

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

function emitUpdate(status, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...extra });
  }
}

ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    emitUpdate('dev');
    return { ok: false, reason: 'dev' };
  }
  try {
    emitUpdate('checking');
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (e) {
    emitUpdate('error', { message: e.message });
    return { ok: false, reason: e.message };
  }
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(true, true);
  return true;
});

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => emitUpdate('checking'));
  autoUpdater.on('update-available', info => {
    emitUpdate('available', { version: info.version });
  });
  autoUpdater.on('update-not-available', info => {
    emitUpdate('current', { version: info?.version || app.getVersion() });
  });
  autoUpdater.on('download-progress', p => {
    emitUpdate('downloading', {
      percent: Math.max(0, Math.min(100, Math.round(p.percent || 0))),
      transferred: p.transferred || 0,
      total: p.total || 0
    });
  });
  autoUpdater.on('update-downloaded', info => {
    emitUpdate('ready', { version: info.version });
  });
  autoUpdater.on('error', err => {
    console.error('Updater error:', err);
    emitUpdate('error', { message: err.message });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    backgroundColor: '#07090d',
    autoHideMenuBar: true,
    show: false,
    title: 'Rebirth Arena',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.center();
    mainWindow.show();

    if (app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 2200);
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  configureUpdater();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
