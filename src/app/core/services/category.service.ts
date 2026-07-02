import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PaginatedResult } from '@puntoventa/shared';
import { ConfigService } from './config.service';

export interface CategoryDto {
  id: string;
  branchId: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  parentName?: string;
  sortOrder?: number;
  isActive: boolean;
}

export interface CreateCategoryPayload {
  branchId: string;
  code: string;
  name: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateCategoryPayload {
  name?: string;
  description?: string;
  parentId?: string;
  sortOrder?: number;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  list(
    branchId: string,
    params?: { search?: string; page?: number; limit?: number },
  ): Observable<PaginatedResult<CategoryDto>> {
    const query: Record<string, string> = { branchId };
    if (params?.search) query['search'] = params.search;
    if (params?.page) query['page'] = String(params.page);
    if (params?.limit) query['limit'] = String(params.limit);

    return this.http
      .get<{ data: PaginatedResult<CategoryDto> }>(`${this.config.apiBaseUrl}/categories`, {
        params: query,
      })
      .pipe(map((r) => r.data));
  }

  listAll(branchId: string, limit = 200): Observable<CategoryDto[]> {
    return this.list(branchId, { limit }).pipe(map((r) => r.items));
  }

  create(payload: CreateCategoryPayload): Observable<CategoryDto> {
    return this.http
      .post<{ data: CategoryDto }>(`${this.config.apiBaseUrl}/categories`, payload)
      .pipe(map((r) => r.data));
  }

  update(id: string, payload: UpdateCategoryPayload): Observable<CategoryDto> {
    return this.http
      .put<{ data: CategoryDto }>(`${this.config.apiBaseUrl}/categories/${id}`, payload)
      .pipe(map((r) => r.data));
  }

  deactivate(id: string): Observable<unknown> {
    return this.http.delete(`${this.config.apiBaseUrl}/categories/${id}`);
  }
}
