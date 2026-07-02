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
  folderOutline,
} from 'ionicons/icons';
import { CategoryDto, CategoryService } from '@core/services/category.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { CategoryFormModal } from './category-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  folderOutline,
});

@Component({
  selector: 'app-categories',
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss'],
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
export class CategoriesPage implements OnInit, OnDestroy {
  private readonly categoryService = inject(CategoryService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('categories.create');
  readonly canUpdate = this.auth.hasPermission('categories.update');
  readonly canDelete = this.auth.hasPermission('categories.delete');

  branchId = signal<string | null>(null);
  categories = signal<CategoryDto[]>([]);
  allCategories = signal<CategoryDto[]>([]);
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
    this.loadCategories();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadCategories();
    await this.loadAllCategories();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadCategories();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadCategories();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: CategoryFormModal,
      componentProps: {
        branchId: this.branchId(),
        categories: this.allCategories(),
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadCategories();
      await this.loadAllCategories();
      await this.showToast('CATEGORIES.SAVED_OK', 'success');
    }
  }

  async openEdit(category: CategoryDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: CategoryFormModal,
      componentProps: {
        branchId: this.branchId(),
        category,
        categories: this.allCategories(),
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadCategories();
      await this.loadAllCategories();
      await this.showToast('CATEGORIES.SAVED_OK', 'success');
    }
  }

  async confirmDelete(category: CategoryDto): Promise<void> {
    if (!this.canDelete || !category.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar categoría',
      message: `¿Desactivar "${category.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivateCategory(category);
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
        this.loadCategories();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadCategories();
        void this.loadAllCategories();
      },
      error: async () => {
        await this.showToast('CATEGORIES.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadAllCategories(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    return new Promise((resolve) => {
      this.categoryService.listAll(branchId).subscribe({
        next: (items) => {
          this.allCategories.set(items);
          resolve();
        },
        error: () => {
          this.allCategories.set([]);
          resolve();
        },
      });
    });
  }

  private loadCategories(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.categoryService.list(branchId, {
        search: this.searchQuery() || undefined,
        page: this.page(),
        limit: 20,
      }).subscribe({
        next: (result) => {
          const items = this.showInactive()
            ? result.items
            : result.items.filter((c) => c.isActive);
          this.categories.set(items);
          this.total.set(result.total);
          this.totalPages.set(result.totalPages);
          this.loading.set(false);
          resolve();
        },
        error: async () => {
          this.loading.set(false);
          await this.showToast('CATEGORIES.LOAD_ERROR', 'danger');
          resolve();
        },
      });
    });
  }

  private async deactivateCategory(category: CategoryDto): Promise<void> {
    this.categoryService.deactivate(category.id).subscribe({
      next: async () => {
        await this.loadCategories();
        await this.loadAllCategories();
        await this.showToast('CATEGORIES.DEACTIVATED_OK', 'success');
      },
      error: async () => {
        await this.showToast('CATEGORIES.DEACTIVATE_ERROR', 'danger');
      },
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'CATEGORIES.SAVED_OK': 'Categoría guardada correctamente',
      'CATEGORIES.LOAD_ERROR': 'Error al cargar categorías',
      'CATEGORIES.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'CATEGORIES.DEACTIVATED_OK': 'Categoría desactivada',
      'CATEGORIES.DEACTIVATE_ERROR': 'No se pudo desactivar la categoría',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
