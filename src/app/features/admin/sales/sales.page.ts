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
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
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
import { AuthService } from '@core/services/auth.service';
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
    AdminBackButton,
    AppCurrencyPipe,
  ],
})
export class SalesPage implements OnInit, OnDestroy {
  private readonly saleService = inject(SaleService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly SaleStatus = SaleStatus;
  readonly canVoid = this.auth.hasPermission('sales.void');
  readonly canDelete = this.auth.hasPermission('sales.delete');

  branchId = signal<string | null>(null);
  businessName = signal('');
  taxId = signal<string | undefined>(undefined);
  businessAddress = signal<string | undefined>(undefined);
  businessPhone = signal<string | undefined>(undefined);
  businessEmail = signal<string | undefined>(undefined);
  logoUrl = signal<string | undefined>(undefined);
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
          branchId: this.branchId(),
          canVoid: this.canVoid,
          canDelete: this.canDelete,
          businessName: this.businessName(),
          taxId: this.taxId(),
          address: this.businessAddress(),
          phone: this.businessPhone(),
          email: this.businessEmail(),
          logoUrl: this.logoUrl(),
          ticketHeader: this.ticketHeader(),
          ticketFooter: this.ticketFooter(),
          registerName: sale.registerName,
        },
        cssClass: 'pv-form-modal',
      });
      await modal.present();
      const { role } = await modal.onDidDismiss();
      if (role === 'changed') {
        await this.loadSales();
      }
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
        this.branchId.set(res.branchId);
        this.businessName.set(res.businessName ?? res.branchName);
        this.taxId.set(res.taxId);
        this.businessAddress.set(res.address);
        this.businessPhone.set(res.phone);
        this.businessEmail.set(res.email);
        this.logoUrl.set(res.logoUrl);
        this.ticketHeader.set(res.ticketHeader);
        this.ticketFooter.set(res.ticketFooter);
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
