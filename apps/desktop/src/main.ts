import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  nativeTheme,
} from 'electron';
import * as path from 'path';
import { BackendManager } from './backend/backend-manager';
import { ConfigStore } from './config/config-store';
import { ServerDiscovery } from './network/server-discovery';
import { APP_MODES, AppMode } from '@puntoventa/shared';

let mainWindow: BrowserWindow | null = null;
const backendManager = new BackendManager();
const configStore = new ConfigStore();
const serverDiscovery = new ServerDiscovery();

const isDev = !app.isPackaged;

async function createWindow(): Promise<void> {
  const config = configStore.get();

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    title: 'PuntoVenta',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.maximize();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  if (isDev) {
    await mainWindow.loadURL('http://localhost:4200');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    const indexPath = path.join(process.resourcesPath, 'www', 'index.html');
    await mainWindow.loadFile(indexPath);
  }
}

async function initializeBackend(): Promise<void> {
  const config = configStore.get();
  const mode = config.mode as AppMode;

  if (mode === APP_MODES.SERVER || mode === APP_MODES.STANDALONE) {
    await backendManager.start();
    if (mode === APP_MODES.SERVER) {
      serverDiscovery.startAdvertising(config.apiPort);
    }
  }
}

app.whenReady().then(async () => {
  await initializeBackend();
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', async () => {
  await backendManager.stop();
  serverDiscovery.stop();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  await backendManager.stop();
  serverDiscovery.stop();
});

// ─── IPC Handlers ───────────────────────────────────────────────────────────

ipcMain.handle('app:getConfig', () => configStore.get());

ipcMain.handle('app:saveConfig', (_event, config: Record<string, unknown>) => {
  configStore.save(config);
  return configStore.get();
});

ipcMain.handle('app:getMode', () => configStore.get().mode);

ipcMain.handle('app:setMode', async (_event, mode: AppMode) => {
  configStore.set('mode', mode);
  if (mode === APP_MODES.SERVER || mode === APP_MODES.STANDALONE) {
    await backendManager.start();
  } else {
    await backendManager.stop();
  }
  return configStore.get();
});

ipcMain.handle('app:getApiUrl', () => configStore.getApiUrl());

ipcMain.handle('app:isBackendRunning', () => backendManager.isRunning());

ipcMain.handle('app:getTheme', () => nativeTheme.shouldUseDarkColors ? 'dark' : 'light');

ipcMain.handle('discovery:findServers', () => serverDiscovery.findServers());

ipcMain.handle('discovery:testConnection', async (_event, host: string, port: number) => {
  return serverDiscovery.testConnection(host, port);
});

ipcMain.handle('shell:openExternal', (_event, url: string) => {
  return shell.openExternal(url);
});
