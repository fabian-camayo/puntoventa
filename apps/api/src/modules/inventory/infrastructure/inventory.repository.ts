import { Injectable } from '@nestjs/common';
import { AdjustmentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByBranch(branchId: string, params?: PaginationQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryItemWhereInput = {
      branchId,
      ...(params?.search
        ? {
            product: {
              OR: [
                { name: { contains: params.search } },
                { sku: { contains: params.search } },
              ],
            },
          }
        : {}),
    };

    return Promise.all([
      this.prisma.inventoryItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: { product: { select: { id: true, sku: true, name: true, unit: true } } },
      }),
      this.prisma.inventoryItem.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  findAdjustmentById(id: string) {
    return this.prisma.inventoryAdjustment.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, username: true, firstName: true, lastName: true } },
      },
    });
  }

  findAdjustmentsByBranch(branchId: string, params?: PaginationQuery) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.InventoryAdjustmentWhereInput = { branchId };

    return Promise.all([
      this.prisma.inventoryAdjustment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { items: true, user: { select: { username: true } } },
      }),
      this.prisma.inventoryAdjustment.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  findInventoryItem(branchId: string, productId: string) {
    return this.prisma.inventoryItem.findUnique({
      where: { branchId_productId: { branchId, productId } },
    });
  }

  findDraftAdjustments(branchId: string) {
    return this.prisma.inventoryAdjustment.findMany({
      where: { branchId, status: AdjustmentStatus.DRAFT },
      include: { items: true },
    });
  }
}
