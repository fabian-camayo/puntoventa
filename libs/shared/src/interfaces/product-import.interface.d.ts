/** Campos de producto que se pueden mapear desde un Excel. */
export declare const PRODUCT_IMPORT_FIELDS: readonly [{
    readonly key: "sku";
    readonly label: "SKU";
    readonly required: true;
}, {
    readonly key: "name";
    readonly label: "Nombre";
    readonly required: true;
}, {
    readonly key: "salePrice";
    readonly label: "Precio de venta";
    readonly required: true;
}, {
    readonly key: "barcode";
    readonly label: "Código de barras";
    readonly required: false;
}, {
    readonly key: "description";
    readonly label: "Descripción";
    readonly required: false;
}, {
    readonly key: "costPrice";
    readonly label: "Precio de costo";
    readonly required: false;
}, {
    readonly key: "taxRate";
    readonly label: "IVA (%)";
    readonly required: false;
}, {
    readonly key: "unit";
    readonly label: "Unidad (código)";
    readonly required: false;
}, {
    readonly key: "categoryCode";
    readonly label: "Categoría (código)";
    readonly required: false;
}, {
    readonly key: "categoryName";
    readonly label: "Categoría (nombre)";
    readonly required: false;
}, {
    readonly key: "minStock";
    readonly label: "Stock mínimo";
    readonly required: false;
}, {
    readonly key: "maxStock";
    readonly label: "Stock máximo";
    readonly required: false;
}, {
    readonly key: "trackInventory";
    readonly label: "Controla inventario (sí/no)";
    readonly required: false;
}, {
    readonly key: "isActive";
    readonly label: "Activo (sí/no)";
    readonly required: false;
}, {
    readonly key: "initialStock";
    readonly label: "Stock inicial";
    readonly required: false;
}];
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
//# sourceMappingURL=product-import.interface.d.ts.map