import { Injectable } from '@angular/core';
import { SaleDto } from '@puntoventa/shared';
import { DEFAULT_CURRENCY_CODE, DEFAULT_CURRENCY_LOCALE } from '@puntoventa/shared';

export interface ReceiptPrintData {
  sale: SaleDto;
  businessName?: string;
  ticketHeader?: string;
  ticketFooter?: string;
  registerName?: string;
  cashierName?: string;
}

@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  printReceipt(data: ReceiptPrintData): void {
    const html = this.buildReceiptHtml(data);
    const printWindow = window.open('', '_blank', 'width=420,height=720');

    if (!printWindow) {
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  }

  private buildReceiptHtml(data: ReceiptPrintData): string {
    const { sale, businessName, ticketHeader, ticketFooter, registerName, cashierName } = data;
    const fmt = (value: number) =>
      new Intl.NumberFormat(DEFAULT_CURRENCY_LOCALE, {
        style: 'currency',
        currency: DEFAULT_CURRENCY_CODE,
        maximumFractionDigits: 0,
      }).format(value);

    const date = sale.completedAt
      ? new Date(sale.completedAt)
      : new Date();

  const itemsHtml = sale.items
      .map(
        (item) => {
          const taxRate = item.taxRate ?? 0;
          const taxAmount = item.taxAmount ?? 0;
          const taxLabel = taxRate > 0 ? `${taxRate}%` : 'Exento';
          return `
        <tr>
          <td>
            ${this.escape(item.productName ?? item.sku ?? 'Producto')}
            ${taxRate > 0 ? `<div class="item-tax">IVA ${taxRate}%: ${fmt(taxAmount)}</div>` : ''}
          </td>
          <td class="num">${item.quantity}</td>
          <td class="num">${fmt(item.unitPrice)}</td>
          <td class="num">${taxLabel}</td>
          <td class="num">${fmt(item.total)}</td>
        </tr>`;
        },
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${this.escape(sale.documentNumber ?? sale.id ?? '')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      margin: 0;
      padding: 12px;
      color: #111;
      width: 80mm;
    }
    .center { text-align: center; }
    .business { font-size: 14px; font-weight: bold; margin-bottom: 4px; }
    .muted { color: #444; font-size: 11px; }
    .divider { border-top: 1px dashed #333; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 3px 0; vertical-align: top; }
    th { text-align: left; border-bottom: 1px solid #333; font-size: 10px; }
    .num { text-align: right; white-space: nowrap; font-size: 11px; }
    .item-tax { font-size: 10px; color: #555; margin-top: 2px; }
    .totals { margin-top: 8px; }
    .totals div { display: flex; justify-content: space-between; margin: 2px 0; }
    .total-line { font-size: 14px; font-weight: bold; margin-top: 4px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 4mm; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="business">${this.escape(businessName ?? 'PuntoVenta')}</div>
    ${ticketHeader ? `<div class="muted">${this.escape(ticketHeader)}</div>` : ''}
  </div>
  <div class="divider"></div>
  <div class="muted">Factura: <strong>${this.escape(sale.documentNumber ?? '—')}</strong></div>
  <div class="muted">Fecha: ${date.toLocaleString('es-CO')}</div>
  ${registerName ? `<div class="muted">Caja: ${this.escape(registerName)}</div>` : ''}
  ${cashierName ? `<div class="muted">Cajero: ${this.escape(cashierName)}</div>` : ''}
  ${sale.customerName ? `<div class="muted">Cliente: ${this.escape(sale.customerName)}</div>` : ''}
  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th>Producto</th>
        <th class="num">Cant</th>
        <th class="num">P.U.</th>
        <th class="num">IVA</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <div class="divider"></div>
  <div class="totals">
    <div><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
    <div><span>IVA</span><span>${fmt(sale.taxAmount)}</span></div>
    <div class="total-line"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
    <div><span>Pagado</span><span>${fmt(sale.amountPaid)}</span></div>
    <div><span>Cambio</span><span>${fmt(sale.changeAmount)}</span></div>
  </div>
  <div class="divider"></div>
  <div class="center muted">${this.escape(ticketFooter ?? 'Gracias por su compra')}</div>
  <script>window.onload = () => window.print();</script>
</body>
</html>`;
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
