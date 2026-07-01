import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, interval, Subscription } from 'rxjs';
import { switchMap, catchError, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ConfigService } from './config.service';
import { environment } from '@env/environment';

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting';

@Injectable({ providedIn: 'root' })
export class ConnectionService {
  private readonly http = inject(HttpClient);
  private readonly configService = inject(ConfigService);
  private readonly status$ = new BehaviorSubject<ConnectionStatus>('connected');
  private monitorSub?: Subscription;

  get connectionStatus$(): BehaviorSubject<ConnectionStatus> {
    return this.status$;
  }

  initialize(): void {
    this.startMonitoring();
  }

  private startMonitoring(): void {
    this.monitorSub?.unsubscribe();
    this.monitorSub = interval(environment.reconnectIntervalMs)
      .pipe(
        switchMap(() =>
          this.http
            .get(`${this.configService.apiBaseUrl}/health`)
            .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((response) => {
        if (response) {
          this.status$.next('connected');
        } else {
          this.status$.next(
            this.status$.value === 'connected' ? 'reconnecting' : 'disconnected',
          );
        }
      });
  }

  destroy(): void {
    this.monitorSub?.unsubscribe();
  }
}
