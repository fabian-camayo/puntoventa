import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonChip,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ModalController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cloudUploadOutline,
} from 'ionicons/icons';
import { ProductImportTypeDto } from '@puntoventa/shared';
import { ProductImportTypeService } from '@core/services/product-import-type.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { ProductImportTypeFormModal } from './product-import-type-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cloudUploadOutline,
});

@Component({
  selector: 'app-product-import-types',
  templateUrl: './product-import-types.page.html',
  styleUrls: ['./product-import-types.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonChip,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
  ],
})
export class ProductImportTypesPage implements OnInit, OnDestroy {
  private readonly importTypeService = inject(ProductImportTypeService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('product_import_types.create');
  readonly canUpdate = this.auth.hasPermission('product_import_types.update');
  readonly canDelete = this.auth.hasPermission('product_import_types.delete');

  branchId = signal<string | null>(null);
  importTypes = signal<ProductImportTypeDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  showInactive = signal(false);

  ngOnInit(): void {
    this.setupSearch();
    this.loadBranchContext();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearchInput(event: CustomEvent): void {
    const value = (event.detail as { value?: string }).value ?? '';
    this.searchQuery.set(value);
    this.search$.next(value);
  }

  setActiveFilter(activeOnly: boolean): void {
    const showInactive = !activeOnly;
    if (this.showInactive() === showInactive) return;
    this.showInactive.set(showInactive);
    this.page.set(1);
    void this.loadImportTypes();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadImportTypes();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadImportTypes();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadImportTypes();
    }
  }

  mappedCount(item: ProductImportTypeDto): number {
    return Object.values(item.mappings ?? {}).filter((v) => !!v).length;
  }

  async openCreate(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return;
    const modal = await this.modalCtrl.create({
      component: ProductImportTypeFormModal,
      componentProps: { branchId },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadImportTypes();
      await this.showToast('Tipo de importe guardado', 'success');
    }
  }

  async openEdit(item: ProductImportTypeDto): Promise<void> {
    if (!this.canUpdate) return;
    const branchId = this.branchId();
    if (!branchId) return;

    const modal = await this.modalCtrl.create({
      component: ProductImportTypeFormModal,
      componentProps: { branchId, importType: item },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadImportTypes();
      await this.showToast('Tipo de importe guardado', 'success');
    }
  }

  async confirmDelete(item: ProductImportTypeDto): Promise<void> {
    if (!this.canDelete || !item.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar tipo de importe',
      message: `¿Desactivar "${item.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivate(item);
          },
        },
      ],
    });
    await alert.present();
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadImportTypes();
      },
      error: async () => {
        await this.showToast('No se pudo cargar el contexto de sucursal', 'danger');
      },
    });
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadImportTypes();
      });
  }

  private loadImportTypes(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.importTypeService
        .list({
          branchId,
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            const items = this.showInactive()
              ? result.items
              : result.items.filter((p) => p.isActive);
            this.importTypes.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('Error al cargar tipos de importe', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivate(item: ProductImportTypeDto): Promise<void> {
    this.importTypeService.deactivate(item.id).subscribe({
      next: async () => {
        await this.loadImportTypes();
        await this.showToast('Tipo de importe desactivado', 'success');
      },
      error: async () => {
        await this.showToast('No se pudo desactivar el tipo de importe', 'danger');
      },
    });
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
