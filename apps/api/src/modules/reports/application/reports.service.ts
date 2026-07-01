import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SaleStatus } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(branchId: string, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);

    const sales = await this.prisma.sale.aggregate({
      where: {
        branchId,
        status: SaleStatus.COMPLETED,
        ...dateFilter,
      },
      _count: { id: true },
      _sum: { total: true, taxAmount: true, discountAmount: true },
    });

    return {
      report: 'sales-summary',
      branchId,
      period: { from, to },
      totalSales: sales._count.id,
      totalAmount: Number(sales._sum.total ?? 0),
      totalTax: Number(sales._sum.taxAmount ?? 0),
      totalDiscount: Number(sales._sum.discountAmount ?? 0),
    };
  }

  async getInventoryValuation(branchId: string) {
    const items = await this.prisma.inventoryItem.findMany({
      where: { branchId },
      include: { product: { select: { name: true, sku: true, costPrice: true, salePrice: true } } },
    });

    let totalCost = 0;
    let totalRetail = 0;

    const products = items.map((item) => {
      const qty = Number(item.quantity);
      const cost = qty * Number(item.product.costPrice);
      const retail = qty * Number(item.product.salePrice);
      totalCost += cost;
      totalRetail += retail;

      return {
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        quantity: qty,
        costValue: cost,
        retailValue: retail,
      };
    });

    return {
      report: 'inventory-valuation',
      branchId,
      totalCost,
      totalRetail,
      productCount: products.length,
      products,
    };
  }

  async getTopProducts(branchId: string, limit = 10, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);

    const items = await this.prisma.saleItem.groupBy({
      by: ['productId'],
      where: {
        sale: {
          branchId,
          status: SaleStatus.COMPLETED,
          ...dateFilter,
        },
      },
      _sum: { quantity: true, total: true },
      orderBy: { _sum: { total: 'desc' } },
      take: limit,
    });

    const productIds = items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, sku: true },
    });

    const productMap = new Map(products.map((p) => [p.id, p]));

    return {
      report: 'top-products',
      branchId,
      period: { from, to },
      items: items.map((item, index) => ({
        rank: index + 1,
        productId: item.productId,
        name: productMap.get(item.productId)?.name,
        sku: productMap.get(item.productId)?.sku,
        quantitySold: Number(item._sum.quantity ?? 0),
        totalRevenue: Number(item._sum.total ?? 0),
      })),
    };
  }

  async getCashRegisterSummary(branchId: string, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to, 'closedAt');

    const sessions = await this.prisma.registerSession.findMany({
      where: {
        register: { branchId },
        status: 'CLOSED',
        ...dateFilter,
      },
      include: { register: { select: { code: true, name: true } } },
    });

    return {
      report: 'cash-register-summary',
      branchId,
      period: { from, to },
      sessionCount: sessions.length,
      sessions: sessions.map((s) => ({
        id: s.id,
        registerCode: s.register.code,
        registerName: s.register.name,
        openingAmount: Number(s.openingAmount),
        closingAmount: s.closingAmount ? Number(s.closingAmount) : null,
        expectedAmount: s.expectedAmount ? Number(s.expectedAmount) : null,
        difference: s.difference ? Number(s.difference) : null,
        openedAt: s.openedAt.toISOString(),
        closedAt: s.closedAt?.toISOString(),
      })),
    };
  }

  private buildDateFilter(from?: string, to?: string, field = 'completedAt') {
    if (!from && !to) return {};

    const filter: { gte?: Date; lte?: Date } = {};
    if (from) filter.gte = new Date(from);
    if (to) filter.lte = new Date(to);

    return { [field]: filter };
  }
}
