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

  async findAll(branchId: string, params?: { page?: number; limit?: number; search?: string }) {
    const result = await this.purchaseRepository.findByBranch(branchId, params);
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
    const existing = await this.prisma.purchase.findUnique({
      where: { branchId_documentNumber: { branchId: dto.branchId, documentNumber: dto.documentNumber } },
    });
    if (existing) throw new ConflictException('El número de documento ya existe');

    const totals = this.calculateTotals(dto.items);

    const purchase = await this.prisma.executeInTransaction(async (tx) => {
      const created = await tx.purchase.create({
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
            create: dto.items.map((item) => {
              const lineSubtotal = item.quantity * item.unitCost;
              const lineTax = lineSubtotal * ((item.taxRate ?? 0) / 100);
              return {
                productId: item.productId,
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
        include: { supplier: true, items: true },
      });

      return created;
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
      if (dto.items) {
        await tx.purchaseItem.deleteMany({ where: { purchaseId: id } });
        await tx.purchaseItem.createMany({
          data: dto.items.map((item) => {
            const lineSubtotal = item.quantity * item.unitCost;
            const lineTax = lineSubtotal * ((item.taxRate ?? 0) / 100);
            return {
              purchaseId: id,
              productId: item.productId,
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
          subtotal: dto.subtotal,
          taxAmount: dto.taxAmount,
          total: dto.total,
        },
        include: { supplier: true, items: true },
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

    return { subtotal, taxAmount, total: subtotal + taxAmount };
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
    createdAt: Date;
    supplier?: { id: string; name: string; code: string };
    items?: Array<{
      id: string;
      productId: string;
      quantity: Prisma.Decimal;
      unitCost: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      total: Prisma.Decimal;
      product?: { name: string; sku: string };
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
      createdAt: purchase.createdAt.toISOString(),
      items: purchase.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name,
        sku: item.product?.sku,
        quantity: Number(item.quantity),
        unitCost: Number(item.unitCost),
        subtotal: Number(item.subtotal),
        total: Number(item.total),
      })),
    };
  }
}
