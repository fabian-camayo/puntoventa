import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonSearchbar,
  IonSpinner,
  IonText,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  saveOutline,
  trashOutline,
  addOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  PaymentTypeDto,
  ProductSearchResult,
  SaleDto,
  SaleItemDto,
  SalePaymentDto,
} from '@puntoventa/shared';
import { SaleService } from '@core/services/sale.service';
import { ProductService } from '@core/services/product.service';
import { PaymentTypeService } from '@core/services/payment-type.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';

addIcons({ closeOutline, saveOutline, trashOutline, addOutline });

interface EditPaymentLine {
  key: string;
  paymentTypeId: string;
  amount: number | null;
  reference: string;
}

@Component({
  selector: 'app-sale-edit-modal',
  templateUrl: './sale-edit.modal.html',
  styleUrls: ['./sale-edit.modal.scss'],
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonSearchbar,
    IonSpinner,
    IonText,
    TranslateModule,
    AppCurrencyPipe,
  ],
})
export class SaleEditModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly saleService = inject(SaleService);
  private readonly productService = inject(ProductService);
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly toast = inject(ToastController);

  @Input({ required: true }) sale!: SaleDto;
  @Input({ required: true }) branchId!: string;

  items = signal<SaleItemDto[]>([]);
  paymentLines = signal<EditPaymentLine[]>([]);
  paymentTypes = signal<PaymentTypeDto[]>([]);
  searchQuery = signal('');
  searchResults = signal<ProductSearchResult[]>([]);
  searching = signal(false);
  saving = signal(false);

  readonly subtotal = computed(() =>
    this.roundMoney(this.items().reduce((sum, i) => sum + i.subtotal, 0)),
  );
  readonly taxAmount = computed(() =>
    this.roundMoney(this.items().reduce((sum, i) => sum + (i.taxAmount ?? 0), 0)),
  );
  readonly total = computed(() =>
    this.roundMoney(this.items().reduce((sum, i) => sum + i.total, 0)),
  );
  readonly paidTotal = computed(() =>
    this.roundMoney(
      this.paymentLines().reduce((sum, p) => sum + (p.amount ?? 0), 0),
    ),
  );

  ngOnInit(): void {
    this.items.set(this.sale.items.map((i) => ({ ...i })));
    this.paymentLines.set(
      (this.sale.payments ?? []).map((p, index) => ({
        key: `pay-${index}`,
        paymentTypeId: p.paymentTypeId,
        amount: p.amount,
        reference: p.reference ?? '',
      })),
    );
    this.paymentTypeService.listActive().subscribe({
      next: (types) => {
        this.paymentTypes.set(types);
        if (this.paymentLines().length === 0 && types[0]) {
          this.paymentLines.set([
            {
              key: 'pay-0',
              paymentTypeId: types[0].id,
              amount: this.total(),
              reference: '',
            },
          ]);
        }
      },
    });
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }

  async onSearchInput(event: CustomEvent): Promise<void> {
    const value = ((event.detail as { value?: string }).value ?? '').trim();
    this.searchQuery.set(value);
    if (value.length < 2) {
      this.searchResults.set([]);
      return;
    }
    this.searching.set(true);
    try {
      const results = await firstValueFrom(
        this.productService.search(value, this.branchId),
      );
      this.searchResults.set(results);
    } catch {
      this.searchResults.set([]);
    } finally {
      this.searching.set(false);
    }
  }

  addProduct(product: ProductSearchResult): void {
    const baseUnit = product.units?.find((u) => u.isBase) ?? product.units?.[0];
    const existingIndex = this.items().findIndex(
      (i) =>
        i.productId === product.id &&
        (i.unitTypeId ?? null) === (baseUnit?.unitTypeId ?? null),
    );

    if (existingIndex >= 0) {
      const existing = this.items()[existingIndex]!;
      this.updateItemQuantity(existingIndex, existing.quantity + 1);
    } else {
      const taxRate = product.taxRate ?? 0;
      const unitPrice = product.salePrice;
      const draft: SaleItemDto = {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        unitTypeId: baseUnit?.unitTypeId,
        unitTypeCode: baseUnit?.unitTypeCode ?? product.unit,
        unitTypeName: baseUnit?.unitTypeName,
        stockFactor: baseUnit ? Number(baseUnit.stockFactor) : 1,
        quantity: 1,
        unitPrice,
        costPrice: 0,
        discountAmount: 0,
        discountPercent: 0,
        taxRate,
        taxAmount: 0,
        subtotal: 0,
        total: 0,
      };
      this.items.update((list) => [...list, this.recalculateItem(draft)]);
      this.syncCashPaymentToTotal();
    }

    this.searchQuery.set('');
    this.searchResults.set([]);
  }

  updateItemQuantity(index: number, quantity: number): void {
    const qty = Math.max(0.001, Number(quantity) || 0.001);
    this.items.update((list) =>
      list.map((i, iIdx) =>
        iIdx === index ? this.recalculateItem({ ...i, quantity: qty }) : i,
      ),
    );
    this.syncCashPaymentToTotal();
  }

  updateItemPrice(index: number, unitPrice: number): void {
    const price = Math.max(0, Number(unitPrice) || 0);
    this.items.update((list) =>
      list.map((i, iIdx) =>
        iIdx === index ? this.recalculateItem({ ...i, unitPrice: price }) : i,
      ),
    );
    this.syncCashPaymentToTotal();
  }

  removeItem(index: number): void {
    this.items.update((list) => list.filter((_, iIdx) => iIdx !== index));
    this.syncCashPaymentToTotal();
  }

  addPaymentLine(): void {
    const type = this.paymentTypes()[0];
    if (!type) return;
    this.paymentLines.update((lines) => [
      ...lines,
      {
        key: `pay-${Date.now()}`,
        paymentTypeId: type.id,
        amount: null,
        reference: '',
      },
    ]);
  }

  removePaymentLine(key: string): void {
    this.paymentLines.update((lines) =>
      lines.length <= 1 ? lines : lines.filter((l) => l.key !== key),
    );
  }

  updatePayment(
    key: string,
    patch: Partial<Pick<EditPaymentLine, 'paymentTypeId' | 'amount' | 'reference'>>,
  ): void {
    this.paymentLines.update((lines) =>
      lines.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  parseAmount(value: unknown): number | null {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    if (this.items().length === 0) {
      await this.showToast('La venta debe tener al menos un producto', 'warning');
      return;
    }

    const payments: SalePaymentDto[] = this.paymentLines()
      .filter((l) => l.amount !== null && l.amount > 0)
      .map((l) => ({
        paymentTypeId: l.paymentTypeId,
        amount: l.amount as number,
        reference: l.reference.trim() || undefined,
      }));

    if (payments.length === 0) {
      await this.showToast('Indique al menos un pago válido', 'warning');
      return;
    }

    if (this.paidTotal() + 0.001 < this.total()) {
      await this.showToast('El pago es insuficiente para el total', 'warning');
      return;
    }

    this.saving.set(true);
    try {
      const updated = await firstValueFrom(
        this.saleService.adminUpdateSale(this.sale.id!, {
          version: this.sale.version ?? 0,
          customerId: this.sale.customerId,
          notes: this.sale.notes,
          items: this.items(),
          payments,
          subtotal: this.subtotal(),
          taxAmount: this.taxAmount(),
          total: this.total(),
          discountAmount: this.sale.discountAmount ?? 0,
          discountPercent: this.sale.discountPercent ?? 0,
        }),
      );
      await this.modalCtrl.dismiss(updated, 'saved');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToast(message ?? 'No se pudo guardar la venta', 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  private syncCashPaymentToTotal(): void {
    const types = this.paymentTypes();
    const cashType = types.find((t) => t.affectsCash) ?? types[0];
    if (!cashType) return;

    const lines = this.paymentLines();
    if (lines.length === 1) {
      this.paymentLines.set([
        {
          ...lines[0]!,
          paymentTypeId: lines[0]!.paymentTypeId || cashType.id,
          amount: this.total(),
        },
      ]);
    }
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

  /** COP no maneja centavos; ver mismo criterio en pos.page.ts#roundMoney. */
  private roundMoney(value: number): number {
    return Math.round(value);
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
