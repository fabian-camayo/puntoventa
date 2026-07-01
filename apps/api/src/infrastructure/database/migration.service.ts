import { Injectable, Logger } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { PrismaService } from './prisma.service';

const execAsync = promisify(exec);

/**
 * Servicio de migraciones versionadas.
 * Ejecuta `prisma migrate deploy` al iniciar la aplicación.
 * Nunca modifica migraciones anteriores; solo aplica las pendientes.
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runPendingMigrations(): Promise<void> {
    const startTime = Date.now();
    const rootPath = path.resolve(__dirname, '../../../../..');

    this.logger.log('Verificando migraciones pendientes...');

    try {
      const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
        cwd: rootPath,
        env: { ...process.env },
      });

      if (stdout) {
        this.logger.log(stdout.trim());
      }
      if (stderr && !stderr.includes('already applied')) {
        this.logger.warn(stderr.trim());
      }

      await this.prisma.migrationLog.create({
        data: {
          migrationName: 'prisma_migrate_deploy',
          durationMs: Date.now() - startTime,
          success: true,
        },
      });

      this.logger.log('Migraciones aplicadas correctamente');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';

      await this.prisma.migrationLog.create({
        data: {
          migrationName: 'prisma_migrate_deploy',
          durationMs: Date.now() - startTime,
          success: false,
          errorMessage: message,
        },
      }).catch(() => undefined);

      this.logger.error(`Error al aplicar migraciones: ${message}`);
      throw error;
    }
  }

  async getMigrationStatus(): Promise<{ applied: number; pending: boolean }> {
    const logs = await this.prisma.migrationLog.count({
      where: { success: true },
    });
    return { applied: logs, pending: false };
  }
}
