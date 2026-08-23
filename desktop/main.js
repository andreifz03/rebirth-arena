const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
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

function sendUpdateStatus(status, extra = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update-status', { status, ...extra });
  }
}

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => sendUpdateStatus('checking'));
  autoUpdater.on('update-available', info => {
    sendUpdateStatus('available', { version: info.version });
  });
  autoUpdater.on('update-not-available', () => sendUpdateStatus('current'));
  autoUpdater.on('download-progress', progress => {
    sendUpdateStatus('downloading', { percent: Math.round(progress.percent || 0) });
  });
  autoUpdater.on('update-downloaded', async info => {
    sendUpdateStatus('ready', { version: info.version });

    const result = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      buttons: ['Restart & Update', 'Later'],
      defaultId: 0,
      cancelId: 1,
      title: 'Rebirth Arena Update',
      message: `Rebirth Arena ${info.version} is ready.`,
      detail: 'Restart now to install the update.'
    });

    if (result.response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });
  autoUpdater.on('error', err => {
    console.error('Updater error:', err);
    sendUpdateStatus('error');
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
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

  mainWindow.loadFile('index.html');
  mainWindow.once('ready-to-show', () => {
    mainWindow.center();
    mainWindow.show();

    // Updater only works from an installed/packaged app.
    if (app.isPackaged) {
      setTimeout(() => autoUpdater.checkForUpdates(), 2500);
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
