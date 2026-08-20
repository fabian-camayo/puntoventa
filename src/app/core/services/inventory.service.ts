import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  PaginatedResult,
  CreateManualAdjustmentRequest,
  InventoryAdjustmentDto,
  ListAdjustmentsQuery,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface StockItemDto {
  id: string;
  productId: string;
  sku?: string;
  name?: string;
  unit?: string;
  quantity: number;
  reserved?: number;
  available?: number;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  listStock(
    branchId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Observable<PaginatedResult<StockItemDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<StockItemDto> }>(
        `${this.config.apiBaseUrl}/inventory/stock`,
        { params: query },
      )
      .pipe(map((r) => r.data));
  }

  exportStockExcel(
    branchId: string,
    search?: string,
  ): Observable<Blob> {
    const query: Record<string, string> = { branchId };
    if (search) query['search'] = search;

    return this.http.get(`${this.config.apiBaseUrl}/inventory/stock/export`, {
      params: query,
      responseType: 'blob',
    });
  }

  /** Ajuste manual de stock de un producto, aplicado de inmediato con auditoría. */
  createManualAdjustment(payload: CreateManualAdjustmentRequest): Observable<InventoryAdjustmentDto> {
    return this.http
      .post<{ data: InventoryAdjustmentDto }>(
        `${this.config.apiBaseUrl}/inventory/adjustments/manual`,
        payload,
      )
      .pipe(map((r) => r.data));
  }

  listAdjustments(params: ListAdjustmentsQuery): Observable<PaginatedResult<InventoryAdjustmentDto>> {
    const query: Record<string, string> = { branchId: params.branchId };
    if (params.search) query['search'] = params.search;
    if (params.productId) query['productId'] = params.productId;
    if (params.userId) query['userId'] = params.userId;
    if (params.type) query['type'] = params.type;
    if (params.dateFrom) query['dateFrom'] = params.dateFrom;
    if (params.dateTo) query['dateTo'] = params.dateTo;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<InventoryAdjustmentDto> }>(
        `${this.config.apiBaseUrl}/inventory/adjustments`,
        { params: query },
      )
      .pipe(map((r) => r.data));
  }

  getAdjustment(id: string): Observable<InventoryAdjustmentDto> {
    return this.http
      .get<{ data: InventoryAdjustmentDto }>(`${this.config.apiBaseUrl}/inventory/adjustments/${id}`)
      .pipe(map((r) => r.data));
  }
}
