import { Component, inject } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  peopleOutline,
  shieldOutline,
  cubeOutline,
  settingsOutline,
  gridOutline,
  receiptOutline,
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

addIcons({
  peopleOutline,
  shieldOutline,
  cubeOutline,
  settingsOutline,
  gridOutline,
  receiptOutline,
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

interface DashboardCard {
  route: string;
  labelKey: string;
  icon: string;
  permission: string;
  color: string;
}

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.page.html',
  styleUrls: ['./admin-dashboard.page.scss'],
  imports: [IonContent, IonIcon, TranslateModule],
})
export class AdminDashboardPage {
  readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);

  readonly cards: DashboardCard[] = [
    { route: '/admin/sales', labelKey: 'ADMIN.SALES', icon: 'receipt-outline', permission: 'sales.view', color: '#2563eb' },
    { route: '/admin/purchases', labelKey: 'ADMIN.PURCHASES', icon: 'bag-handle-outline', permission: 'purchases.view', color: '#c2410c' },
    { route: '/admin/products', labelKey: 'ADMIN.PRODUCTS', icon: 'cube-outline', permission: 'products.view', color: '#16a34a' },
    { route: '/admin/product-import', labelKey: 'ADMIN.PRODUCT_IMPORT', icon: 'cloud-upload-outline', permission: 'products.import', color: '#0f766e' },
    { route: '/admin/product-import-types', labelKey: 'ADMIN.PRODUCT_IMPORT_TYPES', icon: 'document-outline', permission: 'product_import_types.view', color: '#115e59' },
    { route: '/admin/categories', labelKey: 'ADMIN.CATEGORIES', icon: 'folder-outline', permission: 'categories.view', color: '#0d9488' },
    { route: '/admin/payment-types', labelKey: 'ADMIN.PAYMENT_TYPES', icon: 'card-outline', permission: 'payment_types.view', color: '#db2777' },
    { route: '/admin/unit-types', labelKey: 'ADMIN.UNIT_TYPES', icon: 'resize-outline', permission: 'unit_types.view', color: '#7c3aed' },
    { route: '/admin/suppliers', labelKey: 'ADMIN.SUPPLIERS', icon: 'business-outline', permission: 'suppliers.view', color: '#b45309' },
    { route: '/admin/customers', labelKey: 'ADMIN.CUSTOMERS', icon: 'people-outline', permission: 'customers.view', color: '#0369a1' },
    { route: '/admin/inventory', labelKey: 'ADMIN.INVENTORY', icon: 'layers-outline', permission: 'inventory.view', color: '#ea580c' },
    { route: '/admin/users', labelKey: 'ADMIN.USERS', icon: 'people-outline', permission: 'users.view', color: '#7c3aed' },
    { route: '/admin/roles', labelKey: 'ADMIN.ROLES', icon: 'shield-outline', permission: 'roles.view', color: '#d97706' },
    { route: '/admin/register-sessions', labelKey: 'ADMIN.REGISTER_SESSIONS', icon: 'cash-outline', permission: 'registers.view', color: '#0891b2' },
    { route: '/admin/registers', labelKey: 'ADMIN.REGISTERS', icon: 'albums-outline', permission: 'registers.admin', color: '#0e7490' },
    { route: '/admin/terminals', labelKey: 'ADMIN.TERMINALS', icon: 'desktop-outline', permission: 'registers.admin', color: '#4338ca' },
    { route: '/admin/config', labelKey: 'ADMIN.CONFIG', icon: 'settings-outline', permission: 'config.view', color: '#64748b' },
  ];

  visibleCards(): DashboardCard[] {
    if (this.auth.isAdmin()) return this.cards;
    return this.cards.filter((c) => this.auth.hasPermission(c.permission));
  }

  goTo(route: string): void {
    void this.navCtrl.navigateRoot(route, {
      animated: true,
      animationDirection: 'forward',
    });
  }
}
