import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonButton,
  IonItem,
  IonLabel,
  IonInput,
  IonRadioGroup,
  IonRadio,
  IonList,
  IonSpinner,
  IonText,
  ToastController,
} from '@ionic/angular/standalone';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { APP_MODES, AppMode } from '@puntoventa/shared';
import { ConfigService } from '../../core/services/config.service';

@Component({
  selector: 'app-setup',
  templateUrl: './setup.page.html',
  styleUrls: ['./setup.page.scss'],
  imports: [
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonItem,
    IonLabel,
    IonInput,
    IonRadioGroup,
    IonRadio,
    IonList,
    IonSpinner,
    IonText,
    ReactiveFormsModule,
    TranslateModule,
  ],
})
export class SetupPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly config = inject(ConfigService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastController);

  readonly APP_MODES = APP_MODES;
  step = signal(1);
  loading = signal(false);
  discoveredServers = signal<Array<{ host: string; port: number; name: string }>>([]);
  connectionResult = signal<{ success: boolean; message: string } | null>(null);

  form = this.fb.nonNullable.group({
    mode: [APP_MODES.STANDALONE as AppMode, Validators.required],
    serverHost: [''],
    serverPort: [3000],
    apiPort: [3000],
    dbHost: ['localhost', Validators.required],
    dbPort: [3306, Validators.required],
    dbUser: ['root', Validators.required],
    dbPassword: [''],
    dbName: ['puntoventa', Validators.required],
    username: [''],
    password: [''],
    businessName: ['Mi Negocio', Validators.required],
    adminUsername: ['admin', Validators.required],
    adminPassword: ['Admin123!', [Validators.required, Validators.minLength(8)]],
    adminFirstName: ['Administrador', Validators.required],
    adminLastName: ['Sistema', Validators.required],
  });

  ngOnInit(): void {
    void this.prefillFromExistingConfig();
  }

  private async prefillFromExistingConfig(): Promise<void> {
    try {
      if (window.electronAPI) {
        const cfg = await window.electronAPI.getConfig();
        this.form.patchValue({
          mode: (cfg.mode as AppMode) || APP_MODES.STANDALONE,
          serverHost: cfg.serverHost || '',
          serverPort: cfg.serverPort ?? 3000,
          apiPort: cfg.apiPort ?? 3000,
          dbHost: cfg.dbHost || 'localhost',
          dbPort: cfg.dbPort ?? 3306,
          dbUser: cfg.dbUser || 'root',
          dbPassword: cfg.hasDatabasePassword ? '********' : '',
          dbName: cfg.dbName || 'puntoventa',
        });
      }
    } catch {
      // ignore
    }
  }

  async onDiscoverServers(): Promise<void> {
    if (window.electronAPI) {
      const servers = await window.electronAPI.findServers();
      this.discoveredServers.set(servers);
      if (servers.length > 0) {
        const first = servers[0]!;
        this.form.patchValue({ serverHost: first.host, serverPort: first.port });
      }
    }
  }

  async onTestConnection(): Promise<void> {
    const { serverHost, serverPort } = this.form.getRawValue();
    if (!serverHost) return;

    this.loading.set(true);
    if (window.electronAPI) {
      const result = await window.electronAPI.testConnection(serverHost, serverPort);
      this.connectionResult.set(result);
    } else {
      this.config.testConnection(serverHost, serverPort).subscribe({
        next: (res) => this.connectionResult.set(res.data),
        error: () => this.connectionResult.set({ success: false, message: 'Error de conexión' }),
      });
    }
    this.loading.set(false);
  }

  async onComplete(): Promise<void> {
    const values = this.form.getRawValue();
    this.loading.set(true);

    try {
      if (window.electronAPI) {
        await window.electronAPI.setMode(values.mode);

        const payload: Record<string, unknown> = {
          mode: values.mode,
          serverHost: values.serverHost,
          serverPort: Number(values.serverPort),
          apiPort: Number(values.apiPort),
          isConfigured: true,
          language: 'es',
          theme: 'system',
        };

        if (this.isServerMode()) {
          payload['dbHost'] = values.dbHost;
          payload['dbPort'] = Number(values.dbPort);
          payload['dbUser'] = values.dbUser;
          payload['dbPassword'] = values.dbPassword;
          payload['dbName'] = values.dbName;
        }

        const saved = await window.electronAPI.saveConfig(payload);
        if (saved && (saved as { backendError?: string }).backendError) {
          const t = await this.toast.create({
            message: `Configuración guardada, pero la API no inició: ${(saved as { backendError: string }).backendError}`,
            color: 'warning',
            duration: 5000,
          });
          await t.present();
        }
      }

      await this.router.navigate(['/login']);
    } catch {
      const t = await this.toast.create({
        message: 'Error en la configuración',
        color: 'danger',
        duration: 3000,
      });
      await t.present();
    } finally {
      this.loading.set(false);
    }
  }

  nextStep(): void {
    this.step.update((s) => s + 1);
  }

  prevStep(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  isClientMode(): boolean {
    return this.form.get('mode')?.value === APP_MODES.CLIENT;
  }

  isServerMode(): boolean {
    const mode = this.form.get('mode')?.value;
    return mode === APP_MODES.SERVER || mode === APP_MODES.STANDALONE;
  }

  canContinueDatabase(): boolean {
    const v = this.form.getRawValue();
    return !!(v.dbHost && v.dbUser && v.dbName && v.dbPort);
  }
}
