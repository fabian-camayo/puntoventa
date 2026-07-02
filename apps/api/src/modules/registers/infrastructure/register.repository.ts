import { Injectable } from '@nestjs/common';
import { RegisterSessionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class RegisterRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.register.findUnique({ where: { id } });
  }

  create(data: Prisma.RegisterCreateInput) {
    return this.prisma.register.create({ data });
  }

  update(id: string, data: Prisma.RegisterUpdateInput) {
    return this.prisma.register.update({ where: { id }, data });
  }

  findByBranch(branchId: string, params?: PaginationQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RegisterWhereInput = {
      branchId,
      ...(params?.search ? this.buildSearchWhere(params.search) : {}),
    };

    return Promise.all([
      this.prisma.register.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          sessions: {
            where: { status: RegisterSessionStatus.OPEN },
            take: 1,
            orderBy: { openedAt: 'desc' },
          },
        },
      }),
      this.prisma.register.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  findOpenSession(registerId: string) {
    return this.prisma.registerSession.findFirst({
      where: { registerId, status: RegisterSessionStatus.OPEN },
      include: {
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        register: { select: { id: true, code: true, name: true } },
        cashMovements: true,
        sales: {
          where: { status: 'COMPLETED' },
          select: { id: true, total: true, documentNumber: true },
        },
      },
    });
  }

  findSessionById(id: string) {
    return this.prisma.registerSession.findUnique({
      where: { id },
      include: {
        register: true,
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        cashMovements: true,
        sales: {
          where: { status: 'COMPLETED' },
          select: { id: true, total: true, documentNumber: true },
        },
      },
    });
  }

  findSessions(params: {
    branchId: string;
    registerId?: string;
    status?: RegisterSessionStatus;
    page?: number;
    limit?: number;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.RegisterSessionWhereInput = {
      register: { branchId: params.branchId },
      ...(params.registerId ? { registerId: params.registerId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    return Promise.all([
      this.prisma.registerSession.findMany({
        where,
        skip,
        take: limit,
        orderBy: { openedAt: 'desc' },
        include: {
          register: { select: { id: true, code: true, name: true } },
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
          sales: {
            where: { status: 'COMPLETED' },
            select: { id: true, total: true },
          },
        },
      }),
      this.prisma.registerSession.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  private buildSearchWhere(search: string): Prisma.RegisterWhereInput {
    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ],
    };
  }
}
