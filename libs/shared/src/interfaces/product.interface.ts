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
  isActive: boolean;
  imageUrl?: string;
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
}
