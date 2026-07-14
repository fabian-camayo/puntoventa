export interface ProductDto {
    id: string;
    sku: string;
    barcode?: string;
    name: string;
    description?: string;
    salePrice: number;
    costPrice?: number;
    taxRate?: number;
    unit: string;
    categoryId?: string;
    categoryName?: string;
    stock?: number;
    minStock?: number;
    trackInventory?: boolean;
    isActive: boolean;
    imageUrl?: string;
    units?: import('./unit-type.interface').ProductUnitDto[];
}
export interface ProductSearchResult {
    id: string;
    sku: string;
    barcode?: string;
    name: string;
    salePrice: number;
    stock: number;
    unit: string;
    taxRate?: number;
    units?: import('./unit-type.interface').ProductUnitDto[];
}
//# sourceMappingURL=product.interface.d.ts.map