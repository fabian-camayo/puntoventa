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
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, folderOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  CategoryDto,
  CategoryService,
  CreateCategoryPayload,
  UpdateCategoryPayload,
} from '@core/services/category.service';

addIcons({ closeOutline, checkmarkOutline, folderOutline });

@Component({
  selector: 'app-category-form-modal',
  templateUrl: './category-form.modal.html',
  styleUrls: ['./category-form.modal.scss'],
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
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class CategoryFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly categoryService = inject(CategoryService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  @Input() category: CategoryDto | null = null;
  @Input() categories: CategoryDto[] = [];

  saving = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(120)]],
    description: [''],
    parentId: [''],
    sortOrder: [0, [Validators.min(0)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.category;

    if (this.category) {
      this.form.patchValue({
        code: this.category.code,
        name: this.category.name,
        description: this.category.description ?? '',
        parentId: this.category.parentId ?? '',
        sortOrder: this.category.sortOrder ?? 0,
        isActive: this.category.isActive,
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

  get parentOptions(): CategoryDto[] {
    if (!this.category) return this.categories.filter((c) => c.isActive);
    return this.categories.filter((c) => c.isActive && c.id !== this.category!.id);
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
      if (this.isEdit && this.category) {
        const payload: UpdateCategoryPayload = {
          name: raw.name,
          description: raw.description || undefined,
          parentId: raw.parentId || undefined,
          sortOrder: Number(raw.sortOrder),
          isActive: raw.isActive,
        };
        await firstValueFrom(this.categoryService.update(this.category.id, payload));
      } else {
        const payload: CreateCategoryPayload = {
          branchId: this.branchId,
          code: raw.code.toUpperCase(),
          name: raw.name,
          description: raw.description || undefined,
          parentId: raw.parentId || undefined,
          sortOrder: Number(raw.sortOrder),
          isActive: raw.isActive,
        };
        await firstValueFrom(this.categoryService.create(payload));
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar la categoría';
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
