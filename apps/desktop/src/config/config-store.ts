import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
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
  /** MySQL */
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  jwtRefreshExpiresIn: string;
}

const DEFAULT_CONFIG: AppConfig = {
  mode: APP_MODES.STANDALONE,
  serverHost: 'localhost',
  serverPort: DEFAULT_API_PORT,
  apiPort: DEFAULT_API_PORT,
  isConfigured: false,
  language: 'es',
  theme: 'system',
  dbHost: 'localhost',
  dbPort: 3306,
  dbUser: 'root',
  dbPassword: '',
  dbName: 'puntoventa',
  jwtSecret: '',
  jwtExpiresIn: '8h',
  jwtRefreshExpiresIn: '7d',
};

export class ConfigStore {
  private configPath: string;
  private envPath: string;
  private config: AppConfig;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.envPath = path.join(userDataPath, '.env');
    this.config = this.load();
    this.mergeInstallerEnvIfNeeded();
    this.ensureJwtSecret();
  }

  getEnvPath(): string {
    return this.envPath;
  }

  get(): AppConfig {
    return { ...this.config };
  }

  /** Config segura para el renderer (sin password completo si no hace falta editar). */
  getPublic(): AppConfig & { databaseUrl?: string; hasDatabasePassword: boolean } {
    return {
      ...this.config,
      dbPassword: this.config.dbPassword ? '********' : '',
      hasDatabasePassword: !!this.config.dbPassword,
      databaseUrl: this.hasDatabaseConfig() ? this.buildDatabaseUrl() : undefined,
    };
  }

  save(partial: Partial<AppConfig>): void {
    const next = { ...partial };
    // Evitar sobrescribir password con placeholder del UI
    if (next.dbPassword === '********') {
      delete next.dbPassword;
    }
    this.config = { ...this.config, ...next };
    if (!this.config.jwtSecret) {
      this.config.jwtSecret = this.generateJwtSecret();
    }
    this.write();
    this.writeEnvFile();
  }

  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.config[key] = value;
    this.write();
    this.writeEnvFile();
  }

  getApiUrl(): string {
    if (this.config.mode === APP_MODES.CLIENT) {
      return `http://${this.config.serverHost}:${this.config.serverPort}/api/v1`;
    }
    return `http://localhost:${this.config.apiPort}/api/v1`;
  }

  hasDatabaseConfig(): boolean {
    return !!(
      this.config.dbHost &&
      this.config.dbUser &&
      this.config.dbName &&
      this.config.dbPort
    );
  }

  /** Listo para arrancar API local (STANDALONE/SERVER). */
  canStartLocalBackend(): boolean {
    return (
      this.hasDatabaseConfig() &&
      !!this.config.jwtSecret &&
      (this.config.mode === APP_MODES.STANDALONE || this.config.mode === APP_MODES.SERVER)
    );
  }

  buildDatabaseUrl(): string {
    const user = encodeURIComponent(this.config.dbUser);
    const pass = encodeURIComponent(this.config.dbPassword);
    const host = this.config.dbHost;
    const port = this.config.dbPort;
    const name = this.config.dbName;
    return `mysql://${user}:${pass}@${host}:${port}/${name}`;
  }

  /** Variables de entorno para el proceso NestJS. */
  getRuntimeEnv(): Record<string, string> {
    if (!this.config.jwtSecret) {
      this.config.jwtSecret = this.generateJwtSecret();
      this.write();
      this.writeEnvFile();
    }

    return {
      DATABASE_URL: this.buildDatabaseUrl(),
      API_PORT: String(this.config.apiPort),
      API_HOST: '0.0.0.0',
      NODE_ENV: app.isPackaged ? 'production' : 'development',
      JWT_SECRET: this.config.jwtSecret,
      JWT_EXPIRES_IN: this.config.jwtExpiresIn || '8h',
      JWT_REFRESH_EXPIRES_IN: this.config.jwtRefreshExpiresIn || '7d',
      APP_MODE: this.config.mode,
      SERVER_HOST: this.config.serverHost,
      SERVER_PORT: String(this.config.serverPort),
    };
  }

  writeEnvFile(): void {
    if (!this.hasDatabaseConfig()) return;

    const lines = [
      `# Generado por PuntoVenta — no editar a mano salvo que sepas lo que haces`,
      `DATABASE_URL="${this.buildDatabaseUrl()}"`,
      `DB_HOST=${this.config.dbHost}`,
      `DB_PORT=${this.config.dbPort}`,
      `DB_USER=${this.config.dbUser}`,
      `DB_PASSWORD=${this.config.dbPassword}`,
      `DB_NAME=${this.config.dbName}`,
      `API_PORT=${this.config.apiPort}`,
      `API_HOST=0.0.0.0`,
      `NODE_ENV=${app.isPackaged ? 'production' : 'development'}`,
      `JWT_SECRET=${this.config.jwtSecret || this.generateJwtSecret()}`,
      `JWT_EXPIRES_IN=${this.config.jwtExpiresIn || '8h'}`,
      `JWT_REFRESH_EXPIRES_IN=${this.config.jwtRefreshExpiresIn || '7d'}`,
      `APP_MODE=${this.config.mode}`,
      `SERVER_HOST=${this.config.serverHost}`,
      `SERVER_PORT=${this.config.serverPort}`,
      '',
    ];

    fs.mkdirSync(path.dirname(this.envPath), { recursive: true });
    fs.writeFileSync(this.envPath, lines.join('\n'), 'utf-8');
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

  private ensureJwtSecret(): void {
    if (this.config.jwtSecret) return;
    if (!this.hasDatabaseConfig()) return;
    this.config.jwtSecret = this.generateJwtSecret();
    this.write();
    this.writeEnvFile();
  }

  /**
   * Importa .env de AppData o installer.env junto al .exe (NSIS).
   */
  private mergeInstallerEnvIfNeeded(): void {
    const candidates = [this.envPath, this.getInstallerEnvPath()].filter(
      (p): p is string => !!p && fs.existsSync(p),
    );

    if (candidates.length === 0) return;

    let changed = false;

    for (const envFile of candidates) {
      try {
        const envMap = this.parseEnvFile(fs.readFileSync(envFile, 'utf-8'));
        if (this.applyEnvMap(envMap)) {
          changed = true;
        }
      } catch {
        // ignore parse errors
      }
    }

    if (changed) {
      this.write();
      // Materializar .env en userData si solo había installer.env
      if (this.hasDatabaseConfig()) {
        this.writeEnvFile();
      }
    }
  }

  private getInstallerEnvPath(): string | null {
    try {
      // $INSTDIR\installer.env (al lado del ejecutable)
      const besideExe = path.join(path.dirname(process.execPath), 'installer.env');
      if (fs.existsSync(besideExe)) return besideExe;
      if (app.isPackaged) {
        const besideResources = path.join(process.resourcesPath, '..', 'installer.env');
        if (fs.existsSync(besideResources)) return besideResources;
      }
    } catch {
      // ignore
    }
    return null;
  }

  private applyEnvMap(envMap: Record<string, string>): boolean {
    let changed = false;

    if (envMap['DB_HOST'] || envMap['DB_USER'] || envMap['DB_NAME']) {
      if (envMap['DB_HOST'] && !this.config.isConfigured) {
        this.config.dbHost = envMap['DB_HOST'];
        changed = true;
      }
      if (envMap['DB_PORT']) {
        this.config.dbPort = Number(envMap['DB_PORT']) || this.config.dbPort;
        changed = true;
      }
      if (envMap['DB_USER'] && !this.config.isConfigured) {
        this.config.dbUser = envMap['DB_USER'];
        changed = true;
      }
      if (envMap['DB_PASSWORD'] !== undefined && !this.config.dbPassword) {
        this.config.dbPassword = envMap['DB_PASSWORD'];
        changed = true;
      }
      if (envMap['DB_NAME'] && !this.config.isConfigured) {
        this.config.dbName = envMap['DB_NAME'];
        changed = true;
      }
    } else if (envMap['DATABASE_URL'] && !this.config.dbPassword) {
      const parsed = this.parseDatabaseUrl(envMap['DATABASE_URL']);
      if (parsed) {
        Object.assign(this.config, parsed);
        changed = true;
      }
    }

    if (envMap['API_PORT']) {
      this.config.apiPort = Number(envMap['API_PORT']) || this.config.apiPort;
      changed = true;
    }
    if (envMap['JWT_SECRET'] && !this.config.jwtSecret) {
      this.config.jwtSecret = envMap['JWT_SECRET'];
      changed = true;
    }
    if (envMap['JWT_EXPIRES_IN']) {
      this.config.jwtExpiresIn = envMap['JWT_EXPIRES_IN'];
      changed = true;
    }
    if (envMap['JWT_REFRESH_EXPIRES_IN']) {
      this.config.jwtRefreshExpiresIn = envMap['JWT_REFRESH_EXPIRES_IN'];
      changed = true;
    }
    if (envMap['APP_MODE'] && !this.config.isConfigured) {
      this.config.mode = envMap['APP_MODE'] as AppMode;
      changed = true;
    }
    if (envMap['SERVER_HOST'] && !this.config.isConfigured) {
      this.config.serverHost = envMap['SERVER_HOST'];
      changed = true;
    }
    if (envMap['SERVER_PORT']) {
      this.config.serverPort = Number(envMap['SERVER_PORT']) || this.config.serverPort;
      changed = true;
    }

    return changed;
  }

  private parseEnvFile(content: string): Record<string, string> {
    const result: Record<string, string> = {};
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      result[key] = value;
    }
    return result;
  }

  private parseDatabaseUrl(url: string): Partial<AppConfig> | null {
    try {
      const u = new URL(url);
      if (u.protocol !== 'mysql:') return null;
      return {
        dbHost: u.hostname || 'localhost',
        dbPort: Number(u.port) || 3306,
        dbUser: decodeURIComponent(u.username || 'root'),
        dbPassword: decodeURIComponent(u.password || ''),
        dbName: (u.pathname || '/puntoventa').replace(/^\//, '') || 'puntoventa',
      };
    } catch {
      return null;
    }
  }

  private generateJwtSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
