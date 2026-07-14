import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { app } from 'electron';

export class BackendManager {
  private process: ChildProcess | null = null;
  private running = false;
  private port = 3000;

  async start(runtimeEnv: Record<string, string>): Promise<void> {
    if (this.running) return;

    if (!runtimeEnv['DATABASE_URL']) {
      throw new Error('DATABASE_URL no configurada. Complete la configuración de MySQL.');
    }
    if (!runtimeEnv['JWT_SECRET']) {
      throw new Error('JWT_SECRET no configurado.');
    }

    this.port = Number(runtimeEnv['API_PORT']) || 3000;

    const isPackaged = app.isPackaged;
    const apiPath = isPackaged
      ? path.join(process.resourcesPath, 'api', 'main.js')
      : path.join(__dirname, '../../../../api/dist/main.js');

    const cwd = isPackaged
      ? path.join(process.resourcesPath, 'api')
      : path.join(__dirname, '../../../../api');

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

    this.process.stdout?.on('data', (data: Buffer) => {
      console.log(`[API] ${data.toString().trim()}`);
    });

    this.process.stderr?.on('data', (data: Buffer) => {
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

  private async waitForReady(maxAttempts = 40): Promise<void> {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`http://localhost:${this.port}/api/v1/health`);
        if (response.ok) return;
      } catch {
        // API aún no disponible
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    throw new Error('Timeout esperando que la API esté lista');
  }
}
