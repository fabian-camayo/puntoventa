import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductDto, ProductSearchResult, ProductUnitDto } from '@puntoventa/shared';
import { ProductRepository } from '../infrastructure/product.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateProductDto, ProductUnitInputDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtPayload } from '@puntoventa/shared';

const productUnitsInclude = {
  unitType: true,
} as const;

@Injectable()
export class ProductsService {
  constructor(
    private readonly productRepository: ProductRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async search(
    branchId: string,
    params: {
      search?: string;
      page?: number;
      limit?: number;
      full?: boolean;
      includeInactive?: boolean;
    },
  ) {
    const result = await this.productRepository.searchByBranch(branchId, params);
    return {
      ...result,
      items: result.items.map((p) =>
        params.full ? this.mapToDto(p) : this.mapToSearchResult(p),
      ),
    };
  }

  async findByBarcode(branchId: string, barcode: string): Promise<ProductSearchResult> {
    const product = await this.productRepository.findByBarcode(branchId, barcode);
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.mapToSearchResult(product);
  }

  async findById(id: string): Promise<ProductDto> {
    const product = await this.productRepository.findByIdWithDetails(id);
    if (!product) throw new NotFoundException('Producto no encontrado');
    return this.mapToDto(product);
  }

  async create(dto: CreateProductDto, actor: JwtPayload) {
    const existing = await this.prisma.product.findUnique({
      where: { branchId_sku: { branchId: dto.branchId, sku: dto.sku } },
    });
    if (existing) throw new ConflictException('El SKU ya existe en esta sucursal');

    const product = await this.prisma.executeInTransaction(async (tx) => {
      const unitCode = (dto.unit ?? 'UND').trim().toUpperCase();
      const resolvedUnits = await this.resolveUnitsInput(tx, dto.units, unitCode);

      const created = await tx.product.create({
        data: {
          branchId: dto.branchId,
          sku: dto.sku,
          barcode: dto.barcode,
          name: dto.name,
          description: dto.description,
          type: dto.type,
          salePrice: dto.salePrice,
          costPrice: dto.costPrice ?? 0,
          taxRate: dto.taxRate,
          unit: resolvedUnits.baseCode,
          categoryId: dto.categoryId,
          minStock: dto.minStock ?? 0,
          maxStock: dto.maxStock,
          trackInventory: dto.trackInventory ?? true,
          imageUrl: dto.imageUrl,
          productUnits: {
            create: resolvedUnits.units.map((u) => ({
              unitTypeId: u.unitTypeId,
              stockFactor: u.stockFactor,
              isBase: u.isBase,
              isActive: u.isActive ?? true,
            })),
          },
        },
        include: {
          category: true,
          inventoryItems: true,
          productUnits: { include: productUnitsInclude },
        },
      });

      if (dto.barcode) {
        await tx.productBarcode.create({
          data: { productId: created.id, barcode: dto.barcode, isPrimary: true },
        });
      }

      if (created.trackInventory) {
        await tx.inventoryItem.create({
          data: { branchId: dto.branchId, productId: created.id, quantity: 0 },
        });
      }

      return created;
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'products',
      entityType: 'Product',
      entityId: product.id,
      newValues: { sku: dto.sku, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapToDto(product);
  }

  async update(id: string, dto: UpdateProductDto, actor: JwtPayload) {
    const existing = await this.productRepository.findByIdWithDetails(id);
    if (!existing) throw new NotFoundException('Producto no encontrado');

    const product = await this.prisma.executeInTransaction(async (tx) => {
      let unit = dto.unit;

      if (dto.units) {
        const resolved = await this.resolveUnitsInput(tx, dto.units, dto.unit ?? existing.unit);
        unit = resolved.baseCode;
        await tx.productUnit.deleteMany({ where: { productId: id } });
        await tx.productUnit.createMany({
          data: resolved.units.map((u) => ({
            productId: id,
            unitTypeId: u.unitTypeId,
            stockFactor: u.stockFactor,
            isBase: u.isBase,
            isActive: u.isActive ?? true,
          })),
        });
      }

      return tx.product.update({
        where: { id },
        data: {
          name: dto.name,
          barcode: dto.barcode,
          description: dto.description,
          type: dto.type,
          salePrice: dto.salePrice,
          costPrice: dto.costPrice,
          taxRate: dto.taxRate,
          unit,
          categoryId: dto.categoryId,
          minStock: dto.minStock,
          maxStock: dto.maxStock,
          trackInventory: dto.trackInventory,
          isActive: dto.isActive,
          imageUrl: dto.imageUrl,
        },
        include: {
          category: true,
          inventoryItems: true,
          productUnits: { include: productUnitsInclude },
        },
      });
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'products',
      entityType: 'Product',
      entityId: id,
    });

    return this.mapToDto(product);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.productRepository.findById(id);
    if (!existing) throw new NotFoundException('Producto no encontrado');

    await this.productRepository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'products',
      entityType: 'Product',
      entityId: id,
    });

    return { success: true };
  }

  private async resolveUnitsInput(
    tx: Prisma.TransactionClient,
    units: ProductUnitInputDto[] | undefined,
    fallbackUnitCode: string,
  ): Promise<{ baseCode: string; units: ProductUnitInputDto[] }> {
    if (units?.length) {
      const baseUnits = units.filter((u) => u.isBase);
      if (baseUnits.length !== 1) {
        throw new BadRequestException('Debe configurar exactamente una unidad base');
      }
      const base = baseUnits[0]!;
      if (Number(base.stockFactor) !== 1) {
        throw new BadRequestException('La unidad base debe tener factor de stock 1');
      }
      for (const u of units) {
        if (Number(u.stockFactor) <= 0) {
          throw new BadRequestException('El factor de stock debe ser mayor a 0');
        }
      }
      const ids = [...new Set(units.map((u) => u.unitTypeId))];
      if (ids.length !== units.length) {
        throw new BadRequestException('No se pueden repetir tipos de unidad en el producto');
      }
      const unitTypes = await tx.unitType.findMany({
        where: { id: { in: ids }, isActive: true },
      });
      if (unitTypes.length !== ids.length) {
        throw new BadRequestException('Uno o más tipos de unidad no son válidos');
      }
      const baseType = unitTypes.find((ut) => ut.id === base.unitTypeId);
      return { baseCode: baseType!.code, units };
    }

    const code = fallbackUnitCode.trim().toUpperCase() || 'UND';
    let unitType = await tx.unitType.findUnique({ where: { code } });
    if (!unitType) {
      unitType = await tx.unitType.findFirst({
        where: { isActive: true },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      });
    }
    if (!unitType) {
      throw new BadRequestException('No hay tipos de unidad configurados');
    }
    return {
      baseCode: unitType.code,
      units: [
        {
          unitTypeId: unitType.id,
          stockFactor: 1,
          isBase: true,
          isActive: true,
        },
      ],
    };
  }

  private mapUnits(
    productUnits?: Array<{
      id: string;
      unitTypeId: string;
      stockFactor: Prisma.Decimal;
      isBase: boolean;
      isActive: boolean;
      unitType?: { code: string; name: string };
    }>,
  ): ProductUnitDto[] | undefined {
    if (!productUnits?.length) return undefined;
    return productUnits
      .filter((u) => u.isActive)
      .map((u) => ({
        id: u.id,
        unitTypeId: u.unitTypeId,
        unitTypeCode: u.unitType?.code,
        unitTypeName: u.unitType?.name,
        stockFactor: Number(u.stockFactor),
        isBase: u.isBase,
        isActive: u.isActive,
      }))
      .sort((a, b) => Number(b.isBase) - Number(a.isBase));
  }

  private mapToSearchResult(product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    salePrice: Prisma.Decimal;
    taxRate: Prisma.Decimal | null;
    unit: string;
    inventoryItems?: Array<{ quantity: Prisma.Decimal }>;
    productUnits?: Array<{
      id: string;
      unitTypeId: string;
      stockFactor: Prisma.Decimal;
      isBase: boolean;
      isActive: boolean;
      unitType?: { code: string; name: string };
    }>;
  }): ProductSearchResult {
    const stock = product.inventoryItems?.find(() => true);
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode ?? undefined,
      name: product.name,
      salePrice: Number(product.salePrice),
      stock: stock ? Number(stock.quantity) : 0,
      unit: product.unit,
      taxRate: product.taxRate != null ? Number(product.taxRate) : undefined,
      units: this.mapUnits(product.productUnits),
    };
  }

