import { contextBridge, ipcRenderer } from 'electron';
import { AppMode } from '@puntoventa/shared';

export interface ElectronAPI {
  getConfig: () => Promise<Record<string, unknown>>;
  saveConfig: (config: Record<string, unknown>) => Promise<Record<string, unknown>>;
  getMode: () => Promise<AppMode>;
  setMode: (mode: AppMode) => Promise<Record<string, unknown>>;
  getApiUrl: () => Promise<string>;
  isBackendRunning: () => Promise<boolean>;
  getTheme: () => Promise<'light' | 'dark'>;
  findServers: () => Promise<Array<{ host: string; port: number; name: string }>>;
  testConnection: (host: string, port: number) => Promise<{ success: boolean; message: string }>;
  openExternal: (url: string) => Promise<void>;
  platform: string;
  isElectron: boolean;
}

const electronAPI: ElectronAPI = {
  getConfig: () => ipcRenderer.invoke('app:getConfig'),
  saveConfig: (config) => ipcRenderer.invoke('app:saveConfig', config),
  getMode: () => ipcRenderer.invoke('app:getMode'),
  setMode: (mode) => ipcRenderer.invoke('app:setMode', mode),
  getApiUrl: () => ipcRenderer.invoke('app:getApiUrl'),
  isBackendRunning: () => ipcRenderer.invoke('app:isBackendRunning'),
  getTheme: () => ipcRenderer.invoke('app:getTheme'),
  findServers: () => ipcRenderer.invoke('discovery:findServers'),
  testConnection: (host, port) => ipcRenderer.invoke('discovery:testConnection', host, port),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  platform: process.platform,
  isElectron: true,
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
