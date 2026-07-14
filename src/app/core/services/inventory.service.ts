import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
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
}
