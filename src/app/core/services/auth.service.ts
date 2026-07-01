import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '@env/environment';
import { LoginRequest, LoginResponse, AuthUser } from '@puntoventa/shared';

const TOKEN_KEY = 'pv_access_token';
const REFRESH_KEY = 'pv_refresh_token';
const USER_KEY = 'pv_user';
const PERMISSIONS_KEY = 'pv_permissions';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly currentUser$ = new BehaviorSubject<AuthUser | null>(this.loadUser());
  private readonly permissions$ = new BehaviorSubject<string[]>(this.loadPermissions());

  get user$(): Observable<AuthUser | null> {
    return this.currentUser$.asObservable();
  }

  get permissions(): string[] {
    return this.permissions$.value;
  }

  get isAuthenticated(): boolean {
    return !!this.getToken();
  }

  hasPermission(code: string): boolean {
    return this.permissions$.value.includes(code);
  }

  hasAnyPermission(...codes: string[]): boolean {
    return codes.some((c) => this.hasPermission(c));
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<{ data: LoginResponse }>(`${environment.apiUrl}/auth/login`, credentials)
      .pipe(
        tap((res) => {
          const data = res.data;
          localStorage.setItem(TOKEN_KEY, data.accessToken);
          localStorage.setItem(REFRESH_KEY, data.refreshToken);
          localStorage.setItem(USER_KEY, JSON.stringify(data.user));
          localStorage.setItem(PERMISSIONS_KEY, JSON.stringify(data.permissions));
          this.currentUser$.next(data.user);
          this.permissions$.next(data.permissions);
        }),
        map((res) => res.data),
      );
  }

  logout(): Observable<unknown> {
    const refreshToken = localStorage.getItem(REFRESH_KEY) ?? '';
    return this.http
      .post(`${environment.apiUrl}/auth/logout`, { refreshToken })
      .pipe(
        tap(() => this.clearSession()),
      );
  }

  clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(PERMISSIONS_KEY);
    this.currentUser$.next(null);
    this.permissions$.next([]);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }

  private loadPermissions(): string[] {
    const raw = localStorage.getItem(PERMISSIONS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  }
}
