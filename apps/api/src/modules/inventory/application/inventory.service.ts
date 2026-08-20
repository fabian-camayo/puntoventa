import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AdjustmentStatus, AdjustmentType, Prisma } from '@prisma/client';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { CreateManualAdjustmentDto } from './dto/create-manual-adjustment.dto';
import { ListAdjustmentsQueryDto } from './dto/list-adjustments-query.dto';
import { JwtPayload } from '@puntoventa/shared';

/** Señal interna de conflicto de concurrencia optimista (version mismatch) para reintentar. */
class ConcurrentStockUpdateError extends Error {}

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

const MAX_CONCURRENCY_RETRIES = 3;

@Injectable()
export class InventoryService {
  constructor(
    private readonly inventoryRepository: InventoryRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async findStock(branchId: string, params?: { page?: number; limit?: number; search?: string }) {
    const result = await this.inventoryRepository.findByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((item) => ({
        id: item.id,
        productId: item.productId,
        sku: item.product.sku,
        name: item.product.name,
        unit: item.product.unit,
        quantity: Number(item.quantity),
        reserved: Number(item.reserved),
        available: Number(item.quantity) - Number(item.reserved),
        updatedAt: item.updatedAt.toISOString(),
      })),
    };
  }

  async exportStockExcel(
    branchId: string,
    search?: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const items = await this.inventoryRepository.findAllStockForExport(
      branchId,
      search,
    );

    const ExcelJS = (await import('exceljs')).default;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'PuntoVenta';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Inventario', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 18 },
      { header: 'Producto', key: 'name', width: 40 },
      { header: 'Categoría', key: 'category', width: 22 },
      { header: 'Unidad', key: 'unit', width: 12 },
      { header: 'Cantidad', key: 'quantity', width: 12 },
      { header: 'Reservado', key: 'reserved', width: 12 },
      { header: 'Disponible', key: 'available', width: 12 },
      { header: 'Stock mínimo', key: 'minStock', width: 14 },
      { header: 'Costo', key: 'costPrice', width: 12 },
      { header: 'Precio venta', key: 'salePrice', width: 14 },
      { header: 'Actualizado', key: 'updatedAt', width: 20 },
    ];

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { vertical: 'middle' };

