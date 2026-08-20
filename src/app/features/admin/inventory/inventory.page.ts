import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonChip,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, firstValueFrom, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  chevronBackOutline,
  chevronForwardOutline,
  layersOutline,
  downloadOutline,
  swapVerticalOutline,
  timeOutline,
} from 'ionicons/icons';
import { InventoryService, StockItemDto } from '@core/services/inventory.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { InventoryAdjustmentModal } from './inventory-adjustment.modal';

addIcons({
  chevronBackOutline,
  chevronForwardOutline,
  layersOutline,
  downloadOutline,
  swapVerticalOutline,
  timeOutline,
});

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.page.html',
  styleUrls: ['./inventory.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonChip,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
    AdminBackButton,
    RouterLink,
  ],
})
export class InventoryPage implements OnInit, OnDestroy {
  private readonly inventoryService = inject(InventoryService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);
  private readonly modalCtrl = inject(ModalController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canExport =
    this.auth.hasPermission('inventory.view') ||
    this.auth.hasPermission('reports.export');
  readonly canAdjust = this.auth.hasPermission('inventory.adjust');

  branchId = signal<string | null>(null);
  items = signal<StockItemDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  exporting = signal(false);
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

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadStock();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadStock();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadStock();
    }
  }

  async exportExcel(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId || !this.canExport || this.exporting()) return;

    this.exporting.set(true);
    try {
      const blob = await firstValueFrom(
        this.inventoryService.exportStockExcel(
          branchId,
          this.searchQuery() || undefined,
        ),
      );

      if (blob.type.includes('application/json')) {
        throw new Error('Respuesta inválida del servidor');
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const date = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `inventario-${date}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
      await this.showToast('INVENTORY.EXPORT_OK', 'success');
    } catch {
      await this.showToast('INVENTORY.EXPORT_ERROR', 'danger');
    } finally {
      this.exporting.set(false);
    }
  }

  async openAdjustModal(item: StockItemDto): Promise<void> {
    const branchId = this.branchId();
    if (!branchId || !this.canAdjust) return;

    const modal = await this.modalCtrl.create({
      component: InventoryAdjustmentModal,
      componentProps: {
        branchId,
        productId: item.productId,
        productName: item.name ?? '',
        sku: item.sku ?? '',
        unit: item.unit ?? '',
        currentQty: item.quantity,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadStock();
      await this.showToast('INVENTORY.ADJUST_OK', 'success');
    }
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadStock();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadStock();
      },
      error: async () => {
        await this.showToast('INVENTORY.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadStock(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.inventoryService
        .listStock(branchId, {
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            this.items.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('INVENTORY.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'INVENTORY.LOAD_ERROR': 'Error al cargar el inventario',
      'INVENTORY.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'INVENTORY.EXPORT_OK': 'Excel generado correctamente',
      'INVENTORY.EXPORT_ERROR': 'No se pudo generar el Excel',
      'INVENTORY.ADJUST_OK': 'Ajuste de inventario registrado correctamente',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
