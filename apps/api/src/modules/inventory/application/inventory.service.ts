import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AdjustmentStatus, AdjustmentType, Prisma } from '@prisma/client';
import { InventoryRepository } from '../infrastructure/inventory.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateAdjustmentDto } from './dto/create-adjustment.dto';
import { JwtPayload } from '@puntoventa/shared';

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

  async findAdjustments(branchId: string, params?: { page?: number; limit?: number }) {
    const result = await this.inventoryRepository.findAdjustmentsByBranch(branchId, params);
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
    user?: { username: string };
  }) {
    return {
      id: adjustment.id,
      branchId: adjustment.branchId,
      userId: adjustment.userId,
      username: adjustment.user?.username,
      type: adjustment.type,
      status: adjustment.status,
      reason: adjustment.reason ?? undefined,
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
