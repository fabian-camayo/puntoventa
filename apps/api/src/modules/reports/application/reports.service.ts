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
      _sum: { total: true, taxAmount: true, discountAmount: true, subtotal: true },
    });

    return {
      report: 'sales-summary',
      branchId,
      period: { from, to },
      totalSales: sales._count.id,
      totalAmount: Number(sales._sum.total ?? 0),
      totalSubtotal: Number(sales._sum.subtotal ?? 0),
      totalTax: Number(sales._sum.taxAmount ?? 0),
      totalDiscount: Number(sales._sum.discountAmount ?? 0),
    };
  }

  /**
   * Reporte de ventas y ganancias: resumen, serie diaria y top productos.
   * Costo = SaleItem.costPrice * quantity; si costPrice es 0 usa Product.costPrice * stockFactor.
   */
  async getSalesProfit(branchId: string, from?: string, to?: string) {
    const dateFilter = this.buildDateFilter(from, to);

    const sales = await this.prisma.sale.findMany({
      where: {
        branchId,
        status: SaleStatus.COMPLETED,
        ...dateFilter,
      },
      select: {
        id: true,
        documentNumber: true,
        completedAt: true,
        subtotal: true,
        taxAmount: true,
        discountAmount: true,
        total: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            stockFactor: true,
            costPrice: true,
            subtotal: true,
            total: true,
            product: { select: { name: true, sku: true, costPrice: true } },
          },
        },
      },
      orderBy: { completedAt: 'asc' },
    });

    let totalRevenue = 0;
    let totalSubtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let totalCost = 0;

    const byDay = new Map<
      string,
      { date: string; salesCount: number; revenue: number; cost: number; profit: number }
    >();
    const byProduct = new Map<
      string,
      {
        productId: string;
        sku: string;
        name: string;
        quantitySold: number;
        revenue: number;
        cost: number;
        profit: number;
      }
    >();

    for (const sale of sales) {
      const revenue = Number(sale.total);
      const subtotal = Number(sale.subtotal);
      const tax = Number(sale.taxAmount);
      const discount = Number(sale.discountAmount);
      totalRevenue += revenue;
      totalSubtotal += subtotal;
      totalTax += tax;
      totalDiscount += discount;

      let saleCost = 0;
      for (const item of sale.items) {
        const qty = Number(item.quantity);
        const stockFactor = Number(item.stockFactor) || 1;
        const snapCost = Number(item.costPrice);
        const unitCost =
          snapCost > 0 ? snapCost : Number(item.product.costPrice) * stockFactor;
        const lineCost = unitCost * qty;
        const lineRevenue = Number(item.total);
        saleCost += lineCost;

        const existing = byProduct.get(item.productId);
        if (existing) {
          existing.quantitySold += qty;
          existing.revenue += lineRevenue;
          existing.cost += lineCost;
          existing.profit = existing.revenue - existing.cost;
        } else {
          byProduct.set(item.productId, {
            productId: item.productId,
            sku: item.product.sku,
            name: item.product.name,
            quantitySold: qty,
            revenue: lineRevenue,
            cost: lineCost,
            profit: lineRevenue - lineCost,
          });
        }
      }

      totalCost += saleCost;
      const dayKey = this.formatDayKey(sale.completedAt ?? undefined);
      const day = byDay.get(dayKey) ?? {
        date: dayKey,
        salesCount: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
      };
      day.salesCount += 1;
      day.revenue += revenue;
      day.cost += saleCost;
      day.profit = day.revenue - day.cost;
      byDay.set(dayKey, day);
    }

    const profit = totalRevenue - totalCost;
    const marginPercent =
      totalRevenue > 0 ? Math.round((profit / totalRevenue) * 10000) / 100 : 0;

    const topProducts = [...byProduct.values()]
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 15)
      .map((item, index) => ({
        rank: index + 1,
        ...item,
        quantitySold: Math.round(item.quantitySold * 1000) / 1000,
        revenue: Math.round(item.revenue * 100) / 100,
        cost: Math.round(item.cost * 100) / 100,
        profit: Math.round(item.profit * 100) / 100,
      }));

    return {
      report: 'sales-profit',
      branchId,
      period: { from, to },
      summary: {
        salesCount: sales.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSubtotal: Math.round(totalSubtotal * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        totalProfit: Math.round(profit * 100) / 100,
        marginPercent,
      },
      daily: [...byDay.values()].map((d) => ({
        ...d,
        revenue: Math.round(d.revenue * 100) / 100,
        cost: Math.round(d.cost * 100) / 100,
        profit: Math.round(d.profit * 100) / 100,
      })),
      topProducts,
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

  private formatDayKey(value?: Date | null): string {
    const d = value ?? new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private buildDateFilter(from?: string, to?: string, field = 'completedAt') {
    if (!from && !to) return {};

    const filter: { gte?: Date; lte?: Date } = {};
    if (from) {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(from.trim());
      filter.gte = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0, 0)
        : new Date(from);
    }
    if (to) {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(to.trim());
      filter.lte = match
        ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59, 999)
        : new Date(to);
    }

    return { [field]: filter };
  }
}
