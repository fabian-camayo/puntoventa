import { Injectable } from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RequestContext } from '../../../infrastructure/context/request-context';

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  module: string;
  entityType: string;
  entityId?: string;
  oldValues?: Prisma.InputJsonValue;
  newValues?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  module?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  userId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento de auditoría. IP/User-Agent se toman del contexto de la
   * petición actual (poblado por `RequestContextMiddleware`) cuando el llamador no
   * los provee explícitamente, así ningún módulo tiene que reenviarlos a mano.
   */
  async log(input: AuditLogInput): Promise<void> {
    const ctx = RequestContext.get();

    await this.prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        module: input.module,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValues: input.oldValues,
        newValues: input.newValues,
        ipAddress: input.ipAddress ?? ctx?.ipAddress,
        userAgent: input.userAgent ?? ctx?.userAgent,
      },
    });
  }

  async findAll(params: AuditLogQuery) {
    const page = params.page ?? 1;
    const limit = Math.min(params.limit ?? 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.AuditLogWhereInput = {
      ...(params.module ? { module: params.module } : {}),
      ...(params.action ? { action: params.action } : {}),
      ...(params.entityType ? { entityType: params.entityType } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.dateFrom || params.dateTo
        ? {
            createdAt: {
              ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
              ...(params.dateTo ? { lte: new Date(params.dateTo) } : {}),
            },
          }
        : {}),
      ...(params.search
        ? {
            OR: [
              { entityType: { contains: params.search } },
              { entityId: { contains: params.search } },
              { user: { username: { contains: params.search } } },
              { user: { firstName: { contains: params.search } } },
              { user: { lastName: { contains: params.search } } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true, firstName: true, lastName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: items.map((item) => this.mapToDto(item)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findById(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: { user: { select: { username: true, firstName: true, lastName: true } } },
    });
    return log ? this.mapToDto(log) : null;
  }

  private mapToDto(log: {
    id: string;
    userId: string | null;
    action: AuditAction;
    module: string;
    entityType: string;
    entityId: string | null;
    oldValues: Prisma.JsonValue;
    newValues: Prisma.JsonValue;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
    user?: { username: string; firstName: string; lastName: string } | null;
  }) {
    return {
      id: log.id,
      userId: log.userId ?? undefined,
      username: log.user?.username,
      userName: log.user
        ? `${log.user.firstName} ${log.user.lastName}`.trim() || log.user.username
        : undefined,
      action: log.action,
      module: log.module,
      entityType: log.entityType,
      entityId: log.entityId ?? undefined,
      oldValues: (log.oldValues as Record<string, unknown> | null) ?? undefined,
      newValues: (log.newValues as Record<string, unknown> | null) ?? undefined,
      ipAddress: log.ipAddress ?? undefined,
      userAgent: log.userAgent ?? undefined,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
