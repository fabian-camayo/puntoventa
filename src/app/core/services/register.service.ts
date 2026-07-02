import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CloseRegisterRequest,
  OpenRegisterRequest,
  PaginatedResult,
  RegisterSessionDto,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

@Injectable({ providedIn: 'root' })
export class RegisterService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  getActiveSession(registerId: string): Observable<RegisterSessionDto | null> {
    return this.http
      .get<{ data: RegisterSessionDto | null }>(
        `${this.config.apiBaseUrl}/registers/${registerId}/session`,
      )
      .pipe(map((r) => r.data));
  }

  openSession(payload: OpenRegisterRequest): Observable<RegisterSessionDto> {
    return this.http
      .post<{ data: RegisterSessionDto }>(
        `${this.config.apiBaseUrl}/registers/sessions/open`,
        payload,
      )
      .pipe(map((r) => r.data));
  }

  closeSession(payload: CloseRegisterRequest): Observable<RegisterSessionDto> {
    return this.http
      .post<{ data: RegisterSessionDto }>(
        `${this.config.apiBaseUrl}/registers/sessions/close`,
        payload,
      )
      .pipe(map((r) => r.data));
  }

  listSessions(
    branchId: string,
    params?: {
      registerId?: string;
      status?: 'OPEN' | 'CLOSED';
      page?: number;
      limit?: number;
    },
  ): Observable<PaginatedResult<RegisterSessionDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.registerId) query['registerId'] = params.registerId;
    if (params?.status) query['status'] = params.status;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<RegisterSessionDto> }>(
        `${this.config.apiBaseUrl}/registers/sessions`,
        { params: query },
      )
      .pipe(map((r) => r.data));
  }

  getSession(sessionId: string): Observable<RegisterSessionDto> {
    return this.http
      .get<{ data: RegisterSessionDto }>(
        `${this.config.apiBaseUrl}/registers/sessions/${sessionId}`,
      )
      .pipe(map((r) => r.data));
  }
}
