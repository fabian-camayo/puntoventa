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
  IonCheckbox,
  IonSearchbar,
  IonLabel,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, cashOutline, peopleOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { RegisterDto } from '@puntoventa/shared';
import { RegisterService, SaveRegisterPayload } from '@core/services/register.service';
import { UserDto, UserService } from '@core/services/user.service';

addIcons({ closeOutline, checkmarkOutline, cashOutline, peopleOutline });

@Component({
  selector: 'app-register-form-modal',
  templateUrl: './register-form.modal.html',
  styleUrls: ['./register-form.modal.scss'],
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
    IonCheckbox,
    IonSearchbar,
    IonLabel,
    TranslateModule,
  ],
})
export class RegisterFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly registerService = inject(RegisterService);
  private readonly userService = inject(UserService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() register: RegisterDto | null = null;
  @Input() branchId = '';

  saving = signal(false);
  isEdit = false;
  users = signal<UserDto[]>([]);
  filteredUsers = signal<UserDto[]>([]);
  selectedUserIds = signal<Set<string>>(new Set());
  loadingUsers = signal(false);

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.register;

    if (this.register) {
      this.form.patchValue({
        code: this.register.code,
        name: this.register.name,
        description: this.register.description ?? '',
        isActive: this.register.isActive,
      });
      this.form.controls.code.disable();
      this.selectedUserIds.set(new Set(this.register.assignedUserIds ?? []));
    }

    void this.loadUsers();
  }

  private async loadUsers(): Promise<void> {
    this.loadingUsers.set(true);
    try {
      const result = await firstValueFrom(this.userService.list({ limit: 200 }));
      const active = result.items.filter((u) => u.isActive);
      this.users.set(active);
      this.filteredUsers.set(active);
    } catch {
      // ignore
    } finally {
      this.loadingUsers.set(false);
    }
  }

  onUserSearch(event: CustomEvent): void {
    const value = ((event.detail as { value?: string }).value ?? '').toLowerCase();
    if (!value) {
      this.filteredUsers.set(this.users());
      return;
    }
    this.filteredUsers.set(
      this.users().filter(
        (u) =>
          u.username.toLowerCase().includes(value) ||
          `${u.firstName} ${u.lastName}`.toLowerCase().includes(value),
      ),
    );
  }

  isSelected(userId: string): boolean {
    return this.selectedUserIds().has(userId);
  }

  toggleUser(userId: string): void {
    const next = new Set(this.selectedUserIds());
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    this.selectedUserIds.set(next);
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
    const userIds = Array.from(this.selectedUserIds());
    this.saving.set(true);

    try {
      if (this.isEdit && this.register) {
        const payload: SaveRegisterPayload = {
          name: raw.name,
          description: raw.description || undefined,
          isActive: raw.isActive,
          userIds,
        };
        await firstValueFrom(this.registerService.updateRegister(this.register.id, payload));
      } else {
        const payload: SaveRegisterPayload = {
          branchId: this.branchId,
          code: raw.code.toUpperCase(),
          name: raw.name,
          description: raw.description || undefined,
          isActive: raw.isActive,
          userIds,
        };
        await firstValueFrom(this.registerService.createRegister(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar la caja';
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }
}
