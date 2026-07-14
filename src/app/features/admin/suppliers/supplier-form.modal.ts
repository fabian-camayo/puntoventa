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
  IonTextarea,
  IonToggle,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, businessOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  CreateSupplierPayload,
  SupplierDto,
  SupplierService,
  UpdateSupplierPayload,
} from '@core/services/supplier.service';

addIcons({ closeOutline, checkmarkOutline, businessOutline });

@Component({
  selector: 'app-supplier-form-modal',
  templateUrl: './supplier-form.modal.html',
  styleUrls: ['./supplier-form.modal.scss'],
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
    IonTextarea,
    IonToggle,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class SupplierFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly supplierService = inject(SupplierService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  @Input() supplier: SupplierDto | null = null;

  saving = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    taxId: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email, Validators.maxLength(120)]],
    phone: ['', [Validators.maxLength(40)]],
    address: ['', [Validators.maxLength(250)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.supplier;

    if (this.supplier) {
      this.form.patchValue({
        code: this.supplier.code,
        name: this.supplier.name,
        taxId: this.supplier.taxId ?? '',
        email: this.supplier.email ?? '',
        phone: this.supplier.phone ?? '',
        address: this.supplier.address ?? '',
        isActive: this.supplier.isActive,
      });
      this.form.controls.code.disable();
      this.codeManuallyEdited = true;
    }

    this.form.controls.name.valueChanges.subscribe((name) => {
      if (this.isEdit || this.codeManuallyEdited) return;
      this.form.controls.code.setValue(this.slugifyCode(name), { emitEvent: false });
    });

    this.form.controls.code.valueChanges.subscribe(() => {
      if (!this.isEdit) this.codeManuallyEdited = true;
    });
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

    try {
      if (this.isEdit && this.supplier) {
        const payload: UpdateSupplierPayload = {
          name: raw.name,
          taxId: raw.taxId || undefined,
          email: raw.email || undefined,
          phone: raw.phone || undefined,
          address: raw.address || undefined,
          isActive: raw.isActive,
        };
        await firstValueFrom(this.supplierService.update(this.supplier.id, payload));
      } else {
        const payload: CreateSupplierPayload = {
          branchId: this.branchId,
          code: raw.code.toUpperCase(),
          name: raw.name,
          taxId: raw.taxId || undefined,
          email: raw.email || undefined,
          phone: raw.phone || undefined,
          address: raw.address || undefined,
          isActive: raw.isActive,
        };
        await firstValueFrom(this.supplierService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el proveedor';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }

  private slugifyCode(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 30);
  }
}
