import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

@Injectable()
export class BusinessConfigRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByBranchId(branchId: string) {
    return this.prisma.businessConfig.findUnique({
      where: { branchId },
    });
  }

  upsert(branchId: string, data: {
    businessName: string;
    taxId?: string;
    address?: string;
    phone?: string;
    email?: string;
    currency?: string;
    currencySymbol?: string;
    taxRate?: number;
    ticketHeader?: string;
    ticketFooter?: string;
    allowNegativeStock?: boolean;
    defaultCustomerId?: string;
  }) {
    return this.prisma.businessConfig.upsert({
      where: { branchId },
      create: { branchId, ...data },
      update: data,
    });
  }
}
