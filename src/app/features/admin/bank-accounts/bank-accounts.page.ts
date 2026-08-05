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
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  walletOutline,
} from 'ionicons/icons';
import { BankAccountDto } from '@puntoventa/shared';
import { BankAccountService } from '@core/services/bank-account.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { BankAccountFormModal } from './bank-account-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  walletOutline,
});

@Component({
  selector: 'app-bank-accounts',
  templateUrl: './bank-accounts.page.html',
  styleUrls: ['./bank-accounts.page.scss'],
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
    AdminBackButton,
  ],
})
export class BankAccountsPage implements OnInit, OnDestroy {
  private readonly bankAccountService = inject(BankAccountService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('bank_accounts.create');
  readonly canUpdate = this.auth.hasPermission('bank_accounts.update');
  readonly canDelete = this.auth.hasPermission('bank_accounts.delete');

  branchId = signal<string | null>(null);
  accounts = signal<BankAccountDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  showInactive = signal(false);

  ngOnInit(): void {
    this.setupSearch();
    this.loadBranchContext();
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
    void this.loadAccounts();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadAccounts();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadAccounts();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadAccounts();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: BankAccountFormModal,
      componentProps: { branchId: this.branchId() },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadAccounts();
      await this.showToast('Cuenta bancaria guardada', 'success');
    }
  }

  async openEdit(account: BankAccountDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: BankAccountFormModal,
      componentProps: {
        branchId: this.branchId(),
        account,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadAccounts();
      await this.showToast('Cuenta bancaria guardada', 'success');
    }
  }

  async confirmDelete(account: BankAccountDto): Promise<void> {
    if (!this.canDelete || !account.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar cuenta bancaria',
      message: `¿Desactivar "${account.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivate(account);
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
        void this.loadAccounts();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadAccounts();
      },
      error: async () => {
        await this.showToast('No se pudo cargar la sucursal', 'danger');
      },
    });
  }

  private loadAccounts(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.bankAccountService
        .list(branchId, {
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            const items = this.showInactive()
              ? result.items
              : result.items.filter((a) => a.isActive);
            this.accounts.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('Error al cargar cuentas bancarias', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivate(account: BankAccountDto): Promise<void> {
    this.bankAccountService.deactivate(account.id).subscribe({
      next: async () => {
        await this.loadAccounts();
        await this.showToast('Cuenta bancaria desactivada', 'success');
      },
      error: async () => {
        await this.showToast('No se pudo desactivar la cuenta bancaria', 'danger');
      },
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
