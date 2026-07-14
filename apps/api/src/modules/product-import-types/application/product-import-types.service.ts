import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  JwtPayload,
  PRODUCT_IMPORT_FIELDS,
  ProductImportFieldKey,
  ProductImportMappings,
  ProductImportResult,
  ProductImportRowError,
} from '@puntoventa/shared';
import { ProductImportTypeRepository } from '../infrastructure/product-import-type.repository';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { AuditService } from '../../audit/application/audit.service';
import { ProductsService } from '../../products/application/products.service';
import { CreateProductImportTypeDto } from './dto/create-product-import-type.dto';
import { UpdateProductImportTypeDto } from './dto/update-product-import-type.dto';
import { readExcelDataRows, readExcelHeaders } from './excel.util';

@Injectable()
export class ProductImportTypesService {
  constructor(
    private readonly repository: ProductImportTypeRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly productsService: ProductsService,
  ) {}

  async findAll(
    branchId: string,
    params?: { page?: number; limit?: number; search?: string; activeOnly?: boolean },
  ) {
    const result = await this.repository.findAll(branchId, params);
    return {
      ...result,
      items: result.items.map((item) => this.mapToDto(item)),
    };
  }

  async findActive(branchId: string) {
    const items = await this.repository.findActiveByBranch(branchId);
    return items.map((item) => this.mapToDto(item));
  }

  async findById(id: string) {
    const item = await this.repository.findById(id);
    if (!item) throw new NotFoundException('Tipo de importe no encontrado');
    return this.mapToDto(item);
  }

  async create(dto: CreateProductImportTypeDto, actor: JwtPayload) {
    const code = dto.code.trim().toUpperCase();
    this.assertMappings(dto.mappings);

    const existing = await this.repository.findByCode(dto.branchId, code);
    if (existing) throw new ConflictException('El código ya existe en esta sucursal');

    const item = await this.repository.create({
      branch: { connect: { id: dto.branchId } },
      code,
      name: dto.name.trim(),
      description: dto.description?.trim(),
      sampleHeaders: (dto.sampleHeaders ?? []) as Prisma.InputJsonValue,
      mappings: dto.mappings as Prisma.InputJsonValue,
      headerRow: dto.headerRow ?? 1,
      isActive: dto.isActive ?? true,
      sortOrder: dto.sortOrder ?? 0,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'product_import_types',
      entityType: 'ProductImportType',
      entityId: item.id,
      newValues: { code, name: dto.name } as Prisma.InputJsonValue,
    });

    return this.mapToDto(item);
  }

  async update(id: string, dto: UpdateProductImportTypeDto, actor: JwtPayload) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('Tipo de importe no encontrado');

    if (dto.mappings) this.assertMappings(dto.mappings);

    const item = await this.repository.update(id, {
      name: dto.name?.trim(),
      description: dto.description?.trim(),
      sampleHeaders:
        dto.sampleHeaders !== undefined
          ? (dto.sampleHeaders as Prisma.InputJsonValue)
          : undefined,
      mappings:
        dto.mappings !== undefined
          ? (dto.mappings as Prisma.InputJsonValue)
          : undefined,
      headerRow: dto.headerRow,
      isActive: dto.isActive,
      sortOrder: dto.sortOrder,
    });

    await this.auditService.log({
      userId: actor.sub,
      action: 'UPDATE',
      module: 'product_import_types',
      entityType: 'ProductImportType',
      entityId: id,
    });

