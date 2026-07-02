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
  peopleOutline,
} from 'ionicons/icons';
import { UserDto, UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { UserFormModal } from './user-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  peopleOutline,
});

@Component({
  selector: 'app-users',
  templateUrl: './users.page.html',
  styleUrls: ['./users.page.scss'],
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
export class UsersPage implements OnInit, OnDestroy {
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('users.create');
  readonly canUpdate = this.auth.hasPermission('users.update');
  readonly canDelete = this.auth.hasPermission('users.delete');

  companyId = signal<string | null>(null);
  users = signal<UserDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  showInactive = signal(false);

  ngOnInit(): void {
    this.setupSearch();
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.companyId.set(user?.companyId ?? null);
      if (user) void this.loadUsers();
    });
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
    void this.loadUsers();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadUsers();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadUsers();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadUsers();
    }
  }

  async openCreate(): Promise<void> {
    const companyId = this.companyId();
    if (!companyId) return;

    const modal = await this.modalCtrl.create({
      component: UserFormModal,
      componentProps: { companyId },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadUsers();
      await this.showToast('USERS.SAVED_OK', 'success');
    }
  }

  async openEdit(user: UserDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: UserFormModal,
      componentProps: { companyId: this.companyId(), user },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadUsers();
      await this.showToast('USERS.SAVED_OK', 'success');
    }
  }

  async confirmDelete(user: UserDto): Promise<void> {
    if (!this.canDelete || !user.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar usuario',
      message: `¿Desactivar a "${user.username}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivateUser(user);
          },
        },
      ],
    });
    await alert.present();
  }

  formatRoles(user: UserDto): string {
    if (!user.roles?.length) return '—';
    return user.roles.map((r) => r.name).join(', ');
  }

  formatName(user: UserDto): string {
    return `${user.firstName} ${user.lastName}`.trim();
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadUsers();
      });
  }

  private loadUsers(): Promise<void> {
    this.loading.set(true);
    return new Promise((resolve) => {
      this.userService
        .list({
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            const items = this.showInactive()
              ? result.items
              : result.items.filter((u) => u.isActive);
            this.users.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('USERS.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivateUser(user: UserDto): Promise<void> {
    this.userService.deactivate(user.id).subscribe({
      next: async () => {
        await this.loadUsers();
        await this.showToast('USERS.DEACTIVATED_OK', 'success');
      },
      error: async () => {
        await this.showToast('USERS.DEACTIVATE_ERROR', 'danger');
      },
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'USERS.SAVED_OK': 'Usuario guardado correctamente',
      'USERS.LOAD_ERROR': 'Error al cargar usuarios',
      'USERS.DEACTIVATED_OK': 'Usuario desactivado',
      'USERS.DEACTIVATE_ERROR': 'No se pudo desactivar el usuario',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
