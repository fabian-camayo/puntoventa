import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { prepareDatabase } from './prepare-database';

/**
 * Aplica migraciones versionadas al iniciar.
 * La lógica real vive en prepare-database (también se llama antes de Nest).
 */
@Injectable()
export class MigrationService {
  private readonly logger = new Logger(MigrationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async runPendingMigrations(): Promise<void> {
    const startTime = Date.now();
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error('DATABASE_URL no configurada');
    }

    this.logger.log('Verificando migraciones pendientes…');

    try {
      await prepareDatabase(databaseUrl);

      await this.prisma.migrationLog.create({
        data: {
          migrationName: 'prisma_migrate_deploy',
          durationMs: Date.now() - startTime,
          success: true,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error desconocido';

      await this.prisma.migrationLog
        .create({
          data: {
            migrationName: 'prisma_migrate_deploy',
            durationMs: Date.now() - startTime,
            success: false,
            errorMessage: message.slice(0, 2000),
          },
        })
        .catch(() => undefined);

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
