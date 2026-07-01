import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { environment } from '@env/environment';
import { AppConfigDto, AppMode, PosContextDto } from '@puntoventa/shared';

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

  getPosContext(): Observable<{ data: PosContextDto }> {
    return this.http.get<{ data: PosContextDto }>(`${this.apiUrl}/config/pos-context`);
  }

  getBusinessConfig(branchId: string): Observable<{
    data: {
      businessName: string;
      ticketHeader?: string;
      ticketFooter?: string;
    };
  }> {
    return this.http.get<{
      data: {
        businessName: string;
        ticketHeader?: string;
        ticketFooter?: string;
      };
    }>(`${this.apiUrl}/config/business/${branchId}`);
  }
}
