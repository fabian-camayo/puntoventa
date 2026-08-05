import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonSearchbar,
  IonIcon,
  IonSpinner,
  IonList,
  IonLabel,
  IonToggle,
  ModalController,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  cartOutline,
  cubeOutline,
  trashOutline,
  addOutline,
  downloadOutline,
  cashOutline,
} from 'ionicons/icons';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  takeUntil,
} from 'rxjs';
import { BankAccountDto, ProductDto, ProductSearchResult, RegisterDto } from '@puntoventa/shared';
import {
  CreatePurchasePayload,
  PurchaseDto,
  PurchaseFundSource,
  PurchaseItemDto,
  PurchasePaymentTerm,
  PurchaseService,
  UpdatePurchasePayload,
} from '@core/services/purchase.service';
import { SupplierDto } from '@core/services/supplier.service';
import { ProductService } from '@core/services/product.service';
import { CategoryService } from '@core/services/category.service';
import { BankAccountService } from '@core/services/bank-account.service';
import { RegisterService } from '@core/services/register.service';
import { AuthService } from '@core/services/auth.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { FieldErrorComponent } from '@shared/components/field-error/field-error.component';
import { isControlInvalid, notifyInvalidForm } from '@shared/utils/form-validation';
import { ProductFormModal } from '../products/product-form.modal';

addIcons({
  closeOutline,
  checkmarkOutline,
  cartOutline,
  cubeOutline,
  trashOutline,
  addOutline,
  downloadOutline,
  cashOutline,
});

interface EditableLine {
  key: string;
  productId: string;
  productName: string;
  sku: string;
  unitTypeId?: string;
  unitTypeCode?: string;
  stockFactor: number;
  availableUnits: Array<{
    unitTypeId: string;
    unitTypeCode?: string;
    unitTypeName?: string;
    stockFactor: number;
    isBase: boolean;
  }>;
  quantity: number;
  unitCost: number;
  /** Precio de venta actual del producto (unidad base). */
  salePrice: number;
  taxRate: number;
}

