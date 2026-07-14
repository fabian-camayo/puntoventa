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
  IonLabel,
  IonList,
  IonItem,
  IonText,
  IonSpinner,
  IonSelect,
  IonSelectOption,
  IonInput,
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
  lockOpenOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import { SaleService } from '../../core/services/sale.service';
import { ProductService } from '../../core/services/product.service';
import { KeyboardService } from '../../core/services/keyboard.service';
import { AuthService } from '../../core/services/auth.service';
import { ConfigService } from '../../core/services/config.service';
import { RegisterService } from '../../core/services/register.service';
import { PaymentTypeService } from '../../core/services/payment-type.service';
import { ReceiptPrintService } from '../../core/services/receipt-print.service';
import { TerminalHeartbeatService } from '../../core/services/terminal-heartbeat.service';
import {
  SaleDto,
  SaleTab,
  SaleItemDto,
  ProductSearchResult,
  PaymentTypeDto,
  SaleStatus,
  AuthUser,
  RegisterSessionDto,
  RegisterDto,
} from '@puntoventa/shared';
import { SaleTabsComponent } from '../../shared/components/sale-tabs/sale-tabs.component';
import { AppCurrencyPipe } from '../../shared/pipes/app-currency.pipe';
import { RegisterSessionModal } from './register-session.modal';
import { CashMovementModal } from './cash-movement.modal';

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
  lockOpenOutline,
  lockClosedOutline,
});

interface ActiveSale extends SaleDto {
  tabLabel: string;
}

interface PaymentLine {
  key: string;
  paymentTypeId: string;
  amount: number | null;
  reference: string;
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
    IonLabel,
    IonList,
    IonItem,
    IonText,
    IonSpinner,
    IonSelect,
    IonSelectOption,
    IonInput,
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
  private readonly registerService = inject(RegisterService);
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly receiptPrint = inject(ReceiptPrintService);
  private readonly terminalHeartbeat = inject(TerminalHeartbeatService);
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
  activeSession = signal<RegisterSessionDto | null>(null);
  availableRegisters = signal<RegisterDto[]>([]);
  noRegisterAssigned = signal(false);

  readonly canOpenRegister = this.auth.hasPermission('registers.open');
  readonly canCashMovement = this.auth.hasPermission('registers.cash_movement');
  readonly canSelectRegister = computed(() => this.availableRegisters().length > 1);

  tabs = signal<SaleTab[]>([]);
  activeTabId = signal<string | null>(null);
  activeSale = signal<ActiveSale | null>(null);
  searchResults = signal<ProductSearchResult[]>([]);
  searchQuery = signal('');
  isSearching = signal(false);
  paymentTypes = signal<PaymentTypeDto[]>([]);
  paymentLines = signal<PaymentLine[]>([]);
  amountInputFocused = signal(false);

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
  readonly paymentTypeMap = computed(() => {
    const map = new Map<string, PaymentTypeDto>();
    for (const type of this.paymentTypes()) map.set(type.id, type);
    return map;
  });
  readonly cashTendered = computed(() => {
    const types = this.paymentTypeMap();
    return this.paymentLines().reduce((sum, line) => {
      const type = types.get(line.paymentTypeId);
      if (!type?.affectsCash || line.amount === null) return sum;
      return sum + line.amount;
    }, 0);
  });
  readonly nonCashPaid = computed(() => {
    const types = this.paymentTypeMap();
    return this.paymentLines().reduce((sum, line) => {
      const type = types.get(line.paymentTypeId);
      if (!type || type.affectsCash || line.amount === null) return sum;
      return sum + line.amount;
    }, 0);
  });
  readonly totalPaid = computed(() => this.cashTendered() + this.nonCashPaid());
  readonly cashRequired = computed(() =>
    Math.max(0, Math.round((this.total() - this.nonCashPaid()) * 100) / 100),
  );
  readonly hasCashPayment = computed(() => {
    const types = this.paymentTypeMap();
    return this.paymentLines().some((line) => types.get(line.paymentTypeId)?.affectsCash);
  });
  readonly changeAmount = computed(() => {
    if (!this.hasCashPayment()) return 0;
    return Math.max(0, Math.round((this.cashTendered() - this.cashRequired()) * 100) / 100);
  });
  readonly hasSufficientPayment = computed(() => {
    if (this.paymentLines().length === 0) return false;
    if (this.paymentLines().some((line) => line.amount === null || line.amount <= 0)) return false;
    return this.totalPaid() + 0.001 >= this.total() && this.cashTendered() + 0.001 >= this.cashRequired();
  });
  readonly showInsufficientPayment = computed(() => {
    if (this.paymentLines().every((line) => line.amount === null)) return false;
    return !this.hasSufficientPayment();
  });
  readonly isSaleCompleted = computed(
    () => this.activeSale()?.status === SaleStatus.COMPLETED,
  );
  readonly isRegisterOpen = computed(() => this.activeSession()?.status === 'OPEN');
  readonly canOperateSale = computed(
    () => this.isRegisterOpen() && !this.isSaleCompleted(),
  );
  readonly canSaveSale = computed(
    () =>
      this.isRegisterOpen() &&
      !this.isSaleCompleted() &&
      !this.isSavingSale() &&
      (this.activeSale()?.items.length ?? 0) > 0 &&
      this.hasSufficientPayment(),
  );
  readonly canPrintReceipt = computed(
    () => this.isSaleCompleted() && !!this.activeSale()?.documentNumber,
  );

