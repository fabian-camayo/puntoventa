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
  businessOutline,
} from 'ionicons/icons';
import { SupplierDto, SupplierService } from '@core/services/supplier.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { SupplierFormModal } from './supplier-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  businessOutline,
});

@Component({
  selector: 'app-suppliers',
  templateUrl: './suppliers.page.html',
  styleUrls: ['./suppliers.page.scss'],
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
export class SuppliersPage implements OnInit, OnDestroy {
  private readonly supplierService = inject(SupplierService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('suppliers.create');
  readonly canUpdate = this.auth.hasPermission('suppliers.update');
  readonly canDelete = this.auth.hasPermission('suppliers.delete');

  branchId = signal<string | null>(null);
  suppliers = signal<SupplierDto[]>([]);
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
    void this.loadSuppliers();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadSuppliers();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadSuppliers();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadSuppliers();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: SupplierFormModal,
      componentProps: { branchId: this.branchId() },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadSuppliers();
      await this.showToast('SUPPLIERS.SAVED_OK', 'success');
    }
  }

  async openEdit(supplier: SupplierDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: SupplierFormModal,
      componentProps: {
        branchId: this.branchId(),
        supplier,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadSuppliers();
      await this.showToast('SUPPLIERS.SAVED_OK', 'success');
    }
  }

  async confirmDelete(supplier: SupplierDto): Promise<void> {
    if (!this.canDelete || !supplier.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar proveedor',
      message: `¿Desactivar "${supplier.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivate(supplier);
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
        void this.loadSuppliers();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadSuppliers();
      },
      error: async () => {
        await this.showToast('SUPPLIERS.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadSuppliers(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.supplierService
        .list(branchId, {
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            const items = this.showInactive()
              ? result.items
              : result.items.filter((s) => s.isActive);
            this.suppliers.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('SUPPLIERS.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivate(supplier: SupplierDto): Promise<void> {
    this.supplierService.deactivate(supplier.id).subscribe({
      next: async () => {
        await this.loadSuppliers();
        await this.showToast('SUPPLIERS.DEACTIVATED_OK', 'success');
      },
      error: async () => {
        await this.showToast('SUPPLIERS.DEACTIVATE_ERROR', 'danger');
      },
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'SUPPLIERS.SAVED_OK': 'Proveedor guardado correctamente',
      'SUPPLIERS.LOAD_ERROR': 'Error al cargar proveedores',
      'SUPPLIERS.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'SUPPLIERS.DEACTIVATED_OK': 'Proveedor desactivado',
      'SUPPLIERS.DEACTIVATE_ERROR': 'No se pudo desactivar el proveedor',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
