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
      include: { user: { select: { id: true, username: true, firstName: true, lastName: true } } },
    });
  }

  findSessionById(id: string) {
    return this.prisma.registerSession.findUnique({
      where: { id },
      include: {
        register: true,
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
        cashMovements: true,
      },
    });
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
