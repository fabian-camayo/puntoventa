import { Component, Input, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonIcon,
  IonSpinner,
  IonLabel,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, cloudUploadOutline } from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { ProductImportResult, ProductImportTypeDto } from '@puntoventa/shared';
import { ProductImportTypeService } from '@core/services/product-import-type.service';

addIcons({ closeOutline, checkmarkOutline, cloudUploadOutline });

@Component({
  selector: 'app-product-import-modal',
  templateUrl: './product-import.modal.html',
  styleUrls: ['./product-import.modal.scss'],
  imports: [
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonIcon,
    IonSpinner,
    IonLabel,
    TranslateModule,
  ],
})
export class ProductImportModal implements OnInit {
  private readonly importTypeService = inject(ProductImportTypeService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);

  @Input() branchId = '';

  loadingTypes = signal(false);
  importing = signal(false);
  importTypes = signal<ProductImportTypeDto[]>([]);
  selectedTypeId = signal<string>('');
  updateExisting = signal(true);
  selectedFile = signal<File | null>(null);
  result = signal<ProductImportResult | null>(null);

  ngOnInit(): void {
    void this.loadTypes();
  }

  dismiss(imported = false): void {
    void this.modalCtrl.dismiss(
      imported ? this.result() : null,
      imported ? 'imported' : 'cancel',
    );
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.result.set(null);
  }

  async import(): Promise<void> {
    const typeId = this.selectedTypeId();
    const file = this.selectedFile();
    if (!typeId) {
      await this.showToast('Seleccione un tipo de importe', 'warning');
      return;
    }
    if (!file) {
      await this.showToast('Seleccione un archivo Excel', 'warning');
      return;
    }

    this.importing.set(true);
    try {
      const res = await firstValueFrom(
        this.importTypeService.importProducts(
          typeId,
          this.branchId,
          file,
          this.updateExisting(),
        ),
      );
      this.result.set(res);
      const msg = `Importación: ${res.created} creados, ${res.updated} actualizados, ${res.errors.length} errores`;
      await this.showToast(msg, res.errors.length ? 'warning' : 'success');
      if (!res.errors.length) {
        this.dismiss(true);
      }
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo importar el archivo';
      await this.showToast(message, 'danger');
    } finally {
      this.importing.set(false);
    }
  }

  private async loadTypes(): Promise<void> {
    if (!this.branchId) return;
    this.loadingTypes.set(true);
    try {
      const items = await firstValueFrom(
        this.importTypeService.listActive(this.branchId),
      );
      this.importTypes.set(items);
      if (items[0]) this.selectedTypeId.set(items[0].id);
    } catch {
      this.importTypes.set([]);
      await this.showToast('No se pudieron cargar los tipos de importe', 'danger');
    } finally {
      this.loadingTypes.set(false);
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 3500, color });
    await t.present();
  }
}
