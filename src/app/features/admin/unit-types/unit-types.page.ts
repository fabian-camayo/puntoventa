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
  resizeOutline,
} from 'ionicons/icons';
import { UnitTypeDto } from '@puntoventa/shared';
import { UnitTypeService } from '@core/services/unit-type.service';
import { AuthService } from '@core/services/auth.service';
import { UnitTypeFormModal } from './unit-type-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  resizeOutline,
});

@Component({
  selector: 'app-unit-types',
  templateUrl: './unit-types.page.html',
  styleUrls: ['./unit-types.page.scss'],
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
export class UnitTypesPage implements OnInit, OnDestroy {
  private readonly unitTypeService = inject(UnitTypeService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('unit_types.create');
  readonly canUpdate = this.auth.hasPermission('unit_types.update');
  readonly canDelete = this.auth.hasPermission('unit_types.delete');

  unitTypes = signal<UnitTypeDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  showInactive = signal(false);

  ngOnInit(): void {
    this.setupSearch();
    void this.loadUnitTypes();
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
    void this.loadUnitTypes();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadUnitTypes();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadUnitTypes();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadUnitTypes();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: UnitTypeFormModal,
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadUnitTypes();
      await this.showToast('Tipo de unidad guardado', 'success');
    }
  }

  async openEdit(unitType: UnitTypeDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: UnitTypeFormModal,
      componentProps: { unitType },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadUnitTypes();
      await this.showToast('Tipo de unidad guardado', 'success');
    }
  }

  async confirmDelete(unitType: UnitTypeDto): Promise<void> {
    if (!this.canDelete || !unitType.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar tipo de unidad',
      message: `¿Desactivar "${unitType.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivate(unitType);
          },
        },
      ],
    });
    await alert.present();
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadUnitTypes();
      });
  }

  private loadUnitTypes(): Promise<void> {
    this.loading.set(true);
    return new Promise((resolve) => {
      this.unitTypeService
        .list({
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            const items = this.showInactive()
              ? result.items
              : result.items.filter((p) => p.isActive);
            this.unitTypes.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('Error al cargar tipos de unidad', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivate(unitType: UnitTypeDto): Promise<void> {
    this.unitTypeService.deactivate(unitType.id).subscribe({
      next: async () => {
        await this.loadUnitTypes();
        await this.showToast('Tipo de unidad desactivado', 'success');
      },
      error: async () => {
        await this.showToast('No se pudo desactivar el tipo de unidad', 'danger');
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
