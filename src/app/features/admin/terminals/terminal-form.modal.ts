import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
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
  desktopOutline,
  wifiOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  pulseOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { isValidIPv4, TerminalDto } from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';
import { FieldErrorComponent } from '@shared/components/field-error/field-error.component';
import { isControlInvalid, notifyInvalidForm } from '@shared/utils/form-validation';

addIcons({
  closeOutline,
  checkmarkOutline,
  desktopOutline,
  wifiOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  pulseOutline,
});

function ipv4Validator(control: AbstractControl): ValidationErrors | null {
  const value = (control.value ?? '').trim();
  if (!value) return null;
  return isValidIPv4(value) ? null : { ipv4: true };
}

type CheckState = 'idle' | 'checking' | 'ok' | 'fail';

@Component({
  selector: 'app-terminal-form-modal',
  templateUrl: './terminal-form.modal.html',
  styleUrls: ['./terminal-form.modal.scss'],
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
    IonIcon,
    IonSpinner,
    TranslateModule,
    FieldErrorComponent,
  ],
})
export class TerminalFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registerService = inject(RegisterService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  /** Prefijo opcional cuando se abre desde "Computadores detectados en red". */
  @Input() prefillIp = '';

  saving = signal(false);
  checkState = signal<CheckState>('idle');
  checkedIp = signal('');
  checkMessage = signal('');
  latencyMs = signal<number | undefined>(undefined);
  readonly isInvalid = isControlInvalid;

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    ipAddress: ['', [Validators.required, ipv4Validator]],
  });

  ngOnInit(): void {
    if (this.prefillIp) {
      this.form.controls.ipAddress.setValue(this.prefillIp);
    }
    this.form.controls.ipAddress.valueChanges.subscribe(() => {
      // Cualquier edición a la IP invalida una verificación previa: no se
      // puede crear la terminal con una IP distinta a la que se comprobó.
      if (this.checkState() !== 'idle') {
        this.checkState.set('idle');
      }
    });
  }

  get canVerify(): boolean {
    const ip = this.form.controls.ipAddress.value.trim();
    return !!ip && isValidIPv4(ip) && this.checkState() !== 'checking';
  }

  get canCreate(): boolean {
    return (
      this.checkState() === 'ok' &&
      this.checkedIp() === this.form.controls.ipAddress.value.trim() &&
      !!this.form.controls.name.value.trim()
    );
  }

  async verify(): Promise<void> {
    const ip = this.form.controls.ipAddress.value.trim();
    if (!ip || !isValidIPv4(ip) || !this.branchId) return;

    this.checkState.set('checking');
    this.checkMessage.set('');
    try {
      const result = await firstValueFrom(this.registerService.checkTerminalIp(this.branchId, ip));
      this.checkedIp.set(ip);
      this.latencyMs.set(result.latencyMs);
      if (result.ok) {
        this.checkState.set('ok');
      } else {
        this.checkState.set('fail');
        this.checkMessage.set(
          result.message ??
            (result.alreadyRegistered
              ? 'Esta IP ya está registrada como terminal.'
              : 'No se pudo conectar con el computador.'),
        );
      }
    } catch (err: unknown) {
      this.checkState.set('fail');
      const message = (err as { error?: { message?: string } })?.error?.message;
      this.checkMessage.set(message ?? 'No se pudo verificar la IP.');
    }
  }

  dismiss(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    if (await notifyInvalidForm(this.form, this.toast)) return;
    if (!this.canCreate) {
      const t = await this.toast.create({
        message: 'Verifique la conexión antes de crear la terminal.',
        duration: 2500,
        color: 'warning',
      });
      await t.present();
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);
    try {
      const created: TerminalDto = await firstValueFrom(
        this.registerService.createTerminal({
          branchId: this.branchId,
          name: raw.name.trim(),
          ipAddress: raw.ipAddress.trim(),
        }),
      );
      void this.modalCtrl.dismiss(created, 'saved');
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ?? 'No se pudo crear la terminal';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }
}
