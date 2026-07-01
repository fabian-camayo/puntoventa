import { Injectable, RendererFactory2, inject } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ThemeMode = 'light' | 'dark' | 'system';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly renderer = inject(RendererFactory2).createRenderer(null, null);
  private readonly theme$ = new BehaviorSubject<ThemeMode>('system');
  private readonly THEME_KEY = 'pv_theme';

  initialize(): void {
    const saved = (localStorage.getItem(this.THEME_KEY) as ThemeMode) ?? 'system';
    this.setTheme(saved);
  }

  setTheme(mode: ThemeMode): void {
    localStorage.setItem(this.THEME_KEY, mode);
    this.theme$.next(mode);
    this.applyTheme(mode);
  }

  toggleTheme(): void {
    const current = this.theme$.value;
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  get theme() {
    return this.theme$.asObservable();
  }

  private applyTheme(mode: ThemeMode): void {
    const body = document.body;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = mode === 'dark' || (mode === 'system' && prefersDark);

    if (isDark) {
      this.renderer.addClass(body, 'dark');
    } else {
      this.renderer.removeClass(body, 'dark');
    }
  }
}
