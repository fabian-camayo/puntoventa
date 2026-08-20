import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonSearchbar,
  IonInput,
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
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  timeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  addOutline,
  removeOutline,
  optionsOutline,
} from 'ionicons/icons';
import { InventoryAdjustmentDto, AdjustmentTypeDto } from '@puntoventa/shared';
import { InventoryService } from '@core/services/inventory.service';
import { ConfigService } from '@core/services/config.service';
import { InventoryAdjustmentDetailModal } from './inventory-adjustment-detail.modal';

addIcons({
  timeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  addOutline,
  removeOutline,
  optionsOutline,
});

type TypeFilter = 'ALL' | AdjustmentTypeDto;

@Component({
  selector: 'app-inventory-adjustments',
  templateUrl: './inventory-adjustments.page.html',
  styleUrls: ['./inventory-adjustments.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonInput,
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
export class InventoryAdjustmentsPage implements OnInit, OnDestroy {
  private readonly inventoryService = inject(InventoryService);
  private readonly configService = inject(ConfigService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  branchId = signal<string | null>(null);
  adjustments = signal<InventoryAdjustmentDto[]>([]);
  searchQuery = signal('');
  typeFilter = signal<TypeFilter>('ALL');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
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

  setTypeFilter(filter: TypeFilter): void {
    if (this.typeFilter() === filter) return;
    this.typeFilter.set(filter);
    this.page.set(1);
    void this.loadAdjustments();
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.page.set(1);
    void this.loadAdjustments();
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.page.set(1);
    void this.loadAdjustments();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadAdjustments();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadAdjustments();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadAdjustments();
    }
  }

  itemsSummary(adj: InventoryAdjustmentDto): string {
    const first = adj.items?.[0];
    if (!first) return '—';
    const extra = (adj.items?.length ?? 1) - 1;
    return extra > 0 ? `${first.productName ?? '—'} (+${extra})` : first.productName ?? '—';
  }

  deltaSummary(adj: InventoryAdjustmentDto): string {
    const first = adj.items?.[0];
    if (!first) return '—';
    if (adj.type === 'SET') return `= ${first.newQty}`;
    const sign = adj.type === 'INCREASE' ? '+' : '-';
    return `${sign}${first.quantity}`;
  }

  typeLabel(type: AdjustmentTypeDto): string {
    switch (type) {
      case 'INCREASE':
        return 'Entrada';
      case 'DECREASE':
        return 'Salida';
      case 'SET':
        return 'Conteo físico';
      default:
        return type;
    }
  }

  typeColor(type: AdjustmentTypeDto): string {
    switch (type) {
      case 'INCREASE':
        return 'success';
      case 'DECREASE':
        return 'danger';
      case 'SET':
        return 'medium';
      default:
        return 'medium';
    }
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
  }

  async openDetail(adj: InventoryAdjustmentDto): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: InventoryAdjustmentDetailModal,
      componentProps: { adjustmentId: adj.id },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadAdjustments();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadAdjustments();
      },
      error: async () => {
        await this.showToast('No se pudo cargar la sucursal', 'danger');
      },
    });
  }

  private loadAdjustments(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    const type = this.typeFilter();

    return new Promise((resolve) => {
      this.inventoryService
        .listAdjustments({
          branchId,
          search: this.searchQuery() || undefined,
          type: type === 'ALL' ? undefined : type,
          dateFrom: this.dateFrom() || undefined,
          dateTo: this.dateTo() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            this.adjustments.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('Error al cargar el historial de ajustes', 'danger');
            resolve();
          },
        });
    });
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
