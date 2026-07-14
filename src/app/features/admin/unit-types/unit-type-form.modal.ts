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
import { closeOutline, checkmarkOutline, resizeOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { UnitTypeDto } from '@puntoventa/shared';
import { UnitTypeService } from '@core/services/unit-type.service';

addIcons({ closeOutline, checkmarkOutline, resizeOutline });

@Component({
  selector: 'app-unit-type-form-modal',
  templateUrl: './unit-type-form.modal.html',
  styleUrls: ['./unit-type-form.modal.scss'],
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
export class UnitTypeFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly unitTypeService = inject(UnitTypeService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() unitType: UnitTypeDto | null = null;

  saving = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    sortOrder: [0, [Validators.min(0)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.unitType;

    if (this.unitType) {
      this.form.patchValue({
        code: this.unitType.code,
        name: this.unitType.name,
        description: this.unitType.description ?? '',
        sortOrder: this.unitType.sortOrder ?? 0,
        isActive: this.unitType.isActive,
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
      if (this.isEdit && this.unitType) {
        await firstValueFrom(
          this.unitTypeService.update(this.unitType.id, {
            name: raw.name,
            description: raw.description || undefined,
            sortOrder: Number(raw.sortOrder),
            isActive: raw.isActive,
          }),
        );
      } else {
        await firstValueFrom(
          this.unitTypeService.create({
            code: raw.code.toUpperCase(),
            name: raw.name,
            description: raw.description || undefined,
            sortOrder: Number(raw.sortOrder),
            isActive: raw.isActive,
          }),
        );
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el tipo de unidad';
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
      .slice(0, 20);
  }
}