    for (const item of items) {
      const quantity = Number(item.quantity);
      const reserved = Number(item.reserved);
      sheet.addRow({
        sku: item.product.sku,
        name: item.product.name,
        category: item.product.category?.name ?? '',
        unit: item.product.unit,
        quantity,
        reserved,
        available: quantity - reserved,
        minStock: item.product.minStock != null ? Number(item.product.minStock) : '',
        costPrice: Number(item.product.costPrice),
        salePrice: Number(item.product.salePrice),
        updatedAt: item.updatedAt.toISOString().slice(0, 19).replace('T', ' '),
      });
    }

    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
    const date = new Date().toISOString().slice(0, 10);
    return {
      buffer,
      filename: `inventario-${date}.xlsx`,
    };
  }

  async findAdjustments(query: ListAdjustmentsQueryDto) {
    const result = await this.inventoryRepository.findAdjustmentsByBranch(query.branchId, {
      page: query.page,
      limit: query.limit,
      search: query.search,
      productId: query.productId,
      userId: query.userId,
      type: query.type,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
    });
    return {
      ...result,
      items: result.items.map((adj) => this.mapAdjustmentToDto(adj)),
    };
  }

  async findAdjustmentById(id: string) {
    const adjustment = await this.inventoryRepository.findAdjustmentById(id);
    if (!adjustment) throw new NotFoundException('Ajuste no encontrado');
    return this.mapAdjustmentToDto(adjustment);
  }

  /**
   * Ajuste manual de stock de UN producto, aplicado de inmediato dentro de una sola
   * transacción (lee stock actual, valida, actualiza InventoryItem y crea el registro
   * de auditoría InventoryAdjustment/Item de forma atómica). No pasa por el flujo
   * DRAFT/apply usado por `createAdjustment` (pensado para ajustes por lote).
   */
  async createManualAdjustment(dto: CreateManualAdjustmentDto, actor: JwtPayload) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    if (product.branchId !== dto.branchId) {
      throw new BadRequestException('El producto no pertenece a la sucursal indicada');
    }
    if (!product.trackInventory) {
      throw new BadRequestException('Este producto no maneja inventario');
    }

    const reason = dto.reason.trim();
    if (!reason) throw new BadRequestException('El motivo es obligatorio');
    const notes = dto.notes?.trim() || undefined;

    if (dto.mode === 'DELTA') {
      if (!dto.quantity) {
        throw new BadRequestException('La cantidad del ajuste debe ser distinta de cero');
      }
      return this.applyDeltaAdjustment(dto, actor, reason, notes);
    }

    if (dto.quantity < 0) {
      throw new BadRequestException('El stock físico no puede ser negativo');
    }
    return this.applySetAdjustment(dto, actor, reason, notes);
  }

  private async applyDeltaAdjustment(
    dto: CreateManualAdjustmentDto,
    actor: JwtPayload,
    reason: string,
    notes: string | undefined,
  ) {
    const delta = new Prisma.Decimal(dto.quantity);
    const type = delta.gt(0) ? AdjustmentType.INCREASE : AdjustmentType.DECREASE;
    const key = { branchId_productId: { branchId: dto.branchId, productId: dto.productId } };

    const adjustment = await this.prisma.executeInTransaction(async (tx) => {
      const guardWhere: Prisma.InventoryItemWhereInput = {
        branchId: dto.branchId,
        productId: dto.productId,
        ...(delta.lt(0) ? { quantity: { gte: delta.abs() } } : {}),
      };

      const updated = await tx.inventoryItem.updateMany({
        where: guardWhere,
        data: { quantity: { increment: delta }, version: { increment: 1 } },
      });

      let current: { quantity: Prisma.Decimal };

      if (updated.count === 0) {
        if (delta.lt(0)) {
          const existing = await tx.inventoryItem.findUnique({ where: key });
          const currentQty = existing ? Number(existing.quantity) : 0;
          throw new BadRequestException(
            `El stock resultante no puede ser negativo (stock actual: ${currentQty}, salida solicitada: ${delta.abs().toNumber()})`,
          );
        }

        try {
          current = await tx.inventoryItem.create({
            data: { branchId: dto.branchId, productId: dto.productId, quantity: delta },
          });
        } catch (err) {
          if (!isUniqueConstraintError(err)) throw err;
          current = await tx.inventoryItem.update({
            where: key,
            data: { quantity: { increment: delta }, version: { increment: 1 } },
          });
        }
      } else {
        current = await tx.inventoryItem.findUniqueOrThrow({ where: key });
      }

      const newQty = Number(current.quantity);
      const previousQty = Math.round((newQty - dto.quantity) * 1000) / 1000;

      return tx.inventoryAdjustment.create({
        data: {
          branchId: dto.branchId,
          userId: actor.sub,
          type,
          status: AdjustmentStatus.APPLIED,
          reason,
          notes,
          appliedAt: new Date(),
          items: {
            create: [{ productId: dto.productId, quantity: delta.abs(), previousQty, newQty }],
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          user: { select: { id: true, username: true, firstName: true, lastName: true } },
        },
      });
    });

    await this.logManualAdjustment(adjustment.id, actor, dto);
    return this.mapAdjustmentToDto(adjustment);
  }

  private async applySetAdjustment(
    dto: CreateManualAdjustmentDto,
    actor: JwtPayload,
    reason: string,
    notes: string | undefined,
  ) {
    const target = new Prisma.Decimal(dto.quantity);
    const key = { branchId_productId: { branchId: dto.branchId, productId: dto.productId } };

    for (let attempt = 1; attempt <= MAX_CONCURRENCY_RETRIES; attempt++) {
      try {
        const adjustment = await this.prisma.executeInTransaction(async (tx) => {
          const existing = await tx.inventoryItem.findUnique({ where: key });
          const previousQty = existing ? Number(existing.quantity) : 0;

          if (existing) {
            const updated = await tx.inventoryItem.updateMany({
              where: { id: existing.id, version: existing.version },
              data: { quantity: target, version: { increment: 1 } },
            });
            if (updated.count === 0) throw new ConcurrentStockUpdateError();
          } else {
            try {
              await tx.inventoryItem.create({
                data: { branchId: dto.branchId, productId: dto.productId, quantity: target },
              });
            } catch (err) {
              if (isUniqueConstraintError(err)) throw new ConcurrentStockUpdateError();
              throw err;
            }
          }

          return tx.inventoryAdjustment.create({
            data: {
              branchId: dto.branchId,
              userId: actor.sub,
              type: AdjustmentType.SET,
              status: AdjustmentStatus.APPLIED,
              reason,
              notes,
              appliedAt: new Date(),
              items: {
                create: [
                  {
                    productId: dto.productId,
                    quantity: target,
                    previousQty,
                    newQty: Number(target),
                  },
                ],
              },
            },
            include: {
              items: { include: { product: { select: { id: true, name: true, sku: true } } } },
              user: { select: { id: true, username: true, firstName: true, lastName: true } },
            },
          });
        });

        await this.logManualAdjustment(adjustment.id, actor, dto);
        return this.mapAdjustmentToDto(adjustment);
      } catch (err) {
        if (err instanceof ConcurrentStockUpdateError) continue;
        throw err;
      }
    }

    throw new ConflictException(
      'El stock fue modificado por otra operación al mismo tiempo. Recargue e intente de nuevo.',
    );
  }

  private async logManualAdjustment(
    adjustmentId: string,
    actor: JwtPayload,
    dto: CreateManualAdjustmentDto,
  ): Promise<void> {
    await this.auditService.log({
      userId: actor.sub,
      action: 'ADJUST_INVENTORY',
      module: 'inventory',
      entityType: 'InventoryAdjustment',
      entityId: adjustmentId,
      newValues: {
        productId: dto.productId,
        mode: dto.mode,
        quantity: dto.quantity,
        reason: dto.reason,
      } as Prisma.InputJsonValue,
    });
  }

  async createAdjustment(dto: CreateAdjustmentDto, actor: JwtPayload) {
    const adjustment = await this.prisma.executeInTransaction(async (tx) => {
      const created = await tx.inventoryAdjustment.create({
        data: {
          branchId: dto.branchId,
          userId: actor.sub,
          type: dto.type,
          status: AdjustmentStatus.DRAFT,
          reason: dto.reason,
          reference: dto.reference,
        },
      });

      const itemsData = [];
      for (const item of dto.items) {
        const inventory = await tx.inventoryItem.findUnique({
          where: { branchId_productId: { branchId: dto.branchId, productId: item.productId } },
        });
        const previousQty = inventory ? Number(inventory.quantity) : 0;
        const newQty = this.calculateNewQuantity(dto.type, previousQty, item.quantity);

        itemsData.push({
          adjustmentId: created.id,
          productId: item.productId,
          quantity: item.quantity,
          previousQty,
          newQty,
        });
      }

      await tx.inventoryAdjustmentItem.createMany({ data: itemsData });

      return tx.inventoryAdjustment.findUnique({
        where: { id: created.id },
        include: { items: { include: { product: true } } },
      });
    });

    return this.mapAdjustmentToDto(adjustment!);
  }

  async applyAdjustment(id: string, actor: JwtPayload) {
    const adjustment = await this.inventoryRepository.findAdjustmentById(id);
    if (!adjustment) throw new NotFoundException('Ajuste no encontrado');
    if (adjustment.status !== AdjustmentStatus.DRAFT) {
      throw new BadRequestException('El ajuste ya fue aplicado o cancelado');
    }

    await this.prisma.executeInTransaction(async (tx) => {
      for (const item of adjustment.items) {
        await tx.inventoryItem.upsert({
          where: {
            branchId_productId: {
              branchId: adjustment.branchId,
              productId: item.productId,
            },
          },
          create: {
            branchId: adjustment.branchId,
            productId: item.productId,
            quantity: item.newQty,
          },
          update: {
            quantity: item.newQty,
            version: { increment: 1 },
          },
        });
      }

      await tx.inventoryAdjustment.update({
        where: { id },
        data: { status: AdjustmentStatus.APPLIED, appliedAt: new Date() },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'ADJUST_INVENTORY',
      module: 'inventory',
      entityType: 'InventoryAdjustment',
      entityId: id,
    });

    return this.findAdjustmentById(id);
  }

  async cancelAdjustment(id: string, actor: JwtPayload) {
    const adjustment = await this.inventoryRepository.findAdjustmentById(id);
    if (!adjustment) throw new NotFoundException('Ajuste no encontrado');
    if (adjustment.status !== AdjustmentStatus.DRAFT) {
      throw new BadRequestException('Solo se pueden cancelar ajustes en borrador');
    }

    await this.prisma.inventoryAdjustment.update({
      where: { id },
      data: { status: AdjustmentStatus.CANCELLED },
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'inventory',
      entityType: 'InventoryAdjustment',
      entityId: id,
      newValues: { status: 'CANCELLED' } as Prisma.InputJsonValue,
    });

    return { success: true };
  }

  private calculateNewQuantity(type: AdjustmentType, previous: number, quantity: number): number {
    switch (type) {
      case AdjustmentType.INCREASE:
        return previous + quantity;
      case AdjustmentType.DECREASE:
        return previous - quantity;
      case AdjustmentType.SET:
        return quantity;
      default:
        return previous;
    }
  }

  private mapAdjustmentToDto(adjustment: {
    id: string;
    branchId: string;
    userId: string;
    type: AdjustmentType;
    status: AdjustmentStatus;
    reason: string | null;
    notes?: string | null;
    reference: string | null;
    appliedAt: Date | null;
    createdAt: Date;
    items?: Array<{
      id: string;
      productId: string;
      quantity: Prisma.Decimal;
      previousQty: Prisma.Decimal;
      newQty: Prisma.Decimal;
      product?: { name: string; sku: string };
    }>;
    user?: { username: string; firstName?: string; lastName?: string };
  }) {
    return {
      id: adjustment.id,
      branchId: adjustment.branchId,
      userId: adjustment.userId,
      username: adjustment.user?.username,
      userName: adjustment.user
        ? `${adjustment.user.firstName ?? ''} ${adjustment.user.lastName ?? ''}`.trim() ||
          adjustment.user.username
        : undefined,
      type: adjustment.type,
      status: adjustment.status,
      reason: adjustment.reason ?? undefined,
      notes: adjustment.notes ?? undefined,
      reference: adjustment.reference ?? undefined,
      appliedAt: adjustment.appliedAt?.toISOString(),
      createdAt: adjustment.createdAt.toISOString(),
      items: adjustment.items?.map((item) => ({
        id: item.id,
        productId: item.productId,
        productName: item.product?.name,
        sku: item.product?.sku,
        quantity: Number(item.quantity),
        previousQty: Number(item.previousQty),
        newQty: Number(item.newQty),
      })),
    };
  }
}
