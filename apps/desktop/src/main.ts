import {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  nativeTheme,
} from 'electron';
import * as path from 'path';
import { BackendManager } from './backend/backend-manager';
import { ConfigStore, AppConfig } from './config/config-store';
import { ServerDiscovery } from './network/server-discovery';
import { APP_MODES, AppMode } from '@puntoventa/shared';

// Ruta estable en producción: %APPDATA%\PuntoVenta (así el instalador NSIS puede escribir el mismo .env)
if (app.isPackaged) {
  app.setPath('userData', path.join(app.getPath('appData'), 'PuntoVenta'));
}

let mainWindow: BrowserWindow | null = null;
const backendManager = new BackendManager();
let configStore: ConfigStore;
const serverDiscovery = new ServerDiscovery();

const isDev = !app.isPackaged;

async function createWindow(): Promise<void> {
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

  if (mode !== APP_MODES.SERVER && mode !== APP_MODES.STANDALONE) {
    return;
  }

  if (!configStore.canStartLocalBackend()) {
    console.log(
      '[BackendManager] Esperando configuración de MySQL/JWT antes de iniciar la API',
    );
    return;
  }

  try {
    await backendManager.start(configStore.getRuntimeEnv());
    if (mode === APP_MODES.SERVER) {
      serverDiscovery.startAdvertising(config.apiPort);
    }
  } catch (err) {
    console.error('[BackendManager] No se pudo iniciar la API:', err);
  }
}

app.whenReady().then(async () => {
  configStore = new ConfigStore();
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

ipcMain.handle('app:getConfig', () => configStore.getPublic());

ipcMain.handle('app:getEnvPath', () => configStore.getEnvPath());

ipcMain.handle('app:saveConfig', async (_event, config: Partial<AppConfig>) => {
  configStore.save(config);

  const mode = configStore.get().mode as AppMode;
  if (
    (mode === APP_MODES.SERVER || mode === APP_MODES.STANDALONE) &&
    configStore.canStartLocalBackend()
  ) {
    try {
      if (backendManager.isRunning()) {
        await backendManager.restart(configStore.getRuntimeEnv());
      } else {
        await backendManager.start(configStore.getRuntimeEnv());
      }
      if (mode === APP_MODES.SERVER) {
        serverDiscovery.startAdvertising(configStore.get().apiPort);
      }
    } catch (err) {
      console.error('[BackendManager] Error al (re)iniciar API tras guardar config:', err);
      return {
        ...configStore.getPublic(),
        backendError: err instanceof Error ? err.message : String(err),
      };
    }
  }

  return configStore.getPublic();
});

ipcMain.handle('app:getMode', () => configStore.get().mode);

ipcMain.handle('app:setMode', async (_event, mode: AppMode) => {
  configStore.set('mode', mode);
  if (mode === APP_MODES.SERVER || mode === APP_MODES.STANDALONE) {
    if (configStore.canStartLocalBackend()) {
      try {
        if (backendManager.isRunning()) {
          await backendManager.restart(configStore.getRuntimeEnv());
        } else {
          await backendManager.start(configStore.getRuntimeEnv());
        }
      } catch (err) {
        console.error('[BackendManager] Error al iniciar API:', err);
      }
    }
  } else {
    await backendManager.stop();
  }
  return configStore.getPublic();
});

ipcMain.handle('app:getApiUrl', () => configStore.getApiUrl());

ipcMain.handle('app:isBackendRunning', () => backendManager.isRunning());

ipcMain.handle('app:getTheme', () => (nativeTheme.shouldUseDarkColors ? 'dark' : 'light'));

ipcMain.handle('discovery:findServers', () => serverDiscovery.findServers());

ipcMain.handle('discovery:testConnection', async (_event, host: string, port: number) => {
  return serverDiscovery.testConnection(host, port);
});

ipcMain.handle('shell:openExternal', (_event, url: string) => {
  return shell.openExternal(url);
});
