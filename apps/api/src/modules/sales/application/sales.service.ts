import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { SaleStatus, CashMovementType, RegisterSessionStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { SaleRepository } from '../infrastructure/sale.repository';
import { AuditService } from '../../audit/application/audit.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { CheckoutDto } from './dto/checkout.dto';
import { PaymentMethod, JwtPayload } from '@puntoventa/shared';

@Injectable()
export class SalesService {
  constructor(
    private readonly saleRepository: SaleRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async createTab(dto: CreateSaleDto, user: JwtPayload) {
    await this.assertRegisterIsOpen(dto.registerId);

    const tabId = dto.tabId ?? uuidv4();

    const sale = await this.prisma.sale.create({
      data: {
        branchId: dto.branchId,
        registerId: dto.registerId,
        userId: user.sub,
        customerId: dto.customerId,
        tabId,
        tabOrder: dto.tabOrder ?? 0,
        status: SaleStatus.ACTIVE,
        notes: dto.notes,
      },
      include: { items: true, customer: true },
    });

    return this.mapSaleToDto(sale);
  }

  async getActiveTabs(registerId: string) {
    const sales = await this.saleRepository.findActiveByRegister(registerId);
    return sales.map((s) => ({
      id: s.id,
      tabId: s.tabId,
      label: s.customer?.name ?? `Venta ${(s.tabOrder ?? 0) + 1}`,
      order: s.tabOrder,
      status: s.status,
      itemCount: s.items.length,
      total: Number(s.total),
      customerName: s.customer?.name,
      updatedAt: s.updatedAt.toISOString(),
    }));
  }

  async findById(id: string) {
    const sale = await this.saleRepository.findByIdWithDetails(id);
    if (!sale) throw new NotFoundException('Venta no encontrada');
    return this.mapSaleToDto(sale);
  }

  async list(params: {
    branchId: string;
    search?: string;
    status?: SaleStatus;
    page?: number;
    limit?: number;
  }) {
    const result = await this.saleRepository.findByBranch(params.branchId, params);

    return {
      ...result,
      items: result.items.map((sale) => ({
        id: sale.id,
        documentNumber: sale.documentNumber ?? undefined,
        status: sale.status,
        total: Number(sale.total),
        itemCount: sale._count.items,
        customerName: sale.customer?.name,
        registerName: sale.register.name,
        cashierName: `${sale.user.firstName} ${sale.user.lastName}`.trim(),
        completedAt: sale.completedAt?.toISOString(),
        createdAt: sale.createdAt.toISOString(),
      })),
    };
  }

  async update(id: string, dto: UpdateSaleDto, user: JwtPayload) {
    const existing = await this.saleRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Venta no encontrada');

    if (existing.status === SaleStatus.COMPLETED || existing.status === SaleStatus.VOIDED) {
      throw new BadRequestException('No se puede modificar una venta finalizada');
    }

    if (dto.items) {
      await this.assertRegisterIsOpen(existing.registerId);
    }

    if (dto.version !== undefined && dto.version !== existing.version) {
      throw new ConflictException('La venta fue modificada por otro usuario. Recargue e intente de nuevo.');
    }

    const result = await this.prisma.executeInTransaction(async (tx) => {
      if (dto.items) {
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.saleItem.createMany({
          data: dto.items.map((item) => ({
            saleId: id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            costPrice: item.costPrice ?? 0,
            discountAmount: item.discountAmount ?? 0,
            discountPercent: item.discountPercent ?? 0,
            taxRate: item.taxRate ?? 0,
            taxAmount: item.taxAmount ?? 0,
            subtotal: item.subtotal,
            total: item.total,
            notes: item.notes,
          })),
        });
      }

      return tx.sale.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          discountAmount: dto.discountAmount,
          discountPercent: dto.discountPercent,
          subtotal: dto.subtotal,
          taxAmount: dto.taxAmount,
          total: dto.total,
          notes: dto.notes,
          version: { increment: 1 },
        },
        include: { items: { include: { product: true } }, customer: true },
      });
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'UPDATE',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      newValues: { total: dto.total } as Prisma.InputJsonValue,
    });

    return this.mapSaleToDto(result);
  }

  async suspend(id: string, user: JwtPayload) {
    const sale = await this.prisma.sale.update({
      where: { id, status: { in: [SaleStatus.ACTIVE, SaleStatus.DRAFT] } },
      data: { status: SaleStatus.SUSPENDED, suspendedAt: new Date() },
    });
    if (!sale) throw new NotFoundException('Venta no encontrada');
    await this.auditService.log({
      userId: user.sub,
      action: 'UPDATE',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      newValues: { status: 'SUSPENDED' },
    });
    return sale;
  }

  async recover(id: string, user: JwtPayload) {
    const sale = await this.prisma.sale.update({
      where: { id, status: SaleStatus.SUSPENDED },
      data: { status: SaleStatus.ACTIVE, suspendedAt: null },
    });
    if (!sale) throw new NotFoundException('Venta suspendida no encontrada');
    return sale;
  }

  async checkout(id: string, dto: CheckoutDto, user: JwtPayload) {
    const existing = await this.saleRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Venta no encontrada');
    if (existing.version !== dto.version) {
      throw new ConflictException('Conflicto de versión. Recargue la venta.');
    }

    const documentNumber = await this.generateDocumentNumber(existing.branchId);

    const result = await this.prisma.executeInTransaction(async (tx) => {
      const openSession = await tx.registerSession.findFirst({
        where: {
          registerId: existing.registerId,
          status: RegisterSessionStatus.OPEN,
        },
      });
      if (!openSession) {
        throw new BadRequestException('Debe abrir la caja antes de cobrar una venta');
      }

      for (const item of existing.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product?.trackInventory) {
          const updated = await tx.inventoryItem.updateMany({
            where: {
              branchId: existing.branchId,
              productId: item.productId,
              quantity: { gte: item.quantity },
            },
            data: {
              quantity: { decrement: item.quantity },
              version: { increment: 1 },
            },
          });
          if (updated.count === 0) {
            const config = await tx.businessConfig.findFirst({
              where: { branchId: existing.branchId },
            });
            if (!config?.allowNegativeStock) {
              throw new BadRequestException(
                `Stock insuficiente para ${product.name}`,
              );
            }
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
                quantity: -Number(item.quantity),
              },
              update: {
                quantity: { decrement: item.quantity },
              },
            });
          }
        }
      }

      await tx.salePayment.deleteMany({ where: { saleId: id } });
      await tx.salePayment.createMany({
        data: dto.payments.map((p) => ({
          saleId: id,
          method: p.method,
          amount: p.amount,
          reference: p.reference,
        })),
      });

      const totalPaid = dto.payments.reduce((sum, p) => sum + p.amount, 0);

      const sale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.COMPLETED,
          documentNumber,
          registerSessionId: openSession.id,
          amountPaid: totalPaid,
          changeAmount: Math.max(0, totalPaid - Number(existing.total)),
          completedAt: new Date(),
          version: { increment: 1 },
        },
        include: { items: { include: { product: true } }, payments: true, customer: true },
      });

      for (const payment of dto.payments) {
        if (payment.method === PaymentMethod.CASH && payment.amount > 0) {
          await tx.cashMovement.create({
            data: {
              registerSessionId: openSession.id,
              userId: user.sub,
              type: CashMovementType.SALE,
              amount: payment.amount,
              description: `Venta ${documentNumber}`,
              reference: documentNumber,
            },
          });
        }
      }

      return sale;
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SALE',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      newValues: { documentNumber, total: Number(result.total) },
    });

    return this.mapSaleToDto(result);
  }

  private async generateDocumentNumber(branchId: string): Promise<string> {
    const count = await this.prisma.sale.count({
      where: { branchId, status: SaleStatus.COMPLETED },
    });
    const date = new Date();
    const prefix = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `V-${prefix}-${String(count + 1).padStart(6, '0')}`;
  }

  private mapSaleToDto(sale: {
    id: string;
    tabId: string | null;
    registerId: string;
    customerId: string | null;
    status: SaleStatus;
    documentNumber?: string | null;
    subtotal: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    discountPercent: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    amountPaid: Prisma.Decimal;
    changeAmount: Prisma.Decimal;
    notes: string | null;
    version: number;
    completedAt?: Date | null;
    customer?: { name: string } | null;
    items: Array<{
      id: string;
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      costPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      discountPercent: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      total: Prisma.Decimal;
      notes: string | null;
      product?: { name: string; sku: string };
    }>;
    payments?: Array<{ method: string; amount: Prisma.Decimal; reference: string | null }>;
  }) {
    return {
      id: sale.id,
      tabId: sale.tabId ?? undefined,
      registerId: sale.registerId,
      customerId: sale.customerId ?? undefined,
      customerName: sale.customer?.name,
      status: sale.status,
      documentNumber: sale.documentNumber ?? undefined,
      items: sale.items.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.product?.name,
        sku: i.product?.sku,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        costPrice: Number(i.costPrice),
        discountAmount: Number(i.discountAmount),
        discountPercent: Number(i.discountPercent),
        taxRate: Number(i.taxRate),
        subtotal: Number(i.subtotal),
        total: Number(i.total),
        notes: i.notes ?? undefined,
      })),
      payments: sale.payments?.map((p) => ({
        method: p.method,
        amount: Number(p.amount),
        reference: p.reference ?? undefined,
      })),
      subtotal: Number(sale.subtotal),
      discountAmount: Number(sale.discountAmount),
      discountPercent: Number(sale.discountPercent),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      amountPaid: Number(sale.amountPaid),
      changeAmount: Number(sale.changeAmount),
      notes: sale.notes ?? undefined,
      version: sale.version,
      completedAt: sale.completedAt?.toISOString(),
    };
  }

  private async assertRegisterIsOpen(registerId: string): Promise<void> {
    const session = await this.prisma.registerSession.findFirst({
      where: { registerId, status: RegisterSessionStatus.OPEN },
    });
    if (!session) {
      throw new BadRequestException('Debe abrir la caja antes de realizar ventas');
    }
  }
}
