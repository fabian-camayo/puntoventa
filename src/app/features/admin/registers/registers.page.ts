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
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cashOutline,
  peopleOutline,
} from 'ionicons/icons';
import { RegisterDto } from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { RegisterFormModal } from './register-form.modal';

addIcons({
  addOutline,
  createOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cashOutline,
  peopleOutline,
});

@Component({
  selector: 'app-registers',
  templateUrl: './registers.page.html',
  styleUrls: ['./registers.page.scss'],
  imports: [
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
export class RegistersPage implements OnInit, OnDestroy {
  private readonly registerService = inject(RegisterService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canManage = this.auth.hasPermission('registers.admin');

  branchId = signal<string | null>(null);
  registers = signal<RegisterDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  ngOnInit(): void {
    this.setupSearch();
    this.configService.getPosContext().pipe(takeUntil(this.destroy$)).subscribe({
      next: (ctx) => {
        this.branchId.set(ctx.branchId);
        void this.loadRegisters();
      },
      error: async () => {
        await this.showToast('No se pudo cargar la sucursal', 'danger');
      },
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

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadRegisters();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadRegisters();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadRegisters();
    }
  }

  async openCreate(): Promise<void> {
    if (!this.canManage) return;
    const branchId = this.branchId();
    if (!branchId) return;

    const modal = await this.modalCtrl.create({
      component: RegisterFormModal,
      componentProps: { branchId },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadRegisters();
      await this.showToast('Caja guardada correctamente', 'success');
    }
  }

  async openEdit(register: RegisterDto): Promise<void> {
    if (!this.canManage) return;

    const modal = await this.modalCtrl.create({
      component: RegisterFormModal,
      componentProps: { register, branchId: this.branchId() },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadRegisters();
      await this.showToast('Caja guardada correctamente', 'success');
    }
  }

  assignedNames(register: RegisterDto): string {
    const users = register.assignedUsers ?? [];
    if (users.length === 0) return '—';
    if (users.length <= 3) return users.map((u) => u.fullName).join(', ');
    return `${users.slice(0, 3).map((u) => u.fullName).join(', ')} +${users.length - 3}`;
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadRegisters();
      });
  }

  private loadRegisters(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.registerService
        .listRegisters(branchId, {
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            this.registers.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('Error al cargar las cajas', 'danger');
            resolve();
          },
        });
    });
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
