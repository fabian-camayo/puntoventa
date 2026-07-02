import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonContent,
  IonIcon,
  IonButton,
  IonItem,
  IonInput,
  IonTextarea,
  IonToggle,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  settingsOutline,
  storefrontOutline,
  cashOutline,
  businessOutline,
  receiptOutline,
  colorPaletteOutline,
  saveOutline,
  checkmarkOutline,
} from 'ionicons/icons';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AppConfigDto, PosContextDto } from '@puntoventa/shared';
import {
  ConfigService,
  UpdateBusinessConfigPayload,
} from '@core/services/config.service';
import { AuthService } from '@core/services/auth.service';
import { ThemeService, ThemeMode } from '@core/services/theme.service';

addIcons({
  settingsOutline,
  storefrontOutline,
  cashOutline,
  businessOutline,
  receiptOutline,
  colorPaletteOutline,
  saveOutline,
  checkmarkOutline,
});

@Component({
  selector: 'app-config',
  templateUrl: './config.page.html',
  styleUrls: ['./config.page.scss'],
  imports: [
    ReactiveFormsModule,
    IonContent,
    IonIcon,
    IonButton,
    IonItem,
    IonInput,
    IonTextarea,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    TranslateModule,
  ],
})
export class ConfigPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly configService = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastController);

  readonly canUpdate = this.auth.hasPermission('config.update');

  loading = signal(true);
  saving = signal(false);
  branchId = signal<string | null>(null);
  posContext = signal<PosContextDto | null>(null);
  appConfig = signal<AppConfigDto | null>(null);
  activeTab = signal<'general' | 'billing' | 'app'>('general');

  form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(120)]],
    taxId: [''],
    address: [''],
    phone: [''],
    email: ['', [Validators.email]],
    currency: ['COP', [Validators.required, Validators.maxLength(3)]],
    currencySymbol: ['$', [Validators.required, Validators.maxLength(5)]],
    taxRate: [16, [Validators.required, Validators.min(0), Validators.max(100)]],
    ticketHeader: [''],
    ticketFooter: [''],
    allowNegativeStock: [false],
    language: ['es'],
    theme: ['system' as ThemeMode],
  });

  ngOnInit(): void {
    if (!this.canUpdate) {
      this.form.disable();
    }
    void this.loadConfig();
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadConfig();
    (event.target as HTMLIonRefresherElement).complete();
  }

  appModeLabel(mode?: string): string {
    const key = `CONFIG.MODE_${mode ?? 'STANDALONE'}`;
    return key;
  }

  async save(): Promise<void> {
    if (!this.canUpdate || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const branchId = this.branchId();
    if (!branchId) return;

    const raw = this.form.getRawValue();
    this.saving.set(true);

    try {
      const businessPayload: UpdateBusinessConfigPayload = {
        businessName: raw.businessName,
        taxId: raw.taxId || undefined,
        address: raw.address || undefined,
        phone: raw.phone || undefined,
        email: raw.email || undefined,
        currency: raw.currency,
        currencySymbol: raw.currencySymbol,
        taxRate: Number(raw.taxRate),
        ticketHeader: raw.ticketHeader || undefined,
        ticketFooter: raw.ticketFooter || undefined,
        allowNegativeStock: raw.allowNegativeStock,
      };

      await firstValueFrom(
        this.configService.updateBusinessConfig(branchId, businessPayload),
      );

      await firstValueFrom(
        forkJoin([
          this.configService.updateAppSetting('app.language', raw.language),
          this.configService.updateAppSetting('app.theme', raw.theme),
        ]),
      );

      this.themeService.setTheme(raw.theme);

      await this.showToast('CONFIG.SAVED_OK', 'success');
    } catch (err: unknown) {
      const message =
        (err as { error?: { message?: string } })?.error?.message ??
        'No se pudo guardar la configuración';
      await this.showToastMessage(message, 'danger');
    } finally {
      this.saving.set(false);
    }
  }

  private async loadConfig(): Promise<void> {
    this.loading.set(true);

    try {
      const appConfig = await firstValueFrom(this.configService.getAppConfigFromApi());
      this.appConfig.set(appConfig);

      let branchId = appConfig.branchId;

      try {
        const context = await firstValueFrom(this.configService.getPosContext());
        this.posContext.set(context);
        branchId = context.branchId;
      } catch {
        if (branchId) {
          this.posContext.set({
            branchId,
            branchName: '—',
            registerId: appConfig.registerId ?? '',
            registerName: '—',
            registerCode: '—',
          });
        }
      }

      if (!branchId) {
        throw new Error('Sin sucursal configurada');
      }

      this.branchId.set(branchId);

      const business = await firstValueFrom(
        this.configService.getBusinessConfig(branchId),
      );

      this.form.patchValue({
        businessName: business.businessName,
        taxId: business.taxId ?? '',
        address: business.address ?? '',
        phone: business.phone ?? '',
        email: business.email ?? '',
        currency: business.currency,
        currencySymbol: business.currencySymbol,
        taxRate: business.taxRate,
        ticketHeader: business.ticketHeader ?? '',
        ticketFooter: business.ticketFooter ?? '',
        allowNegativeStock: business.allowNegativeStock,
        language: appConfig.language ?? 'es',
        theme: (appConfig.theme as ThemeMode) ?? 'system',
      });
    } catch {
      await this.showToast('CONFIG.LOAD_ERROR', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'CONFIG.SAVED_OK': 'Configuración guardada correctamente',
      'CONFIG.LOAD_ERROR': 'Error al cargar la configuración',
    };
    await this.showToastMessage(messages[messageKey] ?? messageKey, color);
  }

  private async showToastMessage(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 2800, color });
    await t.present();
  }
}
