import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSearchbar,
  IonBadge,
  IonChip,
  IonLabel,
  IonList,
  IonItem,
  IonText,
  ModalController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, switchMap, takeUntil, filter, firstValueFrom, EMPTY } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  addOutline,
  closeOutline,
  personOutline,
  cashOutline,
  printOutline,
  pauseOutline,
  trashOutline,
  removeOutline,
  saveOutline,
  searchOutline,
  cartOutline,
} from 'ionicons/icons';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { KeyboardService } from '../../core/services/keyboard.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { ReceiptPrintService } from '../../core/services/receipt-print.service';
import {
  SaleDto,
  SaleTab,
  SaleItemDto,
  ProductSearchResult,
  PaymentMethod,
  SaleStatus,
  AuthUser,
} from '@puntoventa/shared';
import { SaleTabsComponent } from '../../shared/components/sale-tabs/sale-tabs.component';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';

addIcons({
  addOutline,
  closeOutline,
  personOutline,
  cashOutline,
  printOutline,
  pauseOutline,
  trashOutline,
  removeOutline,
  saveOutline,
  searchOutline,
  cartOutline,
});

interface ActiveSale extends SaleDto {
  tabLabel: string;
}

@Component({
  selector: 'app-pos',
  templateUrl: './pos.page.html',
  styleUrls: ['./pos.page.scss'],
  host: { class: 'ion-page' },
  imports: [
    IonContent,
    IonButton,
    IonIcon,
    IonSearchbar,
    IonBadge,
    IonChip,
    IonLabel,
    IonList,
    IonItem,
    IonText,
    FormsModule,
    TranslateModule,
    SaleTabsComponent,
    AppCurrencyPipe,
  ],
})
export class PosPage implements OnInit, OnDestroy, ViewWillEnter {
  private readonly saleService = inject(SaleService);
  private readonly productService = inject(ProductService);
  private readonly keyboard = inject(KeyboardService);
  private readonly auth = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly receiptPrint = inject(ReceiptPrintService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  private initialized = false;
  private initializing = false;
  private pendingSave: Promise<void> = Promise.resolve();
  private initPromise: Promise<void> | null = null;

  isCreatingTab = signal(false);
  posReady = signal(false);
  isSavingSale = signal(false);

  branchId = signal<string | null>(null);
  registerId = signal<string | null>(null);
  registerName = signal<string>('');
  businessName = signal<string>('');
  ticketHeader = signal<string | undefined>(undefined);
  ticketFooter = signal<string | undefined>(undefined);

  tabs = signal<SaleTab[]>([]);
  activeTabId = signal<string | null>(null);
  activeSale = signal<ActiveSale | null>(null);
  searchResults = signal<ProductSearchResult[]>([]);
  searchQuery = signal('');
  isSearching = signal(false);

  readonly itemCount = computed(() =>
    this.activeSale()?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0,
  );
  readonly lineCount = computed(() => this.activeSale()?.items.length ?? 0);
  readonly saleSubtotal = computed(() =>
    this.activeSale()?.items.reduce((sum, item) => sum + item.subtotal, 0) ?? 0,
  );
  readonly saleTax = computed(() =>
    this.activeSale()?.items.reduce(
      (sum, item) => sum + (item.taxAmount ?? item.total - item.subtotal),
      0,
    ) ?? 0,
  );
  readonly total = computed(() =>
    this.activeSale()?.items.reduce((sum, item) => sum + item.total, 0) ?? 0,
  );
  readonly isSaleCompleted = computed(
    () => this.activeSale()?.status === SaleStatus.COMPLETED,
  );
  readonly canSaveSale = computed(
    () =>
      !this.isSaleCompleted() &&
      !this.isSavingSale() &&
      (this.activeSale()?.items.length ?? 0) > 0,
  );
  readonly canPrintReceipt = computed(
    () => this.isSaleCompleted() && !!this.activeSale()?.documentNumber,
  );

  ngOnInit(): void {
    this.loadPosContext();
    this.setupSearch();
    this.setupKeyboard();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  ionViewWillEnter(): void {
    if (!this.registerId()) return;
    void this.whenReady().then(() => {
      const tabId = this.activeTabId() ?? this.tabs()[0]?.id;
      if (tabId && !this.activeSale()?.id) {
        void this.activateSale(tabId);
      }
    });
  }

  onSearchInput(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && this.searchResults().length > 0) {
      this.addProduct(this.searchResults()[0]!);
      this.clearSearch();
    }
  }

  async onNewTab(): Promise<void> {
    if (this.isCreatingTab()) return;
    this.isCreatingTab.set(true);
    try {
      await this.whenReady();
      await this.createNewTab();
    } finally {
      this.isCreatingTab.set(false);
    }
  }

  selectTab(tabId: string): void {
    void this.activateSale(tabId);
  }

  closeTab(tabId: string, event: Event): void {
    event.stopPropagation();
    const closing = this.tabs().find((t) => t.id === tabId);
    const updated = this.tabs().filter((t) => t.id !== tabId);
    this.tabs.set(updated);

    if (closing) {
      this.saleService.suspendSale(tabId).subscribe({ error: () => undefined });
    }

    if (this.activeTabId() === tabId) {
      const next = updated[0];
      if (next) {
        void this.activateSale(next.id);
      } else {
        this.activeTabId.set(null);
        this.activeSale.set(null);
        void this.createNewTab();
      }
    }
  }

  addProduct(product: ProductSearchResult): void {
    void this.addProductAsync(product);
  }

  updateQuantity(item: SaleItemDto, delta: number): void {
    if (this.isSaleCompleted()) return;
    const sale = this.activeSale();
    if (!sale) return;

    const items = sale.items
      .map((i) => {
        if (i.productId !== item.productId) return i;
        const qty = Math.max(0, i.quantity + delta);
        return qty === 0 ? null : this.recalculateItem({ ...i, quantity: qty });
      })
      .filter((i): i is SaleItemDto => i !== null);

    this.updateSaleItems(items);
  }

  removeItem(item: SaleItemDto): void {
    if (this.isSaleCompleted()) return;
    const sale = this.activeSale();
    if (!sale) return;
    const items = sale.items.filter((i) => i.productId !== item.productId);
    this.updateSaleItems(items);
  }

  async onSaveSale(): Promise<void> {
    const sale = this.activeSale();
    if (!sale?.id || !this.canSaveSale()) return;

    this.isSavingSale.set(true);
    try {
      await this.flushPendingSave();

      const current = this.activeSale();
      if (!current?.id || current.items.length === 0) return;

      const completed = await firstValueFrom(
        this.saleService.checkout(current.id, {
          version: current.version ?? 0,
          payments: [{ method: PaymentMethod.CASH, amount: this.total() }],
        }),
      );

      const tabLabel = current.tabLabel;
      this.activeSale.set({
        ...completed,
        items: completed.items ?? [],
        tabLabel,
      });
      this.tabs.update((tabs) => tabs.filter((tab) => tab.id !== current.id));
      this.activeTabId.set(null);

      await this.showToast('Venta guardada. Stock actualizado.', 'success');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToast(message ?? 'Error al guardar la venta', 'danger');
    } finally {
      this.isSavingSale.set(false);
    }
  }

  onPrintReceipt(): void {
    const sale = this.activeSale();
    if (!sale || !this.canPrintReceipt()) return;

    const user = this.getCurrentUser();
    const cashierName = user
      ? `${user.firstName} ${user.lastName}`.trim() || user.username
      : undefined;

    this.receiptPrint.printReceipt({
      sale,
      businessName: this.businessName() || undefined,
      ticketHeader: this.ticketHeader(),
      ticketFooter: this.ticketFooter(),
      registerName: this.registerName() || undefined,
      cashierName,
    });
  }

  async onSuspend(): Promise<void> {
    if (this.isSaleCompleted()) return;
    const sale = this.activeSale();
    if (!sale?.id) return;
    this.saleService.suspendSale(sale.id).subscribe({
      next: async () => {
        await this.refreshTabsFromServer();
        const nextTab = this.tabs()[0];
        if (nextTab) {
          await this.activateSale(nextTab.id);
        } else {
          await this.createNewTab();
        }
      },
    });
  }

  getStockClass(stock: number): string {
    if (stock <= 0) return 'stock-out';
    if (stock <= 5) return 'stock-low';
    return 'stock-ok';
  }

  private async addProductAsync(product: ProductSearchResult): Promise<void> {
    await this.whenReady();
    if (this.isSaleCompleted()) {
      await this.showToast('La venta ya está guardada. Abra una nueva pestaña.', 'warning');
      return;
    }
    const sale = this.activeSale();
    if (!sale?.id) {
      await this.showToast('No hay una venta activa', 'warning');
      return;
    }

    const existing = sale.items.find((i) => i.productId === product.id);
    let items: SaleItemDto[];

    if (existing) {
      items = sale.items.map((i) =>
        i.productId === product.id
          ? this.recalculateItem({ ...i, quantity: i.quantity + 1 })
          : i,
      );
    } else {
      const newItem: SaleItemDto = this.recalculateItem({
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        quantity: 1,
        unitPrice: product.salePrice,
        discountAmount: 0,
        discountPercent: 0,
        taxRate: 16,
        subtotal: 0,
        total: 0,
      });
      items = [...sale.items, newItem];
    }

    this.updateSaleItems(items);
    this.clearSearch();
  }

  private setupSearch(): void {
    this.search$
      .pipe(
        debounceTime(200),
        filter((q) => q.length >= 1),
        switchMap((q) => {
          const branchId = this.branchId();
          if (!branchId) return EMPTY;
          this.isSearching.set(true);
          if (/^\d{8,}$/.test(q)) {
            return this.productService.findByBarcode(q, branchId);
          }
          return this.productService.search(q, branchId);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe((result) => {
        this.isSearching.set(false);
        if (Array.isArray(result)) {
          this.searchResults.set(result);
        } else if (result) {
          this.addProduct(result);
          this.clearSearch();
        } else {
          this.searchResults.set([]);
        }
      });
  }

  private setupKeyboard(): void {
    this.keyboard.onAction.pipe(takeUntil(this.destroy$)).subscribe(({ action }) => {
      switch (action) {
        case 'sale.new':
          void this.onNewTab();
          break;
        case 'product.search':
          document.querySelector<HTMLInputElement>('ion-searchbar input')?.focus();
          break;
        case 'sale.checkout':
          void this.onSaveSale();
          break;
        case 'sale.print':
          this.onPrintReceipt();
          break;
        case 'sale.suspend':
          void this.onSuspend();
          break;
        case 'sale.cancel':
          if (this.activeSale() && !this.isSaleCompleted()) this.updateSaleItems([]);
          break;
      }
    });
  }

  private loadPosContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.data.branchId);
        this.registerId.set(res.data.registerId);
        this.registerName.set(res.data.registerName);
        this.businessName.set(res.data.businessName ?? res.data.branchName);
        this.ticketHeader.set(res.data.ticketHeader);
        this.ticketFooter.set(res.data.ticketFooter);
        void this.whenReady();
      },
      error: async () => {
        await this.showToast('No se pudo cargar la configuración de caja', 'danger');
      },
    });
  }

  private whenReady(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.initializePos();
    return this.initPromise;
  }

  private async initializePos(): Promise<void> {
    if (this.initialized || this.initializing) return;

    const registerId = this.registerId();
    const branchId = this.branchId();
    if (!registerId || !branchId) return;

    this.initializing = true;
    try {
      await this.refreshTabsFromServer();

      if (this.tabs().length === 0) {
        await this.createNewTab();
      } else {
        const tabId = this.activeTabId() ?? this.tabs()[0]!.id;
        await this.activateSale(tabId);
      }

      this.initialized = true;
      this.posReady.set(true);
    } finally {
      this.initializing = false;
    }
  }

  private async refreshTabsFromServer(): Promise<void> {
    const registerId = this.registerId();
    if (!registerId) return;

    const tabs = await firstValueFrom(this.saleService.getActiveTabs(registerId));
    this.tabs.set(tabs);
  }

  private async createNewTab(): Promise<void> {
    const branchId = this.branchId();
    const registerId = this.registerId();
    if (!branchId || !registerId) return;

    const order = this.tabs().length;

    try {
      const sale = await firstValueFrom(
        this.saleService.createTab({
          branchId,
          registerId,
          tabOrder: order,
        }),
      );

      if (!sale?.id) return;

      const tabLabel = `Venta ${order + 1}`;
      const newTab: SaleTab = {
        id: sale.id,
        tabId: sale.tabId ?? sale.id,
        label: tabLabel,
        order,
        status: sale.status,
        itemCount: 0,
        total: 0,
        updatedAt: new Date().toISOString(),
      };

      this.tabs.update((current) => [...current, newTab]);
      this.activeTabId.set(sale.id);
      this.activeSale.set({ ...sale, items: [], tabLabel });
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      const message = (err as { error?: { message?: string } })?.error?.message;

      if (status === 401) {
        await this.showToast(
          'Su sesión ya no es válida. Redirigiendo al inicio de sesión...',
          'warning',
        );
        return;
      }

      await this.showToast(
        message ?? 'No se pudo crear la venta. Intente de nuevo.',
        'danger',
      );
    }
  }

  private async activateSale(tabId: string): Promise<void> {
    this.activeTabId.set(tabId);

    try {
      const sale = await firstValueFrom(this.saleService.getSale(tabId));
      if (this.activeTabId() !== tabId) return;

      const tab = this.tabs().find((t) => t.id === tabId);
      this.activeSale.set({
        ...sale,
        items: sale.items ?? [],
        tabLabel: tab?.label ?? 'Venta',
      });
    } catch {
      if (this.activeTabId() !== tabId) return;
      await this.showToast('No se pudo cargar la venta', 'danger');
    }
  }

  private updateSaleItems(items: SaleItemDto[]): void {
    const sale = this.activeSale();
    if (!sale?.id || sale.status === SaleStatus.COMPLETED) return;

    const { subtotal, taxAmount, total } = this.sumSaleTotals(items);
    const saleId = sale.id;
    const tabLabel = sale.tabLabel;

    this.activeSale.set({ ...sale, items, subtotal, taxAmount, total });
    this.syncTabSummary(saleId, items.length, total);

    this.pendingSave = this.pendingSave
      .then(() => this.persistSaleItems(saleId, tabLabel))
      .catch(() => undefined);
  }

  private async persistSaleItems(saleId: string, tabLabel: string): Promise<void> {
    const sale = this.activeSale();
    if (!sale?.id || sale.id !== saleId) return;

    try {
      const updated = await firstValueFrom(
        this.saleService.updateSale(saleId, {
          items: sale.items,
          subtotal: sale.subtotal,
          taxAmount: sale.taxAmount,
          total: sale.total,
          version: sale.version ?? 0,
        }),
      );

      if (this.activeTabId() !== saleId) return;

      this.activeSale.set({
        ...updated,
        items: updated.items ?? [],
        tabLabel,
      });
      this.syncTabSummary(saleId, updated.items.length, updated.total);
    } catch (err: unknown) {
      if (this.activeTabId() !== saleId) return;

      try {
        const fresh = await firstValueFrom(this.saleService.getSale(saleId));
        if (this.activeTabId() === saleId) {
          this.activeSale.set({
            ...fresh,
            items: fresh.items ?? [],
            tabLabel,
          });
          this.syncTabSummary(saleId, fresh.items.length, fresh.total);
        }
      } catch {
        // ignore reload failure
      }

      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToast(message ?? 'Error al actualizar la venta', 'danger');
    }
  }

  private syncTabSummary(saleId: string, itemCount: number, total: number): void {
    this.tabs.update((tabs) =>
      tabs.map((tab) =>
        tab.id === saleId ? { ...tab, itemCount, total } : tab,
      ),
    );
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, color });
    await t.present();
  }

  private recalculateItem(item: SaleItemDto): SaleItemDto {
    const discount = item.discountAmount ?? 0;
    const subtotal = this.roundMoney(item.quantity * item.unitPrice - discount);
    const taxRate = item.taxRate ?? 0;
    const taxAmount = this.roundMoney(subtotal * (taxRate / 100));
    return {
      ...item,
      subtotal,
      taxAmount,
      total: this.roundMoney(subtotal + taxAmount),
    };
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private sumSaleTotals(items: SaleItemDto[]): {
    subtotal: number;
    taxAmount: number;
    total: number;
  } {
    const subtotal = this.roundMoney(items.reduce((s, i) => s + i.subtotal, 0));
    const taxAmount = this.roundMoney(
      items.reduce((s, i) => s + (i.taxAmount ?? i.total - i.subtotal), 0),
    );
    const total = this.roundMoney(items.reduce((s, i) => s + i.total, 0));
    return { subtotal, taxAmount, total };
  }

  private clearSearch(): void {
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  private async flushPendingSave(): Promise<void> {
    await this.pendingSave;
  }

  private getCurrentUser(): AuthUser | null {
    const raw = localStorage.getItem('pv_user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  }
}
