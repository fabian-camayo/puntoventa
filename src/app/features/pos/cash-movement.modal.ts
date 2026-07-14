import { Component, Input, inject, signal } from '@angular/core';
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
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, cashOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { RegisterService } from '@core/services/register.service';

addIcons({ closeOutline, checkmarkOutline, cashOutline });

@Component({
  selector: 'app-cash-movement-modal',
  templateUrl: './cash-movement.modal.html',
  styleUrls: ['./cash-movement.modal.scss'],
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
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class CashMovementModal {
  private readonly fb = inject(FormBuilder);
  private readonly registerService = inject(RegisterService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() sessionId = '';

  saving = signal(false);

  form = this.fb.nonNullable.group({
    type: ['WITHDRAWAL' as 'WITHDRAWAL' | 'DEPOSIT', Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    description: ['', [Validators.maxLength(500)]],
  });

  dismiss(saved = false): void {
    void this.modalCtrl.dismiss(null, saved ? 'saved' : 'cancel');
  }

  async save(): Promise<void> {
    if (this.form.invalid || !this.sessionId) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);

    try {
      await firstValueFrom(
        this.registerService.createCashMovement(this.sessionId, {
          type: raw.type,
          amount: Number(raw.amount),
          description: raw.description.trim() || undefined,
        }),
      );
      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo registrar el movimiento';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }
}
