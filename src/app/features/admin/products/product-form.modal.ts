import { Component, Input, OnInit, inject, signal } from '@angular/core';
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
  IonToggle,
  IonTextarea,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  pricetagOutline,
  cashOutline,
  layersOutline,
  resizeOutline,
  addOutline,
  trashOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { ProductDto, ProductUnitDto, UnitTypeDto } from '@puntoventa/shared';
import {
  ProductService,
  CreateProductPayload,
  UpdateProductPayload,
} from '@core/services/product.service';
import { UnitTypeService } from '@core/services/unit-type.service';
import { CategoryDto } from '@core/services/category.service';
import { AuthService } from '@core/services/auth.service';
import { ConfigService } from '@core/services/config.service';

addIcons({
  closeOutline,
  checkmarkOutline,
  pricetagOutline,
  cashOutline,
  layersOutline,
  resizeOutline,
  addOutline,
  trashOutline,
});

interface EditableProductUnit {
  unitTypeId: string;
  stockFactor: number;
  isBase: boolean;
}

@Component({
  selector: 'app-product-form-modal',
  templateUrl: './product-form.modal.html',
  styleUrls: ['./product-form.modal.scss'],
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
    IonToggle,
    IonTextarea,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class ProductFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly productService = inject(ProductService);
  private readonly unitTypeService = inject(UnitTypeService);
  private readonly auth = inject(AuthService);
  private readonly configService = inject(ConfigService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  @Input() product: ProductDto | null = null;
  @Input() categories: CategoryDto[] = [];

  saving = signal(false);
  defaultTaxRate = signal(19);
  isEdit = false;
  unitTypes = signal<UnitTypeDto[]>([]);
  productUnits = signal<EditableProductUnit[]>([]);

  readonly canViewCosts = this.auth.hasPermission('products.view_costs');
  readonly canModifyPrices = this.auth.hasPermission('products.modify_prices');

  form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    barcode: [''],
    description: [''],
    salePrice: [0, [Validators.required, Validators.min(0)]],
    costPrice: [0, [Validators.min(0)]],
    applyTax: [true],
    taxRate: [19, [Validators.min(0), Validators.max(100)]],
    baseUnitTypeId: ['', [Validators.required]],
    categoryId: [''],
    minStock: [0, [Validators.min(0)]],
    trackInventory: [true],
    isActive: [true],
  });

  async ngOnInit(): Promise<void> {
    this.isEdit = !!this.product;
    await Promise.all([this.loadDefaultTaxRate(), this.loadUnitTypes()]);

    if (this.product) {
      const rate = this.product.taxRate ?? 0;
      const applyTax = rate > 0;
      const units = this.fromProductUnits(this.product.units);
      const base = units.find((u) => u.isBase) ?? units[0];
      this.productUnits.set(units.filter((u) => !u.isBase));
      this.form.patchValue({
        sku: this.product.sku,
        name: this.product.name,
        barcode: this.product.barcode ?? '',
        description: this.product.description ?? '',
        salePrice: this.product.salePrice,
        costPrice: this.product.costPrice ?? 0,
        applyTax,
        taxRate: applyTax ? rate : this.defaultTaxRate(),
        baseUnitTypeId: base?.unitTypeId ?? '',
        categoryId: this.product.categoryId ?? '',
        minStock: this.product.minStock ?? 0,
        trackInventory: this.product.trackInventory ?? true,
        isActive: this.product.isActive,
      });
      this.form.controls.sku.disable();
    } else {
      const fallback =
        this.unitTypes().find((u) => u.code === 'UND' || u.code === 'PZA') ??
        this.unitTypes()[0];
      this.form.patchValue({
        applyTax: true,
        taxRate: this.defaultTaxRate(),
        baseUnitTypeId: fallback?.id ?? '',
      });
    }

    this.syncTaxRateControl(this.form.controls.applyTax.value);
    this.form.controls.applyTax.valueChanges.subscribe((applyTax) => {
      this.syncTaxRateControl(applyTax);
    });

    if (!this.canModifyPrices) {
      this.form.controls.salePrice.disable();
    }
    if (!this.canViewCosts) {
      this.form.controls.costPrice.disable();
    }
  }

  availableExtraUnitTypes(): UnitTypeDto[] {
    const baseId = this.form.controls.baseUnitTypeId.value;
    const used = new Set(this.productUnits().map((u) => u.unitTypeId));
    return this.unitTypes().filter((u) => u.id !== baseId && !used.has(u.id));
  }

  addExtraUnit(): void {
    const available = this.availableExtraUnitTypes();
    const next = available[0];
    if (!next) return;
    this.productUnits.update((list) => [
      ...list,
      { unitTypeId: next.id, stockFactor: 12, isBase: false },
    ]);
  }

  updateExtraUnit(
    index: number,
    patch: Partial<Pick<EditableProductUnit, 'unitTypeId' | 'stockFactor'>>,
  ): void {
    this.productUnits.update((list) =>
      list.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          unitTypeId: patch.unitTypeId ?? item.unitTypeId,
          stockFactor:
            patch.stockFactor !== undefined
              ? Math.max(0.0001, Number(patch.stockFactor) || 0.0001)
              : item.stockFactor,
        };
      }),
    );
  }

  removeExtraUnit(index: number): void {
    this.productUnits.update((list) => list.filter((_, i) => i !== index));
  }

  dismiss(saved = false): void {
    void this.modalCtrl.dismiss(null, saved ? 'saved' : 'cancel');
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const baseUnitTypeId = raw.baseUnitTypeId;
    if (!baseUnitTypeId) {
      await this.showError('Seleccione la unidad base');
      return;
    }

    const unitsPayload = [
      { unitTypeId: baseUnitTypeId, stockFactor: 1, isBase: true, isActive: true },
      ...this.productUnits().map((u) => ({
        unitTypeId: u.unitTypeId,
        stockFactor: Number(u.stockFactor),
        isBase: false,
        isActive: true,
      })),
    ];

    if (new Set(unitsPayload.map((u) => u.unitTypeId)).size !== unitsPayload.length) {
      await this.showError('No se pueden repetir tipos de unidad');
      return;
    }

    const baseType = this.unitTypes().find((u) => u.id === baseUnitTypeId);
    this.saving.set(true);

    const salePrice = Number(raw.salePrice);
    const costPrice = Number(raw.costPrice);
    const taxRate = raw.applyTax ? Number(raw.taxRate) : 0;
    const minStock = Number(raw.minStock);

    try {
      if (this.isEdit && this.product) {
        const payload: UpdateProductPayload = {
          name: raw.name,
          barcode: raw.barcode || undefined,
          description: raw.description || undefined,
          salePrice,
          costPrice: this.canViewCosts ? costPrice : undefined,
          taxRate,
          unit: baseType?.code,
          categoryId: raw.categoryId || undefined,
          minStock,
          trackInventory: raw.trackInventory,
          isActive: raw.isActive,
          units: unitsPayload,
        };
        await firstValueFrom(this.productService.update(this.product.id, payload));
      } else {
        const payload: CreateProductPayload = {
          branchId: this.branchId,
          sku: raw.sku,
          name: raw.name,
          barcode: raw.barcode || undefined,
          description: raw.description || undefined,
          salePrice,
          costPrice: this.canViewCosts ? costPrice : undefined,
          taxRate,
          unit: baseType?.code,
          categoryId: raw.categoryId || undefined,
          minStock,
          trackInventory: raw.trackInventory,
          units: unitsPayload,
        };
        await firstValueFrom(this.productService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el producto';
      await this.showError(message);
    } finally {
      this.saving.set(false);
    }
  }

  private fromProductUnits(units?: ProductUnitDto[]): EditableProductUnit[] {
    if (units?.length) {
      return units.map((u) => ({
        unitTypeId: u.unitTypeId,
        stockFactor: u.stockFactor,
        isBase: u.isBase,
      }));
    }
    const fallback =
      this.unitTypes().find((u) => u.code === 'UND' || u.code === 'PZA') ??
      this.unitTypes()[0];
    return fallback
      ? [{ unitTypeId: fallback.id, stockFactor: 1, isBase: true }]
      : [];
  }

  private async loadUnitTypes(): Promise<void> {
    try {
      const items = await firstValueFrom(this.unitTypeService.listActive());
      this.unitTypes.set(items);
    } catch {
      this.unitTypes.set([]);
    }
  }

  private async loadDefaultTaxRate(): Promise<void> {
    if (!this.branchId) return;
    try {
      const config = await firstValueFrom(
        this.configService.getBusinessConfig(this.branchId),
      );
      this.defaultTaxRate.set(config.taxRate);
    } catch {
      // keep fallback default
    }
  }

  private syncTaxRateControl(applyTax: boolean): void {
    const taxControl = this.form.controls.taxRate;
    if (applyTax) {
      taxControl.enable({ emitEvent: false });
      if (!taxControl.value) {
        taxControl.setValue(this.defaultTaxRate(), { emitEvent: false });
      }
    } else {
      taxControl.disable({ emitEvent: false });
    }
  }

  private async showError(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
    await t.present();
  }
}
