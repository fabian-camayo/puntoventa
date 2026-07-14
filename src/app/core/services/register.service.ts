import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  CloseRegisterRequest,
  CreateCashMovementRequest,
  CashMovementDto,
  OpenRegisterRequest,
  PaginatedResult,
  RegisterDto,
  RegisterSessionDto,
  TerminalDto,
} from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface SaveRegisterPayload {
  branchId?: string;
  code?: string;
  name: string;
  description?: string;
  isActive?: boolean;
  userIds?: string[];
}

export interface UpdateTerminalPayload {
  name?: string;
  registerId?: string | null;
  isActive?: boolean;
}

export interface TerminalHeartbeatPayload {
  barcodeScanned?: boolean;
  registerId?: string;
}

@Injectable({ providedIn: 'root' })
export class RegisterService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  listRegisters(
    branchId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Observable<PaginatedResult<RegisterDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<RegisterDto> }>(`${this.config.apiBaseUrl}/registers`, {
        params: query,
      })
      .pipe(map((r) => r.data));
  }

  listMine(branchId: string): Observable<RegisterDto[]> {
    return this.http
      .get<{ data: RegisterDto[] }>(`${this.config.apiBaseUrl}/registers/mine`, {
        params: { branchId },
      })
      .pipe(map((r) => r.data));
  }

  getRegister(id: string): Observable<RegisterDto> {
    return this.http
      .get<{ data: RegisterDto }>(`${this.config.apiBaseUrl}/registers/${id}`)
      .pipe(map((r) => r.data));
  }

  createRegister(payload: SaveRegisterPayload): Observable<RegisterDto> {
    return this.http
      .post<{ data: RegisterDto }>(`${this.config.apiBaseUrl}/registers`, payload)
      .pipe(map((r) => r.data));
  }

  updateRegister(id: string, payload: SaveRegisterPayload): Observable<RegisterDto> {
    return this.http
      .put<{ data: RegisterDto }>(`${this.config.apiBaseUrl}/registers/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  assignUsers(id: string, userIds: string[]): Observable<RegisterDto> {
    return this.http
      .put<{ data: RegisterDto }>(`${this.config.apiBaseUrl}/registers/${id}/users`, { userIds })
      .pipe(map((r) => r.data));
  }

  listTerminals(branchId: string): Observable<TerminalDto[]> {
    return this.http
      .get<{ data: TerminalDto[] }>(`${this.config.apiBaseUrl}/terminals`, {
        params: { branchId },
      })
      .pipe(map((r) => r.data));
  }

  updateTerminal(id: string, payload: UpdateTerminalPayload): Observable<TerminalDto> {
    return this.http
      .put<{ data: TerminalDto }>(`${this.config.apiBaseUrl}/terminals/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deleteTerminal(id: string): Observable<unknown> {
    return this.http.delete(`${this.config.apiBaseUrl}/terminals/${id}`);
  }

  sendHeartbeat(payload: TerminalHeartbeatPayload): Observable<{ ok: true; serverTime: string }> {
    return this.http
      .post<{ data: { ok: true; serverTime: string } }>(
        `${this.config.apiBaseUrl}/terminals/heartbeat`,
        payload,
      )
      .pipe(map((r) => r.data));
  }

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

  listCashMovements(sessionId: string): Observable<CashMovementDto[]> {
    return this.http
      .get<{ data: CashMovementDto[] }>(
        `${this.config.apiBaseUrl}/registers/sessions/${sessionId}/movements`,
      )
      .pipe(map((r) => r.data));
  }

  createCashMovement(
    sessionId: string,
    payload: CreateCashMovementRequest,
  ): Observable<CashMovementDto> {
    return this.http
      .post<{ data: CashMovementDto }>(
        `${this.config.apiBaseUrl}/registers/sessions/${sessionId}/movements`,
        payload,
      )
      .pipe(map((r) => r.data));
  }
}
