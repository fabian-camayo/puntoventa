/** Campos de producto que se pueden mapear desde un Excel. */
export const PRODUCT_IMPORT_FIELDS = [
  { key: 'sku', label: 'SKU', required: true },
  { key: 'name', label: 'Nombre', required: true },
  { key: 'salePrice', label: 'Precio de venta', required: true },
  { key: 'barcode', label: 'Código de barras', required: false },
  { key: 'description', label: 'Descripción', required: false },
  { key: 'costPrice', label: 'Precio de costo', required: false },
  { key: 'taxRate', label: 'IVA (%)', required: false },
  { key: 'unit', label: 'Unidad (código)', required: false },
  { key: 'categoryCode', label: 'Categoría (código)', required: false },
  { key: 'categoryName', label: 'Categoría (nombre)', required: false },
  { key: 'minStock', label: 'Stock mínimo', required: false },
  { key: 'maxStock', label: 'Stock máximo', required: false },
  { key: 'trackInventory', label: 'Controla inventario (sí/no)', required: false },
  { key: 'isActive', label: 'Activo (sí/no)', required: false },
  { key: 'initialStock', label: 'Stock inicial', required: false },
] as const;

export type ProductImportFieldKey = (typeof PRODUCT_IMPORT_FIELDS)[number]['key'];

/** Mapeo campo de producto → nombre de columna en el Excel. */
export type ProductImportMappings = Partial<Record<ProductImportFieldKey, string>>;

export interface ProductImportTypeDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string;
  sampleHeaders: string[];
  mappings: ProductImportMappings;
  headerRow: number;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateProductImportTypeRequest {
  branchId: string;
  code: string;
  name: string;
  description?: string;
  sampleHeaders?: string[];
  mappings: ProductImportMappings;
  headerRow?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface UpdateProductImportTypeRequest {
  name?: string;
  description?: string;
  sampleHeaders?: string[];
  mappings?: ProductImportMappings;
  headerRow?: number;
  isActive?: boolean;
  sortOrder?: number;
}

export interface ProductImportPreviewHeadersResult {
  headers: string[];
  headerRow: number;
  sheetName?: string;
}

export interface ProductImportRowError {
  row: number;
  sku?: string;
  message: string;
}

export interface ProductImportResult {
  totalRows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: ProductImportRowError[];
}
