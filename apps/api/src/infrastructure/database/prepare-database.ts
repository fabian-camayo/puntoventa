import { createHash, randomUUID } from 'crypto';
import { existsSync, readdirSync, readFileSync } from 'fs';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const logger = new Logger('PrepareDatabase');

/**
 * Antes de Nest/Prisma: asegura que exista la BD y aplica migraciones SQL.
 * No depende de `npx prisma` ni del schema-engine (crítico en el .exe de Windows).
 */
export async function prepareDatabase(databaseUrl: string): Promise<void> {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL no está definida. Configure MySQL en el asistente o reinstalador.');
  }

  await ensureMysqlDatabase(databaseUrl);
  await applySqlMigrations(databaseUrl);
}

export async function ensureMysqlDatabase(databaseUrl: string): Promise<void> {
  const { serverUrl, dbName } = splitDatabaseUrl(databaseUrl);
  if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
    throw new Error(`Nombre de base de datos inválido: ${dbName}`);
  }

  const admin = new PrismaClient({
    datasources: { db: { url: serverUrl } },
    log: ['error', 'warn'],
  });

  try {
    logger.log(`Verificando MySQL y base de datos "${dbName}"…`);
    await admin.$connect();
    await admin.$executeRawUnsafe(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    logger.log(`Base de datos "${dbName}" lista`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No se pudo conectar a MySQL o crear la base "${dbName}". ` +
        `Revise host/usuario/contraseña (instalador o %APPDATA%\\PuntoVenta\\.env). Detalle: ${message}`,
    );
  } finally {
    await admin.$disconnect().catch(() => undefined);
  }
}

export async function applySqlMigrations(databaseUrl: string): Promise<void> {
  const migrationsDir = resolveMigrationsDir();
  const client = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
    log: ['error', 'warn'],
  });

  try {
    await client.$connect();
    await client.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
        \`id\` VARCHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        \`checksum\` VARCHAR(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        \`finished_at\` DATETIME(3) NULL,
        \`migration_name\` VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
        \`logs\` TEXT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL,
        \`rolled_back_at\` DATETIME(3) NULL,
        \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        \`applied_steps_count\` INT UNSIGNED NOT NULL DEFAULT 0,
        PRIMARY KEY (\`id\`)
      ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);

    const appliedRows = await client.$queryRawUnsafe<Array<{ migration_name: string }>>(
      `SELECT \`migration_name\` FROM \`_prisma_migrations\` WHERE \`rolled_back_at\` IS NULL`,
    );
    const applied = new Set(appliedRows.map((r) => r.migration_name));

    const migrationNames = readdirSync(migrationsDir)
      .filter((name) => existsSync(path.join(migrationsDir, name, 'migration.sql')))
      .sort();

    for (const name of migrationNames) {
      if (applied.has(name)) continue;

      const sqlPath = path.join(migrationsDir, name, 'migration.sql');
      const sql = readFileSync(sqlPath, 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const id = randomUUID();

      logger.log(`Aplicando migración ${name}…`);

      await client.$executeRawUnsafe(
        `INSERT INTO \`_prisma_migrations\` (\`id\`, \`checksum\`, \`migration_name\`, \`started_at\`, \`applied_steps_count\`)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP(3), 0)`,
        id,
        checksum,
        name,
      );

      try {
        for (const statement of splitSqlStatements(sql)) {
          await client.$executeRawUnsafe(statement);
        }
        await client.$executeRawUnsafe(
          `UPDATE \`_prisma_migrations\`
           SET \`finished_at\` = CURRENT_TIMESTAMP(3), \`applied_steps_count\` = 1
           WHERE \`id\` = ?`,
          id,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await client.$executeRawUnsafe(
          `UPDATE \`_prisma_migrations\` SET \`logs\` = ?, \`rolled_back_at\` = CURRENT_TIMESTAMP(3) WHERE \`id\` = ?`,
          message.slice(0, 4000),
          id,
        );
        throw new Error(`Falló la migración ${name}: ${message}`);
      }
    }

    logger.log('Migraciones aplicadas correctamente');
  } finally {
    await client.$disconnect().catch(() => undefined);
  }
}

function splitSqlStatements(sql: string): string[] {
  const withoutBom = sql.replace(/^\uFEFF/, '');
  const lines = withoutBom.split(/\r?\n/);
  const cleaned: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('--')) continue;
    cleaned.push(line);
  }
  const body = cleaned.join('\n');
  return body
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function splitDatabaseUrl(databaseUrl: string): { serverUrl: string; dbName: string } {
  let u: URL;
  try {
    u = new URL(databaseUrl);
  } catch {
    throw new Error('DATABASE_URL inválida');
  }
  if (!u.protocol.startsWith('mysql')) {
    throw new Error('DATABASE_URL debe ser mysql://…');
  }

  const dbName = decodeURIComponent((u.pathname || '').replace(/^\//, '').split('/')[0] || '');
  if (!dbName) {
    throw new Error('DATABASE_URL no incluye el nombre de la base de datos');
  }

  u.pathname = '/information_schema';
  return { serverUrl: u.toString(), dbName };
}

function resolveMigrationsDir(): string {
  const candidates = [
    path.join(process.cwd(), 'prisma', 'migrations'),
    path.join(__dirname, '..', '..', '..', 'prisma', 'migrations'),
    path.join(__dirname, '..', '..', '..', '..', 'prisma', 'migrations'),
    path.join(__dirname, '..', '..', '..', '..', '..', 'prisma', 'migrations'),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  throw new Error(
    `No se encontró prisma/migrations. cwd=${process.cwd()} __dirname=${__dirname}`,
  );
}
