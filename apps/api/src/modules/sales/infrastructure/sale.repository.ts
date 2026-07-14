import { Injectable } from '@nestjs/common';
import { SaleStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class SaleRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIdWithDetails(id: string) {
    return this.prisma.sale.findUnique({
      where: { id },
      include: {
        items: { include: { product: true, unitType: true } },
        payments: { include: { paymentType: true } },
        customer: true,
      },
    });
  }

  findActiveByRegister(registerId: string) {
    return this.prisma.sale.findMany({
      where: {
        registerId,
        status: SaleStatus.ACTIVE,
      },
      include: {
        items: true,
        customer: true,
      },
      orderBy: { tabOrder: 'asc' },
    });
  }

  findByBranch(
    branchId: string,
    params: {
      search?: string;
      status?: SaleStatus;
      page?: number;
      limit?: number;
    },
  ) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      branchId,
      ...(params.status ? { status: params.status } : {}),
      ...(params.search
        ? {
            OR: [
              { documentNumber: { contains: params.search } },
              { customer: { name: { contains: params.search } } },
            ],
          }
        : {}),
    };

    return Promise.all([
      this.prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ completedAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          customer: true,
          register: true,
          user: true,
          _count: { select: { items: true } },
        },
      }),
      this.prisma.sale.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    }));
  }
}
