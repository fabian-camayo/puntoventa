import { Component, Input, OnInit, inject, signal, computed } from '@angular/core';
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
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, cashOutline, lockClosedOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { RegisterSessionDto } from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';

addIcons({ closeOutline, checkmarkOutline, cashOutline, lockClosedOutline });

@Component({
  selector: 'app-register-session-modal',
  templateUrl: './register-session.modal.html',
  styleUrls: ['./register-session.modal.scss'],
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
    IonIcon,
    IonSpinner,
    TranslateModule,
    DecimalPipe,
  ],
})
export class RegisterSessionModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registerService = inject(RegisterService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() mode: 'open' | 'close' = 'open';
  @Input() registerId = '';
  @Input() registerName = '';
  @Input() session: RegisterSessionDto | null = null;

  saving = signal(false);

  form = this.fb.nonNullable.group({
    openingAmount: [0, [Validators.required, Validators.min(0)]],
    closingAmount: [0, [Validators.required, Validators.min(0)]],
    notes: [''],
  });

  difference = computed(() => {
    if (this.mode !== 'close' || !this.session) return 0;
    const closing = Number(this.form.controls.closingAmount.value) || 0;
    const expected = this.session.expectedAmount ?? 0;
    return closing - expected;
  });

  ngOnInit(): void {
    if (this.mode === 'close' && this.session) {
      const expected = this.session.expectedAmount ?? 0;
      this.form.controls.closingAmount.setValue(expected);
      this.form.controls.openingAmount.disable();
    } else {
      this.form.controls.closingAmount.disable();
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

    try {
      if (this.mode === 'open') {
        await firstValueFrom(
          this.registerService.openSession({
            registerId: this.registerId,
            openingAmount: Number(raw.openingAmount),
            notes: raw.notes || undefined,
          }),
        );
      } else if (this.session) {
        await firstValueFrom(
          this.registerService.closeSession({
            sessionId: this.session.id,
            closingAmount: Number(raw.closingAmount),
            notes: raw.notes || undefined,
          }),
        );
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo completar la operación';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }
}
