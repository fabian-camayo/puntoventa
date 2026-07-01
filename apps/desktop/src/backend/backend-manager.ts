import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';
import { app } from 'electron';

export class BackendManager {
  private process: ChildProcess | null = null;
  private running = false;
  private readonly port = 3000;

  async start(): Promise<void> {
    if (this.running) return;

    const isPackaged = app.isPackaged;
    const apiPath = isPackaged
      ? path.join(process.resourcesPath, 'api', 'main.js')
      : path.join(__dirname, '../../../../api/dist/main.js');

    const env = {
      ...process.env,
      API_PORT: String(this.port),
      API_HOST: '0.0.0.0',
      NODE_ENV: isPackaged ? 'production' : 'development',
    };

    this.process = spawn('node', [apiPath], {
      env,
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
    console.log('[BackendManager] API NestJS iniciada');
  }

  async stop(): Promise<void> {
    if (!this.process) return;

    return new Promise((resolve) => {
      this.process?.on('exit', () => resolve());
      this.process?.kill('SIGTERM');

      setTimeout(() => {
        this.process?.kill('SIGKILL');
        resolve();
      }, 5000);
    });
  }

  isRunning(): boolean {
    return this.running;
  }

  private async waitForReady(maxAttempts = 30): Promise<void> {
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
