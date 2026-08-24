import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  AlertController,
  ToastController,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
import { Subject, takeUntil, firstValueFrom } from 'rxjs';
import { addIcons } from 'ionicons';
import {
  desktopOutline,
  trashOutline,
  createOutline,
  wifiOutline,
  cashOutline,
  barcodeOutline,
  scanOutline,
  addOutline,
  searchOutline,
  addCircleOutline,
} from 'ionicons/icons';
import { RegisterDto, TerminalDto, DeviceConnectionStatus, NetworkScanResultItem } from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';
import { ConfigService } from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { DeviceService } from '@core/services/device.service';
import { TerminalFormModal } from './terminal-form.modal';
import { RegisterFormModal } from '../registers/register-form.modal';

addIcons({
  desktopOutline,
  trashOutline,
  createOutline,
  wifiOutline,
  cashOutline,
  barcodeOutline,
  scanOutline,
  addOutline,
  searchOutline,
  addCircleOutline,
});

@Component({
  selector: 'app-terminals',
  templateUrl: './terminals.page.html',
  styleUrls: ['./terminals.page.scss'],
  imports: [
    IonButton,
    IonIcon,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonBadge,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
    AdminBackButton,
  ],
})
export class TerminalsPage implements OnInit, OnDestroy {
  private readonly registerService = inject(RegisterService);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly device = inject(DeviceService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly modalCtrl = inject(ModalController);
  private readonly destroy$ = new Subject<void>();

  readonly canManage = this.auth.hasPermission('registers.admin');
  readonly currentDeviceId = this.device.getDeviceId();

  branchId = signal<string | null>(null);
  terminals = signal<TerminalDto[]>([]);
  registers = signal<RegisterDto[]>([]);
  loading = signal(false);
  private refreshTimer: ReturnType<typeof setInterval> | null = null;

  scanning = signal(false);
  scanResults = signal<NetworkScanResultItem[]>([]);
  scanSubnet = signal('');
  hasScanned = signal(false);

  readonly summaryOnline = computed(() => this.terminals().filter((t) => t.isOnline).length);
  readonly summaryRegisterConnected = computed(() =>
    this.terminals().filter((t) => t.registerConnectionStatus === 'CONNECTED').length,
  );
  readonly summaryBarcodeActive = computed(() =>
    this.terminals().filter((t) => t.barcodeReaderStatus === 'CONNECTED').length,
  );

  ngOnInit(): void {
    this.configService.getPosContext().pipe(takeUntil(this.destroy$)).subscribe({
      next: (ctx) => {
        this.branchId.set(ctx.branchId);
        void this.loadData();
        this.startAutoRefresh();
      },
      error: async () => {
        await this.showToast('No se pudo cargar la sucursal', 'danger');
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    this.destroy$.next();
    this.destroy$.complete();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadData();
    (event.target as HTMLIonRefresherElement).complete();
  }

  isCurrentDevice(terminal: TerminalDto): boolean {
    return terminal.deviceId === this.currentDeviceId;
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO');
  }

  connectionColor(status?: DeviceConnectionStatus): string {
    switch (status) {
      case 'CONNECTED':
        return 'success';
      case 'DISCONNECTED':
        return 'danger';
      default:
        return 'medium';
    }
  }

  connectionKey(status?: DeviceConnectionStatus): string {
    switch (status) {
      case 'CONNECTED':
        return 'TERMINALS.CONNECTED';
      case 'DISCONNECTED':
        return 'TERMINALS.DISCONNECTED';
      default:
        return 'TERMINALS.UNKNOWN';
    }
  }

  private startAutoRefresh(): void {
    this.stopAutoRefresh();
    this.refreshTimer = setInterval(() => void this.loadData(), 30_000);
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async openNewTerminal(prefillIp = ''): Promise<void> {
    const branchId = this.branchId();
    if (!branchId || !this.canManage) return;

    const modal = await this.modalCtrl.create({
      component: TerminalFormModal,
      componentProps: { branchId, prefillIp },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { role } = await modal.onDidDismiss();
    if (role === 'saved') {
      await this.loadData();
      await this.showToast('Terminal creada correctamente', 'success');
    }
  }

  async scanNetwork(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId || !this.canManage || this.scanning()) return;

    this.scanning.set(true);
    try {
      const result = await firstValueFrom(this.registerService.scanNetwork(branchId));
      this.scanResults.set(result.items);
      this.scanSubnet.set(result.subnet);
      this.hasScanned.set(true);
    } catch {
      await this.showToast('No se pudo escanear la red', 'danger');
    } finally {
      this.scanning.set(false);
    }
  }

  async registerDetected(item: NetworkScanResultItem): Promise<void> {
    if (item.alreadyRegistered) return;
    await this.openNewTerminal(item.ipAddress);
  }

  async createRegisterForTerminal(terminal: TerminalDto): Promise<void> {
    const branchId = this.branchId();
    if (!branchId || !this.canManage) return;

    const modal = await this.modalCtrl.create({
      component: RegisterFormModal,
      componentProps: { register: null, branchId },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<RegisterDto>();
    if (role !== 'saved' || !data?.id) return;

    try {
      await firstValueFrom(
        this.registerService.updateTerminal(terminal.id, { registerId: data.id }),
      );
      await this.loadData();
      await this.showToast('Caja creada y asignada al equipo', 'success');
    } catch {
      await this.showToast('La caja se creó, pero no se pudo asignar al equipo', 'danger');
    }
  }

  async onRegisterChange(terminal: TerminalDto, registerId: string | null): Promise<void> {
    try {
      await firstValueFrom(
        this.registerService.updateTerminal(terminal.id, { registerId: registerId || null }),
      );
      await this.loadData();
      await this.showToast('Caja asignada al equipo', 'success');
    } catch {
      await this.showToast('No se pudo asignar la caja', 'danger');
    }
  }

  async rename(terminal: TerminalDto): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Renombrar equipo',
      inputs: [{ name: 'name', type: 'text', value: terminal.name, placeholder: 'Nombre del equipo' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Guardar',
          handler: (data: { name?: string }) => {
            if (data.name?.trim()) {
              void this.applyRename(terminal, data.name.trim());
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async toggleActive(terminal: TerminalDto): Promise<void> {
    try {
      await firstValueFrom(
        this.registerService.updateTerminal(terminal.id, { isActive: !terminal.isActive }),
      );
      await this.loadData();
    } catch {
      await this.showToast('No se pudo actualizar el equipo', 'danger');
    }
  }

  async confirmDelete(terminal: TerminalDto): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar equipo',
      message: `¿Eliminar el equipo "${terminal.name}"? Volverá a registrarse si se conecta de nuevo.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            void this.deleteTerminal(terminal);
          },
        },
      ],
    });
    await alert.present();
  }

  private async applyRename(terminal: TerminalDto, name: string): Promise<void> {
    try {
      await firstValueFrom(this.registerService.updateTerminal(terminal.id, { name }));
      await this.loadData();
    } catch {
      await this.showToast('No se pudo renombrar el equipo', 'danger');
    }
  }

  private async deleteTerminal(terminal: TerminalDto): Promise<void> {
    try {
      await firstValueFrom(this.registerService.deleteTerminal(terminal.id));
      await this.loadData();
      await this.showToast('Equipo eliminado', 'success');
    } catch {
      await this.showToast('No se pudo eliminar el equipo', 'danger');
    }
  }

  private async loadData(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return;

    this.loading.set(true);
    try {
      const [terminals, registersResult] = await Promise.all([
        firstValueFrom(this.registerService.listTerminals(branchId)),
        firstValueFrom(this.registerService.listRegisters(branchId, { limit: 200 })),
      ]);
      this.terminals.set(terminals);
      this.registers.set(registersResult.items.filter((r) => r.isActive));
    } catch {
      await this.showToast('Error al cargar los equipos', 'danger');
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
