import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  NavController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { addIcons } from 'ionicons';
import {
  cloudUploadOutline,
  settingsOutline,
  documentOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { ProductImportResult, ProductImportTypeDto } from '@puntoventa/shared';
import { ProductImportTypeService } from '@core/services/product-import-type.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';

addIcons({ cloudUploadOutline, settingsOutline, documentOutline });

@Component({
  selector: 'app-product-import',
  templateUrl: './product-import.page.html',
  styleUrls: ['./product-import.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
  ],
})
export class ProductImportPage implements OnInit {
  private readonly importTypeService = inject(ProductImportTypeService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly navCtrl = inject(NavController);
  private readonly toast = inject(ToastController);

  readonly canConfigure = this.auth.hasPermission('product_import_types.view');
  readonly canImport = this.auth.hasPermission('products.import');

  branchId = signal<string | null>(null);
  loadingTypes = signal(false);
  importing = signal(false);
  importTypes = signal<ProductImportTypeDto[]>([]);
  selectedTypeId = signal<string>('');
  updateExisting = signal(true);
  selectedFile = signal<File | null>(null);
  result = signal<ProductImportResult | null>(null);

  ngOnInit(): void {
    this.loadBranchContext();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadTypes();
    (event.target as HTMLIonRefresherElement).complete();
  }

  goToImportTypes(): void {
    void this.navCtrl.navigateRoot('/admin/product-import-types', {
      animated: true,
      animationDirection: 'forward',
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.result.set(null);
  }

  async import(): Promise<void> {
    if (!this.canImport) return;
    const branchId = this.branchId();
    const typeId = this.selectedTypeId();
    const file = this.selectedFile();
    if (!branchId) {
      await this.showToast('No hay sucursal activa', 'danger');
      return;
    }
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
          branchId,
          file,
          this.updateExisting(),
        ),
      );
      this.result.set(res);
      await this.showToast(
        `Importación: ${res.created} creados, ${res.updated} actualizados, ${res.errors.length} errores`,
        res.errors.length ? 'warning' : 'success',
      );
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo importar el archivo';
      await this.showToast(message, 'danger');
    } finally {
      this.importing.set(false);
    }
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadTypes();
      },
      error: async () => {
        await this.showToast('No se pudo cargar el contexto de sucursal', 'danger');
      },
    });
  }

  private async loadTypes(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return;
    this.loadingTypes.set(true);
    try {
      const items = await firstValueFrom(
        this.importTypeService.listActive(branchId),
      );
      this.importTypes.set(items);
      if (items[0] && !this.selectedTypeId()) {
        this.selectedTypeId.set(items[0].id);
      }
    } catch {
      this.importTypes.set([]);
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
