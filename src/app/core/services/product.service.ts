import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ProductDto,
  ProductSearchResult,
  PaginatedResult,
  ProductUnitInput,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface ProductListParams {
  branchId: string;
  search?: string;
  page?: number;
  limit?: number;
  includeInactive?: boolean;
}

export interface CreateProductPayload {
  branchId: string;
  sku: string;
  name: string;
  barcode?: string;
  description?: string;
  salePrice: number;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
  categoryId?: string;
  minStock?: number;
  trackInventory?: boolean;
  units?: ProductUnitInput[];
}

export interface UpdateProductPayload {
  name?: string;
  barcode?: string;
  description?: string;
  salePrice?: number;
  costPrice?: number;
  taxRate?: number;
  unit?: string;
  categoryId?: string;
  minStock?: number;
  trackInventory?: boolean;
  isActive?: boolean;
  units?: ProductUnitInput[];
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  search(query: string, branchId: string): Observable<ProductSearchResult[]> {
    return this.http
      .get<{ data: PaginatedResult<ProductSearchResult> }>(
        `${this.config.apiBaseUrl}/products`,
        { params: { branchId, search: query, limit: 20 } },
      )
      .pipe(map((r) => r.data.items));
  }

  list(params: ProductListParams): Observable<PaginatedResult<ProductDto>> {
    const httpParams: Record<string, string> = {
      branchId: params.branchId,
      full: 'true',
      page: String(params.page ?? 1),
      limit: String(params.limit ?? 20),
    };
    if (params.search) httpParams['search'] = params.search;
    if (params.includeInactive) httpParams['includeInactive'] = 'true';

    return this.http
      .get<{ data: PaginatedResult<ProductDto> }>(`${this.config.apiBaseUrl}/products`, {
        params: httpParams,
      })
      .pipe(map((r) => r.data));
  }

  findByBarcode(barcode: string, branchId: string): Observable<ProductSearchResult | null> {
    return this.http
      .get<{ data: ProductSearchResult }>(
        `${this.config.apiBaseUrl}/products/barcode/${encodeURIComponent(barcode)}`,
        { params: { branchId } },
      )
      .pipe(map((r) => r.data));
  }

  getById(id: string): Observable<ProductDto> {
    return this.http
      .get<{ data: ProductDto }>(`${this.config.apiBaseUrl}/products/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateProductPayload): Observable<ProductDto> {
    return this.http
      .post<{ data: ProductDto }>(`${this.config.apiBaseUrl}/products`, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateProductPayload): Observable<ProductDto> {
    return this.http
      .put<{ data: ProductDto }>(`${this.config.apiBaseUrl}/products/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.config.apiBaseUrl}/products/${id}`);
  }
}
