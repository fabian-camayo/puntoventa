import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  BankAccountDto,
  CreateBankAccountRequest,
  PaginatedResult,
  UpdateBankAccountRequest,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class BankAccountService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/bank-accounts`;
  }

  list(
    branchId: string,
    params?: {
      search?: string;
      page?: number;
      limit?: number;
      activeOnly?: boolean;
    },
  ): Observable<PaginatedResult<BankAccountDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);
    if (params?.activeOnly) query['activeOnly'] = 'true';

    return this.http
      .get<{ data: PaginatedResult<BankAccountDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  listActive(branchId: string): Observable<BankAccountDto[]> {
    return this.http
      .get<{ data: BankAccountDto[] }>(`${this.baseUrl}/active`, {
        params: { branchId },
      })
      .pipe(map((r) => r.data));
  }

  create(payload: CreateBankAccountRequest): Observable<BankAccountDto> {
    return this.http
      .post<{ data: BankAccountDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateBankAccountRequest): Observable<BankAccountDto> {
    return this.http
      .put<{ data: BankAccountDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
