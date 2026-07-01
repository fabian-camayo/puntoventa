import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ProductDto, ProductSearchResult } from '@puntoventa/shared';
import { ProductRepository } from '../infrastructure/product.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtPayload } from '@puntoventa/shared';

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
          unit: dto.unit ?? 'PZA',
          categoryId: dto.categoryId,
          minStock: dto.minStock ?? 0,
          maxStock: dto.maxStock,
          trackInventory: dto.trackInventory ?? true,
          imageUrl: dto.imageUrl,
        },
        include: { category: true, inventoryItems: true },
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

    const product = await this.productRepository.update(id, dto);

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'products',
      entityType: 'Product',
      entityId: id,
    });

    const updated = await this.productRepository.findByIdWithDetails(product.id);
    return this.mapToDto(updated!);
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

  private mapToSearchResult(
    product: {
      id: string;
      sku: string;
      barcode: string | null;
      name: string;
      salePrice: Prisma.Decimal;
      unit: string;
      inventoryItems?: Array<{ quantity: Prisma.Decimal }>;
    },
  ): ProductSearchResult {
    const stock = product.inventoryItems?.find(() => true);
    return {
      id: product.id,
      sku: product.sku,
      barcode: product.barcode ?? undefined,
      name: product.name,
      salePrice: Number(product.salePrice),
      stock: stock ? Number(stock.quantity) : 0,
      unit: product.unit,
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
    isActive: boolean;
    imageUrl: string | null;
    inventoryItems?: Array<{ quantity: Prisma.Decimal }>;
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
      taxRate: product.taxRate ? Number(product.taxRate) : undefined,
      unit: product.unit,
      categoryId: product.categoryId ?? undefined,
      categoryName: product.category?.name,
      stock: stock ? Number(stock.quantity) : undefined,
      minStock: Number(product.minStock),
      isActive: product.isActive,
      imageUrl: product.imageUrl ?? undefined,
    };
  }
}
