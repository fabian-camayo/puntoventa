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
  peopleOutline,
  shieldOutline,
  cubeOutline,
  settingsOutline,
  logOutOutline,
  receiptOutline,
  storefrontOutline,
  personCircleOutline,
  moonOutline,
  sunnyOutline,
  folderOutline,
  cashOutline,
  albumsOutline,
  desktopOutline,
  cardOutline,
  layersOutline,
  businessOutline,
  bagHandleOutline,
  resizeOutline,
  cloudUploadOutline,
  documentOutline,
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';

addIcons({
  cartOutline,
  gridOutline,
  peopleOutline,
  shieldOutline,
  cubeOutline,
  settingsOutline,
  logOutOutline,
  receiptOutline,
  storefrontOutline,
  personCircleOutline,
  moonOutline,
  sunnyOutline,
  folderOutline,
  cashOutline,
  albumsOutline,
  desktopOutline,
  cardOutline,
  layersOutline,
  businessOutline,
  bagHandleOutline,
  resizeOutline,
  cloudUploadOutline,
  documentOutline,
});

export interface NavItem {
  labelKey: string;
  icon: string;
  route: string;
  permission?: string | string[];
}

const NAV_ITEMS: NavItem[] = [
  { labelKey: 'MENU.POS', icon: 'cart-outline', route: '/pos' },
  {
    labelKey: 'ADMIN.DASHBOARD',
    icon: 'grid-outline',
    route: '/admin',
    permission: 'admin.access',
  },
  {
    labelKey: 'ADMIN.SALES',
    icon: 'receipt-outline',
    route: '/admin/sales',
    permission: 'sales.view',
  },
  {
    labelKey: 'ADMIN.PURCHASES',
    icon: 'bag-handle-outline',
    route: '/admin/purchases',
    permission: 'purchases.view',
  },
  {
    labelKey: 'ADMIN.PRODUCTS',
    icon: 'cube-outline',
    route: '/admin/products',
    permission: 'products.view',
  },
  {
    labelKey: 'ADMIN.PRODUCT_IMPORT',
    icon: 'cloud-upload-outline',
    route: '/admin/product-import',
    permission: 'products.import',
  },
  {
    labelKey: 'ADMIN.PRODUCT_IMPORT_TYPES',
    icon: 'document-outline',
    route: '/admin/product-import-types',
    permission: 'product_import_types.view',
  },
  {
    labelKey: 'ADMIN.CATEGORIES',
    icon: 'folder-outline',
    route: '/admin/categories',
    permission: 'categories.view',
  },
  {
    labelKey: 'ADMIN.PAYMENT_TYPES',
    icon: 'card-outline',
    route: '/admin/payment-types',
    permission: 'payment_types.view',
  },
  {
    labelKey: 'ADMIN.UNIT_TYPES',
    icon: 'resize-outline',
    route: '/admin/unit-types',
    permission: 'unit_types.view',
  },
  {
    labelKey: 'ADMIN.SUPPLIERS',
    icon: 'business-outline',
    route: '/admin/suppliers',
    permission: 'suppliers.view',
  },
  {
    labelKey: 'ADMIN.CUSTOMERS',
    icon: 'people-outline',
    route: '/admin/customers',
    permission: 'customers.view',
  },
  {
    labelKey: 'ADMIN.INVENTORY',
    icon: 'layers-outline',
    route: '/admin/inventory',
    permission: 'inventory.view',
  },
  {
    labelKey: 'ADMIN.REGISTER_SESSIONS',
    icon: 'cash-outline',
    route: '/admin/register-sessions',
    permission: 'registers.view',
  },
  {
    labelKey: 'ADMIN.REGISTERS',
    icon: 'albums-outline',
    route: '/admin/registers',
    permission: 'registers.admin',
  },
  {
    labelKey: 'ADMIN.TERMINALS',
    icon: 'desktop-outline',
    route: '/admin/terminals',
    permission: 'registers.view',
  },
  {
    labelKey: 'ADMIN.USERS',
    icon: 'people-outline',
    route: '/admin/users',
    permission: 'users.view',
  },
  {
    labelKey: 'ADMIN.ROLES',
    icon: 'shield-outline',
    route: '/admin/roles',
    permission: 'roles.view',
  },
  {
    labelKey: 'ADMIN.CONFIG',
    icon: 'settings-outline',
    route: '/admin/config',
    permission: 'config.view',
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
  private readonly router = inject(Router);
  private readonly navCtrl = inject(NavController);
  private readonly theme = inject(ThemeService);

  visibleItems = signal<NavItem[]>([]);
  userName = signal('');
  currentUrl = signal(this.router.url);

  ngOnInit(): void {
    this.refreshMenu();
    this.auth.user$.subscribe((user) => {
      this.userName.set(user ? `${user.firstName} ${user.lastName}` : '');
      this.refreshMenu();
    });

    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((e) => this.currentUrl.set(e.urlAfterRedirects));
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
}
