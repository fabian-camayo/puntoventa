"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRODUCT_IMPORT_FIELDS = void 0;
/** Campos de producto que se pueden mapear desde un Excel. */
exports.PRODUCT_IMPORT_FIELDS = [
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
];
//# sourceMappingURL=product-import.interface.js.map