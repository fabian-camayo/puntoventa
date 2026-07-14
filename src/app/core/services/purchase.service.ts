import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

export type PurchaseStatus = 'DRAFT' | 'RECEIVED' | 'CANCELLED';

export interface PurchaseItemDto {
  id?: string;
  productId: string;
  productName?: string;
  sku?: string;
  unitTypeId?: string;
  unitTypeCode?: string;
  unitTypeName?: string;
  stockFactor?: number;
  quantity: number;
  unitCost: number;
  taxRate?: number;
  subtotal: number;
  taxAmount?: number;
  total: number;
}

export interface PurchaseDto {
  id: string;
  branchId: string;
  supplierId: string;
  supplierName?: string;
  documentNumber: string;
  status: PurchaseStatus;
  subtotal: number;
  taxAmount: number;
  total: number;
  notes?: string;
  receivedAt?: string;
  createdAt: string;
  items?: PurchaseItemDto[];
}

export interface CreatePurchasePayload {
  branchId: string;
  supplierId: string;
  documentNumber: string;
  notes?: string;
  items: Array<{
    productId: string;
    unitTypeId?: string;
    quantity: number;
    unitCost: number;
    taxRate?: number;
  }>;
}

export interface UpdatePurchasePayload {
  notes?: string;
  items?: Array<{
    productId: string;
    unitTypeId?: string;
    quantity: number;
    unitCost: number;
    taxRate?: number;
  }>;
}

@Injectable({ providedIn: 'root' })
export class PurchaseService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/purchases`;
  }

  list(
    branchId: string,
    params?: {
      search?: string;
      status?: PurchaseStatus;
      page?: number;
      limit?: number;
    },
  ): Observable<PaginatedResult<PurchaseDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.status) query['status'] = params.status;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<PurchaseDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  get(id: string): Observable<PurchaseDto> {
    return this.http
      .get<{ data: PurchaseDto }>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreatePurchasePayload): Observable<PurchaseDto> {
    return this.http
      .post<{ data: PurchaseDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdatePurchasePayload): Observable<PurchaseDto> {
    return this.http
      .put<{ data: PurchaseDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  receive(id: string): Observable<PurchaseDto> {
    return this.http
      .post<{ data: PurchaseDto }>(`${this.baseUrl}/${id}/receive`, {})
      .pipe(map((r) => r.data));
  }

  cancel(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
