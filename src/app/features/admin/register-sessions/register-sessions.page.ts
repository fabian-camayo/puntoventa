import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
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
import { Subject, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  cashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  lockOpenOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import { RegisterSessionDto } from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { RegisterSessionDetailModal } from './register-session-detail.modal';
import { RegisterSessionModal } from '../../pos/register-session.modal';

addIcons({
  cashOutline,
  chevronBackOutline,
  chevronForwardOutline,
  lockOpenOutline,
  lockClosedOutline,
});

type StatusFilter = 'ALL' | 'OPEN' | 'CLOSED';

@Component({
  selector: 'app-register-sessions',
  templateUrl: './register-sessions.page.html',
  styleUrls: ['./register-sessions.page.scss'],
  imports: [
    IonButton,
    IonIcon,
    IonContent,
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
export class RegisterSessionsPage implements OnInit, OnDestroy {
  private readonly registerService = inject(RegisterService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  readonly canOpen = this.auth.hasPermission('registers.open');
  readonly canClose = this.auth.hasPermission('registers.close');

  branchId = signal<string | null>(null);
  registerId = signal<string | null>(null);
  registerName = signal('');
  sessions = signal<RegisterSessionDto[]>([]);
  activeSession = signal<RegisterSessionDto | null>(null);
  statusFilter = signal<StatusFilter>('ALL');
  loading = signal(false);
  page = signal(1);
  totalPages = signal(1);
  total = signal(0);

  ngOnInit(): void {
    this.configService.getPosContext().pipe(takeUntil(this.destroy$)).subscribe({
      next: (ctx) => {
        this.branchId.set(ctx.branchId);
        this.registerId.set(ctx.registerId);
        this.registerName.set(ctx.registerName);
        void this.loadSessions();
        void this.loadActiveSession();
      },
      error: async () => {
        await this.showToast('REGISTERS.CONTEXT_ERROR', 'danger');
      },
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setStatusFilter(filter: StatusFilter): void {
    if (this.statusFilter() === filter) return;
    this.statusFilter.set(filter);
    this.page.set(1);
    void this.loadSessions();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await Promise.all([this.loadSessions(), this.loadActiveSession()]);
    (event.target as HTMLIonRefresherElement).complete();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      void this.loadSessions();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      void this.loadSessions();
    }
  }

  async openDetail(session: RegisterSessionDto): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: RegisterSessionDetailModal,
      componentProps: { sessionId: session.id },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
  }

  async openRegister(): Promise<void> {
    const registerId = this.registerId();
    if (!registerId || !this.canOpen) return;

    const modal = await this.modalCtrl.create({
      component: RegisterSessionModal,
      componentProps: {
        mode: 'open',
        registerId,
        registerName: this.registerName(),
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await Promise.all([this.loadSessions(), this.loadActiveSession()]);
      await this.showToast('REGISTERS.OPENED_OK', 'success');
    }
  }

  async closeRegister(): Promise<void> {
    const session = this.activeSession();
    if (!session || !this.canClose) return;

    const modal = await this.modalCtrl.create({
      component: RegisterSessionModal,
      componentProps: {
        mode: 'close',
        registerId: this.registerId(),
        registerName: this.registerName(),
        session,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await Promise.all([this.loadSessions(), this.loadActiveSession()]);
      await this.showToast('REGISTERS.CLOSED_OK', 'success');
    }
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO');
  }

  private loadActiveSession(): Promise<void> {
    const registerId = this.registerId();
    if (!registerId) return Promise.resolve();

    return new Promise((resolve) => {
      this.registerService.getActiveSession(registerId).subscribe({
        next: (session) => {
          this.activeSession.set(session);
          resolve();
        },
        error: () => {
          this.activeSession.set(null);
          resolve();
        },
      });
    });
  }

  private loadSessions(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return Promise.resolve();

    this.loading.set(true);
    const filter = this.statusFilter();

    return new Promise((resolve) => {
      this.registerService
        .listSessions(branchId, {
          registerId: this.registerId() ?? undefined,
          status: filter === 'ALL' ? undefined : filter,
          page: this.page(),
          limit: 20,
        })
        .subscribe({
          next: (result) => {
            this.sessions.set(result.items);
            this.total.set(result.total);
            this.totalPages.set(result.totalPages);
            this.loading.set(false);
            resolve();
          },
          error: async () => {
            this.loading.set(false);
            await this.showToast('REGISTERS.LOAD_ERROR', 'danger');
            resolve();
          },
        });
    });
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'REGISTERS.OPENED_OK': 'Caja abierta correctamente',
      'REGISTERS.CLOSED_OK': 'Caja cerrada correctamente',
      'REGISTERS.LOAD_ERROR': 'Error al cargar sesiones de caja',
      'REGISTERS.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2500,
      color,
    });
    await t.present();
  }
}
