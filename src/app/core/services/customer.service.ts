import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface CustomerDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  isActive: boolean;
}

export interface CreateCustomerPayload {
  branchId: string;
  code: string;
  name: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  isActive?: boolean;
}

export interface UpdateCustomerPayload {
  name?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  creditLimit?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/customers`;
  }

  list(
    branchId: string,
    params?: {
      search?: string;
      page?: number;
      limit?: number;
      includeInactive?: boolean;
    },
  ): Observable<PaginatedResult<CustomerDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);
    if (params?.includeInactive) query['includeInactive'] = 'true';

    return this.http
      .get<{ data: PaginatedResult<CustomerDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  listActive(branchId: string, search?: string): Observable<CustomerDto[]> {
    return this.list(branchId, { search, limit: 50 }).pipe(map((r) => r.items));
  }

  get(id: string): Observable<CustomerDto> {
    return this.http
      .get<{ data: CustomerDto }>(`${this.baseUrl}/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateCustomerPayload): Observable<CustomerDto> {
    return this.http
      .post<{ data: CustomerDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateCustomerPayload): Observable<CustomerDto> {
    return this.http
      .put<{ data: CustomerDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
