import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import started from 'electron-squirrel-startup';
import { startBackendServer } from '../../backend/src/server.ts';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const appDataPath = app.getPath('appData');
const stableUserDataPath = path.join(appDataPath, 'StarQuery');
const legacyUserDataPaths = [
  path.join(appDataPath, 'star-query'),
  path.join(appDataPath, 'Electron'),
];

if (!fs.existsSync(stableUserDataPath)) {
  const legacyPath = legacyUserDataPaths.find((candidate) => fs.existsSync(candidate));
  if (legacyPath) {
    fs.mkdirSync(stableUserDataPath, { recursive: true });
    fs.cpSync(legacyPath, stableUserDataPath, { recursive: true, force: false, errorOnExist: false });
  }
}

app.setName('StarQuery');
app.setPath('userData', stableUserDataPath);

const getDesktopConfigPath = () => path.join(app.getPath('userData'), 'starquery-desktop.json');
const getLocalMetaStorePath = () => path.join(app.getPath('userData'), 'backend', 'starquery-meta.sqlite');

let localBackend = null;
let isQuitting = false;

const readDesktopConfig = () => {
  const filePath = getDesktopConfigPath();

  if (!fs.existsSync(filePath)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return {};
  }
};

const writeDesktopConfig = (config) => {
  const filePath = getDesktopConfigPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2));
};

const getWindowIconPath = () => path.join(__dirname, '../images/128x128.png');

const hasRunningLocalBackend = () => Boolean(localBackend?.server?.listening);

const startLocalBackend = async () => {
  if (hasRunningLocalBackend()) {
    return localBackend;
  }

  if (localBackend) {
    try {
      await localBackend.close();
    } catch (error) {
      console.error('Failed to clean up stale local StarQuery backend', error);
    } finally {
      localBackend = null;
    }
  }

  localBackend = await startBackendServer({
    host: '127.0.0.1',
    port: 0,
    serverName: 'Local Computer',
    mode: 'local',
    metaStore: {
      driver: 'sqlite',
      sqlitePath: getLocalMetaStorePath(),
    },
  });

  return localBackend;
};

const createWindow = async () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    icon: getWindowIconPath(),
    width: 1280,
    height: 720,
    ...(process.platform === 'darwin' ?
        {
          vibrancy: 'sidebar',
        visualEffectState: 'active',
        transparent: true
      } : {}),

    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default'
  });

  mainWindow.webContents.on("did-finish-load", () => {
    const electronClasses = ['electron'];
    if (process.platform === 'darwin') {
      electronClasses.push('electron-mac');
    }

    mainWindow.webContents.executeJavaScript(`
      document.documentElement.classList.add(${electronClasses.map((value) => JSON.stringify(value)).join(', ')});
    `);
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();
};

app.whenReady().then(async () => {
  try {
    await startLocalBackend();
  } catch (error) {
    console.error('Failed to start local StarQuery backend', error);
  }

  ipcMain.handle('starquery:desktop-config:get', () => readDesktopConfig());
  ipcMain.handle('starquery:desktop-config:set', (_event, config) => {
    writeDesktopConfig(config);
    return { ok: true };
  });
  ipcMain.handle('starquery:local-server:url', async () => {
    try {
      await startLocalBackend();
    } catch (error) {
      console.error('Failed to provide local backend URL', error);
      return null;
    }

    return localBackend?.url ?? null;
  });
  ipcMain.handle('starquery:sqlite-file:pick', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'SQLite Databases', extensions: ['sqlite', 'sqlite3', 'db', 'db3'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    return result.canceled ? null : (result.filePaths[0] ?? null);
  });

  await createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('before-quit', (event) => {
  if (isQuitting) {
    return;
  }

  isQuitting = true;
  event.preventDefault();

  Promise.resolve(localBackend?.close())
    .catch((error) => {
      console.error('Failed to stop local StarQuery backend', error);
    })
    .finally(() => {
      localBackend = null;
      app.quit();
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
