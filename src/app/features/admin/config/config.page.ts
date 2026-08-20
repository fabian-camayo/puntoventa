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
  AlertController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
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
  peopleOutline,
  imageOutline,
  trashOutline,
  downloadOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  documentOutline,
} from 'ionicons/icons';
import { firstValueFrom, forkJoin } from 'rxjs';
import { AppConfigDto, PosContextDto } from '@puntoventa/shared';
import {
  ConfigService,
  UpdateBusinessConfigPayload,
} from '@core/services/config.service';
import { CustomerDto, CustomerService } from '@core/services/customer.service';
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
  peopleOutline,
  imageOutline,
  trashOutline,
  downloadOutline,
  cloudDownloadOutline,
  cloudUploadOutline,
  documentOutline,
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
    AdminBackButton,
  ],
})
export class ConfigPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly configService = inject(ConfigService);
  private readonly customerService = inject(CustomerService);
  private readonly auth = inject(AuthService);
  private readonly themeService = inject(ThemeService);
  private readonly toast = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  readonly canUpdate = this.auth.hasPermission('config.update');

  loading = signal(true);
  saving = signal(false);
  backingUp = signal(false);
  restoring = signal(false);
  restoreFile = signal<File | null>(null);
  restoreFileName = signal('');
  branchId = signal<string | null>(null);
  posContext = signal<PosContextDto | null>(null);
  appConfig = signal<AppConfigDto | null>(null);
  customers = signal<CustomerDto[]>([]);
  activeTab = signal<'general' | 'billing' | 'app' | 'backup'>('general');

  form = this.fb.nonNullable.group({
    businessName: ['', [Validators.required, Validators.maxLength(120)]],
    taxId: [''],
    address: [''],
    phone: [''],
    email: ['', [Validators.email]],
    currency: ['COP', [Validators.required, Validators.maxLength(3)]],
    currencySymbol: ['$', [Validators.required, Validators.maxLength(5)]],
    taxRate: [16, [Validators.required, Validators.min(0), Validators.max(100)]],
    logoUrl: [''],
    ticketHeader: [''],
    ticketFooter: [''],
    invoiceResolution: ['', [Validators.maxLength(2000)]],
    warrantyPolicy: ['', [Validators.maxLength(2000)]],
    invoicePrefix: ['FEV', [Validators.required, Validators.maxLength(20)]],
    invoiceNumberPadding: [3, [Validators.required, Validators.min(1), Validators.max(10)]],
    invoiceNextNumber: [1, [Validators.required, Validators.min(1)]],
    allowNegativeStock: [false],
    defaultCustomerId: [''],
    language: ['es'],
    theme: ['system' as ThemeMode],
  });

  readonly invoicePreview = signal('FEV001');

  ngOnInit(): void {
    if (!this.canUpdate) {
      this.form.disable();
    }
    this.form.valueChanges.subscribe(() => this.updateInvoicePreview());
    void this.loadConfig();
  }

  private updateInvoicePreview(): void {
    const prefix = (this.form.controls.invoicePrefix.value ?? 'FEV')
      .trim()
      .toUpperCase() || 'FEV';
    const padding = Math.min(
      10,
      Math.max(1, Number(this.form.controls.invoiceNumberPadding.value) || 3),
    );
    const next = Math.max(1, Number(this.form.controls.invoiceNextNumber.value) || 1);
    this.invoicePreview.set(`${prefix}${String(next).padStart(padding, '0')}`);
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadConfig();
    (event.target as HTMLIonRefresherElement).complete();
  }

  appModeLabel(mode?: string): string {
    const key = `CONFIG.MODE_${mode ?? 'STANDALONE'}`;
    return key;
  }

  async onLogoSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      await this.showToast('CONFIG.LOGO_INVALID', 'warning');
      input.value = '';
      return;
    }
    if (file.size > 500_000) {
      await this.showToast('CONFIG.LOGO_TOO_LARGE', 'warning');
      input.value = '';
      return;
    }

    try {
      const dataUrl = await this.readFileAsDataUrl(file);
      // Comprime para impresión/API (objetivo ~200 KB en base64)
      const optimized = await this.optimizeLogoDataUrl(dataUrl, file.type);
      this.form.controls.logoUrl.setValue(optimized);
    } catch {
      await this.showToast('CONFIG.LOGO_INVALID', 'danger');
    } finally {
      input.value = '';
    }
  }

  clearLogo(): void {
    this.form.controls.logoUrl.setValue('');
  }

  async downloadBackup(): Promise<void> {
    if (!this.canUpdate || this.backingUp()) return;
    this.backingUp.set(true);
    try {
      const blob = await firstValueFrom(this.configService.downloadDatabaseBackup());
      if (blob.type.includes('application/json')) {
        throw new Error('Respuesta inválida');
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      link.href = url;
      link.download = `puntoventa-backup-${stamp}.sql`;
      link.click();
      URL.revokeObjectURL(url);
      await this.showToastMessage('Copia de seguridad descargada', 'success');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToastMessage(
        message ?? 'No se pudo generar la copia de seguridad',
        'danger',
      );
    } finally {
      this.backingUp.set(false);
    }
  }

  onBackupFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.restoreFile.set(file);
    this.restoreFileName.set(file?.name ?? '');
    input.value = '';
  }

  async confirmRestore(): Promise<void> {
    const file = this.restoreFile();
    if (!this.canUpdate || !file || this.restoring()) return;

    const alert = await this.alertCtrl.create({
      header: 'Restaurar base de datos',
      message:
        'Esta acción reemplazará TODOS los datos actuales con el respaldo. No se puede deshacer. ¿Continuar?',
      inputs: [
        {
          name: 'confirm',
          type: 'text',
          placeholder: 'Escriba RESTAURAR para confirmar',
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Restaurar', role: 'confirm', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role, data } = await alert.onDidDismiss<
      { values?: { confirm?: string }; confirm?: string } | undefined
    >();
    if (role !== 'confirm') return;
    const typed = (
      data?.values?.confirm ??
      data?.confirm ??
      ''
    )
      .trim()
      .toUpperCase();
    if (typed !== 'RESTAURAR') {
      await this.showToastMessage('Debe escribir RESTAURAR para confirmar', 'warning');
      return;
    }

    this.restoring.set(true);
    try {
      await firstValueFrom(this.configService.restoreDatabaseBackup(file));
      this.restoreFile.set(null);
      this.restoreFileName.set('');
      await this.showToastMessage(
        'Base de datos restaurada. Recargue la aplicación.',
        'success',
      );
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToastMessage(
        message ?? 'No se pudo restaurar el respaldo',
        'danger',
      );
    } finally {
      this.restoring.set(false);
    }
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
        logoUrl: raw.logoUrl || null,
        ticketHeader: raw.ticketHeader || undefined,
        ticketFooter: raw.ticketFooter || undefined,
        invoiceResolution: raw.invoiceResolution || undefined,
        warrantyPolicy: raw.warrantyPolicy || undefined,
        invoicePrefix: raw.invoicePrefix.trim().toUpperCase(),
        invoiceNumberPadding: Number(raw.invoiceNumberPadding),
        invoiceNextNumber: Number(raw.invoiceNextNumber),
        allowNegativeStock: raw.allowNegativeStock,
        defaultCustomerId: raw.defaultCustomerId || undefined,
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

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  /** Reduce tamaño del logo para que quepa en API e impresión del ticket. */
  private optimizeLogoDataUrl(dataUrl: string, mimeType: string): Promise<string> {
    const maxBytes = 280_000;
    if (dataUrl.length <= maxBytes && (mimeType === 'image/jpeg' || mimeType === 'image/png')) {
      return Promise.resolve(dataUrl);
    }

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const maxSide = 360;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        let quality = 0.82;
        let out = canvas.toDataURL('image/jpeg', quality);
        while (out.length > maxBytes && quality > 0.4) {
          quality -= 0.1;
          out = canvas.toDataURL('image/jpeg', quality);
        }
        resolve(out);
      };
      img.onerror = () => reject(new Error('invalid image'));
      img.src = dataUrl;
    });
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

      const [business, customers] = await Promise.all([
        firstValueFrom(this.configService.getBusinessConfig(branchId)),
        firstValueFrom(this.customerService.listActive(branchId)).catch(() => [] as CustomerDto[]),
      ]);
      this.customers.set(customers);

      this.form.patchValue({
        businessName: business.businessName,
        taxId: business.taxId ?? '',
        address: business.address ?? '',
        phone: business.phone ?? '',
        email: business.email ?? '',
        currency: business.currency,
        currencySymbol: business.currencySymbol,
        taxRate: business.taxRate,
        logoUrl: business.logoUrl ?? '',
        ticketHeader: business.ticketHeader ?? '',
        ticketFooter: business.ticketFooter ?? '',
        invoiceResolution: business.invoiceResolution ?? '',
        warrantyPolicy: business.warrantyPolicy ?? '',
        invoicePrefix: business.invoicePrefix ?? 'FEV',
        invoiceNumberPadding: business.invoiceNumberPadding ?? 3,
        invoiceNextNumber: business.invoiceNextNumber ?? 1,
        allowNegativeStock: business.allowNegativeStock,
        defaultCustomerId: business.defaultCustomerId ?? '',
        language: appConfig.language ?? 'es',
        theme: (appConfig.theme as ThemeMode) ?? 'system',
      });
      this.updateInvoicePreview();
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
      'CONFIG.LOGO_TOO_LARGE': 'El logo debe pesar menos de 500 KB',
      'CONFIG.LOGO_INVALID': 'Seleccione una imagen válida (PNG o JPG)',
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
