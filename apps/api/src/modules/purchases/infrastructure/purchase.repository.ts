import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class PurchaseRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.purchase.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.PurchaseUpdateInput) {
    return this.prisma.purchase.update({ where: { id }, data });
  }

  findByIdWithDetails(id: string) {
    return this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: { include: { product: true, unitType: true } },
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
  }

  findByBranch(
    branchId: string,
    params?: PaginationQuery & { status?: import('@prisma/client').PurchaseStatus },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PurchaseWhereInput = {
      branchId,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.search ? this.buildSearchWhere(params.search) : {}),
    };

    return Promise.all([
      this.prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { supplier: true, items: { include: { product: true, unitType: true } } },
      }),
      this.prisma.purchase.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  private buildSearchWhere(search: string): Prisma.PurchaseWhereInput {
    return {
      OR: [
        { documentNumber: { contains: search } },
        { notes: { contains: search } },
        { supplier: { name: { contains: search } } },
      ],
    };
  }
}
