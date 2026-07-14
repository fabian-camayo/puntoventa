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
import { closeOutline, checkmarkOutline, peopleOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  CreateCustomerPayload,
  CustomerDto,
  CustomerService,
  UpdateCustomerPayload,
} from '@core/services/customer.service';

addIcons({ closeOutline, checkmarkOutline, peopleOutline });

@Component({
  selector: 'app-customer-form-modal',
  templateUrl: './customer-form.modal.html',
  styleUrls: ['./customer-form.modal.scss'],
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
export class CustomerFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly customerService = inject(CustomerService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  @Input() customer: CustomerDto | null = null;

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
    creditLimit: [null as number | null],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.customer;

    if (this.customer) {
      this.form.patchValue({
        code: this.customer.code,
        name: this.customer.name,
        taxId: this.customer.taxId ?? '',
        email: this.customer.email ?? '',
        phone: this.customer.phone ?? '',
        address: this.customer.address ?? '',
        creditLimit: this.customer.creditLimit ?? null,
        isActive: this.customer.isActive,
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
      const creditLimit =
        raw.creditLimit !== null && raw.creditLimit !== undefined && String(raw.creditLimit) !== ''
          ? Number(raw.creditLimit)
          : undefined;

      if (this.isEdit && this.customer) {
        const payload: UpdateCustomerPayload = {
          name: raw.name,
          taxId: raw.taxId || undefined,
          email: raw.email || undefined,
          phone: raw.phone || undefined,
          address: raw.address || undefined,
          creditLimit,
          isActive: raw.isActive,
        };
        await firstValueFrom(this.customerService.update(this.customer.id, payload));
      } else {
        const payload: CreateCustomerPayload = {
          branchId: this.branchId,
          code: raw.code.toUpperCase(),
          name: raw.name,
          taxId: raw.taxId || undefined,
          email: raw.email || undefined,
          phone: raw.phone || undefined,
          address: raw.address || undefined,
          creditLimit,
          isActive: raw.isActive,
        };
        await firstValueFrom(this.customerService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el cliente';
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
