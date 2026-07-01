import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll(params?: PaginationQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where = params?.search
      ? {
          OR: [
            { code: { contains: params.search } },
            { name: { contains: params.search } },
            { module: { contains: params.search } },
            { action: { contains: params.search } },
          ],
        }
      : undefined;

    const orderBy = params?.sortBy
      ? { [params.sortBy]: params.sortOrder ?? 'asc' }
      : { module: 'asc' as const };

    return Promise.all([
      this.prisma.permission.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.permission.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  findAllActive() {
    return this.prisma.permission.findMany({
      where: { isActive: true },
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });
  }

  findByModule(module: string) {
    return this.prisma.permission.findMany({
      where: { module, isActive: true },
      orderBy: { action: 'asc' },
    });
  }
}
