import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.category.findUnique({ where: { id } });
  }

  create(data: Prisma.CategoryCreateInput) {
    return this.prisma.category.create({ data });
  }

  update(id: string, data: Prisma.CategoryUpdateInput) {
    return this.prisma.category.update({ where: { id }, data });
  }

  findByBranch(branchId: string, params?: PaginationQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 50;
    const skip = (page - 1) * limit;

    const where: Prisma.CategoryWhereInput = {
      branchId,
      ...(params?.search ? this.buildSearchWhere(params.search) : {}),
    };

    return Promise.all([
      this.prisma.category.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { parent: true, children: true },
      }),
      this.prisma.category.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  findByIdWithRelations(id: string) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { parent: true, children: true },
    });
  }

  private buildSearchWhere(search: string): Prisma.CategoryWhereInput {
    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { description: { contains: search } },
      ],
    };
  }
}
