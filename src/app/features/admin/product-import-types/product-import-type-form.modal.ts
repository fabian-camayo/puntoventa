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
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  checkmarkOutline,
  cloudUploadOutline,
  documentOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  PRODUCT_IMPORT_FIELDS,
  ProductImportFieldKey,
  ProductImportMappings,
  ProductImportTypeDto,
} from '@puntoventa/shared';
import { ProductImportTypeService } from '@core/services/product-import-type.service';

addIcons({ closeOutline, checkmarkOutline, cloudUploadOutline, documentOutline });

@Component({
  selector: 'app-product-import-type-form-modal',
  templateUrl: './product-import-type-form.modal.html',
  styleUrls: ['./product-import-type-form.modal.scss'],
  imports: [
    ReactiveFormsModule,
    FormsModule,
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
    IonToggle,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class ProductImportTypeFormModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly importTypeService = inject(ProductImportTypeService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';
  @Input() importType: ProductImportTypeDto | null = null;

  saving = signal(false);
  readingExcel = signal(false);
  isEdit = false;
  private codeManuallyEdited = false;

  readonly fields = PRODUCT_IMPORT_FIELDS;
  sampleHeaders = signal<string[]>([]);
  mappings = signal<ProductImportMappings>({});
  sampleFileName = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(30)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    description: [''],
    headerRow: [1, [Validators.required, Validators.min(1)]],
    sortOrder: [0, [Validators.min(0)]],
    isActive: [true],
  });

  ngOnInit(): void {
    this.isEdit = !!this.importType;

    if (this.importType) {
      this.form.patchValue({
        code: this.importType.code,
        name: this.importType.name,
        description: this.importType.description ?? '',
        headerRow: this.importType.headerRow ?? 1,
        sortOrder: this.importType.sortOrder ?? 0,
        isActive: this.importType.isActive,
      });
      this.form.controls.code.disable();
      this.codeManuallyEdited = true;
      this.sampleHeaders.set(this.importType.sampleHeaders ?? []);
      this.mappings.set({ ...(this.importType.mappings ?? {}) });
    }

    this.form.controls.name.valueChanges.subscribe((name) => {
      if (this.isEdit || this.codeManuallyEdited) return;
      this.form.controls.code.setValue(this.slugifyCode(name), { emitEvent: false });
    });

    this.form.controls.code.valueChanges.subscribe(() => {
      if (!this.isEdit) this.codeManuallyEdited = true;
    });
  }

  mappingValue(field: ProductImportFieldKey): string {
    return this.mappings()[field] ?? '';
  }

  setMapping(field: ProductImportFieldKey, column: string | null | undefined): void {
    this.mappings.update((current) => {
      const next = { ...current };
      if (!column) delete next[field];
      else next[field] = column;
      return next;
    });
  }

  async onSampleFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    this.readingExcel.set(true);
    this.sampleFileName.set(file.name);
    try {
      const headerRow = Number(this.form.controls.headerRow.value) || 1;
      const result = await firstValueFrom(
        this.importTypeService.previewHeaders(file, headerRow),
      );
      this.sampleHeaders.set(result.headers);
      await this.showToast(`Columnas detectadas: ${result.headers.length}`, 'success');
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudieron leer las columnas del Excel';
      await this.showToast(message, 'danger');
    } finally {
      this.readingExcel.set(false);
      input.value = '';
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

    const mappings = this.mappings();
    for (const field of this.fields.filter((f) => f.required)) {
      if (!mappings[field.key]?.trim()) {
        await this.showToast(`Debe mapear el campo: ${field.label}`, 'danger');
        return;
      }
    }

    if (!this.sampleHeaders().length && !this.isEdit) {
      await this.showToast('Cargue un Excel de muestra para obtener las columnas', 'warning');
      return;
    }

    const raw = this.form.getRawValue();
    this.saving.set(true);

    try {
      if (this.isEdit && this.importType) {
        await firstValueFrom(
          this.importTypeService.update(this.importType.id, {
            name: raw.name,
            description: raw.description || undefined,
            sampleHeaders: this.sampleHeaders(),
            mappings,
            headerRow: Number(raw.headerRow),
            sortOrder: Number(raw.sortOrder),
            isActive: raw.isActive,
          }),
        );
      } else {
        await firstValueFrom(
          this.importTypeService.create({
            branchId: this.branchId,
            code: raw.code.toUpperCase(),
            name: raw.name,
            description: raw.description || undefined,
            sampleHeaders: this.sampleHeaders(),
            mappings,
            headerRow: Number(raw.headerRow),
            sortOrder: Number(raw.sortOrder),
            isActive: raw.isActive,
          }),
        );
      }

      this.dismiss(true);
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar el tipo de importe';
      await this.showToast(message, 'danger');
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

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 3000, color });
    await t.present();
  }
}
