import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonSearchbar,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonChip,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import { shieldCheckmarkOutline, chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { AUDIT_MODULES, AUDIT_ACTIONS, AuditLogDto, AuditActionDto } from '@puntoventa/shared';
import { AuditService } from '@core/services/audit.service';
import { UserService, UserDto } from '@core/services/user.service';
import { ConfigService } from '@core/services/config.service';
import { AuditDetailModal } from './audit-detail.modal';

addIcons({ shieldCheckmarkOutline, chevronBackOutline, chevronForwardOutline });

@Component({
  selector: 'app-audit',
  templateUrl: './audit.page.html',
  styleUrls: ['./audit.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonSearchbar,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonChip,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
    AdminBackButton,
  ],
})
export class AuditPage implements OnInit, OnDestroy {
  private readonly auditService = inject(AuditService);
  private readonly userService = inject(UserService);
  private readonly configService = inject(ConfigService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();
  private readonly search$ = new Subject<string>();

  readonly modules = AUDIT_MODULES;
  readonly actions = AUDIT_ACTIONS;

  users = signal<UserDto[]>([]);
  logs = signal<AuditLogDto[]>([]);
  searchQuery = signal('');
  moduleFilter = signal<string>('ALL');
  actionFilter = signal<string>('ALL');
  userFilter = signal<string>('ALL');
  dateFrom = signal<string>('');
  dateTo = signal<string>('');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  ngOnInit(): void {
    this.setupSearch();
    this.loadUsers();
    this.loadLogs();
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

  setModuleFilter(value: string): void {
    this.moduleFilter.set(value || 'ALL');
    this.page.set(1);
    void this.loadLogs();
  }

  setActionFilter(value: string): void {
    this.actionFilter.set(value || 'ALL');
    this.page.set(1);
    void this.loadLogs();
  }

  setUserFilter(value: string): void {
    this.userFilter.set(value || 'ALL');
    this.page.set(1);
    void this.loadLogs();
  }

  onDateFromChange(value: string): void {
    this.dateFrom.set(value);
    this.page.set(1);
    void this.loadLogs();
  }

  onDateToChange(value: string): void {
    this.dateTo.set(value);
    this.page.set(1);
    void this.loadLogs();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadLogs();
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadLogs();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadLogs();
    }
  }

  moduleLabel(value: string): string {
    return this.modules.find((m) => m.value === value)?.label ?? value;
  }

  actionLabel(value: string): string {
    return this.actions.find((a) => a.value === value)?.label ?? value;
  }

  actionColor(action: string): string {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'DELETE':
      case 'VOID':
        return 'danger';
      case 'UPDATE':
      case 'CONFIG_CHANGE':
        return 'warning';
      case 'LOGIN':
        return 'primary';
      case 'LOGOUT':
        return 'medium';
      default:
        return 'tertiary';
    }
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'medium' });
  }

  async openDetail(log: AuditLogDto): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: AuditDetailModal,
      componentProps: { logId: log.id },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
  }

  private setupSearch(): void {
    this.search$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => {
        this.page.set(1);
        void this.loadLogs();
      });
  }

  private loadUsers(): void {
    this.userService.list({ limit: 200 }).subscribe({
      next: (result) => this.users.set(result.items),
      error: () => this.users.set([]),
    });
  }

  private loadLogs(): Promise<void> {
    this.loading.set(true);

    return new Promise((resolve) => {
      this.auditService
        .list({
          module: this.moduleFilter() === 'ALL' ? undefined : this.moduleFilter(),
          action: this.actionFilter() === 'ALL' ? undefined : (this.actionFilter() as AuditActionDto),
          userId: this.userFilter() === 'ALL' ? undefined : this.userFilter(),
          search: this.searchQuery() || undefined,
          dateFrom: this.dateFrom() || undefined,
          dateTo: this.dateTo() || undefined,
          page: this.page(),
          limit: 50,
        })
        .subscribe({
          next: (result) => {
            this.logs.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            const t = await this.toast.create({
              message: 'Error al cargar el historial de auditoría',
              duration: 2500,
              color: 'danger',
            });
            await t.present();
            resolve();
          },
        });
    });
  }
}
