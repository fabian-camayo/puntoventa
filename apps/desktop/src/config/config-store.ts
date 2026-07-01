import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { APP_MODES, AppMode, DEFAULT_API_PORT } from '@puntoventa/shared';

export interface AppConfig {
  mode: AppMode;
  serverHost: string;
  serverPort: number;
  apiPort: number;
  isConfigured: boolean;
  branchId?: string;
  registerId?: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
}

const DEFAULT_CONFIG: AppConfig = {
  mode: APP_MODES.STANDALONE,
  serverHost: 'localhost',
  serverPort: DEFAULT_API_PORT,
  apiPort: DEFAULT_API_PORT,
  isConfigured: false,
  language: 'es',
  theme: 'system',
};

export class ConfigStore {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.config = this.load();
  }

  get(): AppConfig {
    return { ...this.config };
  }

  save(partial: Partial<AppConfig>): void {
    this.config = { ...this.config, ...partial };
    this.write();
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.write();
  }

  getApiUrl(): string {
    if (this.config.mode === APP_MODES.CLIENT) {
      return `http://${this.config.serverHost}:${this.config.serverPort}/api/v1`;
    }
    return `http://localhost:${this.config.apiPort}/api/v1`;
  }

  private load(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch {
      // Usar configuración por defecto
    }
    return { ...DEFAULT_CONFIG };
  }

  private write(): void {
    fs.mkdirSync(path.dirname(this.configPath), { recursive: true });
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }
}
