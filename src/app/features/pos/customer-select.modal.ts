import { Component, Input, OnDestroy, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonSpinner,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, peopleOutline, addOutline } from 'ionicons/icons';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CustomerDto, CustomerService } from '@core/services/customer.service';
import { AuthService } from '@core/services/auth.service';
import { CustomerFormModal } from '../admin/customers/customer-form.modal';

addIcons({ closeOutline, checkmarkOutline, peopleOutline, addOutline });

@Component({
  selector: 'app-customer-select-modal',
  templateUrl: './customer-select.modal.html',
  styleUrls: ['./customer-select.modal.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonSpinner,
    TranslateModule,
  ],
})
export class CustomerSelectModal implements OnInit, OnDestroy {
  private readonly customerService = inject(CustomerService);
  private readonly modalCtrl = inject(ModalController);
  private readonly auth = inject(AuthService);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  @Input() branchId = '';
  @Input() selectedCustomerId: string | null = null;

  readonly canCreate = this.auth.hasPermission('customers.create');

  loading = signal(false);
  customers = signal<CustomerDto[]>([]);
  searchQuery = signal('');

  ngOnInit(): void {
    this.search$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((q) => void this.loadCustomers(q));
    void this.loadCustomers('');
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

  select(customer: CustomerDto): void {
    void this.modalCtrl.dismiss(customer, 'selected');
  }

  dismiss(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async openCreate(): Promise<void> {
    if (!this.canCreate || !this.branchId) return;

    const modal = await this.modalCtrl.create({
      component: CustomerFormModal,
      componentProps: { branchId: this.branchId },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<CustomerDto | null>();
    if (role !== 'saved' || !data?.id) return;

    // Select the newly created customer for the sale.
    this.select(data);
  }

  private loadCustomers(search: string): Promise<void> {
    if (!this.branchId) return Promise.resolve();
    this.loading.set(true);
    return new Promise((resolve) => {
      this.customerService.listActive(this.branchId, search || undefined).subscribe({
        next: (items) => {
          this.customers.set(items);
          this.loading.set(false);
          resolve();
        },
        error: () => {
          this.customers.set([]);
          this.loading.set(false);
          resolve();
        },
      });
    });
  }
}