  ngOnInit(): void {
    this.loadPosContext();
    this.loadPaymentTypes();
    this.setupSearch();
    this.setupKeyboard();
  }

  ngOnDestroy(): void {
    this.terminalHeartbeat.stop();
    this.destroy$.next();
    this.destroy$.complete();
    this.initialized = false;
    this.initializing = false;
    this.initPromise = null;
    this.posReady.set(false);
  }

  ionViewWillEnter(): void {
    void this.loadActiveSession().then(() => {
      if (!this.branchId() || !this.registerId()) {
        this.loadPosContext();
        return;
      }

      void this.whenReady().then(() => {
        const tabId = this.activeTabId() ?? this.tabs()[0]?.id;
        if (tabId && !this.activeSale()?.id) {
          void this.activateSale(tabId);
        }
      });
    });
  }

  onSearchInput(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  onPaymentAmountInput(key: string, event: CustomEvent): void {
    const raw = (event.detail as { value?: string | null }).value?.trim() ?? '';
    const parsed = raw ? Number.parseFloat(raw) : NaN;
    const amount = Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
    this.paymentLines.update((lines) =>
      lines.map((line) => (line.key === key ? { ...line, amount } : line)),
    );
  }

  onPaymentTypeChange(key: string, paymentTypeId: string): void {
    this.paymentLines.update((lines) =>
      lines.map((line) => (line.key === key ? { ...line, paymentTypeId } : line)),
    );
  }

  addPaymentLine(): void {
    const types = this.paymentTypes();
    if (types.length === 0) return;
    const remaining = Math.max(0, this.roundMoney(this.total() - this.totalPaid()));
    const preferred =
      types.find((t) => !t.affectsCash) ??
      types.find((t) => t.affectsCash) ??
      types[0]!;
    this.paymentLines.update((lines) => [
      ...lines,
      {
        key: `pay-${Date.now()}-${lines.length}`,
        paymentTypeId: preferred.id,
        amount: remaining > 0 ? remaining : null,
        reference: '',
      },
    ]);
  }

  removePaymentLine(key: string): void {
    this.paymentLines.update((lines) => {
      if (lines.length <= 1) return lines;
      return lines.filter((line) => line.key !== key);
    });
  }

  async openCashMovementModal(): Promise<void> {
    const sessionId = this.activeSession()?.id;
    if (!sessionId || !this.canCashMovement) return;

    const modal = await this.modalCtrl.create({
      component: CashMovementModal,
      componentProps: { sessionId },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadActiveSession();
      await this.showToast('Movimiento de caja registrado', 'success');
    }
  }

  onSearchKeydown(event: KeyboardEvent): void {
    if (!this.canOperateSale()) return;
    if (event.key === 'Enter' && this.searchResults().length > 0) {
      this.addProduct(this.searchResults()[0]!);
      this.clearSearch();
    }
  }

  async onNewTab(): Promise<void> {
    if (this.isCreatingTab()) return;
    if (!this.isRegisterOpen()) {
      await this.showRegisterClosedWarning();
      return;
    }
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
        if (this.isRegisterOpen()) {
          void this.createNewTab();
        }
      }
    }
  }

