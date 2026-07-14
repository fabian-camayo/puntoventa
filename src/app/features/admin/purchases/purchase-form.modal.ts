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
  ModalController,
  ToastController,
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
} from 'ionicons/icons';
import {
  Subject,
  debounceTime,
  distinctUntilChanged,
  firstValueFrom,
  takeUntil,
} from 'rxjs';
import { ProductSearchResult } from '@puntoventa/shared';
import {
  CreatePurchasePayload,
  PurchaseDto,
  PurchaseItemDto,
  PurchaseService,
  UpdatePurchasePayload,
} from '@core/services/purchase.service';
import { SupplierDto } from '@core/services/supplier.service';
import { ProductService } from '@core/services/product.service';
import { AuthService } from '@core/services/auth.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';

addIcons({
  closeOutline,
  checkmarkOutline,
  cartOutline,
  cubeOutline,
  trashOutline,
  addOutline,
  downloadOutline,
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
    TranslateModule,
    AppCurrencyPipe,
  ],
})
export class PurchaseFormModal implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly purchaseService = inject(PurchaseService);
  private readonly productService = inject(ProductService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
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

  readonly canCreate = this.auth.hasPermission('purchases.create');
  readonly canUpdate = this.auth.hasPermission('purchases.update');
  readonly canSaveAndReceive =
    this.auth.hasPermission('purchases.create') ||
    this.auth.hasPermission('purchases.update');

  form = this.fb.nonNullable.group({
    supplierId: ['', Validators.required],
    documentNumber: ['', [Validators.required, Validators.maxLength(50)]],
    notes: [''],
  });

  ngOnInit(): void {
    this.isEdit = !!this.purchase;
    this.setupProductSearch();

    if (this.purchase) {
      this.form.patchValue({
        supplierId: this.purchase.supplierId,
        documentNumber: this.purchase.documentNumber,
        notes: this.purchase.notes ?? '',
      });
      this.form.controls.supplierId.disable();
      this.form.controls.documentNumber.disable();
      this.lines.set(
        (this.purchase.items ?? []).map((item) => this.fromDto(item)),
      );
    } else {
      this.form.patchValue({
        documentNumber: this.suggestDocumentNumber(),
      });
    }
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

  lineSubtotal(line: EditableLine): number {
    return Math.round(line.quantity * line.unitCost * 100) / 100;
  }

  lineTax(line: EditableLine): number {
    return Math.round(this.lineSubtotal(line) * (line.taxRate / 100) * 100) / 100;
  }

  lineTotal(line: EditableLine): number {
    return this.lineSubtotal(line) + this.lineTax(line);
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

  addProduct(product: ProductSearchResult): void {
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
        typeof (product as ProductSearchResult & { costPrice?: number }).costPrice ===
        'number'
          ? (product as ProductSearchResult & { costPrice?: number }).costPrice!
          : 0;
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
          taxRate: product.taxRate ?? 0,
        },
      ]);
    }
    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  updateLine(
    key: string,
    patch: Partial<Pick<EditableLine, 'quantity' | 'unitCost' | 'taxRate'>>,
  ): void {
    this.lines.update((items) =>
      items.map((item) => {
        if (item.key !== key) return item;
        return {
          ...item,
          quantity:
            patch.quantity !== undefined
              ? Math.max(0.001, Number(patch.quantity) || 0.001)
              : item.quantity,
          unitCost:
            patch.unitCost !== undefined
              ? Math.max(0, Number(patch.unitCost) || 0)
              : item.unitCost,
          taxRate:
            patch.taxRate !== undefined
              ? Math.max(0, Math.min(100, Number(patch.taxRate) || 0))
              : item.taxRate,
        };
      }),
    );
  }

  removeLine(key: string): void {
    this.lines.update((items) => items.filter((i) => i.key !== key));
  }

  dismiss(saved = false): void {
    void this.modalCtrl.dismiss(null, saved ? 'saved' : 'cancel');
  }

  async save(andReceive = false): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (this.lines().length === 0) {
      await this.showError('Agregue al menos un producto');
      return;
    }

    const allowed = this.isEdit ? this.canUpdate : this.canCreate;
    if (!allowed) return;

    this.saving.set(true);
    const raw = this.form.getRawValue();

    try {
      let saved: PurchaseDto;

      if (this.isEdit && this.purchase) {
        const payload: UpdatePurchasePayload = {
          notes: raw.notes || undefined,
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
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar la compra';
      await this.showError(message);
    } finally {
      this.saving.set(false);
    }
  }

  private setupProductSearch(): void {
    this.productSearch$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((query) => {
        void this.searchProducts(query);
      });
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
      taxRate: item.taxRate ?? 0,
    };
  }

  private suggestDocumentNumber(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `COMP-${y}${m}${d}-${hh}${mm}`;
  }

  private async showError(message: string): Promise<void> {
    const t = await this.toast.create({
      message,
      duration: 3500,
      color: 'danger',
    });
    await t.present();
  }
}
