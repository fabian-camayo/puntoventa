import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreatePaymentTypeRequest,
  PaginatedResult,
  PaymentTypeDto,
  UpdatePaymentTypeRequest,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class PaymentTypeService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/payment-types`;
  }

  list(params?: {
    search?: string;
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  }): Observable<PaginatedResult<PaymentTypeDto>> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);
    if (params?.activeOnly) query['activeOnly'] = 'true';

    return this.http
      .get<{ data: PaginatedResult<PaymentTypeDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  listActive(): Observable<PaymentTypeDto[]> {
    return this.http
      .get<{ data: PaymentTypeDto[] }>(`${this.baseUrl}/active`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreatePaymentTypeRequest): Observable<PaymentTypeDto> {
    return this.http
      .post<{ data: PaymentTypeDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdatePaymentTypeRequest): Observable<PaymentTypeDto> {
    return this.http
      .put<{ data: PaymentTypeDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
