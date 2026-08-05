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
import { AdminUpdateSaleDto } from './dto/admin-update-sale.dto';
import { JwtPayload } from '@puntoventa/shared';

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

    let customerId = dto.customerId;
    if (!customerId) {
      const config = await this.prisma.businessConfig.findFirst({
        where: { branchId: dto.branchId },
        select: { defaultCustomerId: true },
      });
      customerId = config?.defaultCustomerId ?? undefined;
    }

    if (customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: customerId, branchId: dto.branchId, isActive: true },
      });
      if (!customer) {
        throw new BadRequestException('Cliente no válido');
      }
    }

    const sale = await this.prisma.sale.create({
      data: {
        branchId: dto.branchId,
        registerId: dto.registerId,
        userId: user.sub,
        customerId,
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
        const resolvedItems = await this.resolveSaleItemUnits(tx, dto.items);
        await tx.saleItem.deleteMany({ where: { saleId: id } });
        await tx.saleItem.createMany({
          data: resolvedItems.map((item) => ({
            saleId: id,
            productId: item.productId,
            unitTypeId: item.unitTypeId,
            stockFactor: item.stockFactor,
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
        include: {
          items: { include: { product: true, unitType: true } },
          customer: true,
        },
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

      const documentNumber = await this.allocateDocumentNumber(tx, existing.branchId);

      await this.deductInventory(tx, existing.branchId, existing.items);

      const paymentSettlement = await this.applyPayments(
        tx,
        id,
        Number(existing.total),
        dto.payments,
      );

      const sale = await tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.COMPLETED,
          documentNumber,
          registerSessionId: openSession.id,
          amountPaid: paymentSettlement.totalPaid,
          changeAmount: paymentSettlement.changeAmount,
          completedAt: new Date(),
          version: { increment: 1 },
        },
        include: {
          items: { include: { product: true, unitType: true } },
          payments: { include: { paymentType: true } },
          customer: true,
        },
      });

      if (paymentSettlement.cashIntoRegister > 0) {
        await tx.cashMovement.create({
          data: {
            registerSessionId: openSession.id,
            userId: user.sub,
            type: CashMovementType.SALE,
            amount: paymentSettlement.cashIntoRegister,
            description: `Venta ${documentNumber}`,
            reference: documentNumber,
          },
        });
      }

      return sale;
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'SALE',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      newValues: { documentNumber: result.documentNumber, total: Number(result.total) },
    });

    return this.mapSaleToDto(result);
  }

  /** Anula una venta completada: restaura stock y revierte el efectivo en caja. */
  async voidSale(id: string, user: JwtPayload) {
    const existing = await this.saleRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Venta no encontrada');
    if (existing.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Solo se pueden anular ventas completadas');
    }

    const result = await this.prisma.executeInTransaction(async (tx) => {
      await this.restoreInventory(tx, existing.branchId, existing.items);
      await this.reverseSaleCashMovement(tx, existing, user.sub);

      return tx.sale.update({
        where: { id },
        data: {
          status: SaleStatus.VOIDED,
          version: { increment: 1 },
        },
        include: {
          items: { include: { product: true, unitType: true } },
          payments: { include: { paymentType: true } },
          customer: true,
        },
      });
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'VOID',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      oldValues: {
        documentNumber: existing.documentNumber,
        total: Number(existing.total),
        status: existing.status,
      },
    });

    return this.mapSaleToDto(result);
  }

  /**
   * Edita una venta completada: revierte stock/caja anteriores,
   * aplica nuevos ítems y pagos, y mantiene el número de documento.
   */
  async adminUpdate(id: string, dto: AdminUpdateSaleDto, user: JwtPayload) {
    const existing = await this.saleRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Venta no encontrada');
    if (existing.status !== SaleStatus.COMPLETED) {
      throw new BadRequestException('Solo se pueden editar ventas completadas');
    }
    if (existing.version !== dto.version) {
      throw new ConflictException('Conflicto de versión. Recargue la venta.');
    }

    const documentNumber = existing.documentNumber;
    if (!documentNumber) {
      throw new BadRequestException('La venta no tiene número de documento');
    }

    const result = await this.prisma.executeInTransaction(async (tx) => {
      await this.restoreInventory(tx, existing.branchId, existing.items);
      await this.reverseSaleCashMovement(tx, existing, user.sub);

      const resolvedItems = await this.resolveSaleItemUnits(tx, dto.items);
      await tx.saleItem.deleteMany({ where: { saleId: id } });
      await tx.saleItem.createMany({
        data: resolvedItems.map((item) => ({
          saleId: id,
          productId: item.productId,
          unitTypeId: item.unitTypeId,
          stockFactor: item.stockFactor,
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

      await this.deductInventory(tx, existing.branchId, resolvedItems);

      const saleTotal =
        dto.total ??
        resolvedItems.reduce((sum, item) => sum + Number(item.total), 0);

      const paymentSettlement = await this.applyPayments(
        tx,
        id,
        saleTotal,
        dto.payments,
      );

      const sessionId =
        existing.registerSessionId ??
        (
          await tx.registerSession.findFirst({
            where: {
              registerId: existing.registerId,
              status: RegisterSessionStatus.OPEN,
            },
            select: { id: true },
          })
        )?.id;

      if (paymentSettlement.cashIntoRegister > 0) {
        if (!sessionId) {
          throw new BadRequestException(
            'No hay sesión de caja para registrar el efectivo de la venta editada',
          );
        }
        await tx.cashMovement.create({
          data: {
            registerSessionId: sessionId,
            userId: user.sub,
            type: CashMovementType.SALE,
            amount: paymentSettlement.cashIntoRegister,
            description: `Venta ${documentNumber} (editada)`,
            reference: documentNumber,
          },
        });
      }

      return tx.sale.update({
        where: { id },
        data: {
          customerId: dto.customerId,
          discountAmount: dto.discountAmount,
          discountPercent: dto.discountPercent,
          subtotal: dto.subtotal ?? saleTotal - (dto.taxAmount ?? 0),
          taxAmount: dto.taxAmount,
          total: saleTotal,
          amountPaid: paymentSettlement.totalPaid,
          changeAmount: paymentSettlement.changeAmount,
          notes: dto.notes,
          registerSessionId: sessionId ?? existing.registerSessionId,
          version: { increment: 1 },
        },
        include: {
          items: { include: { product: true, unitType: true } },
          payments: { include: { paymentType: true } },
          customer: true,
        },
      });
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'UPDATE',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      oldValues: { total: Number(existing.total) },
      newValues: { total: Number(result.total), documentNumber },
    });

    return this.mapSaleToDto(result);
  }

  /**
   * Elimina una venta.
   * Si está completada, restaura stock y revierte el efectivo antes de borrarla.
   */
  async remove(id: string, user: JwtPayload) {
    const existing = await this.saleRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Venta no encontrada');

    await this.prisma.executeInTransaction(async (tx) => {
      if (existing.status === SaleStatus.COMPLETED) {
        await this.restoreInventory(tx, existing.branchId, existing.items);
        await this.reverseSaleCashMovement(tx, existing, user.sub);
      }

      await tx.sale.delete({ where: { id } });
    });

    await this.auditService.log({
      userId: user.sub,
      action: 'DELETE',
      module: 'sales',
      entityType: 'Sale',
      entityId: id,
      oldValues: {
        documentNumber: existing.documentNumber,
        status: existing.status,
        total: Number(existing.total),
      },
    });

    return { deleted: true };
  }

  private async allocateDocumentNumber(
    tx: Prisma.TransactionClient,
    branchId: string,
  ): Promise<string> {
    const config = await tx.businessConfig.findUnique({ where: { branchId } });
    const prefix = (config?.invoicePrefix ?? 'FEV').trim().toUpperCase() || 'FEV';
    const padding = Math.min(10, Math.max(1, config?.invoiceNumberPadding ?? 3));
    const next = Math.max(1, config?.invoiceNextNumber ?? 1);

    if (config) {
      await tx.businessConfig.update({
        where: { branchId },
        data: { invoiceNextNumber: next + 1 },
      });
    }

    return `${prefix}${String(next).padStart(padding, '0')}`;
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
      unitTypeId?: string | null;
      stockFactor?: Prisma.Decimal;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      costPrice: Prisma.Decimal;
      discountAmount: Prisma.Decimal;
      discountPercent: Prisma.Decimal;
      taxRate: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      subtotal: Prisma.Decimal;
      total: Prisma.Decimal;
      notes: string | null;
      product?: { name: string; sku: string };
      unitType?: { id: string; code: string; name: string } | null;
    }>;
    payments?: Array<{
      amount: Prisma.Decimal;
      reference: string | null;
      paymentTypeId?: string;
      paymentType?: {
        id: string;
        code: string;
        name: string;
        affectsCash: boolean;
      };
      method?: string;
    }>;
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
        unitTypeId: i.unitTypeId ?? i.unitType?.id ?? undefined,
        unitTypeCode: i.unitType?.code,
        unitTypeName: i.unitType?.name,
        stockFactor: i.stockFactor != null ? Number(i.stockFactor) : 1,
        quantity: Number(i.quantity),
        unitPrice: Number(i.unitPrice),
        costPrice: Number(i.costPrice),
        discountAmount: Number(i.discountAmount),
        discountPercent: Number(i.discountPercent),
        taxRate: Number(i.taxRate),
        taxAmount: Number(i.taxAmount),
        subtotal: Number(i.subtotal),
        total: Number(i.total),
        notes: i.notes ?? undefined,
      })),
      payments: sale.payments?.map((p) => ({
        paymentTypeId: p.paymentTypeId ?? p.paymentType?.id ?? '',
        paymentTypeName: p.paymentType?.name,
        paymentTypeCode: p.paymentType?.code,
        affectsCash: p.paymentType?.affectsCash,
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

  private async deductInventory(
    tx: Prisma.TransactionClient,
    branchId: string,
    items: Array<{
      productId: string;
      quantity: Prisma.Decimal | number;
      stockFactor?: Prisma.Decimal | number;
      product?: { name?: string } | null;
    }>,
  ): Promise<void> {
    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product?.trackInventory) continue;

      const stockQty = new Prisma.Decimal(item.quantity).mul(item.stockFactor ?? 1);
      const updated = await tx.inventoryItem.updateMany({
        where: {
          branchId,
          productId: item.productId,
          quantity: { gte: stockQty },
        },
        data: {
          quantity: { decrement: stockQty },
          version: { increment: 1 },
        },
      });

      if (updated.count === 0) {
        const config = await tx.businessConfig.findFirst({
          where: { branchId },
        });
        if (!config?.allowNegativeStock) {
          throw new BadRequestException(
            `Stock insuficiente para ${product.name}`,
          );
        }
        await tx.inventoryItem.upsert({
          where: {
            branchId_productId: {
              branchId,
              productId: item.productId,
            },
          },
          create: {
            branchId,
            productId: item.productId,
            quantity: stockQty.negated(),
          },
          update: {
            quantity: { decrement: stockQty },
          },
        });
      }
    }
  }

  private async restoreInventory(
    tx: Prisma.TransactionClient,
    branchId: string,
    items: Array<{
      productId: string;
      quantity: Prisma.Decimal | number;
      stockFactor?: Prisma.Decimal | number;
    }>,
  ): Promise<void> {
    for (const item of items) {
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product?.trackInventory) continue;

      const stockQty = new Prisma.Decimal(item.quantity).mul(item.stockFactor ?? 1);
      await tx.inventoryItem.upsert({
        where: {
          branchId_productId: {
            branchId,
            productId: item.productId,
          },
        },
        create: {
          branchId,
          productId: item.productId,
          quantity: stockQty,
        },
        update: {
          quantity: { increment: stockQty },
          version: { increment: 1 },
        },
      });
    }
  }

  private async applyPayments(
    tx: Prisma.TransactionClient,
    saleId: string,
    saleTotal: number,
    payments: Array<{ paymentTypeId: string; amount: number; reference?: string }>,
  ): Promise<{ totalPaid: number; changeAmount: number; cashIntoRegister: number }> {
    await tx.salePayment.deleteMany({ where: { saleId } });

    const paymentTypeIds = [...new Set(payments.map((p) => p.paymentTypeId))];
    const paymentTypes = await tx.paymentType.findMany({
      where: { id: { in: paymentTypeIds }, isActive: true },
    });
    if (paymentTypes.length !== paymentTypeIds.length) {
      throw new BadRequestException('Uno o más tipos de pago no son válidos');
    }
    const paymentTypeMap = new Map(paymentTypes.map((pt) => [pt.id, pt]));

    let nonCashPaid = 0;
    let cashTendered = 0;

    for (const payment of payments) {
      if (payment.amount <= 0) {
        throw new BadRequestException('El monto de cada pago debe ser mayor a cero');
      }
      const type = paymentTypeMap.get(payment.paymentTypeId)!;
      if (type.affectsCash) {
        cashTendered += payment.amount;
      } else {
        nonCashPaid += payment.amount;
      }
    }

    const cashRequired = Math.max(0, Math.round((saleTotal - nonCashPaid) * 100) / 100);
    const totalPaid = Math.round((nonCashPaid + cashTendered) * 100) / 100;
    if (totalPaid + 0.001 < saleTotal) {
      throw new BadRequestException('El pago es insuficiente para cubrir el total de la venta');
    }
    if (cashTendered + 0.001 < cashRequired) {
      throw new BadRequestException('El efectivo recibido es insuficiente');
    }

    const changeAmount = Math.max(0, Math.round((cashTendered - cashRequired) * 100) / 100);
    const cashIntoRegister = Math.round((cashTendered - changeAmount) * 100) / 100;

    await tx.salePayment.createMany({
      data: payments.map((p) => ({
        saleId,
        paymentTypeId: p.paymentTypeId,
        amount: p.amount,
        reference: p.reference,
      })),
    });

    return { totalPaid, changeAmount, cashIntoRegister };
  }

  private async reverseSaleCashMovement(
    tx: Prisma.TransactionClient,
    sale: {
      documentNumber?: string | null;
      registerSessionId?: string | null;
      registerId: string;
    },
    userId: string,
  ): Promise<void> {
    if (!sale.documentNumber) return;

    let sessionId = sale.registerSessionId;
    if (!sessionId) {
      const openSession = await tx.registerSession.findFirst({
        where: {
          registerId: sale.registerId,
          status: RegisterSessionStatus.OPEN,
        },
        select: { id: true },
      });
      sessionId = openSession?.id ?? null;
    }
    if (!sessionId) return;

    const saleMovements = await tx.cashMovement.findMany({
      where: {
        registerSessionId: sessionId,
        type: CashMovementType.SALE,
        reference: sale.documentNumber,
      },
    });
    const soldCash = saleMovements.reduce((sum, m) => sum + Number(m.amount), 0);

    const refundMovements = await tx.cashMovement.findMany({
      where: {
        registerSessionId: sessionId,
        type: CashMovementType.REFUND,
        reference: sale.documentNumber,
      },
    });
    const refunded = refundMovements.reduce((sum, m) => sum + Number(m.amount), 0);
    const toRefund = Math.round((soldCash - refunded) * 100) / 100;
    if (toRefund <= 0) return;

    await tx.cashMovement.create({
      data: {
        registerSessionId: sessionId,
        userId,
        type: CashMovementType.REFUND,
        amount: toRefund,
        description: `Anulación venta ${sale.documentNumber}`,
        reference: sale.documentNumber,
      },
    });
  }

  private async resolveSaleItemUnits(
    tx: Prisma.TransactionClient,
    items: Array<{
      productId: string;
      unitTypeId?: string;
      quantity: number;
      unitPrice: number;
      costPrice?: number;
      discountAmount?: number;
      discountPercent?: number;
      taxRate?: number;
      taxAmount?: number;
      subtotal: number;
      total: number;
      notes?: string;
    }>,
  ) {
    const productIds = [...new Set(items.map((i) => i.productId))];
    const [productUnits, products] = await Promise.all([
      tx.productUnit.findMany({
        where: { productId: { in: productIds }, isActive: true },
        include: { unitType: true },
      }),
      tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, costPrice: true },
      }),
    ]);
    const byProduct = new Map<string, typeof productUnits>();
    for (const pu of productUnits) {
      const list = byProduct.get(pu.productId) ?? [];
      list.push(pu);
      byProduct.set(pu.productId, list);
    }
    const costByProduct = new Map(products.map((p) => [p.id, Number(p.costPrice)]));

    return items.map((item) => {
      const units = byProduct.get(item.productId) ?? [];
      let matched = item.unitTypeId
        ? units.find((u) => u.unitTypeId === item.unitTypeId)
        : units.find((u) => u.isBase);

      if (item.unitTypeId && !matched) {
        throw new BadRequestException(
          `La unidad seleccionada no está configurada para el producto`,
        );
      }

      if (!matched && units.length) {
        matched = units.find((u) => u.isBase) ?? units[0];
      }

      const stockFactor = matched ? Number(matched.stockFactor) : 1;
      const baseCost = costByProduct.get(item.productId) ?? 0;
      const costPrice =
        item.costPrice != null && item.costPrice > 0
          ? item.costPrice
          : Math.round(baseCost * stockFactor * 10000) / 10000;

      return {
        ...item,
        unitTypeId: matched?.unitTypeId ?? null,
        stockFactor,
        costPrice,
      };
    });
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
