import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { promisify } from 'util';
import { execFile } from 'child_process';

const execFileAsync = promisify(execFile);

const BACKUP_MARKER = '-- PuntoVenta database backup';

@Injectable()
export class DatabaseBackupService {
  private readonly logger = new Logger(DatabaseBackupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly nestConfig: NestConfigService,
  ) {}

  async createBackup(): Promise<{ buffer: Buffer; filename: string }> {
    const dbUrl = this.requireDatabaseUrl();
    const dbName = this.parseDbName(dbUrl);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `puntoventa-backup-${stamp}.sql`;

    try {
      const fromDump = await this.tryMysqldump(dbUrl, dbName);
      if (fromDump) {
        const withHeader = `${BACKUP_MARKER}\n-- Created: ${new Date().toISOString()}\n-- Database: ${dbName}\n-- Engine: mysqldump\n\n${fromDump}`;
        return { buffer: Buffer.from(withHeader, 'utf8'), filename };
      }
    } catch (err) {
      this.logger.warn(
        `mysqldump no disponible, usando volcado interno: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const sql = await this.dumpWithPrisma(dbName);
    return { buffer: Buffer.from(sql, 'utf8'), filename };
  }

  async restoreBackup(fileBuffer: Buffer, originalName?: string): Promise<{ ok: true; statements: number }> {
    if (!fileBuffer?.length) {
      throw new BadRequestException('Archivo de respaldo vacío');
    }
    if (originalName && !/\.sql$/i.test(originalName)) {
      throw new BadRequestException('El archivo debe ser .sql');
    }

    const sql = fileBuffer.toString('utf8');
    if (!sql.includes(BACKUP_MARKER) && !/CREATE TABLE|INSERT INTO/i.test(sql)) {
      throw new BadRequestException(
        'El archivo no parece un respaldo SQL válido de PuntoVenta',
      );
    }

    const statements = this.splitSqlStatements(sql);
    if (statements.length === 0) {
      throw new BadRequestException('El respaldo no contiene sentencias SQL');
    }

    this.logger.warn(`Restaurando respaldo (${statements.length} sentencias)…`);

    await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=0');
    try {
      for (const statement of statements) {
        const upper = statement.trim().toUpperCase();
        if (
          upper.startsWith('SET FOREIGN_KEY_CHECKS') ||
          upper.startsWith('SET NAMES') ||
          upper.startsWith('SET SQL_MODE') ||
          upper.startsWith('LOCK TABLES') ||
          upper.startsWith('UNLOCK TABLES') ||
          upper.startsWith('START TRANSACTION') ||
          upper === 'COMMIT' ||
          upper === 'BEGIN'
        ) {
          continue;
        }
        await this.prisma.$executeRawUnsafe(statement);
      }
    } finally {
      await this.prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS=1').catch(() => undefined);
    }

    this.logger.warn('Respaldo restaurado correctamente');
    return { ok: true, statements: statements.length };
  }

  private async dumpWithPrisma(dbName: string): Promise<string> {
    const tables = await this.prisma.$queryRawUnsafe<Array<{ TABLE_NAME: string }>>(
      `SELECT TABLE_NAME AS TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
    );

    const lines: string[] = [
      BACKUP_MARKER,
      `-- Created: ${new Date().toISOString()}`,
      `-- Database: ${dbName}`,
      `-- Engine: prisma`,
      `SET NAMES utf8mb4;`,
      `SET FOREIGN_KEY_CHECKS=0;`,
      '',
    ];

    for (const row of tables) {
      const table = row.TABLE_NAME;
      if (!/^[A-Za-z0-9_]+$/.test(table)) continue;

      const createRows = await this.prisma.$queryRawUnsafe<
        Array<Record<string, string>>
      >(`SHOW CREATE TABLE \`${table}\``);
      const createSql =
        createRows[0]?.['Create Table'] ??
        createRows[0]?.['Create Table'.toLowerCase()] ??
        Object.values(createRows[0] ?? {}).find((v) =>
          typeof v === 'string' && v.toUpperCase().includes('CREATE TABLE'),
        );

      if (!createSql || typeof createSql !== 'string') {
        throw new BadRequestException(`No se pudo leer la estructura de ${table}`);
      }

      lines.push(`DROP TABLE IF EXISTS \`${table}\`;`);
      lines.push(`${createSql};`);
      lines.push('');

      const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
        `SELECT * FROM \`${table}\``,
      );
      if (!rows.length) {
        lines.push(`-- ${table}: sin datos`);
        lines.push('');
        continue;
      }

      const columns = Object.keys(rows[0]!);
      const colList = columns.map((c) => `\`${c}\``).join(', ');
      const batchSize = 100;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const values = batch
          .map(
            (r) =>
              `(${columns.map((c) => this.sqlLiteral(r[c])).join(', ')})`,
          )
          .join(',\n');
        lines.push(`INSERT INTO \`${table}\` (${colList}) VALUES\n${values};`);
      }
      lines.push('');
    }

