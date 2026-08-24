import { Component, Input, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonIcon,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  ModalController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  refreshOutline,
  cashOutline,
  receiptOutline,
  swapHorizontalOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import {
  CashMovementDto,
  PosSessionSaleItem,
  PosSessionSummaryDto,
} from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';
import { AuthService } from '@core/services/auth.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { RegisterSessionModal } from './register-session.modal';

addIcons({
  closeOutline,
  refreshOutline,
  cashOutline,
  receiptOutline,
  swapHorizontalOutline,
  lockClosedOutline,
});

type SummaryTab = 'sales' | 'movements';

@Component({
  selector: 'app-session-summary-modal',
  templateUrl: './session-summary.modal.html',
  styleUrls: ['./session-summary.modal.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    TranslateModule,
    AppCurrencyPipe,
  ],
})
export class SessionSummaryModal implements OnInit {
  private readonly modalCtrl = inject(ModalController);
  private readonly registerService = inject(RegisterService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastController);

  @Input({ required: true }) sessionId!: string;

  readonly canClose = this.auth.hasPermission('registers.close');

  summary = signal<PosSessionSummaryDto | null>(null);
  loading = signal(true);
  closing = signal(false);
  tab = signal<SummaryTab>('sales');

  ngOnInit(): void {
    void this.load();
  }

  close(): void {
    void this.modalCtrl.dismiss(this.summary()?.session ?? null, 'closed');
  }

  async closeRegister(): Promise<void> {
    const data = this.summary();
    if (!data || !this.canClose || this.closing()) return;

    this.closing.set(true);
    try {
      const modal = await this.modalCtrl.create({
        component: RegisterSessionModal,
        componentProps: {
          mode: 'close',
          registerId: data.session.registerId,
          registerName: data.session.registerName,
          session: data.session,
        },
        cssClass: 'pv-form-modal',
      });
      await modal.present();
      const { role } = await modal.onDidDismiss();
      if (role === 'saved') {
        // La caja quedó cerrada: se cierra también el resumen para volver al POS
        // (que refrescará la sesión activa al no recibir datos).
        void this.modalCtrl.dismiss(null, 'register-closed');
      }
    } finally {
      this.closing.set(false);
    }
  }

  async refresh(): Promise<void> {
    await this.load();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.load();
    (event.target as HTMLIonRefresherElement).complete();
  }

  setTab(value: string | number | undefined): void {
    if (value === 'sales' || value === 'movements') {
      this.tab.set(value);
    }
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  }

  movementLabel(movement: CashMovementDto): string {
    switch (movement.type) {
      case 'SALE':
        return 'Venta';
      case 'REFUND':
        return 'Anulación / reembolso';
      case 'WITHDRAWAL':
        return 'Retiro';
      case 'DEPOSIT':
        return 'Ingreso';
      case 'INCOME':
        return 'Ingreso';
      case 'EXPENSE':
        return 'Gasto';
      default:
        return movement.type;
    }
  }

  movementSign(type: CashMovementDto['type']): number {
    return type === 'WITHDRAWAL' || type === 'EXPENSE' || type === 'REFUND'
      ? -1
      : 1;
  }

  trackSale(_: number, sale: PosSessionSaleItem): string {
    return sale.id;
  }

  trackMovement(_: number, m: CashMovementDto): string {
    return m.id;
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const data = await firstValueFrom(
        this.registerService.getPosSummary(this.sessionId),
      );
      this.summary.set(data);
    } catch {
      await this.showToast('No se pudo cargar el resumen de caja', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
