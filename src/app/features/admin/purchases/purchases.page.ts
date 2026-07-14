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
import { Subject, debounceTime, distinctUntilChanged, firstValueFrom, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  cartOutline,
  addOutline,
  createOutline,
  trashOutline,
  downloadOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import {
  PurchaseDto,
  PurchaseService,
  PurchaseStatus,
} from '@core/services/purchase.service';
import { SupplierDto, SupplierService } from '@core/services/supplier.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { PurchaseFormModal } from './purchase-form.modal';

addIcons({
  cartOutline,
  addOutline,
  createOutline,
  trashOutline,
  downloadOutline,
  chevronBackOutline,
  chevronForwardOutline,
});

type StatusFilter = 'ALL' | PurchaseStatus;

@Component({
  selector: 'app-purchases',
  templateUrl: './purchases.page.html',
  styleUrls: ['./purchases.page.scss'],
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
    AppCurrencyPipe,
  ],
})
export class PurchasesPage implements OnInit, OnDestroy {
  private readonly purchaseService = inject(PurchaseService);
  private readonly supplierService = inject(SupplierService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('purchases.create');
  readonly canUpdate = this.auth.hasPermission('purchases.update');
  readonly canDelete = this.auth.hasPermission('purchases.delete');

  branchId = signal<string | null>(null);
  purchases = signal<PurchaseDto[]>([]);
  suppliers = signal<SupplierDto[]>([]);
  searchQuery = signal('');
  statusFilter = signal<StatusFilter>('ALL');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

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

  setStatusFilter(filter: StatusFilter): void {
    if (this.statusFilter() === filter) return;
    this.statusFilter.set(filter);
    this.page.set(1);
    void this.loadPurchases();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadPurchases();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadPurchases();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadPurchases();
    }
  }

  statusColor(status: PurchaseStatus): string {
    switch (status) {
      case 'RECEIVED':
        return 'success';
      case 'DRAFT':
        return 'warning';
      case 'CANCELLED':
        return 'danger';
      default:
        return 'medium';
    }
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  async openCreate(): Promise<void> {
    if (!this.canCreate) return;
    const branchId = this.branchId();
    if (!branchId) return;

    const modal = await this.modalCtrl.create({
      component: PurchaseFormModal,
      componentProps: {
        branchId,
        purchase: null,
        suppliers: this.suppliers(),
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadPurchases();
      await this.showToast('PURCHASES.SAVED_OK', 'success');
    }
  }

  async openEdit(purchase: PurchaseDto): Promise<void> {
    if (!this.canUpdate || purchase.status !== 'DRAFT') return;
    const branchId = this.branchId();
    if (!branchId) return;

    try {
      const detail = await firstValueFrom(this.purchaseService.get(purchase.id));
      const modal = await this.modalCtrl.create({
        component: PurchaseFormModal,
        componentProps: {
          branchId,
          purchase: detail,
          suppliers: this.suppliers(),
        },
        cssClass: 'pv-form-modal',
      });
      await modal.present();
      const { role } = await modal.onDidDismiss();
      if (role === 'saved') {
        await this.loadPurchases();
        await this.showToast('PURCHASES.SAVED_OK', 'success');
      }
    } catch {
      await this.showToast('PURCHASES.LOAD_DETAIL_ERROR', 'danger');
    }
  }

  async confirmReceive(purchase: PurchaseDto): Promise<void> {
    if (!this.canUpdate || purchase.status !== 'DRAFT') return;

    const alert = await this.alertCtrl.create({
      header: 'Recibir compra',
      message: `¿Confirmar recepción de "${purchase.documentNumber}"? El inventario se actualizará.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Recibir',
          handler: () => {
            void this.receivePurchase(purchase);
          },
        },
      ],
    });
    await alert.present();
  }

  async confirmCancel(purchase: PurchaseDto): Promise<void> {
    if (!this.canDelete || purchase.status !== 'DRAFT') return;

    const alert = await this.alertCtrl.create({
      header: 'Cancelar compra',
      message: `¿Cancelar el borrador "${purchase.documentNumber}"?`,
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Cancelar compra',
          role: 'destructive',
          handler: () => {
            void this.cancelPurchase(purchase);
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
        void this.loadPurchases();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        this.loadSuppliers(res.branchId);
        void this.loadPurchases();
      },
      error: async () => {
        await this.showToast('PURCHASES.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadSuppliers(branchId: string): void {
    this.supplierService.listActive(branchId).subscribe({
      next: (items) => this.suppliers.set(items),
      error: () => this.suppliers.set([]),
    });
  }

  private loadPurchases(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    const filter = this.statusFilter();

    return new Promise((resolve) => {
      this.purchaseService
        .list(branchId, {
          search: this.searchQuery() || undefined,
          status: filter === 'ALL' ? undefined : filter,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            this.purchases.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('PURCHASES.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async receivePurchase(purchase: PurchaseDto): Promise<void> {
    try {
      await firstValueFrom(this.purchaseService.receive(purchase.id));
      await this.loadPurchases();
      await this.showToast('PURCHASES.RECEIVED_OK', 'success');
    } catch {
      await this.showToast('PURCHASES.RECEIVE_ERROR', 'danger');
    }
  }

  private async cancelPurchase(purchase: PurchaseDto): Promise<void> {
    try {
      await firstValueFrom(this.purchaseService.cancel(purchase.id));
      await this.loadPurchases();
      await this.showToast('PURCHASES.CANCELLED_OK', 'success');
    } catch {
      await this.showToast('PURCHASES.CANCEL_ERROR', 'danger');
    }
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'PURCHASES.SAVED_OK': 'Compra guardada correctamente',
      'PURCHASES.LOAD_ERROR': 'Error al cargar compras',
      'PURCHASES.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'PURCHASES.LOAD_DETAIL_ERROR': 'No se pudo cargar el detalle de la compra',
      'PURCHASES.RECEIVED_OK': 'Compra recibida correctamente',
      'PURCHASES.RECEIVE_ERROR': 'No se pudo recibir la compra',
      'PURCHASES.CANCELLED_OK': 'Compra cancelada',
      'PURCHASES.CANCEL_ERROR': 'No se pudo cancelar la compra',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
