import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ConfigService } from './config.service';

export interface SalesProfitSummary {
  salesCount: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalTax: number;
  totalDiscount: number;
  totalCost: number;
  totalProfit: number;
  marginPercent: number;
}

export interface SalesProfitDailyRow {
  date: string;
  salesCount: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface SalesProfitProductRow {
  rank: number;
  productId: string;
  sku: string;
  name: string;
  quantitySold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface SalesProfitReport {
  report: string;
  branchId: string;
  period: { from?: string; to?: string };
  summary: SalesProfitSummary;
  daily: SalesProfitDailyRow[];
  topProducts: SalesProfitProductRow[];
}

@Injectable({ providedIn: 'root' })
export class ReportService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  private get baseUrl(): string {
    return `${this.config.apiBaseUrl}/reports`;
  }

  getSalesProfit(
    branchId: string,
    params?: { from?: string; to?: string },
  ): Observable<SalesProfitReport> {
    const query: Record<string, string> = { branchId };
    if (params?.from) query['from'] = params.from;
    if (params?.to) query['to'] = params.to;

    return this.http
      .get<{ data: SalesProfitReport }>(`${this.baseUrl}/sales-profit`, { params: query })
      .pipe(map((r) => r.data));
  }
}
