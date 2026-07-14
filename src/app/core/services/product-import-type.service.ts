import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateProductImportTypeRequest,
  PaginatedResult,
  ProductImportPreviewHeadersResult,
  ProductImportResult,
  ProductImportTypeDto,
  UpdateProductImportTypeRequest,
  PRODUCT_IMPORT_FIELDS,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class ProductImportTypeService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/product-import-types`;
  }

  getFields() {
    return PRODUCT_IMPORT_FIELDS;
  }

  list(params: {
    branchId: string;
    search?: string;
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  }): Observable<PaginatedResult<ProductImportTypeDto>> {
    const query: Record<string, string> = { branchId: params.branchId };
    if (params.search) query['search'] = params.search;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);
    if (params.activeOnly) query['activeOnly'] = 'true';

    return this.http
      .get<{ data: PaginatedResult<ProductImportTypeDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  listActive(branchId: string): Observable<ProductImportTypeDto[]> {
    return this.http
      .get<{ data: ProductImportTypeDto[] }>(`${this.baseUrl}/active`, {
        params: { branchId },
      })
      .pipe(map((r) => r.data));
  }

  create(payload: CreateProductImportTypeRequest): Observable<ProductImportTypeDto> {
    return this.http
      .post<{ data: ProductImportTypeDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(
    id: string,
    payload: UpdateProductImportTypeRequest,
  ): Observable<ProductImportTypeDto> {
    return this.http
      .put<{ data: ProductImportTypeDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }

  previewHeaders(file: File, headerRow = 1): Observable<ProductImportPreviewHeadersResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('headerRow', String(headerRow));
    return this.http
      .post<{ data: ProductImportPreviewHeadersResult }>(
        `${this.baseUrl}/preview-headers`,
        form,
      )
      .pipe(map((r) => r.data));
  }

  importProducts(
    importTypeId: string,
    branchId: string,
    file: File,
    updateExisting = true,
  ): Observable<ProductImportResult> {
    const form = new FormData();
    form.append('file', file);
    form.append('branchId', branchId);
    form.append('updateExisting', updateExisting ? 'true' : 'false');
    return this.http
      .post<{ data: ProductImportResult }>(`${this.baseUrl}/${importTypeId}/import`, form)
      .pipe(map((r) => r.data));
  }
}
