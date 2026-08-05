import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { app } from 'electron';

export class BackendManager {
  private process: ChildProcess | null = null;
  private running = false;
  private port = 3000;
  private lastOutput = '';

  async start(runtimeEnv: Record<string, string>): Promise<void> {
    if (this.running) return;

    if (!runtimeEnv['DATABASE_URL']) {
      throw new Error('DATABASE_URL no configurada. Complete la configuración de MySQL.');
    }
    if (!runtimeEnv['JWT_SECRET']) {
      throw new Error('JWT_SECRET no configurado.');
    }

    this.port = Number(runtimeEnv['API_PORT']) || 3000;
    this.lastOutput = '';

    const isPackaged = app.isPackaged;
    // __dirname = apps/desktop/dist/backend
    const apiPath = isPackaged
      ? path.join(process.resourcesPath, 'api', 'main.js')
      : path.join(__dirname, '../../../api/dist/main.js');

    // Packaged: resources/api (incluye prisma/). Dev: raíz del monorepo (prisma/)
    const cwd = isPackaged
      ? path.join(process.resourcesPath, 'api')
      : path.join(__dirname, '../../../../');

    const { binary, args, extraEnv } = this.resolveNodeSpawn(apiPath);

    const env = {
      ...process.env,
      ...runtimeEnv,
      ...extraEnv,
      API_PORT: String(this.port),
      API_HOST: runtimeEnv['API_HOST'] || '0.0.0.0',
      NODE_ENV: isPackaged ? 'production' : process.env['NODE_ENV'] || 'development',
    };

    this.process = spawn(binary, args, {
      env,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
    });

    const appendOut = (data: Buffer) => {
      const text = data.toString();
      this.lastOutput = (this.lastOutput + text).slice(-8000);
      console.log(`[API] ${text.trim()}`);
    };

    this.process.stdout?.on('data', appendOut);
    this.process.stderr?.on('data', (data: Buffer) => {
      appendOut(data);
      console.error(`[API ERROR] ${data.toString().trim()}`);
    });

    this.process.on('exit', (code) => {
      console.log(`[API] Proceso terminado con código ${code}`);
      this.running = false;
      this.process = null;
    });

    await this.waitForReady();
    this.running = true;
    console.log(`[BackendManager] API NestJS iniciada en puerto ${this.port}`);
  }

  getLastOutput(): string {
    return this.lastOutput;
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    return new Promise((resolve) => {
      const proc = this.process;
      if (!proc) {
        resolve();
        return;
      }

      proc.once('exit', () => resolve());
      proc.kill('SIGTERM');

      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL');
        }
        resolve();
      }, 5000);
    });
  }

  async restart(runtimeEnv: Record<string, string>): Promise<void> {
    await this.stop();
    this.running = false;
    this.process = null;
    await this.start(runtimeEnv);
  }

  isRunning(): boolean {
    return this.running;
  }

  getPort(): number {
    return this.port;
  }

  /**
   * En producción usa el binario de Electron como Node (ELECTRON_RUN_AS_NODE)
   * para no empaquetar un node.exe aparte. Override: PUNTOVENTA_NODE.
   */
  private resolveNodeSpawn(apiPath: string): {
    binary: string;
    args: string[];
    extraEnv: Record<string, string>;
  } {
    const override = process.env['PUNTOVENTA_NODE'];
    if (override) {
      return { binary: override, args: [apiPath], extraEnv: {} };
    }

    if (app.isPackaged) {
      return {
        binary: process.execPath,
        args: [apiPath],
        extraEnv: { ELECTRON_RUN_AS_NODE: '1' },
      };
    }

    return { binary: 'node', args: [apiPath], extraEnv: {} };
  }

  private async waitForReady(maxAttempts = 45): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      if (!this.process && i > 2) {
        throw new Error(
          `La API se cerró antes de estar lista. Revise MySQL (host/usuario/clave). Detalle:\n${this.lastOutput.slice(-2000)}`,
        );
      }
      try {
        const response = await fetch(`http://localhost:${this.port}/api/v1/health`);
        if (response.ok) return;
      } catch {
        // API aún no disponible
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error(
      `Timeout esperando la API en el puerto ${this.port}. ¿MySQL accesible?\n${this.lastOutput.slice(-2000)}`,
    );
  }
}
