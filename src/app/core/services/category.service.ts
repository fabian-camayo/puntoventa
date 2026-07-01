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
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  list(branchId: string, limit = 100): Observable<CategoryDto[]> {
    return this.http
      .get<{ data: PaginatedResult<CategoryDto> }>(`${this.config.apiBaseUrl}/categories`, {
        params: { branchId, limit },
      })
      .pipe(map((r) => r.data.items));
  }
}
