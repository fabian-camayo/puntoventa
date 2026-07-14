import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class ProductRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.product.findUnique({ where: { id } });
  }

  update(id: string, data: Prisma.ProductUpdateInput) {
    return this.prisma.product.update({ where: { id }, data });
  }

  findByIdWithDetails(id: string) {
    return this.prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        barcodes: true,
        inventoryItems: true,
        productUnits: {
          include: { unitType: true },
          orderBy: [{ isBase: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  searchByBranch(
    branchId: string,
    params?: PaginationQuery & { includeInactive?: boolean },
  ) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      branchId,
      ...(params?.includeInactive ? {} : { isActive: true }),
      ...(params?.search ? this.buildSearchWhere(params.search) : {}),
    };

    return Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          category: true,
          inventoryItems: { where: { branchId } },
          productUnits: {
            where: { isActive: true },
            include: { unitType: true },
            orderBy: [{ isBase: 'desc' }, { createdAt: 'asc' }],
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  findByBarcode(branchId: string, barcode: string) {
    return this.prisma.product.findFirst({
      where: {
        branchId,
        isActive: true,
        OR: [
          { barcode },
          { barcodes: { some: { barcode } } },
        ],
      },
      include: {
        category: true,
        inventoryItems: { where: { branchId } },
        productUnits: {
          where: { isActive: true },
          include: { unitType: true },
          orderBy: [{ isBase: 'desc' }, { createdAt: 'asc' }],
        },
      },
    });
  }

  private buildSearchWhere(search: string): Prisma.ProductWhereInput {
    return {
      OR: [
        { name: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
        { barcodes: { some: { barcode: { contains: search } } } },
      ],
    };
  }
}
