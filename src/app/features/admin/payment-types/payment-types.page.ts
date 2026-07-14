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
  cardOutline,
} from 'ionicons/icons';
import { PaymentTypeDto } from '@puntoventa/shared';
import { PaymentTypeService } from '@core/services/payment-type.service';
import { AuthService } from '@core/services/auth.service';
import { PaymentTypeFormModal } from './payment-type-form.modal';

addIcons({
  addOutline,
  createOutline,
  trashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  cardOutline,
});

@Component({
  selector: 'app-payment-types',
  templateUrl: './payment-types.page.html',
  styleUrls: ['./payment-types.page.scss'],
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
export class PaymentTypesPage implements OnInit, OnDestroy {
  private readonly paymentTypeService = inject(PaymentTypeService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly canCreate = this.auth.hasPermission('payment_types.create');
  readonly canUpdate = this.auth.hasPermission('payment_types.update');
  readonly canDelete = this.auth.hasPermission('payment_types.delete');

  paymentTypes = signal<PaymentTypeDto[]>([]);
  searchQuery = signal('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);
  showInactive = signal(false);

  ngOnInit(): void {
    this.setupSearch();
    void this.loadPaymentTypes();
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
    void this.loadPaymentTypes();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadPaymentTypes();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadPaymentTypes();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadPaymentTypes();
    }
  }

  async openCreate(): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: PaymentTypeFormModal,
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadPaymentTypes();
      await this.showToast('Tipo de pago guardado', 'success');
    }
  }

  async openEdit(paymentType: PaymentTypeDto): Promise<void> {
    if (!this.canUpdate) return;

    const modal = await this.modalCtrl.create({
      component: PaymentTypeFormModal,
      componentProps: { paymentType },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadPaymentTypes();
      await this.showToast('Tipo de pago guardado', 'success');
    }
  }

  async confirmDelete(paymentType: PaymentTypeDto): Promise<void> {
    if (!this.canDelete || !paymentType.isActive) return;

    const alert = await this.alertCtrl.create({
      header: 'Desactivar tipo de pago',
      message: `¿Desactivar "${paymentType.name}"?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Desactivar',
          role: 'destructive',
          handler: () => {
            void this.deactivate(paymentType);
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
        void this.loadPaymentTypes();
      });
  }

  private loadPaymentTypes(): Promise<void> {
    this.loading.set(true);
    return new Promise((resolve) => {
      this.paymentTypeService
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
            this.paymentTypes.set(items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('Error al cargar tipos de pago', 'danger');
            resolve();
          },
        });
    });
  }

  private async deactivate(paymentType: PaymentTypeDto): Promise<void> {
    this.paymentTypeService.deactivate(paymentType.id).subscribe({
      next: async () => {
        await this.loadPaymentTypes();
        await this.showToast('Tipo de pago desactivado', 'success');
      },
      error: async () => {
        await this.showToast('No se pudo desactivar el tipo de pago', 'danger');
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
