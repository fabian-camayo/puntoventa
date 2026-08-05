import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PaginationQuery } from '@puntoventa/shared';

@Injectable()
export class BankAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.bankAccount.findUnique({ where: { id } });
  }

  create(data: Prisma.BankAccountCreateInput) {
    return this.prisma.bankAccount.create({ data });
  }

  update(id: string, data: Prisma.BankAccountUpdateInput) {
    return this.prisma.bankAccount.update({ where: { id }, data });
  }

  findActiveByBranch(branchId: string) {
    return this.prisma.bankAccount.findMany({
      where: { branchId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  findByBranch(branchId: string, params?: PaginationQuery & { activeOnly?: boolean }) {
    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: Prisma.BankAccountWhereInput = {
      branchId,
      ...(params?.activeOnly ? { isActive: true } : {}),
      ...(params?.search ? this.buildSearchWhere(params.search) : {}),
    };

    return Promise.all([
      this.prisma.bankAccount.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.bankAccount.count({ where }),
    ]).then(([items, total]) => ({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    }));
  }

  private buildSearchWhere(search: string): Prisma.BankAccountWhereInput {
    return {
      OR: [
        { code: { contains: search } },
        { name: { contains: search } },
        { bankName: { contains: search } },
        { accountNumber: { contains: search } },
      ],
    };
  }
}
