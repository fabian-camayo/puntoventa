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
import { CustomerDto, CustomerService } from '@core/services/customer.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { CustomerFormModal } from './customer-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  peopleOutline,
});

@Component({
  selector: 'app-customers',
  templateUrl: './customers.page.html',
  styleUrls: ['./customers.page.scss'],
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
export class CustomersPage implements OnInit, OnDestroy {
  private readonly customerService = inject(CustomerService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('customers.create');
  readonly canUpdate = this.auth.hasPermission('customers.update');
  readonly canDelete = this.auth.hasPermission('customers.delete');

  branchId = signal<string | null>(null);
  customers = signal<CustomerDto[]>([]);
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
    void this.loadCustomers();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadCustomers();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadCustomers();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadCustomers();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CustomerFormModal,
      componentProps: { branchId: this.branchId() },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadCustomers();
      await this.showToast('CUSTOMERS.SAVED_OK', 'success');
    }
  }

  async openEdit(customer: CustomerDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: CustomerFormModal,
      componentProps: {
        branchId: this.branchId(),
        customer,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadCustomers();
      await this.showToast('CUSTOMERS.SAVED_OK', 'success');
    }
  }

  async confirmDelete(customer: CustomerDto): Promise<void> {
    if (!this.canDelete || !customer.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar cliente',
      message: `¿Desactivar "${customer.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivate(customer);
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
        void this.loadCustomers();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadCustomers();
      },
      error: async () => {
        await this.showToast('CUSTOMERS.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadCustomers(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.customerService
        .list(branchId, {
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
          includeInactive: this.showInactive(),
        })
        .subscribe({
          next: (result) => {
            this.customers.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('CUSTOMERS.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivate(customer: CustomerDto): Promise<void> {
    this.customerService.deactivate(customer.id).subscribe({
      next: async () => {
        await this.loadCustomers();
        await this.showToast('CUSTOMERS.DEACTIVATED_OK', 'success');
      },
      error: async () => {
        await this.showToast('CUSTOMERS.DEACTIVATE_ERROR', 'danger');
      },
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'CUSTOMERS.SAVED_OK': 'Cliente guardado correctamente',
      'CUSTOMERS.LOAD_ERROR': 'Error al cargar clientes',
      'CUSTOMERS.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'CUSTOMERS.DEACTIVATED_OK': 'Cliente desactivado',
      'CUSTOMERS.DEACTIVATE_ERROR': 'No se pudo desactivar el cliente',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
