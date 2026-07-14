import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PurchaseStatus, Prisma } from '@prisma/client';
import { PurchaseRepository } from '../infrastructure/purchase.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { JwtPayload } from '@puntoventa/shared';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly purchaseRepository: PurchaseRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    branchId: string,
    params?: { page?: number; limit?: number; search?: string; status?: string },
  ) {
    const status =
      params?.status && Object.values(PurchaseStatus).includes(params.status as PurchaseStatus)
        ? (params.status as PurchaseStatus)
        : undefined;
    const result = await this.purchaseRepository.findByBranch(branchId, {
      page: params?.page,
      limit: params?.limit,
      search: params?.search,
      status,
    });
    return {
      ...result,
      items: result.items.map((p) => this.mapPurchaseToDto(p)),
    };
  }

  async findById(id: string) {
    const purchase = await this.purchaseRepository.findByIdWithDetails(id);
    if (!purchase) throw new NotFoundException('Compra no encontrada');
    return this.mapPurchaseToDto(purchase);
  }

  async create(dto: CreatePurchaseDto, actor: JwtPayload) {
    if (!dto.items?.length) {
      throw new BadRequestException('La compra debe tener al menos un producto');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, branchId: dto.branchId, isActive: true },
    });
    if (!supplier) throw new BadRequestException('Proveedor no válido');

    const existing = await this.prisma.purchase.findUnique({
      where: {
        branchId_documentNumber: {
          branchId: dto.branchId,
          documentNumber: dto.documentNumber,
        },
      },
    });
    if (existing) throw new ConflictException('El número de documento ya existe');

    const totals = this.calculateTotals(dto.items);

    const purchase = await this.prisma.executeInTransaction(async (tx) => {
      const resolvedItems = await this.resolvePurchaseItemUnits(tx, dto.items);
      return tx.purchase.create({
        data: {
          branchId: dto.branchId,
          supplierId: dto.supplierId,
          userId: actor.sub,
          documentNumber: dto.documentNumber,
          status: PurchaseStatus.DRAFT,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
          notes: dto.notes,
          items: {
            create: resolvedItems.map((item) => {
              const lineSubtotal = item.quantity * item.unitCost;
              const lineTax = lineSubtotal * ((item.taxRate ?? 0) / 100);
              return {
                productId: item.productId,
                unitTypeId: item.unitTypeId,
                stockFactor: item.stockFactor,
                quantity: item.quantity,
                unitCost: item.unitCost,
                taxRate: item.taxRate ?? 0,
                subtotal: lineSubtotal,
                taxAmount: lineTax,
                total: lineSubtotal + lineTax,
              };
            }),
          },
        },
        include: {
          supplier: true,
          items: { include: { product: true, unitType: true } },
        },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'purchases',
      entityType: 'Purchase',
      entityId: purchase.id,
      newValues: { documentNumber: dto.documentNumber } as Prisma.InputJsonValue,
    });

    return this.mapPurchaseToDto(purchase);
  }

  async update(id: string, dto: UpdatePurchaseDto, actor: JwtPayload) {
    const existing = await this.purchaseRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Compra no encontrada');
    if (existing.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden modificar compras en borrador');
    }

    const purchase = await this.prisma.executeInTransaction(async (tx) => {
      let totals = {
        subtotal: Number(existing.subtotal),
        taxAmount: Number(existing.taxAmount),
        total: Number(existing.total),
      };

      if (dto.items) {
        if (!dto.items.length) {
          throw new BadRequestException('La compra debe tener al menos un producto');
        }
        totals = this.calculateTotals(dto.items);
        const resolvedItems = await this.resolvePurchaseItemUnits(tx, dto.items);
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchaseItem.createMany({
          data: resolvedItems.map((item) => {
            const lineSubtotal = item.quantity * item.unitCost;
            const lineTax = lineSubtotal * ((item.taxRate ?? 0) / 100);
            return {
              purchaseId: id,
              productId: item.productId,
              unitTypeId: item.unitTypeId,
              stockFactor: item.stockFactor,
              quantity: item.quantity,
              unitCost: item.unitCost,
              taxRate: item.taxRate ?? 0,
              subtotal: lineSubtotal,
              taxAmount: lineTax,
              total: lineSubtotal + lineTax,
            };
          }),
        });
      }

      return tx.purchase.update({
        where: { id },
        data: {
          notes: dto.notes,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
        },
        include: {
          supplier: true,
          items: { include: { product: true, unitType: true } },
        },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'purchases',
      entityType: 'Purchase',
      entityId: id,
    });

    return this.mapPurchaseToDto(purchase);
  }

  async receive(id: string, actor: JwtPayload) {
    const existing = await this.purchaseRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Compra no encontrada');
    if (existing.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden recibir compras en borrador');
    }
    if (!existing.items.length) {
      throw new BadRequestException('La compra no tiene productos');
    }

    const purchase = await this.prisma.executeInTransaction(async (tx) => {
      for (const item of existing.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new BadRequestException(`Producto no encontrado (${item.productId})`);
        }

        if (product.trackInventory) {
          const stockQty = new Prisma.Decimal(item.quantity).mul(item.stockFactor);
          await tx.inventoryItem.upsert({
            where: {
              branchId_productId: {
                branchId: existing.branchId,
                productId: item.productId,
              },
            },
            create: {
              branchId: existing.branchId,
              productId: item.productId,
              quantity: stockQty,
            },
            update: {
              quantity: { increment: stockQty },
              version: { increment: 1 },
            },
          });
        }

        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: item.unitCost },
        });
      }

      return tx.purchase.update({
        where: { id },
        data: {
          status: PurchaseStatus.RECEIVED,
          receivedAt: new Date(),
        },
        include: {
          supplier: true,
          items: { include: { product: true, unitType: true } },
        },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'purchases',
      entityType: 'Purchase',
      entityId: id,
      newValues: {
        status: 'RECEIVED',
        documentNumber: purchase.documentNumber,
      } as Prisma.InputJsonValue,
    });

    return this.mapPurchaseToDto(purchase);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.purchaseRepository.findById(id);
    if (!existing) throw new NotFoundException('Compra no encontrada');
    if (existing.status !== PurchaseStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden cancelar compras en borrador');
    }

    await this.purchaseRepository.update(id, { status: PurchaseStatus.CANCELLED });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'purchases',
      entityType: 'Purchase',
      entityId: id,
    });

    return { success: true };
  }

  private calculateTotals(items: Array<{ quantity: number; unitCost: number; taxRate?: number }>) {
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of items) {
      const lineSubtotal = item.quantity * item.unitCost;
      const lineTax = lineSubtotal * ((item.taxRate ?? 0) / 100);
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round((subtotal + taxAmount) * 100) / 100,
    };
  }

  private async resolvePurchaseItemUnits(
    tx: Prisma.TransactionClient,
    items: Array<{
      productId: string;
      unitTypeId?: string;
      quantity: number;
      unitCost: number;
      taxRate?: number;
    }>,
  ) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const productUnits = await tx.productUnit.findMany({
      where: { productId: { in: productIds }, isActive: true },
    });
    const byProduct = new Map<string, typeof productUnits>();
    for (const pu of productUnits) {
      const list = byProduct.get(pu.productId) ?? [];
      list.push(pu);
      byProduct.set(pu.productId, list);
    }

    return items.map((item) => {
      const units = byProduct.get(item.productId) ?? [];
      let matched = item.unitTypeId
        ? units.find((u) => u.unitTypeId === item.unitTypeId)
        : units.find((u) => u.isBase);

      if (item.unitTypeId && !matched) {
        throw new BadRequestException(
          'La unidad seleccionada no está configurada para el producto',
        );
      }

      if (!matched && units.length) {
        matched = units.find((u) => u.isBase) ?? units[0];
      }

      return {
        ...item,
        unitTypeId: matched?.unitTypeId ?? null,
        stockFactor: matched ? Number(matched.stockFactor) : 1,
      };
    });
  }

  private mapPurchaseToDto(purchase: {
    id: string;
    branchId: string;
    supplierId: string;
    documentNumber: string;
    status: PurchaseStatus;
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    notes: string | null;
    receivedAt?: Date | null;
    createdAt: Date;
    supplier?: { id: string; name: string; code: string };
    items?: Array<{
      id: string;
      productId: string;
      unitTypeId?: string | null;
      stockFactor?: Prisma.Decimal;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      taxRate?: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      taxAmount?: Prisma.Decimal;
      total: Prisma.Decimal;
      product?: { name: string; sku: string };
      unitType?: { id: string; code: string; name: string } | null;
    }>;
  }) {
    return {
      id: purchase.id,
      branchId: purchase.branchId,
      supplierId: purchase.supplierId,
      supplierName: purchase.supplier?.name,
      documentNumber: purchase.documentNumber,
      status: purchase.status,
      subtotal: Number(purchase.subtotal),
      taxAmount: Number(purchase.taxAmount),
      total: Number(purchase.total),
      notes: purchase.notes ?? undefined,
      receivedAt: purchase.receivedAt?.toISOString(),
      createdAt: purchase.createdAt.toISOString(),
      items: purchase.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name,
        sku: item.product?.sku,
        unitTypeId: item.unitTypeId ?? item.unitType?.id ?? undefined,
        unitTypeCode: item.unitType?.code,
        unitTypeName: item.unitType?.name,
        stockFactor: item.stockFactor != null ? Number(item.stockFactor) : 1,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        taxRate: item.taxRate != null ? Number(item.taxRate) : 0,
        subtotal: Number(item.subtotal),
        taxAmount: item.taxAmount != null ? Number(item.taxAmount) : undefined,
        total: Number(item.total),
      })),
    };
  }
}