    lines.push(`SET FOREIGN_KEY_CHECKS=1;`);
    lines.push(`-- Fin del respaldo`);
    return lines.join('\n');
  }

  private async tryMysqldump(databaseUrl: string, dbName: string): Promise<string | null> {
    const parsed = this.parseMysqlUrl(databaseUrl);
    const args = [
      `-h${parsed.host}`,
      `-P${parsed.port}`,
      `-u${parsed.user}`,
      `--single-transaction`,
      `--routines`,
      `--triggers`,
      `--default-character-set=utf8mb4`,
      `--result-file=-`,
      dbName,
    ];
    if (parsed.password) {
      args.splice(3, 0, `-p${parsed.password}`);
    }

    try {
      const { stdout } = await execFileAsync('mysqldump', args, {
        maxBuffer: 512 * 1024 * 1024,
        encoding: 'utf8',
        env: { ...process.env, MYSQL_PWD: parsed.password || undefined },
      });
      if (!stdout || stdout.length < 20) return null;
      return stdout;
    } catch {
      return null;
    }
  }

  private sqlLiteral(value: unknown): string {
    if (value === null || value === undefined) return 'NULL';
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'number') {
      return Number.isFinite(value) ? String(value) : 'NULL';
    }
    if (typeof value === 'boolean') return value ? '1' : '0';
    if (value instanceof Date) {
      const iso = value.toISOString();
      return `'${iso.slice(0, 19).replace('T', ' ')}'`;
    }
    if (Buffer.isBuffer(value)) {
      return value.length ? `X'${value.toString('hex')}'` : 'NULL';
    }
    if (typeof value === 'object') {
      // Prisma Decimal u objetos serializables
      if (
        value &&
        typeof (value as { toFixed?: unknown }).toFixed === 'function'
      ) {
        return String(value);
      }
      return this.quoteString(JSON.stringify(value));
    }
    return this.quoteString(String(value));
  }

  private quoteString(s: string): string {
    return `'${s
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')
      .replace(/\u0000/g, '')}'`;
  }

  private splitSqlStatements(sql: string): string[] {
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

  private requireDatabaseUrl(): string {
    const url = this.nestConfig.get<string>('DATABASE_URL');
    if (!url) {
      throw new BadRequestException('DATABASE_URL no está configurada');
    }
    return url;
  }

  private parseDbName(databaseUrl: string): string {
    try {
      const u = new URL(databaseUrl);
      return decodeURIComponent((u.pathname || '').replace(/^\//, '').split('/')[0] || 'puntoventa');
    } catch {
      return 'puntoventa';
    }
  }

  private parseMysqlUrl(databaseUrl: string): {
    host: string;
    port: string;
    user: string;
    password: string;
  } {
    const u = new URL(databaseUrl);
    return {
      host: u.hostname || 'localhost',
      port: u.port || '3306',
      user: decodeURIComponent(u.username || 'root'),
      password: decodeURIComponent(u.password || ''),
    };
  }
}