    return this.mapToDto(item);
  }

  async remove(id: string, actor: JwtPayload) {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundException('Tipo de importe no encontrado');

    await this.repository.update(id, { isActive: false });

    await this.auditService.log({
      userId: actor.sub,
      action: 'DELETE',
      module: 'product_import_types',
      entityType: 'ProductImportType',
      entityId: id,
    });

    return { success: true };
  }

  async previewHeaders(file: Express.Multer.File, headerRow = 1) {
    this.assertExcelFile(file);
    const result = await readExcelHeaders(file.buffer, headerRow);
    return {
      headers: result.headers,
      headerRow,
      sheetName: result.sheetName,
    };
  }

  getFields() {
    return PRODUCT_IMPORT_FIELDS;
  }

  async importProducts(
    importTypeId: string,
    branchId: string,
    file: Express.Multer.File,
    actor: JwtPayload,
    options?: { updateExisting?: boolean },
  ): Promise<ProductImportResult> {
    this.assertExcelFile(file);

    const importType = await this.repository.findById(importTypeId);
    if (!importType || !importType.isActive) {
      throw new NotFoundException('Tipo de importe no encontrado');
    }
    if (importType.branchId !== branchId) {
      throw new BadRequestException('El tipo de importe no pertenece a esta sucursal');
    }

    const mappings = this.normalizeMappings(importType.mappings);
    this.assertMappings(mappings);

    const { rows } = await readExcelDataRows(file.buffer, importType.headerRow);
    const updateExisting = options?.updateExisting !== false;

    const categories = await this.prisma.category.findMany({
      where: { branchId, isActive: true },
      select: { id: true, code: true, name: true },
    });
    const categoryByCode = new Map(
      categories.map((c) => [c.code.toUpperCase(), c.id]),
    );
    const categoryByName = new Map(
      categories.map((c) => [c.name.trim().toLowerCase(), c.id]),
    );

    const errors: ProductImportRowError[] = [];
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const headerOffset = importType.headerRow;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]!;
      const excelRow = headerOffset + i + 1;
      try {
        const mapped = this.mapRow(row, mappings);
        if (!mapped.sku && !mapped.name && mapped.salePrice == null) {
          skipped += 1;
          continue;
        }
        if (!mapped.sku || !mapped.name || mapped.salePrice == null) {
          throw new Error('SKU, nombre y precio de venta son obligatorios');
        }

        let categoryId: string | undefined;
        if (mapped.categoryCode) {
          categoryId = categoryByCode.get(mapped.categoryCode.toUpperCase());
          if (!categoryId) {
            throw new Error(`Categoría con código "${mapped.categoryCode}" no encontrada`);
          }
        } else if (mapped.categoryName) {
          categoryId = categoryByName.get(mapped.categoryName.trim().toLowerCase());
          if (!categoryId) {
            throw new Error(`Categoría con nombre "${mapped.categoryName}" no encontrada`);
          }
        }

        const existing = await this.prisma.product.findUnique({
          where: { branchId_sku: { branchId, sku: mapped.sku } },
        });

        if (existing) {
          if (!updateExisting) {
            skipped += 1;
            continue;
          }
          await this.productsService.update(
            existing.id,
            {
              name: mapped.name,
              barcode: mapped.barcode,
              description: mapped.description,
              salePrice: mapped.salePrice,
              costPrice: mapped.costPrice,
              taxRate: mapped.taxRate,
              unit: mapped.unit,
              categoryId,
              minStock: mapped.minStock,
              maxStock: mapped.maxStock,
              trackInventory: mapped.trackInventory,
              isActive: mapped.isActive,
            },
            actor,
          );
          if (mapped.initialStock != null && mapped.trackInventory !== false) {
            await this.setStock(branchId, existing.id, mapped.initialStock);
          }
          updated += 1;
        } else {
          const product = await this.productsService.create(
            {
              branchId,
              sku: mapped.sku,
              name: mapped.name,
              barcode: mapped.barcode,
              description: mapped.description,
              salePrice: mapped.salePrice,
              costPrice: mapped.costPrice,
              taxRate: mapped.taxRate,
              unit: mapped.unit,
              categoryId,
              minStock: mapped.minStock,
              maxStock: mapped.maxStock,
              trackInventory: mapped.trackInventory ?? true,
            },
            actor,
          );
          if (mapped.initialStock != null && (mapped.trackInventory ?? true)) {
            await this.setStock(branchId, product.id, mapped.initialStock);
          }
          created += 1;
        }
      } catch (err) {
        errors.push({
          row: excelRow,
          sku: this.safeCell(row, mappings.sku),
          message: err instanceof Error ? err.message : 'Error desconocido',
        });
      }
    }

    await this.auditService.log({
      userId: actor.sub,
      action: 'CREATE',
      module: 'products',
      entityType: 'ProductImport',
      entityId: importTypeId,
      newValues: {
        created,
        updated,
        skipped,
        errors: errors.length,
      } as Prisma.InputJsonValue,
    });

    return {
      totalRows: rows.length,
      created,
      updated,
      skipped,
      errors,
    };
  }

  private async setStock(branchId: string, productId: string, quantity: number) {
    await this.prisma.inventoryItem.upsert({
      where: { branchId_productId: { branchId, productId } },
      create: { branchId, productId, quantity },
      update: { quantity, version: { increment: 1 } },
    });
  }

  private mapRow(
    row: Record<string, string>,
    mappings: ProductImportMappings,
  ): {
    sku?: string;
    name?: string;
    salePrice?: number;
    barcode?: string;
    description?: string;
    costPrice?: number;
    taxRate?: number;
    unit?: string;
    categoryCode?: string;
    categoryName?: string;
    minStock?: number;
    maxStock?: number;
    trackInventory?: boolean;
    isActive?: boolean;
    initialStock?: number;
  } {
    const get = (field: ProductImportFieldKey) => {
      const col = mappings[field];
      if (!col) return undefined;
      const value = row[col]?.trim();
      return value || undefined;
    };

    return {
      sku: get('sku'),
      name: get('name'),
      salePrice: this.parseNumber(get('salePrice')),
      barcode: get('barcode'),
      description: get('description'),
      costPrice: this.parseNumber(get('costPrice')),
      taxRate: this.parseNumber(get('taxRate')),
      unit: get('unit')?.toUpperCase(),
      categoryCode: get('categoryCode'),
      categoryName: get('categoryName'),
      minStock: this.parseNumber(get('minStock')),
      maxStock: this.parseNumber(get('maxStock')),
      trackInventory: this.parseBoolean(get('trackInventory')),
      isActive: this.parseBoolean(get('isActive')),
      initialStock: this.parseNumber(get('initialStock')),
    };
  }

  private parseNumber(value?: string): number | undefined {
    if (value == null || value === '') return undefined;
    const normalized = value.replace(/\$/g, '').replace(/\s/g, '').replace(',', '.');
    const n = Number(normalized);
    if (Number.isNaN(n)) throw new Error(`Valor numérico inválido: "${value}"`);
    return n;
  }

  private parseBoolean(value?: string): boolean | undefined {
    if (value == null || value === '') return undefined;
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'si', 'sí', 'yes', 'y', 's'].includes(v)) return true;
    if (['0', 'false', 'no', 'n'].includes(v)) return false;
    throw new Error(`Valor booleano inválido: "${value}"`);
  }

  private safeCell(row: Record<string, string>, column?: string): string | undefined {
    if (!column) return undefined;
    return row[column] || undefined;
  }

  private assertExcelFile(file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Debe adjuntar un archivo Excel (.xlsx)');
    }
    const name = (file.originalname || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      throw new BadRequestException('Solo se permiten archivos .xlsx o .xls');
    }
  }

  private assertMappings(mappings: Record<string, string>) {
    const allowed = new Set(PRODUCT_IMPORT_FIELDS.map((f) => f.key));
    for (const key of Object.keys(mappings)) {
      if (!allowed.has(key as ProductImportFieldKey)) {
        throw new BadRequestException(`Campo de mapeo no válido: ${key}`);
      }
      if (!mappings[key]?.trim()) {
        throw new BadRequestException(`La columna mapeada para "${key}" está vacía`);
      }
    }
    for (const field of PRODUCT_IMPORT_FIELDS.filter((f) => f.required)) {
      if (!mappings[field.key]?.trim()) {
        throw new BadRequestException(`Debe mapear el campo obligatorio: ${field.label}`);
      }
    }
  }

  private normalizeMappings(raw: Prisma.JsonValue): ProductImportMappings {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new BadRequestException('El mapeo del tipo de importe es inválido');
    }
    const result: ProductImportMappings = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        result[key as ProductImportFieldKey] = value.trim();
      }
    }
    return result;
  }

  private mapToDto(item: {
    id: string;
    branchId: string;
    code: string;
    name: string;
    description: string | null;
    sampleHeaders: Prisma.JsonValue | null;
    mappings: Prisma.JsonValue;
    headerRow: number;
    isActive: boolean;
    sortOrder: number;
  }) {
    const sampleHeaders = Array.isArray(item.sampleHeaders)
      ? item.sampleHeaders.filter((h): h is string => typeof h === 'string')
      : [];

    return {
      id: item.id,
      branchId: item.branchId,
      code: item.code,
      name: item.name,
      description: item.description ?? undefined,
      sampleHeaders,
      mappings: this.normalizeMappings(item.mappings),
      headerRow: item.headerRow,
      isActive: item.isActive,
      sortOrder: item.sortOrder,
    };
  }
}
