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
import { closeOutline, checkmarkOutline, walletOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { BankAccountDto } from '@puntoventa/shared';
import { BankAccountService } from '@core/services/bank-account.service';
import { FieldErrorComponent } from '@shared/components/field-error/field-error.component';
import { isControlInvalid, notifyInvalidForm } from '@shared/utils/form-validation';

addIcons({ closeOutline, checkmarkOutline, walletOutline });

@Component({
  selector: 'app-bank-account-form-modal',
  templateUrl: './bank-account-form.modal.html',
  styleUrls: ['./bank-account-form.modal.scss'],
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
    FieldErrorComponent,
  ],
})
export class BankAccountFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly bankAccountService = inject(BankAccountService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  @Input() account: BankAccountDto | null = null;

  saving = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;
  readonly isInvalid = isControlInvalid;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    bankName: ['', [Validators.maxLength(150)]],
    accountNumber: ['', [Validators.maxLength(50)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.account;

    if (this.account) {
      this.form.patchValue({
        code: this.account.code,
        name: this.account.name,
        bankName: this.account.bankName ?? '',
        accountNumber: this.account.accountNumber ?? '',
        isActive: this.account.isActive,
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
    if (await notifyInvalidForm(this.form, this.toast)) return;
    if (!this.branchId && !this.isEdit) {
      await this.showError('No se pudo determinar la sucursal');
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);

    try {
      if (this.isEdit && this.account) {
        await firstValueFrom(
          this.bankAccountService.update(this.account.id, {
            name: raw.name,
            bankName: raw.bankName.trim() || null,
            accountNumber: raw.accountNumber.trim() || null,
            isActive: raw.isActive,
          }),
        );
      } else {
        await firstValueFrom(
          this.bankAccountService.create({
            branchId: this.branchId,
            code: raw.code.toUpperCase(),
            name: raw.name,
            bankName: raw.bankName.trim() || undefined,
            accountNumber: raw.accountNumber.trim() || undefined,
            isActive: raw.isActive,
          }),
        );
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar la cuenta bancaria';
      await this.showError(message);
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

  private async showError(message: string): Promise<void> {
    const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
    await t.present();
  }
}
