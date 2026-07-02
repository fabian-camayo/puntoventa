import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface PermissionDto {
  id: string;
  module: string;
  action: string;
  code: string;
  name: string;
  description?: string;
  isActive: boolean;
  granted?: boolean;
}

export interface PermissionGroupDto {
  module: string;
  permissions: PermissionDto[];
}

export interface RoleDto {
  id: string;
  code: string;
  name: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  permissions?: PermissionDto[];
}

export interface CreateRolePayload {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface AssignPermissionsPayload {
  permissions: Array<{ permissionId: string; granted?: boolean }>;
}

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  list(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResult<RoleDto>> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<RoleDto> }>(`${this.config.apiBaseUrl}/roles`, { params: query })
      .pipe(map((r) => r.data));
  }

  listAll(limit = 100): Observable<RoleDto[]> {
    return this.list({ limit }).pipe(map((r) => r.items));
  }

  getById(id: string): Observable<RoleDto> {
    return this.http
      .get<{ data: RoleDto }>(`${this.config.apiBaseUrl}/roles/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateRolePayload): Observable<RoleDto> {
    return this.http
      .post<{ data: RoleDto }>(`${this.config.apiBaseUrl}/roles`, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateRolePayload): Observable<RoleDto> {
    return this.http
      .put<{ data: RoleDto }>(`${this.config.apiBaseUrl}/roles/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.config.apiBaseUrl}/roles/${id}`);
  }

  assignPermissions(id: string, payload: AssignPermissionsPayload): Observable<RoleDto> {
    return this.http
      .put<{ data: RoleDto }>(`${this.config.apiBaseUrl}/roles/${id}/permissions`, payload)
      .pipe(map((r) => r.data));
  }

  getPermissionsGrouped(): Observable<PermissionGroupDto[]> {
    return this.http
      .get<{ data: PermissionGroupDto[] }>(`${this.config.apiBaseUrl}/permissions/grouped`)
      .pipe(map((r) => r.data));
  }
}
