import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CreateUnitTypeRequest,
  PaginatedResult,
  UnitTypeDto,
  UpdateUnitTypeRequest,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class UnitTypeService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/unit-types`;
  }

  list(params?: {
    search?: string;
    page?: number;
    limit?: number;
    activeOnly?: boolean;
  }): Observable<PaginatedResult<UnitTypeDto>> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);
    if (params?.activeOnly) query['activeOnly'] = 'true';

    return this.http
      .get<{ data: PaginatedResult<UnitTypeDto> }>(this.baseUrl, { params: query })
      .pipe(map((r) => r.data));
  }

  listActive(): Observable<UnitTypeDto[]> {
    return this.http
      .get<{ data: UnitTypeDto[] }>(`${this.baseUrl}/active`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateUnitTypeRequest): Observable<UnitTypeDto> {
    return this.http
      .post<{ data: UnitTypeDto }>(this.baseUrl, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateUnitTypeRequest): Observable<UnitTypeDto> {
    return this.http
      .put<{ data: UnitTypeDto }>(`${this.baseUrl}/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.baseUrl}/${id}`);
  }
}
