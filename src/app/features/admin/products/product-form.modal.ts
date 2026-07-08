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
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  pricetagOutline,
  cashOutline,
  layersOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { ProductDto } from '@puntoventa/shared';
import {
  ProductService,
  CreateProductPayload,
  UpdateProductPayload,
} from '@core/services/product.service';
import { CategoryDto } from '@core/services/category.service';
import { AuthService } from '@core/services/auth.service';
import { ConfigService } from '@core/services/config.service';

addIcons({
  closeOutline,
  checkmarkOutline,
  pricetagOutline,
  cashOutline,
  layersOutline,
});

@Component({
  selector: 'app-product-form-modal',
  templateUrl: './product-form.modal.html',
  styleUrls: ['./product-form.modal.scss'],
  imports: [
    ReactiveFormsModule,
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
    unit: ['UND', [Validators.required]],
    categoryId: [''],
    minStock: [0, [Validators.min(0)]],
    trackInventory: [true],
    isActive: [true],
  });

  async ngOnInit(): Promise<void> {
    this.isEdit = !!this.product;
    await this.loadDefaultTaxRate();

    if (this.product) {
      const rate = this.product.taxRate ?? 0;
      const applyTax = rate > 0;
      this.form.patchValue({
        sku: this.product.sku,
        name: this.product.name,
        barcode: this.product.barcode ?? '',
        description: this.product.description ?? '',
        salePrice: this.product.salePrice,
        costPrice: this.product.costPrice ?? 0,
        applyTax,
        taxRate: applyTax ? rate : this.defaultTaxRate(),
        unit: this.product.unit,
        categoryId: this.product.categoryId ?? '',
        minStock: this.product.minStock ?? 0,
        trackInventory: true,
        isActive: this.product.isActive,
      });
      this.form.controls.sku.disable();
    } else {
      this.form.patchValue({
        applyTax: true,
        taxRate: this.defaultTaxRate(),
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

  dismiss(saved = false): void {
    void this.modalCtrl.dismiss(null, saved ? 'saved' : 'cancel');
  }

  async save(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
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
          unit: raw.unit,
          categoryId: raw.categoryId || undefined,
          minStock,
          trackInventory: raw.trackInventory,
          isActive: raw.isActive,
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
          unit: raw.unit,
          categoryId: raw.categoryId || undefined,
          minStock,
          trackInventory: raw.trackInventory,
        };
        await firstValueFrom(this.productService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message
        ?? 'No se pudo guardar el producto';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }
}
