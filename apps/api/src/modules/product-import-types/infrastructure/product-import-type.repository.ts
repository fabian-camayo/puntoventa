import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class ProductImportTypeRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.productImportType.findUnique({ where: { id } });
  }

  findByCode(branchId: string, code: string) {
    return this.prisma.productImportType.findUnique({
      where: { branchId_code: { branchId, code } },
    });
  }

  create(data: Prisma.ProductImportTypeCreateInput) {
    return this.prisma.productImportType.create({ data });
  }

  update(id: string, data: Prisma.ProductImportTypeUpdateInput) {
    return this.prisma.productImportType.update({ where: { id }, data });
  }

  findActiveByBranch(branchId: string) {
    return this.prisma.productImportType.findMany({
      where: { branchId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  findAll(
    branchId: string,
    params?: PaginationQuery & { activeOnly?: boolean },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductImportTypeWhereInput = {
      branchId,
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
      this.prisma.productImportType.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.productImportType.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }
}
