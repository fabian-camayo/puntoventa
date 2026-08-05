import { Component, OnInit, inject, signal } from '@angular/core';
import {
  IonButton,
  IonIcon,
  IonContent,
  IonItem,
  IonInput,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  ToastController,
} from '@ionic/angular/standalone';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AdminBackButton } from '@shared/components/admin-back-button/admin-back-button.component';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { addIcons } from 'ionicons';
import {
  barChartOutline,
  calendarOutline,
  refreshOutline,
  trendingUpOutline,
  cashOutline,
  cartOutline,
  pricetagOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@core/services/config.service';
import {
  ReportService,
  SalesProfitDailyRow,
  SalesProfitProductRow,
  SalesProfitSummary,
} from '@core/services/report.service';

addIcons({
  barChartOutline,
  calendarOutline,
  refreshOutline,
  trendingUpOutline,
  cashOutline,
  cartOutline,
  pricetagOutline,
});

@Component({
  selector: 'app-reports',
  templateUrl: './reports.page.html',
  styleUrls: ['./reports.page.scss'],
  imports: [
    FormsModule,
    IonButton,
    IonIcon,
    IonContent,
    IonItem,
    IonInput,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslateModule,
    AdminBackButton,
    AppCurrencyPipe,
  ],
})
export class ReportsPage implements OnInit {
  private readonly reportService = inject(ReportService);
  private readonly configService = inject(ConfigService);
  private readonly toast = inject(ToastController);

  branchId = signal<string | null>(null);
  loading = signal(false);
  fromDate = signal(this.defaultFrom());
  toDate = signal(this.todayIso());

  summary = signal<SalesProfitSummary | null>(null);
  daily = signal<SalesProfitDailyRow[]>([]);
  topProducts = signal<SalesProfitProductRow[]>([]);

  ngOnInit(): void {
    this.configService.getPosContext().subscribe({
      next: (res) => {
        this.branchId.set(res.branchId);
        void this.loadReport();
      },
      error: async () => {
        await this.showToast('REPORTS.CONTEXT_ERROR', 'danger');
      },
    });
  }

  async onRefresh(event: CustomEvent): Promise<void> {
    await this.loadReport();
    (event.target as HTMLIonRefresherElement).complete();
  }

  onFromChange(event: CustomEvent): void {
    const value = String((event.detail as { value?: string }).value ?? '');
    this.fromDate.set(value);
  }

  onToChange(event: CustomEvent): void {
    const value = String((event.detail as { value?: string }).value ?? '');
    this.toDate.set(value);
  }

  async applyFilters(): Promise<void> {
    await this.loadReport();
  }

  setPreset(days: number): void {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - (days - 1));
    this.fromDate.set(this.toIsoDate(from));
    this.toDate.set(this.toIsoDate(to));
    void this.loadReport();
  }

  formatDate(value: string): string {
    const [y, m, d] = value.split('-');
    if (!y || !m || !d) return value;
    return `${d}/${m}/${y}`;
  }

  private async loadReport(): Promise<void> {
    const branchId = this.branchId();
    if (!branchId) return;

    this.loading.set(true);
    try {
      const report = await firstValueFrom(
        this.reportService.getSalesProfit(branchId, {
          from: this.fromDate() || undefined,
          to: this.toDate() || undefined,
        }),
      );
      this.summary.set(report.summary);
      this.daily.set(report.daily);
      this.topProducts.set(report.topProducts);
    } catch {
      this.summary.set(null);
      this.daily.set([]);
      this.topProducts.set([]);
      await this.showToast('REPORTS.LOAD_ERROR', 'danger');
    } finally {
      this.loading.set(false);
    }
  }

  private todayIso(): string {
    return this.toIsoDate(new Date());
  }

  private defaultFrom(): string {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return this.toIsoDate(d);
  }

  private toIsoDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private async showToast(
    messageKey: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const messages: Record<string, string> = {
      'REPORTS.LOAD_ERROR': 'Error al cargar el reporte',
      'REPORTS.CONTEXT_ERROR': 'No se pudo cargar la sucursal',
    };
    const t = await this.toast.create({
      message: messages[messageKey] ?? messageKey,
      duration: 2800,
      color,
    });
    await t.present();
  }
}
