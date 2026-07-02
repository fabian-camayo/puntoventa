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
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, personOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  CreateUserPayload,
  UpdateUserPayload,
  UserDto,
  UserService,
} from '@core/services/user.service';
import { RoleDto, RoleService } from '@core/services/role.service';

addIcons({ closeOutline, checkmarkOutline, personOutline });

@Component({
  selector: 'app-user-form-modal',
  templateUrl: './user-form.modal.html',
  styleUrls: ['./user-form.modal.scss'],
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
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class UserFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly userService = inject(UserService);
  private readonly roleService = inject(RoleService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() companyId = '';
  @Input() user: UserDto | null = null;

  saving = signal(false);
  loadingRoles = signal(true);
  isEdit = false;
  roles = signal<RoleDto[]>([]);

  form = this.fb.nonNullable.group({
    username: ['', [Validators.required, Validators.maxLength(50)]],
    password: ['', [Validators.minLength(6)]],
    firstName: ['', [Validators.required, Validators.maxLength(80)]],
    lastName: ['', [Validators.required, Validators.maxLength(80)]],
    email: ['', [Validators.email]],
    pin: [''],
    roleIds: [[] as string[]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.user;

    if (this.isEdit) {
      this.form.controls.username.disable();
      this.form.controls.password.clearValidators();
      this.form.controls.password.updateValueAndValidity();
    } else {
      this.form.controls.password.setValidators([Validators.required, Validators.minLength(6)]);
      this.form.controls.password.updateValueAndValidity();
    }

    if (this.user) {
      this.form.patchValue({
        username: this.user.username,
        firstName: this.user.firstName,
        lastName: this.user.lastName,
        email: this.user.email ?? '',
        roleIds: this.user.roles?.map((r) => r.id) ?? [],
        isActive: this.user.isActive,
      });
    }

    void this.loadRoles();
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
      if (this.isEdit && this.user) {
        const payload: UpdateUserPayload = {
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email || undefined,
          pin: raw.pin || undefined,
          isActive: raw.isActive,
          roleIds: raw.roleIds,
        };
        if (raw.password) payload.password = raw.password;
        await firstValueFrom(this.userService.update(this.user.id, payload));
      } else {
        const payload: CreateUserPayload = {
          companyId: this.companyId,
          username: raw.username,
          password: raw.password,
          firstName: raw.firstName,
          lastName: raw.lastName,
          email: raw.email || undefined,
          pin: raw.pin || undefined,
          isActive: raw.isActive,
          roleIds: raw.roleIds.length ? raw.roleIds : undefined,
        };
        await firstValueFrom(this.userService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el usuario';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }

  private async loadRoles(): Promise<void> {
    this.loadingRoles.set(true);
    try {
      const items = await firstValueFrom(this.roleService.listAll());
      this.roles.set(items.filter((r) => r.isActive));
    } catch {
      this.roles.set([]);
    } finally {
      this.loadingRoles.set(false);
    }
  }
}
