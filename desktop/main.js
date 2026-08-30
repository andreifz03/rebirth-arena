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
ipcMain.handle('get-app-version', () => app.getVersion());

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

async function checkForUpdatesResilient({ manual = false } = {}) {
  if (!app.isPackaged) {
    if (manual) emitUpdate('dev');
    return { ok: false, reason: 'dev' };
  }
  const delays = manual ? [0, 2500] : [0, 5000, 12000];
  let lastError = null;
  for (let i = 0; i < delays.length; i++) {
    if (delays[i]) await new Promise(resolve => setTimeout(resolve, delays[i]));
    try {
      if (manual || i === 0) emitUpdate('checking');
      await autoUpdater.checkForUpdates();
      return { ok: true };
    } catch (e) {
      lastError = e;
      console.error(`Updater check attempt ${i + 1} failed:`, e.message);
    }
  }
  emitUpdate('error', { message: lastError?.message || 'Release channel unavailable' });
  return { ok: false, reason: lastError?.message || 'release-channel-unavailable' };
}

ipcMain.handle('check-for-updates', async () => checkForUpdatesResilient({ manual: true }));

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall(true, true);
  return true;
});

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.requestHeaders = {
    'User-Agent': `RebirthArena/${app.getVersion()}`,
    'Accept': 'application/vnd.github+json'
  };

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
      setTimeout(() => checkForUpdatesResilient({ manual: false }), 3200);
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