  addProduct(product: ProductSearchResult): void {
    void this.addProductAsync(product);
  }

  updateQuantity(item: SaleItemDto, delta: number): void {
    if (!this.canOperateSale()) return;
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
    if (!this.canOperateSale()) return;
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

      const payments = this.paymentLines()
        .filter((line) => line.amount !== null && line.amount > 0)
        .map((line) => ({
          paymentTypeId: line.paymentTypeId,
          amount: line.amount as number,
          reference: line.reference.trim() || undefined,
        }));

      if (payments.length === 0) return;

      const completed = await firstValueFrom(
        this.saleService.checkout(current.id, {
          version: current.version ?? 0,
          payments,
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
      await this.loadActiveSession();
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
    if (!this.canOperateSale()) return;
    const sale = this.activeSale();
    if (!sale?.id) return;
    this.saleService.suspendSale(sale.id).subscribe({
      next: async () => {
        await this.refreshTabsFromServer();
        const nextTab = this.tabs()[0];
        if (nextTab) {
          await this.activateSale(nextTab.id);
        } else if (this.isRegisterOpen()) {
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
    if (!this.isRegisterOpen()) {
      await this.showRegisterClosedWarning();
      return;
    }
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
        taxRate: product.taxRate ?? 0,
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
          this.terminalHeartbeat.reportBarcodeScan();
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
          if (this.isRegisterOpen()) {
            void this.onNewTab();
          } else {
            void this.showRegisterClosedWarning();
          }
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
          if (this.canOperateSale()) this.updateSaleItems([]);
          break;
        case 'register.toggle':
          void this.toggleRegisterSession();
          break;
      }
    });
  }

  private loadPosContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        this.businessName.set(res.businessName ?? res.branchName);
        this.ticketHeader.set(res.ticketHeader);
        this.ticketFooter.set(res.ticketFooter);
        void this.loadAvailableRegisters(
          res.branchId,
          res.registerId,
          res.registerName,
          res.registerBoundToTerminal ?? false,
        );
      },
      error: async () => {
        this.initPromise = null;
        await this.showToast('No se pudo cargar la configuración de caja', 'danger');
      },
    });
  }

  private async loadAvailableRegisters(
    branchId: string,
    defaultRegisterId: string,
    defaultRegisterName: string,
    boundToTerminal: boolean,
  ): Promise<void> {
    const isAdmin = this.auth.hasPermission('registers.admin');

    let registers: RegisterDto[] = [];
    try {
      registers = await firstValueFrom(this.registerService.listMine(branchId));
    } catch {
      registers = [];
    }

    // Usuario normal: solo puede ver/abrir la caja asignada a él que además
    // pertenezca a este equipo (terminal). El admin ve todas las cajas.
    if (!isAdmin && boundToTerminal) {
      registers = registers.filter((r) => r.id === defaultRegisterId);
    }

    this.availableRegisters.set(registers);

    if (registers.length === 0) {
      this.noRegisterAssigned.set(true);
      this.registerId.set(null);
      this.registerName.set('');
      this.posReady.set(true);
      return;
    }

    this.noRegisterAssigned.set(false);

    const preferred =
      registers.find((r) => r.id === defaultRegisterId) ?? registers[0]!;
    this.registerId.set(preferred.id);
    this.registerName.set(
      preferred.id === defaultRegisterId ? defaultRegisterName : preferred.name,
    );

    await this.loadActiveSession();
    await this.whenReady();
  }

  async selectRegister(registerId: string): Promise<void> {
    if (!registerId || registerId === this.registerId()) return;

    const register = this.availableRegisters().find((r) => r.id === registerId);
    if (!register) return;

    this.initialized = false;
    this.initializing = false;
    this.initPromise = null;
    this.posReady.set(false);
    this.tabs.set([]);
    this.activeTabId.set(null);
    this.activeSale.set(null);
    this.searchResults.set([]);
    this.searchQuery.set('');

    this.registerId.set(register.id);
    this.registerName.set(register.name);
    this.terminalHeartbeat.start(register.id);

    await this.loadActiveSession();
    await this.whenReady();
    this.posReady.set(true);
  }

