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
import { closeOutline, checkmarkOutline, shieldOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  CreateRolePayload,
  RoleDto,
  RoleService,
  UpdateRolePayload,
} from '@core/services/role.service';

addIcons({ closeOutline, checkmarkOutline, shieldOutline });

@Component({
  selector: 'app-role-form-modal',
  templateUrl: './role-form.modal.html',
  styleUrls: ['./role-form.modal.scss'],
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
export class RoleFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly roleService = inject(RoleService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() role: RoleDto | null = null;

  saving = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.role;

    if (this.role) {
      this.form.patchValue({
        code: this.role.code,
        name: this.role.name,
        description: this.role.description ?? '',
        isActive: this.role.isActive,
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
      if (this.isEdit && this.role) {
        const payload: UpdateRolePayload = {
          name: raw.name,
          description: raw.description || undefined,
          isActive: raw.isActive,
        };
        await firstValueFrom(this.roleService.update(this.role.id, payload));
      } else {
        const payload: CreateRolePayload = {
          code: raw.code.toUpperCase(),
          name: raw.name,
          description: raw.description || undefined,
          isActive: raw.isActive,
        };
        await firstValueFrom(this.roleService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el rol';
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
      .slice(0, 40);
  }
}
