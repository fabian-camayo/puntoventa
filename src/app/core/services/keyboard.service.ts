import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { POS_SHORTCUTS } from '@puntoventa/shared';

export interface KeyboardAction {
  action: string;
  event: KeyboardEvent;
}

@Injectable({ providedIn: 'root' })
export class KeyboardService {
  private readonly action$ = new Subject<KeyboardAction>();
  private initialized = false;

  get onAction() {
    return this.action$.asObservable();
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    document.addEventListener('keydown', (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        if (!event.key.startsWith('F')) return;
      }

      for (const shortcut of POS_SHORTCUTS) {
        const keyMatch = event.key === shortcut.key || event.code === shortcut.key;
        const ctrlMatch = !!shortcut.ctrl === (event.ctrlKey || event.metaKey);
        const altMatch = !!shortcut.alt === event.altKey;
        const shiftMatch = !!shortcut.shift === event.shiftKey;

        if (keyMatch && ctrlMatch && altMatch && shiftMatch) {
          event.preventDefault();
          this.action$.next({ action: shortcut.action, event });
          return;
        }
      }
    });
  }
}