  private whenReady(): Promise<void> {
    if (this.initialized) return Promise.resolve();

    const registerId = this.registerId();
    const branchId = this.branchId();
    if (!registerId || !branchId) {
      return Promise.resolve();
    }

    if (!this.initPromise) {
      this.initPromise = this.initializePos().finally(() => {
        if (!this.initialized) {
          this.initPromise = null;
        }
      });
    }

    return this.initPromise;
  }

  private async initializePos(): Promise<void> {
    if (this.initialized) return;

    const registerId = this.registerId();
    const branchId = this.branchId();
    if (!registerId || !branchId) return;

    if (this.initializing) return;
    this.initializing = true;

    try {
      await this.refreshTabsFromServer();

      if (this.isRegisterOpen()) {
        if (this.tabs().length === 0) {
          await this.createNewTab();
        } else {
          const tabId = this.activeTabId() ?? this.tabs()[0]!.id;
          await this.activateSale(tabId);
        }
      } else {
        this.activeTabId.set(null);
        this.activeSale.set(null);
      }

      this.initialized = true;
      this.posReady.set(true);
      this.terminalHeartbeat.start(this.registerId());
    } catch {
      this.initialized = false;
      this.posReady.set(false);
      await this.showToast('No se pudo iniciar el punto de venta', 'danger');
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

    if (!this.isRegisterOpen()) {
      await this.showRegisterClosedWarning();
      return;
    }

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
      this.resetPaymentLines();
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
      this.resetPaymentLines(sale);
    } catch {
      if (this.activeTabId() !== tabId) return;
      await this.showToast('No se pudo cargar la venta', 'danger');
    }
  }

  private updateSaleItems(items: SaleItemDto[]): void {
    const sale = this.activeSale();
    if (!sale?.id || sale.status === SaleStatus.COMPLETED || !this.isRegisterOpen()) return;

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

  async toggleRegisterSession(): Promise<void> {
    if (this.isRegisterOpen()) {
      await this.showToast('Cierre la caja desde Apertura y cierre de caja', 'warning');
      return;
    }
    await this.openRegisterModal();
  }

  async openRegisterModal(): Promise<void> {
    const registerId = this.registerId();
    if (!registerId || !this.canOpenRegister) return;

    const modal = await this.modalCtrl.create({
      component: RegisterSessionModal,
      componentProps: {
        mode: 'open',
        registerId,
        registerName: this.registerName(),
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadActiveSession();
      if (!this.initialized) {
        await this.whenReady();
      } else if (this.isRegisterOpen() && this.tabs().length === 0) {
        await this.createNewTab();
      }
      await this.showToast('Caja abierta correctamente', 'success');
    }
  }

  private loadActiveSession(): Promise<void> {
    const registerId = this.registerId();
    if (!registerId) return Promise.resolve();

    return new Promise((resolve) => {
      this.registerService.getActiveSession(registerId).subscribe({
        next: (session) => {
          this.activeSession.set(session);
          resolve();
        },
        error: () => {
          this.activeSession.set(null);
          resolve();
        },
      });
    });
  }

  private async showRegisterClosedWarning(): Promise<void> {
    await this.showToast('Debe abrir la caja antes de realizar ventas', 'warning');
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

  private loadPaymentTypes(): void {
    this.paymentTypeService.listActive().subscribe({
      next: (types) => {
        this.paymentTypes.set(types);
        if (this.paymentLines().length === 0) {
          this.resetPaymentLines();
        }
      },
      error: () => {
        this.paymentTypes.set([]);
      },
    });
  }

  private resetPaymentLines(sale?: SaleDto): void {
    if (sale?.status === SaleStatus.COMPLETED && sale.payments?.length) {
      this.paymentLines.set(
        sale.payments.map((p, index) => ({
          key: `done-${index}`,
          paymentTypeId: p.paymentTypeId,
          amount: p.amount,
          reference: p.reference ?? '',
        })),
      );
      return;
    }

    const cashType =
      this.paymentTypes().find((t) => t.affectsCash) ?? this.paymentTypes()[0];
    if (!cashType) {
      this.paymentLines.set([]);
      return;
    }

    this.paymentLines.set([
      {
        key: 'pay-0',
        paymentTypeId: cashType.id,
        amount: null,
        reference: '',
      },
    ]);
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
