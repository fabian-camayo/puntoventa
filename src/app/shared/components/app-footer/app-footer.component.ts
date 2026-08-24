import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs/operators';

const DARK_BG_ROUTES = /^\/(login|setup)(\/|\?|$)/;

/**
 * Firma sutil y muy pequeña, presente en toda la aplicación.
 *
 * Se monta UNA sola vez en la raíz (app.component.html), fuera del
 * <ion-router-outlet>: Ionic mantiene vivas en el DOM las páginas ya
 * visitadas (para animaciones/gestos de "atrás"), así que un footer con
 * position:fixed dentro de cada página quedaría duplicado y visible por
 * encima de la página activa. Al vivir en la raíz hay un único elemento
 * siempre, y detecta la ruta activa para adaptar su color.
 */
@Component({
  selector: 'app-footer',
  template: `<footer class="app-global-footer" [class.on-dark]="onDark()">&copy; FASER 2026. Todos los derechos reservados.</footer>`,
  styleUrls: ['./app-footer.component.scss'],
})
export class AppFooterComponent {
  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);

  readonly onDark = computed(() => DARK_BG_ROUTES.test(this.url()));

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.url.set(e.urlAfterRedirects));
  }
}
