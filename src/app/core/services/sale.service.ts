import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  SaleDto,
  SaleTab,
  CheckoutRequest,
  SaleItemDto,
  SaleListItemDto,
  PaginatedResult,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/sales`;
  }

  getActiveTabs(registerId: string): Observable<SaleTab[]> {
    return this.http
      .get<{ data: SaleTab[] }>(`${this.baseUrl}/tabs`, { params: { registerId } })
      .pipe(map((r) => r.data));
  }

  list(params: {
    branchId: string;
    search?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResult<SaleListItemDto>> {
    const query: Record<string, string> = { branchId: params.branchId };
    if (params.search) query['search'] = params.search;
    if (params.status) query['status'] = params.status;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<SaleListItemDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  createTab(data: {
    branchId: string;
    registerId: string;
    customerId?: string;
    tabOrder?: number;
  }): Observable<SaleDto> {
    return this.http
      .post<{ data: SaleDto }>(this.baseUrl, data)
      .pipe(map((r) => r.data));
  }

  getSale(id: string): Observable<SaleDto> {
    return this.http
      .get<{ data: SaleDto }>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  updateSale(id: string, sale: Partial<SaleDto> & { version: number }): Observable<SaleDto> {
    const body = {
      customerId: sale.customerId,
      subtotal: sale.subtotal,
      discountAmount: sale.discountAmount,
      discountPercent: sale.discountPercent,
      taxAmount: sale.taxAmount,
      total: sale.total,
      notes: sale.notes,
      version: sale.version,
      items: sale.items?.map((item) => this.toUpdateItemPayload(item)),
    };

    return this.http
      .put<{ data: SaleDto }>(`${this.baseUrl}/${id}`, body)
      .pipe(map((r) => r.data));
  }

  suspendSale(id: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/suspend`, {});
  }

  recoverSale(id: string): Observable<unknown> {
    return this.http.post(`${this.baseUrl}/${id}/recover`, {});
  }

  checkout(id: string, request: CheckoutRequest): Observable<SaleDto> {
    const body = {
      payments: request.payments,
      version: request.version,
    };

    return this.http
      .post<{ data: SaleDto }>(`${this.baseUrl}/${id}/checkout`, body)
      .pipe(map((r) => r.data));
  }

  /** El API rechaza campos extra (productName, sku, id) por forbidNonWhitelisted. */
  private toUpdateItemPayload(item: SaleItemDto) {
    return {
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      costPrice: item.costPrice,
      discountAmount: item.discountAmount ?? 0,
      discountPercent: item.discountPercent ?? 0,
      taxRate: item.taxRate ?? 0,
      taxAmount: item.taxAmount ?? 0,
      subtotal: item.subtotal,
      total: item.total,
      notes: item.notes,
    };
  }
}
