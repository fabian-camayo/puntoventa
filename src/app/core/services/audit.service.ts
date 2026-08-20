import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { AuditLogDto, ListAuditLogsQuery, PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class AuditService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  list(params: ListAuditLogsQuery): Observable<PaginatedResult<AuditLogDto>> {
    const query: Record<string, string> = {};
    if (params.module) query['module'] = params.module;
    if (params.action) query['action'] = params.action;
    if (params.entityType) query['entityType'] = params.entityType;
    if (params.entityId) query['entityId'] = params.entityId;
    if (params.userId) query['userId'] = params.userId;
    if (params.search) query['search'] = params.search;
    if (params.dateFrom) query['dateFrom'] = params.dateFrom;
    if (params.dateTo) query['dateTo'] = params.dateTo;
    if (params.page) query['page'] = String(params.page);
    if (params.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<AuditLogDto> }>(`${this.config.apiBaseUrl}/audit`, {
        params: query,
      })
      .pipe(map((r) => r.data));
  }

  getById(id: string): Observable<AuditLogDto> {
    return this.http
      .get<{ data: AuditLogDto }>(`${this.config.apiBaseUrl}/audit/${id}`)
      .pipe(map((r) => r.data));
  }
}
