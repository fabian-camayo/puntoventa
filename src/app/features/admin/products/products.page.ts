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
  IonFab,
  IonFabButton,
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
  cubeOutline,
} from 'ionicons/icons';
import { ProductDto } from '@puntoventa/shared';
import { ProductService } from '@core/services/product.service';
import { CategoryService, CategoryDto } from '@core/services/category.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { ProductFormModal } from './product-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cubeOutline,
});

@Component({
  selector: 'app-products',
  templateUrl: './products.page.html',
  styleUrls: ['./products.page.scss'],
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
    AppCurrencyPipe,
  ],
})
export class ProductsPage implements OnInit, OnDestroy {
  private readonly productService = inject(ProductService);
  private readonly categoryService = inject(CategoryService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('products.create');
  readonly canUpdate = this.auth.hasPermission('products.update');
  readonly canDelete = this.auth.hasPermission('products.delete');
  readonly canViewCosts = this.auth.hasPermission('products.view_costs');

  branchId = signal<string | null>(null);
  products = signal<ProductDto[]>([]);
  categories = signal<CategoryDto[]>([]);
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
    this.loadProducts();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadProducts();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadProducts();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadProducts();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: ProductFormModal,
      componentProps: {
        branchId: this.branchId(),
        categories: this.categories(),
      },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadProducts();
      await this.showToast('PRODUCTS.SAVED_OK', 'success');
    }
  }

  async openEdit(product: ProductDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: ProductFormModal,
      componentProps: {
        branchId: this.branchId(),
        product,
        categories: this.categories(),
      },
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadProducts();
      await this.showToast('PRODUCTS.SAVED_OK', 'success');
    }
  }

  async confirmDelete(product: ProductDto): Promise<void> {
    if (!this.canDelete) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar producto',
      message: `¿Desactivar "${product.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivateProduct(product);
          },
        },
      ],
    });
    await alert.present();
  }

  stockClass(stock: number | undefined, minStock: number | undefined): string {
    const qty = stock ?? 0;
    const min = minStock ?? 0;
    if (qty <= 0) return 'stock-out';
    if (qty <= min) return 'stock-low';
    return 'stock-ok';
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        this.loadProducts();
      });
  }

  private loadBranchContext(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.data.branchId);
        this.loadCategories(res.data.branchId);
        this.loadProducts();
      },
      error: async () => {
        await this.showToast('PRODUCTS.CONTEXT_ERROR', 'danger');
      },
    });
  }

  private loadCategories(branchId: string): void {
    this.categoryService.list(branchId).subscribe({
      next: (items) => this.categories.set(items),
      error: () => this.categories.set([]),
    });
  }

  private loadProducts(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    return new Promise((resolve) => {
      this.productService
        .list({
          branchId,
          search: this.searchQuery() || undefined,
          page: this.page(),
          limit: 20,
          includeInactive: this.showInactive(),
        })
        .subscribe({
          next: (result) => {
            this.products.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('PRODUCTS.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivateProduct(product: ProductDto): Promise<void> {
    this.productService.deactivate(product.id).subscribe({
      next: async () => {
        await this.loadProducts();
        await this.showToast('PRODUCTS.DEACTIVATED_OK', 'success');
      },
      error: async () => {
        await this.showToast('PRODUCTS.DEACTIVATE_ERROR', 'danger');
      },
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'PRODUCTS.SAVED_OK': 'Producto guardado correctamente',
      'PRODUCTS.LOAD_ERROR': 'Error al cargar productos',
      'PRODUCTS.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
      'PRODUCTS.DEACTIVATED_OK': 'Producto desactivado',
      'PRODUCTS.DEACTIVATE_ERROR': 'No se pudo desactivar el producto',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
