/// <reference types="electron" />

import { AppConfigDto, AppMode } from '@puntoventa/shared';

export interface ElectronAPI {
  getConfig: () => Promise<AppConfigDto>;
  saveConfig: (config: Partial<AppConfigDto>) => Promise<AppConfigDto>;
  getMode: () => Promise<AppMode>;
  setMode: (mode: AppMode) => Promise<AppConfigDto>;
  getApiUrl: () => Promise<string>;
  isBackendRunning: () => Promise<boolean>;
  getTheme: () => Promise<'light' | 'dark'>;
  findServers: () => Promise<Array<{ host: string; port: number; name: string }>>;
  testConnection: (host: string, port: number) => Promise<{ success: boolean; message: string }>;
  openExternal: (url: string) => Promise<void>;
  platform: string;
  isElectron: boolean;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

export {};
