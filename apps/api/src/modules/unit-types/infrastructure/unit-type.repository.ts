import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class UnitTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.unitType.findUnique({ where: { id } });
  }

  findByCode(code: string) {
    return this.prisma.unitType.findUnique({ where: { code } });
  }

  create(data: Prisma.UnitTypeCreateInput) {
    return this.prisma.unitType.create({ data });
  }

  update(id: string, data: Prisma.UnitTypeUpdateInput) {
    return this.prisma.unitType.update({ where: { id }, data });
  }

  findActive() {
    return this.prisma.unitType.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findAll(params?: PaginationQuery & { activeOnly?: boolean }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.UnitTypeWhereInput = {
      ...(params?.activeOnly ? { isActive: true } : {}),
      ...(params?.search
        ? {
            OR: [
              { code: { contains: params.search } },
              { name: { contains: params.search } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.unitType.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.unitType.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }
}
