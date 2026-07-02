import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface UserRoleRef {
  id: string;
  code: string;
  name: string;
}

export interface UserDto {
  id: string;
  username: string;
  email?: string;
  firstName: string;
  lastName: string;
  companyId: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  roles?: UserRoleRef[];
}

export interface CreateUserPayload {
  companyId: string;
  username: string;
  password: string;
  firstName: string;
  lastName: string;
  email?: string;
  pin?: string;
  isActive?: boolean;
  roleIds?: string[];
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  pin?: string;
  isActive?: boolean;
  roleIds?: string[];
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  list(params?: {
    search?: string;
    page?: number;
    limit?: number;
  }): Observable<PaginatedResult<UserDto>> {
    const query: Record<string, string> = {};
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<UserDto> }>(`${this.config.apiBaseUrl}/users`, { params: query })
      .pipe(map((r) => r.data));
  }

  getById(id: string): Observable<UserDto> {
    return this.http
      .get<{ data: UserDto }>(`${this.config.apiBaseUrl}/users/${id}`)
      .pipe(map((r) => r.data));
  }

  create(payload: CreateUserPayload): Observable<UserDto> {
    return this.http
      .post<{ data: UserDto }>(`${this.config.apiBaseUrl}/users`, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateUserPayload): Observable<UserDto> {
    return this.http
      .put<{ data: UserDto }>(`${this.config.apiBaseUrl}/users/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.config.apiBaseUrl}/users/${id}`);
  }
}
