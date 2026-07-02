import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonChip,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ModalController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  shieldOutline,
  keyOutline,
} from 'ionicons/icons';
import { RoleDto, RoleService } from '@core/services/role.service';
import { AuthService } from '@core/services/auth.service';
import { RoleFormModal } from './role-form.modal';
import { RolePermissionsModal } from './role-permissions.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  shieldOutline,
  keyOutline,
});

@Component({
  selector: 'app-roles',
  templateUrl: './roles.page.html',
  styleUrls: ['./roles.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonChip,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
  ],
})
export class RolesPage implements OnInit, OnDestroy {
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('roles.create');
  readonly canUpdate = this.auth.hasPermission('roles.update');
  readonly canDelete = this.auth.hasPermission('roles.delete');
  readonly canViewPermissions = this.auth.hasPermission('roles.view');
  readonly canManagePermissions = this.auth.hasPermission('roles.update');

  roles = signal<RoleDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  showInactive = signal(false);

  ngOnInit(): void {
    this.setupSearch();
    void this.loadRoles();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  setActiveFilter(activeOnly: boolean): void {
    const showInactive = !activeOnly;
    if (this.showInactive() === showInactive) return;
    this.showInactive.set(showInactive);
    this.page.set(1);
    void this.loadRoles();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadRoles();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadRoles();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadRoles();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: RoleFormModal,
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadRoles();
      await this.showToast('ROLES.SAVED_OK', 'success');
    }
  }

  async openEdit(role: RoleDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: RoleFormModal,
      componentProps: { role },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role: dismissRole } = await modal.onDidDismiss();
    if (dismissRole === 'saved') {
      await this.loadRoles();
      await this.showToast('ROLES.SAVED_OK', 'success');
    }
  }

  async openPermissions(role: RoleDto): Promise<void> {
    if (!this.canViewPermissions) return;

    const modal = await this.modalCtrl.create({
      component: RolePermissionsModal,
      componentProps: {
        role,
        readOnly: !this.canManagePermissions,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role: dismissRole } = await modal.onDidDismiss();
    if (dismissRole === 'saved') {
      await this.loadRoles();
      await this.showToast('ROLES.PERMISSIONS_SAVED_OK', 'success');
    }
  }

  async confirmDelete(role: RoleDto): Promise<void> {
    if (!this.canDelete || !role.isActive || role.isSystem) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar rol',
      message: `¿Desactivar el rol "${role.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivateRole(role);
          },
        },
      ],
    });
    await alert.present();
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadRoles();
      });
  }

  private loadRoles(): Promise<void> {
    this.loading.set(true);
    return new Promise((resolve) => {
      this.roleService
        .list({
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            const items = this.showInactive()
              ? result.items
              : result.items.filter((r) => r.isActive);
            this.roles.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('ROLES.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivateRole(role: RoleDto): Promise<void> {
    this.roleService.deactivate(role.id).subscribe({
      next: async () => {
        await this.loadRoles();
        await this.showToast('ROLES.DEACTIVATED_OK', 'success');
      },
      error: async () => {
        await this.showToast('ROLES.DEACTIVATE_ERROR', 'danger');
      },
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'ROLES.SAVED_OK': 'Rol guardado correctamente',
      'ROLES.PERMISSIONS_SAVED_OK': 'Permisos actualizados',
      'ROLES.LOAD_ERROR': 'Error al cargar roles',
      'ROLES.DEACTIVATED_OK': 'Rol desactivado',
      'ROLES.DEACTIVATE_ERROR': 'No se pudo desactivar el rol',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