  private mapToDto(product: {
    id: string;
    sku: string;
    barcode: string | null;
    name: string;
    description: string | null;
    salePrice: Prisma.Decimal;
    costPrice: Prisma.Decimal;
    taxRate: Prisma.Decimal | null;
    unit: string;
    categoryId: string | null;
    category?: { name: string } | null;
    minStock: Prisma.Decimal;
    trackInventory?: boolean;
    isActive: boolean;
    imageUrl: string | null;
    inventoryItems?: Array<{ quantity: Prisma.Decimal }>;
    productUnits?: Array<{
      id: string;
      unitTypeId: string;
      stockFactor: Prisma.Decimal;
      isBase: boolean;
      isActive: boolean;
      unitType?: { code: string; name: string };
    }>;
  }): ProductDto {
    const stock = product.inventoryItems?.[0];
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode ?? undefined,
      name: product.name,
      description: product.description ?? undefined,
      salePrice: Number(product.salePrice),
      costPrice: Number(product.costPrice),
      taxRate: product.taxRate != null ? Number(product.taxRate) : undefined,
      unit: product.unit,
      categoryId: product.categoryId ?? undefined,
      categoryName: product.category?.name,
      stock: stock ? Number(stock.quantity) : undefined,
      minStock: Number(product.minStock),
      trackInventory: product.trackInventory,
      isActive: product.isActive,
      imageUrl: product.imageUrl ?? undefined,
      units: this.mapUnits(product.productUnits),
    };
  }
}
