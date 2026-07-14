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
  IonToggle,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, cardOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { PaymentTypeDto } from '@puntoventa/shared';
import { PaymentTypeService } from '@core/services/payment-type.service';

addIcons({ closeOutline, checkmarkOutline, cardOutline });

@Component({
  selector: 'app-payment-type-form-modal',
  templateUrl: './payment-type-form.modal.html',
  styleUrls: ['./payment-type-form.modal.scss'],
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
    IonToggle,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class PaymentTypeFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() paymentType: PaymentTypeDto | null = null;

  saving = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    affectsCash: [false],
    sortOrder: [0, [Validators.min(0)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.paymentType;

    if (this.paymentType) {
      this.form.patchValue({
        code: this.paymentType.code,
        name: this.paymentType.name,
        affectsCash: this.paymentType.affectsCash,
        sortOrder: this.paymentType.sortOrder ?? 0,
        isActive: this.paymentType.isActive,
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
      if (this.isEdit && this.paymentType) {
        await firstValueFrom(
          this.paymentTypeService.update(this.paymentType.id, {
            name: raw.name,
            affectsCash: raw.affectsCash,
            sortOrder: Number(raw.sortOrder),
            isActive: raw.isActive,
          }),
        );
      } else {
        await firstValueFrom(
          this.paymentTypeService.create({
            code: raw.code.toUpperCase(),
            name: raw.name,
            affectsCash: raw.affectsCash,
            sortOrder: Number(raw.sortOrder),
            isActive: raw.isActive,
          }),
        );
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el tipo de pago';
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
