import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '@env/environment';
import { AppConfigDto, AppMode, PosContextDto } from '@puntoventa/shared';

export interface BusinessConfigDto {
  id: string;
  branchId: string;
  businessName: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  currencySymbol: string;
  taxRate: number;
  ticketHeader?: string;
  ticketFooter?: string;
  allowNegativeStock: boolean;
  defaultCustomerId?: string;
}

export interface UpdateBusinessConfigPayload {
  businessName: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  currency?: string;
  currencySymbol?: string;
  taxRate?: number;
  ticketHeader?: string;
  ticketFooter?: string;
  allowNegativeStock?: boolean;
  defaultCustomerId?: string;
}

export interface AppSettingDto {
  key: string;
  value: string;
  category: string;
  isSecret: boolean;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly http = inject(HttpClient);
  private readonly config$ = new BehaviorSubject<AppConfigDto | null>(null);
  private apiUrl = environment.apiUrl;

  async initialize(): Promise<void> {
    if (typeof window !== 'undefined' && window.electronAPI) {
      const url = await window.electronAPI.getApiUrl();
      this.apiUrl = url;
      const config = await window.electronAPI.getConfig();
      this.config$.next(config);
    }
  }

  get apiBaseUrl(): string {
    return this.apiUrl;
  }

  get config(): Observable<AppConfigDto | null> {
    return this.config$.asObservable();
  }

  get currentConfig(): AppConfigDto | null {
    return this.config$.value;
  }

  async saveMode(mode: AppMode): Promise<void> {
    if (window.electronAPI) {
      const config = await window.electronAPI.setMode(mode);
      this.config$.next(config);
      this.apiUrl = await window.electronAPI.getApiUrl();
    }
  }

  testConnection(host: string, port: number): Observable<{ data: { success: boolean; message: string } }> {
    return this.http.post<{ data: { success: boolean; message: string } }>(
      `${this.apiUrl}/config/test-connection`,
      { host, port },
    );
  }

  getPosContext(): Observable<PosContextDto> {
    return this.http
      .get<{ data: PosContextDto }>(`${this.apiUrl}/config/pos-context`)
      .pipe(map((r) => r.data));
  }

  getAppConfigFromApi(): Observable<AppConfigDto> {
    return this.http
      .get<{ data: AppConfigDto }>(`${this.apiUrl}/config/app`)
      .pipe(map((r) => r.data));
  }

  getBusinessConfig(branchId: string): Observable<BusinessConfigDto> {
    return this.http
      .get<{ data: BusinessConfigDto }>(`${this.apiUrl}/config/business/${branchId}`)
      .pipe(map((r) => r.data));
  }

  updateBusinessConfig(
    branchId: string,
    payload: UpdateBusinessConfigPayload,
  ): Observable<BusinessConfigDto> {
    return this.http
      .put<{ data: BusinessConfigDto }>(`${this.apiUrl}/config/business/${branchId}`, payload)
      .pipe(map((r) => r.data));
  }

  updateAppSetting(key: string, value: string, category = 'app'): Observable<AppSettingDto> {
    return this.http
      .put<{ data: AppSettingDto }>(`${this.apiUrl}/config/settings`, { key, value, category })
      .pipe(map((r) => r.data));
  }
}