@Component({
  selector: 'app-purchase-form-modal',
  templateUrl: './purchase-form.modal.html',
  styleUrls: ['./purchase-form.modal.scss'],
  imports: [
    ReactiveFormsModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    IonSearchbar,
    IonIcon,
    IonSpinner,
    IonList,
    IonLabel,
    IonToggle,
    TranslateModule,
    AppCurrencyPipe,
    FieldErrorComponent,
  ],
})
export class PurchaseFormModal implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly purchaseService = inject(PurchaseService);
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly bankAccountService = inject(BankAccountService);
  private readonly registerService = inject(RegisterService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);
  private readonly destroy$ = new Subject<void>();
  private readonly productSearch$ = new Subject<string>();

  @Input() branchId = '';
  @Input() purchase: PurchaseDto | null = null;
  @Input() suppliers: SupplierDto[] = [];

  saving = signal(false);
  isEdit = false;
  lines = signal<EditableLine[]>([]);
  searchQuery = signal('');
  searchResults = signal<ProductSearchResult[]>([]);
  searching = signal(false);
  registers = signal<RegisterDto[]>([]);
  bankAccounts = signal<BankAccountDto[]>([]);
  readonly isInvalid = isControlInvalid;

  readonly canCreate = this.auth.hasPermission('purchases.create');
  readonly canUpdate = this.auth.hasPermission('purchases.update');
  readonly canCreateProduct = this.auth.hasPermission('products.create');
  readonly canSaveAndReceive =
    this.auth.hasPermission('purchases.create') ||
    this.auth.hasPermission('purchases.update');

  form = this.fb.nonNullable.group({
    supplierId: ['', Validators.required],
    documentNumber: ['', [Validators.required, Validators.maxLength(50)]],
    purchaseDate: [this.todayIsoDate(), Validators.required],
    paymentTerm: ['CASH' as PurchasePaymentTerm, Validators.required],
    fundSource: ['REGISTER' as PurchaseFundSource | ''],
    registerId: [''],
    bankAccountId: [''],
    reduceCash: [true],
    notes: [''],
  });

  ngOnInit(): void {
    this.isEdit = !!this.purchase;
    this.setupProductSearch();
    this.setupPaymentWatchers();
    void this.loadPaymentOptions();

    if (this.purchase) {
      this.form.patchValue({
        supplierId: this.purchase.supplierId,
        documentNumber: this.purchase.documentNumber,
        purchaseDate: this.purchase.purchaseDate?.slice(0, 10) || this.todayIsoDate(),
        paymentTerm: this.purchase.paymentTerm ?? 'CASH',
        fundSource: this.purchase.fundSource ?? 'REGISTER',
        registerId: this.purchase.registerId ?? '',
        bankAccountId: this.purchase.bankAccountId ?? '',
        reduceCash: this.purchase.reduceCash ?? true,
        notes: this.purchase.notes ?? '',
      });
      this.form.controls.supplierId.disable();
      this.form.controls.documentNumber.disable();
      this.lines.set(
        (this.purchase.items ?? []).map((item) => this.fromDto(item)),
      );
      void this.ensureSalePricesLoaded();
    } else {
      void this.assignNextDocumentNumber();
    }

    this.applyPaymentValidators();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get subtotal(): number {
    return this.lines().reduce((sum, line) => sum + this.lineSubtotal(line), 0);
  }

  get taxAmount(): number {
    return this.lines().reduce((sum, line) => sum + this.lineTax(line), 0);
  }

  get total(): number {
    return this.subtotal + this.taxAmount;
  }

  get isCash(): boolean {
    return this.form.controls.paymentTerm.value === 'CASH';
  }

  get isRegisterFund(): boolean {
    return this.isCash && this.form.controls.fundSource.value === 'REGISTER';
  }

  get isBankFund(): boolean {
    return this.isCash && this.form.controls.fundSource.value === 'BANK_ACCOUNT';
  }

  lineSubtotal(line: EditableLine): number {
    return Math.round(line.quantity * line.unitCost * 100) / 100;
  }

  lineTax(line: EditableLine): number {
    return Math.round(this.lineSubtotal(line) * (line.taxRate / 100) * 100) / 100;
  }

  lineTotal(line: EditableLine): number {
    return this.lineSubtotal(line) + this.lineTax(line);
  }

  /** Costo por unidad base (comparable con precio de venta). */
  baseUnitCost(line: EditableLine): number {
    const factor = line.stockFactor > 0 ? line.stockFactor : 1;
    return Math.round((line.unitCost / factor) * 10000) / 10000;
  }

  isBelowSalePrice(line: EditableLine): boolean {
    if (!(line.salePrice > 0)) return false;
    return this.baseUnitCost(line) > line.salePrice;
  }

  linesBelowSalePrice(): EditableLine[] {
    return this.lines().filter((line) => this.isBelowSalePrice(line));
  }

  onProductSearch(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.searchQuery.set(value);
    this.productSearch$.next(value);
  }

  onLineNumberChange(
    key: string,
    field: 'quantity' | 'unitCost' | 'taxRate',
    event: CustomEvent,
  ): void {
    const value = Number((event.detail as { value?: string | number }).value);
    this.updateLine(key, { [field]: value });
    if (field === 'unitCost') {
      const line = this.lines().find((l) => l.key === key);
      if (line && this.isBelowSalePrice(line)) {
        void this.showBelowCostToast(line);
      }
    }
  }

  changeLineUnit(key: string, unitTypeId: string): void {
    const line = this.lines().find((l) => l.key === key);
    if (!line) return;
    const unit = line.availableUnits.find((u) => u.unitTypeId === unitTypeId);
    if (!unit) return;

    const duplicate = this.lines().find(
      (l) => l.productId === line.productId && l.unitTypeId === unitTypeId && l.key !== key,
    );
    if (duplicate) {
      this.lines.update((items) =>
        items
          .filter((i) => i.key !== key)
          .map((i) =>
            i.key === duplicate.key
              ? { ...i, quantity: i.quantity + line.quantity }
              : i,
          ),
      );
      return;
    }

    this.lines.update((items) =>
      items.map((item) =>
        item.key !== key
          ? item
          : {
              ...item,
              key: `${item.productId}:${unit.unitTypeId}`,
              unitTypeId: unit.unitTypeId,
              unitTypeCode: unit.unitTypeCode,
              stockFactor: unit.stockFactor,
            },
      ),
    );
  }

  addProduct(product: ProductSearchResult & { costPrice?: number }): void {
    const units = (product.units ?? []).map((u) => ({
      unitTypeId: u.unitTypeId,
      unitTypeCode: u.unitTypeCode,
      unitTypeName: u.unitTypeName,
      stockFactor: u.stockFactor,
      isBase: u.isBase,
    }));
    const base = units.find((u) => u.isBase) ?? units[0];
    const unitTypeId = base?.unitTypeId;
    const key = `${product.id}:${unitTypeId ?? ''}`;

    const existing = this.lines().find((l) => l.key === key);
    if (existing) {
      this.updateLine(existing.key, {
        quantity: existing.quantity + 1,
      });
    } else {
      const cost =
        typeof product.costPrice === 'number' ? product.costPrice : 0;
      this.lines.update((items) => [
        ...items,
        {
          key,
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unitTypeId,
          unitTypeCode: base?.unitTypeCode ?? product.unit,
          stockFactor: base?.stockFactor ?? 1,
          availableUnits: units,
          quantity: 1,
          unitCost: cost,
          salePrice: product.salePrice ?? 0,
          taxRate: product.taxRate ?? 0,
        },
      ]);
    }
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  async openCreateProduct(): Promise<void> {
    if (!this.canCreateProduct || !this.branchId) return;

    try {
      const categories = await firstValueFrom(
        this.categoryService.listAll(this.branchId),
      );
      const modal = await this.modalCtrl.create({
        component: ProductFormModal,
        componentProps: {
          branchId: this.branchId,
          categories,
        },
        cssClass: 'pv-form-modal',
      });
      await modal.present();
      const { data, role } = await modal.onDidDismiss<ProductDto>();
      if (role !== 'saved' || !data) return;

      this.addProduct({
        id: data.id,
        sku: data.sku,
        barcode: data.barcode,
        name: data.name,
        salePrice: data.salePrice,
        stock: data.stock ?? 0,
        unit: data.unit,
        taxRate: data.taxRate,
        units: data.units,
        costPrice: data.costPrice,
      });
      await this.showMessage('Producto creado y agregado a la compra', 'success');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showError(message ?? 'No se pudo crear el producto');
    }
  }

  updateLine(
    key: string,
    patch: Partial<Pick<EditableLine, 'quantity' | 'unitCost' | 'taxRate'>>,
  ): void {
    this.lines.update((items) =>
      items.map((item) => {
        if (item.key !== key) return item;
        const quantity =
          patch.quantity !== undefined
            ? this.parseNonNegative(patch.quantity, item.quantity)
            : item.quantity;
        return {
          ...item,
          quantity,
          unitCost:
            patch.unitCost !== undefined
              ? Math.max(0, this.parseNonNegative(patch.unitCost, item.unitCost))
              : item.unitCost,
          taxRate:
            patch.taxRate !== undefined
              ? Math.max(0, Math.min(100, this.parseNonNegative(patch.taxRate, item.taxRate)))
              : item.taxRate,
        };
      }),
    );
  }

  removeLine(key: string): void {
    this.lines.update((items) => items.filter((i) => i.key !== key));
  }

  dismiss(saved = false, received = false): void {
    void this.modalCtrl.dismiss(
      saved ? { received } : null,
      saved ? (received ? 'received' : 'saved') : 'cancel',
    );
  }

  async save(andReceive = false): Promise<void> {
    if (await notifyInvalidForm(this.form, this.toast)) return;
    if (this.lines().length === 0) {
      await this.showError('Agregue al menos un producto');
      return;
    }

    const invalidQty = this.lines().find((line) => !(line.quantity >= 0.001));
    if (invalidQty) {
      await this.showError(
        `La cantidad de "${invalidQty.productName}" debe ser mayor a 0`,
      );
      return;
    }

    const allowed = this.isEdit ? this.canUpdate : this.canCreate;
    if (!allowed) return;

    if (andReceive) {
      const confirmed = await this.confirmReceiveAction();
      if (!confirmed) return;
    }

    this.saving.set(true);
    const raw = this.form.getRawValue();
    const paymentTerm = raw.paymentTerm;
    const fundSource =
      paymentTerm === 'CASH' ? (raw.fundSource as PurchaseFundSource) : undefined;

    try {
      let saved: PurchaseDto;

      if (this.isEdit && this.purchase) {
        const payload: UpdatePurchasePayload = {
          notes: raw.notes || undefined,
          purchaseDate: raw.purchaseDate,
          paymentTerm,
          fundSource: paymentTerm === 'CASH' ? fundSource : null,
          registerId:
            paymentTerm === 'CASH' && fundSource === 'REGISTER'
              ? raw.registerId || null
              : null,
          bankAccountId:
            paymentTerm === 'CASH' && fundSource === 'BANK_ACCOUNT'
              ? raw.bankAccountId || null
              : null,
          reduceCash:
            paymentTerm === 'CASH' && fundSource === 'REGISTER'
              ? raw.reduceCash
              : false,
          items: this.lines().map((line) => ({
            productId: line.productId,
            unitTypeId: line.unitTypeId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            taxRate: line.taxRate,
          })),
        };
        saved = await firstValueFrom(
          this.purchaseService.update(this.purchase.id, payload),
        );
      } else {
        const payload: CreatePurchasePayload = {
          branchId: this.branchId,
          supplierId: raw.supplierId,
          documentNumber: raw.documentNumber,
          purchaseDate: raw.purchaseDate,
          paymentTerm,
          fundSource,
          registerId:
            paymentTerm === 'CASH' && fundSource === 'REGISTER'
              ? raw.registerId || undefined
              : undefined,
          bankAccountId:
            paymentTerm === 'CASH' && fundSource === 'BANK_ACCOUNT'
              ? raw.bankAccountId || undefined
              : undefined,
          reduceCash:
            paymentTerm === 'CASH' && fundSource === 'REGISTER'
              ? raw.reduceCash
              : false,
          notes: raw.notes || undefined,
          items: this.lines().map((line) => ({
            productId: line.productId,
            unitTypeId: line.unitTypeId,
            quantity: line.quantity,
            unitCost: line.unitCost,
            taxRate: line.taxRate,
          })),
        };
        saved = await firstValueFrom(this.purchaseService.create(payload));
      }

      if (andReceive && this.canSaveAndReceive) {
        await firstValueFrom(this.purchaseService.receive(saved.id));
        this.dismiss(true, true);
        return;
      }

      this.dismiss(true, false);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar la compra';
      await this.showError(message);
    } finally {
      this.saving.set(false);
    }
  }

  private async confirmReceiveAction(): Promise<boolean> {
    await this.ensureSalePricesLoaded();

    const below = this.linesBelowSalePrice();
    const raw = this.form.getRawValue();
    const reducesCash =
      raw.paymentTerm === 'CASH' &&
      raw.fundSource === 'REGISTER' &&
      raw.reduceCash;

    let message = reducesCash
      ? 'Se actualizará el inventario y se descontará el efectivo de la caja (debe haber sesión abierta).'
      : 'Se actualizará el inventario y la compra quedará como recibida.';

    if (below.length > 0) {
      const names = below
        .slice(0, 5)
        .map(
          (l) =>
            `• ${l.productName}: costo ${this.baseUnitCost(l)} > venta ${l.salePrice}`,
        )
        .join('\n');
      const more = below.length > 5 ? `\n… y ${below.length - 5} más` : '';
      message +=
        `\n\nAdvertencia: el costo queda por encima del precio de venta en:\n${names}${more}` +
        '\n\nSi continúa, podrá vender por debajo del costo.';
    }

    message += '\n\n¿Continuar?';

    const alert = await this.alertCtrl.create({
      header: below.length > 0 ? 'Costo mayor al precio de venta' : 'Guardar y recibir',
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: below.length > 0 ? 'Recibir de todos modos' : 'Recibir', role: 'confirm' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === 'confirm';
  }

  private async ensureSalePricesLoaded(): Promise<void> {
    const missing = this.lines().filter((l) => !(l.salePrice > 0));
    if (!missing.length) return;

    await Promise.all(
      missing.map(async (line) => {
        try {
          const product = await firstValueFrom(this.productService.getById(line.productId));
          this.lines.update((items) =>
            items.map((item) =>
              item.key === line.key
                ? { ...item, salePrice: product.salePrice ?? 0 }
                : item,
            ),
          );
        } catch {
          /* se omite si no se puede cargar */
        }
      }),
    );
  }

  private async showBelowCostToast(line: EditableLine): Promise<void> {
    const t = await this.toast.create({
      message: `"${line.productName}": el costo (${this.baseUnitCost(line)}) supera el precio de venta (${line.salePrice})`,
      duration: 3500,
      color: 'warning',
    });
    await t.present();
  }

  private setupProductSearch(): void {
    this.productSearch$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        void this.searchProducts(query);
      });
  }

  private setupPaymentWatchers(): void {
    this.form.controls.paymentTerm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyPaymentValidators());
    this.form.controls.fundSource.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.applyPaymentValidators());
  }

  private applyPaymentValidators(): void {
    const { paymentTerm, fundSource, registerId, bankAccountId } = this.form.controls;

    if (paymentTerm.value === 'CREDIT') {
      fundSource.clearValidators();
      registerId.clearValidators();
      bankAccountId.clearValidators();
      fundSource.setValue('', { emitEvent: false });
      registerId.setValue('', { emitEvent: false });
      bankAccountId.setValue('', { emitEvent: false });
    } else {
      fundSource.setValidators([Validators.required]);
      if (!fundSource.value) {
        fundSource.setValue('REGISTER', { emitEvent: false });
      }
      if (fundSource.value === 'REGISTER') {
        registerId.setValidators([Validators.required]);
        bankAccountId.clearValidators();
        bankAccountId.setValue('', { emitEvent: false });
      } else {
        bankAccountId.setValidators([Validators.required]);
        registerId.clearValidators();
        registerId.setValue('', { emitEvent: false });
      }
    }

    fundSource.updateValueAndValidity({ emitEvent: false });
    registerId.updateValueAndValidity({ emitEvent: false });
    bankAccountId.updateValueAndValidity({ emitEvent: false });
  }

  private async loadPaymentOptions(): Promise<void> {
    if (!this.branchId) return;
    try {
      const [registers, accounts] = await Promise.all([
        firstValueFrom(this.registerService.listRegisters(this.branchId, { limit: 100 })),
        firstValueFrom(this.bankAccountService.listActive(this.branchId)),
      ]);
      this.registers.set(registers.items.filter((r) => r.isActive));
      this.bankAccounts.set(accounts);
    } catch {
      this.registers.set([]);
      this.bankAccounts.set([]);
    }
  }

  private async searchProducts(query: string): Promise<void> {
    const q = query.trim();
    if (!q || !this.branchId) {
      this.searchResults.set([]);
      return;
    }

    this.searching.set(true);
    try {
      const results = await firstValueFrom(
        this.productService.search(q, this.branchId),
      );
      this.searchResults.set(results);
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  private fromDto(item: PurchaseItemDto): EditableLine {
    const unitTypeId = item.unitTypeId;
    return {
      key: `${item.productId}:${unitTypeId ?? ''}`,
      productId: item.productId,
      productName: item.productName ?? item.sku ?? item.productId,
      sku: item.sku ?? '',
      unitTypeId,
      unitTypeCode: item.unitTypeCode,
      stockFactor: item.stockFactor ?? 1,
      availableUnits: unitTypeId
        ? [
            {
              unitTypeId,
              unitTypeCode: item.unitTypeCode,
              unitTypeName: item.unitTypeName,
              stockFactor: item.stockFactor ?? 1,
              isBase: (item.stockFactor ?? 1) === 1,
            },
          ]
        : [],
      quantity: item.quantity,
      unitCost: item.unitCost,
      salePrice: 0,
      taxRate: item.taxRate ?? 0,
    };
  }

  private async assignNextDocumentNumber(): Promise<void> {
    if (!this.branchId) {
      this.form.patchValue({ documentNumber: this.suggestDocumentNumberFallback() });
      return;
    }
    try {
      const documentNumber = await firstValueFrom(
        this.purchaseService.nextDocumentNumber(this.branchId),
      );
      this.form.patchValue({ documentNumber });
    } catch {
      this.form.patchValue({ documentNumber: this.suggestDocumentNumberFallback() });
    }
  }

  private suggestDocumentNumberFallback(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `COMP-${y}${m}${d}-${hh}${mm}${ss}`;
  }

  private todayIsoDate(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Parsea número; si es inválido conserva el valor anterior (permite 0 para validar al guardar). */
  private parseNonNegative(raw: unknown, fallback: number): number {
    const n = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(n) || n < 0) return fallback;
    return n;
  }

  private async showError(message: string): Promise<void> {
    await this.showMessage(message, 'danger');
  }

  private async showMessage(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({
      message,
      duration: 3500,
      color,
    });
    await t.present();
  }
}
