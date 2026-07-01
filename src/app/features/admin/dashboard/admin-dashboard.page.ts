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
} from 'ionicons/icons';
import { AuthService } from '@core/services/auth.service';

addIcons({
  peopleOutline,
  shieldOutline,
  cubeOutline,
  settingsOutline,
  gridOutline,
  receiptOutline,
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
    { route: '/admin/products', labelKey: 'ADMIN.PRODUCTS', icon: 'cube-outline', permission: 'products.view', color: '#16a34a' },
    { route: '/admin/users', labelKey: 'ADMIN.USERS', icon: 'people-outline', permission: 'users.view', color: '#7c3aed' },
    { route: '/admin/roles', labelKey: 'ADMIN.ROLES', icon: 'shield-outline', permission: 'roles.view', color: '#d97706' },
    { route: '/admin/config', labelKey: 'ADMIN.CONFIG', icon: 'settings-outline', permission: 'config.view', color: '#64748b' },
  ];

  visibleCards(): DashboardCard[] {
    return this.cards.filter((c) => this.auth.hasPermission(c.permission));
  }

  goTo(route: string): void {
    void this.navCtrl.navigateForward(route, {
      animated: true,
      animationDirection: 'forward',
    });
  }
}
