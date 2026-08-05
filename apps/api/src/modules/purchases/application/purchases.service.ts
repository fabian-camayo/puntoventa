import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import {
  PurchaseStatus,
  PurchasePaymentTerm,
  PurchaseFundSource,
  CashMovementType,
  RegisterSessionStatus,
  Prisma,
} from '@prisma/client';
import { PurchaseRepository } from '../infrastructure/purchase.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { JwtPayload } from '@puntoventa/shared';

type PaymentFields = {
  paymentTerm: PurchasePaymentTerm;
  fundSource: PurchaseFundSource | null;
  bankAccountId: string | null;
  registerId: string | null;
  reduceCash: boolean;
};

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

  /**
   * Siguiente número de documento único por sucursal.
   * Cuenta todas las compras (incluidas canceladas) para no reutilizar números.
   */
  async nextDocumentNumber(branchId: string): Promise<{ documentNumber: string }> {
    if (!branchId) throw new BadRequestException('branchId es requerido');

    const date = new Date();
    const ymd = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const prefix = `COMP-${ymd}-`;

    const count = await this.prisma.purchase.count({ where: { branchId } });
    let seq = count + 1;
    let documentNumber = `${prefix}${String(seq).padStart(4, '0')}`;

    // Garantiza unicidad aunque existan números con formato anterior
    while (
      await this.prisma.purchase.findUnique({
        where: {
          branchId_documentNumber: { branchId, documentNumber },
        },
        select: { id: true },
      })
    ) {
      seq += 1;
      documentNumber = `${prefix}${String(seq).padStart(4, '0')}`;
    }

    return { documentNumber };
  }

  async create(dto: CreatePurchaseDto, actor: JwtPayload) {
    if (!dto.items?.length) {
      throw new BadRequestException('La compra debe tener al menos un producto');
    }
    this.assertValidItemQuantities(dto.items);

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

    const payment = await this.resolvePaymentFields(dto.branchId, {
      paymentTerm: dto.paymentTerm ?? PurchasePaymentTerm.CASH,
      fundSource: dto.fundSource ?? null,
      bankAccountId: dto.bankAccountId ?? null,
      registerId: dto.registerId ?? null,
      reduceCash: dto.reduceCash ?? true,
    });

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
          paymentTerm: payment.paymentTerm,
          fundSource: payment.fundSource,
          bankAccountId: payment.bankAccountId,
          registerId: payment.registerId,
          reduceCash: payment.reduceCash,
          purchaseDate: this.parsePurchaseDate(dto.purchaseDate),
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
          bankAccount: true,
          register: true,
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

    const payment = await this.resolvePaymentFields(existing.branchId, {
      paymentTerm: dto.paymentTerm ?? existing.paymentTerm,
      fundSource:
        dto.fundSource !== undefined ? dto.fundSource : existing.fundSource,
      bankAccountId:
        dto.bankAccountId !== undefined ? dto.bankAccountId : existing.bankAccountId,
      registerId: dto.registerId !== undefined ? dto.registerId : existing.registerId,
      reduceCash: dto.reduceCash ?? existing.reduceCash,
    });

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
        this.assertValidItemQuantities(dto.items);
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
          purchaseDate:
            dto.purchaseDate !== undefined
              ? this.parsePurchaseDate(dto.purchaseDate)
              : undefined,
          paymentTerm: payment.paymentTerm,
          fundSource: payment.fundSource,
          bankAccountId: payment.bankAccountId,
          registerId: payment.registerId,
          reduceCash: payment.reduceCash,
          subtotal: totals.subtotal,
          taxAmount: totals.taxAmount,
          total: totals.total,
        },
        include: {
          supplier: true,
          bankAccount: true,
          register: true,
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

    await this.resolvePaymentFields(existing.branchId, {
      paymentTerm: existing.paymentTerm,
      fundSource: existing.fundSource,
      bankAccountId: existing.bankAccountId,
      registerId: existing.registerId,
      reduceCash: existing.reduceCash,
    });

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
          data: {
            costPrice: new Prisma.Decimal(item.unitCost).div(
              item.stockFactor && Number(item.stockFactor) > 0
                ? item.stockFactor
                : 1,
            ),
          },
        });
      }

      if (
        existing.paymentTerm === PurchasePaymentTerm.CASH &&
        existing.fundSource === PurchaseFundSource.REGISTER &&
        existing.reduceCash &&
        existing.registerId
      ) {
        const openSession = await tx.registerSession.findFirst({
          where: {
            registerId: existing.registerId,
            status: RegisterSessionStatus.OPEN,
          },
        });
        if (!openSession) {
          throw new BadRequestException(
            'No hay una sesión de caja abierta para descontar el efectivo de esta compra',
          );
        }

        await tx.cashMovement.create({
          data: {
            registerSessionId: openSession.id,
            userId: actor.sub,
            type: CashMovementType.WITHDRAWAL,
            amount: existing.total,
            description: `Compra ${existing.documentNumber}`,
            reference: existing.id,
          },
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
          bankAccount: true,
          register: true,
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

  private async resolvePaymentFields(
    branchId: string,
    input: {
      paymentTerm: PurchasePaymentTerm;
      fundSource: PurchaseFundSource | null;
      bankAccountId: string | null;
      registerId: string | null;
      reduceCash: boolean;
    },
  ): Promise<PaymentFields> {
    if (input.paymentTerm === PurchasePaymentTerm.CREDIT) {
      return {
        paymentTerm: PurchasePaymentTerm.CREDIT,
        fundSource: null,
        bankAccountId: null,
        registerId: null,
        reduceCash: false,
      };
    }

    if (!input.fundSource) {
      throw new BadRequestException('Debe indicar el origen de los fondos (caja o banco)');
    }

    if (input.fundSource === PurchaseFundSource.REGISTER) {
      if (!input.registerId) {
        throw new BadRequestException('Debe seleccionar la caja para el pago de contado');
      }
      const register = await this.prisma.register.findFirst({
        where: { id: input.registerId, branchId, isActive: true },
      });
      if (!register) {
        throw new BadRequestException('La caja seleccionada no es válida para esta sucursal');
      }
      return {
        paymentTerm: PurchasePaymentTerm.CASH,
        fundSource: PurchaseFundSource.REGISTER,
        bankAccountId: null,
        registerId: input.registerId,
        reduceCash: input.reduceCash,
      };
    }

    if (!input.bankAccountId) {
      throw new BadRequestException('Debe seleccionar la cuenta bancaria');
    }
    const bankAccount = await this.prisma.bankAccount.findFirst({
      where: { id: input.bankAccountId, branchId, isActive: true },
    });
    if (!bankAccount) {
      throw new BadRequestException('La cuenta bancaria no es válida o está inactiva');
    }

    return {
      paymentTerm: PurchasePaymentTerm.CASH,
      fundSource: PurchaseFundSource.BANK_ACCOUNT,
      bankAccountId: input.bankAccountId,
      registerId: null,
      reduceCash: false,
    };
  }

  private assertValidItemQuantities(items: Array<{ quantity: number }>): void {
    for (const item of items) {
      if (!Number.isFinite(item.quantity) || item.quantity < 0.001) {
        throw new BadRequestException(
          'La cantidad de cada producto debe ser mayor a 0',
        );
      }
    }
  }

  /** Interpreta YYYY-MM-DD (o ISO) como fecha de compra sin desfases de zona horaria. */
  private parsePurchaseDate(value: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) {
      throw new BadRequestException('Fecha de compra inválida');
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException('Fecha de compra inválida');
    }
    return date;
  }

  private formatPurchaseDate(value: Date): string {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const d = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
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
    paymentTerm?: PurchasePaymentTerm;
    fundSource?: PurchaseFundSource | null;
    bankAccountId?: string | null;
    registerId?: string | null;
    reduceCash?: boolean;
    purchaseDate?: Date;
    subtotal: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    total: Prisma.Decimal;
    notes: string | null;
    receivedAt?: Date | null;
    createdAt: Date;
    supplier?: { id: string; name: string; code: string };
    bankAccount?: { id: string; code: string; name: string } | null;
    register?: { id: string; code: string; name: string } | null;
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
      paymentTerm: purchase.paymentTerm ?? PurchasePaymentTerm.CASH,
      fundSource: purchase.fundSource ?? undefined,
      bankAccountId: purchase.bankAccountId ?? undefined,
      bankAccountName: purchase.bankAccount
        ? `${purchase.bankAccount.code} — ${purchase.bankAccount.name}`
        : undefined,
      registerId: purchase.registerId ?? undefined,
      registerName: purchase.register
        ? `${purchase.register.code} — ${purchase.register.name}`
        : undefined,
      reduceCash: purchase.reduceCash ?? true,
      purchaseDate: purchase.purchaseDate
        ? this.formatPurchaseDate(purchase.purchaseDate)
        : this.formatPurchaseDate(purchase.createdAt),
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
