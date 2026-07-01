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
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  receiptOutline,
  chevronBackOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { SaleListItemDto, SaleStatus, SaleDto } from '@puntoventa/shared';
import { SaleService } from '@core/services/sale.service';
import { ConfigService } from '@core/services/config.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { SaleDetailModal } from './sale-detail.modal';

addIcons({
  receiptOutline,
  chevronBackOutline,
  chevronForwardOutline,
});

type StatusFilter = 'ALL' | SaleStatus;

@Component({
  selector: 'app-sales',
  templateUrl: './sales.page.html',
  styleUrls: ['./sales.page.scss'],
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
export class SalesPage implements OnInit, OnDestroy {
  private readonly saleService = inject(SaleService);
  private readonly configService = inject(ConfigService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly SaleStatus = SaleStatus;

  branchId = signal<string | null>(null);
  businessName = signal('');
  ticketHeader = signal<string | undefined>(undefined);
  ticketFooter = signal<string | undefined>(undefined);
  sales = signal<SaleListItemDto[]>([]);
  searchQuery = signal('');
  statusFilter = signal<StatusFilter>(SaleStatus.COMPLETED);
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
    this.loadSales();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadSales();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadSales();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadSales();
    }
  }

  statusColor(status: SaleStatus): string {
    switch (status) {
      case SaleStatus.COMPLETED:
        return 'success';
      case SaleStatus.SUSPENDED:
        return 'warning';
      case SaleStatus.ACTIVE:
        return 'primary';
      case SaleStatus.VOIDED:
      case SaleStatus.CANCELLED:
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

  async openDetail(sale: SaleListItemDto): Promise<void> {
    try {
      const detail = await new Promise<SaleDto>((resolve, reject) => {
        this.saleService.getSale(sale.id).subscribe({
          next: resolve,
          error: reject,
        });
      });

      const modal = await this.modalCtrl.create({
        component: SaleDetailModal,
        componentProps: {
          sale: detail,
          businessName: this.businessName(),
          ticketHeader: this.ticketHeader(),
          ticketFooter: this.ticketFooter(),
          registerName: sale.registerName,
        },
        cssClass: 'sale-detail-modal',
      });
      await modal.present();
    } catch {
      await this.showToast('SALES.LOAD_DETAIL_ERROR', 'danger');
    }
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        this.loadSales();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.data.branchId);
        this.businessName.set(res.data.businessName ?? res.data.branchName);
        this.ticketHeader.set(res.data.ticketHeader);
        this.ticketFooter.set(res.data.ticketFooter);
        this.loadSales();
      },
      error: async () => {
        await this.showToast('SALES.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadSales(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    const filter = this.statusFilter();

    return new Promise((resolve) => {
      this.saleService
        .list({
          branchId,
          search: this.searchQuery() || undefined,
          status: filter === 'ALL' ? undefined : filter,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            this.sales.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('SALES.LOAD_ERROR', 'danger');
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
      'SALES.LOAD_ERROR': 'Error al cargar ventas',
      'SALES.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'SALES.LOAD_DETAIL_ERROR': 'No se pudo cargar el detalle de la venta',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
