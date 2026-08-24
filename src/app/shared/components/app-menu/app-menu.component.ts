import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { IonIcon } from '@ionic/angular/standalone';
import { NavController } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs/operators';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  gridOutline,
  bagHandleOutline,
  logOutOutline,
  personCircleOutline,
  moonOutline,
  sunnyOutline,
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { ConfigService } from '@core/services/config.service';
import { ThemeService } from '@core/services/theme.service';
import { firstValueFrom } from 'rxjs';

addIcons({
  cartOutline,
  gridOutline,
  bagHandleOutline,
  logOutOutline,
  personCircleOutline,
  moonOutline,
  sunnyOutline,
});

export interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  permission?: string | string[];
}

/**
 * Menú principal reducido a tres entradas (POS, Compras, Panel de Administración).
 * El resto de módulos administrativos (Productos, Inventario, Clientes, Proveedores,
 * Usuarios, Cajas, Auditoría, Configuración, Reportes, etc.) no se eliminaron: siguen
 * disponibles con sus rutas y permisos intactos dentro de `AdminDashboardPage`
 * (`/admin`), que ya actuaba como panel/contenedor de esos módulos.
 */
const NAV_ITEMS: NavItem[] = [
  { labelKey: 'MENU.POS', icon: 'cart-outline', route: '/pos' },
  {
    labelKey: 'ADMIN.PURCHASES',
    icon: 'bag-handle-outline',
    route: '/admin/purchases',
    permission: 'purchases.view',
  },
  {
    labelKey: 'ADMIN.DASHBOARD',
    icon: 'grid-outline',
    route: '/admin',
    permission: 'admin.access',
  },
];

@Component({
  selector: 'app-menu',
  templateUrl: './app-menu.component.html',
  styleUrls: ['./app-menu.component.scss'],
  imports: [IonIcon, TranslateModule],
})
export class AppMenuComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly router = inject(Router);
  private readonly navCtrl = inject(NavController);
  private readonly theme = inject(ThemeService);

  visibleItems = signal<NavItem[]>([]);
  userName = signal('');
  businessName = signal('');
  logoUrl = signal<string | undefined>(undefined);
  currentUrl = signal(this.router.url);

  ngOnInit(): void {
    this.refreshMenu();
    this.auth.user$.subscribe((user) => {
      this.userName.set(user ? `${user.firstName} ${user.lastName}` : '');
      this.refreshMenu();
      void this.loadBranding();
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => {
        const previous = this.currentUrl();
        this.currentUrl.set(e.urlAfterRedirects);
        if (
          previous.startsWith('/admin/config') &&
          !e.urlAfterRedirects.startsWith('/admin/config')
        ) {
          void this.loadBranding();
        }
      });
  }

  isActive(route: string): boolean {
    const url = this.currentUrl();
    if (route === '/admin') {
      return url === '/admin' || url === '/admin/';
    }
    return url === route || url.startsWith(`${route}/`);
  }

  async navigateTo(route: string): Promise<void> {
    if (this.router.url !== route) {
      await this.navCtrl.navigateRoot(route, {
        animated: true,
        animationDirection: 'forward',
      });
    }
  }

  toggleTheme(): void {
    this.theme.toggleTheme();
  }

  isDarkMode(): boolean {
    return document.body.classList.contains('dark');
  }

  async logout(): Promise<void> {
    this.auth.logout().subscribe({
      next: () => void this.navCtrl.navigateRoot('/login'),
      error: () => {
        this.auth.clearSession();
        void this.navCtrl.navigateRoot('/login');
      },
    });
  }

  private refreshMenu(): void {
    if (!this.auth.isAuthenticated) {
      this.visibleItems.set([]);
      return;
    }

    const items = NAV_ITEMS.filter((item) => {
      if (!item.permission) return true;
      if (item.permission === 'admin.access') {
        return this.auth.hasAdminAccess();
      }
      const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
      return this.auth.hasAnyPermission(...perms);
    });

    this.visibleItems.set(items);
  }

  private async loadBranding(): Promise<void> {
    if (!this.auth.isAuthenticated) {
      this.businessName.set('');
      this.logoUrl.set(undefined);
      return;
    }
    try {
      const ctx = await firstValueFrom(this.configService.getPosContext());
      this.businessName.set(ctx.businessName?.trim() || ctx.branchName || '');
      this.logoUrl.set(ctx.logoUrl || undefined);
    } catch {
      // Sin contexto aún (setup / offline): mantener marca por defecto
    }
  }
}
