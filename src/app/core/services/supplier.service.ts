import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface SupplierDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive: boolean;
}

export interface CreateSupplierPayload {
  branchId: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

export interface UpdateSupplierPayload {
  name?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/suppliers`;
  }

  list(
    branchId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Observable<PaginatedResult<SupplierDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<SupplierDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  listActive(branchId: string): Observable<SupplierDto[]> {
    return this.list(branchId, { limit: 200 }).pipe(
      map((r) => r.items.filter((s) => s.isActive)),
    );
  }

  create(payload: CreateSupplierPayload): Observable<SupplierDto> {
    return this.http
      .post<{ data: SupplierDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateSupplierPayload): Observable<SupplierDto> {
    return this.http
      .put<{ data: SupplierDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
