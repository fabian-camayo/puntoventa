import { Injectable } from '@angular/core';
import { SaleDto } from '@puntoventa/shared';
import { DEFAULT_CURRENCY_CODE, DEFAULT_CURRENCY_LOCALE } from '@puntoventa/shared';

export interface ReceiptPrintData {
  sale: SaleDto;
  businessName?: string;
  taxId?: string;
  address?: string;
  phone?: string;
  email?: string;
  logoUrl?: string;
  /** Mensaje al inicio de la factura */
  ticketHeader?: string;
  /** Mensaje legal / pie de factura */
  ticketFooter?: string;
  /** Resolución de facturación (ej. resolución DIAN) configurada en el negocio */
  invoiceResolution?: string;
  /** Política de garantía configurada en el negocio */
  warrantyPolicy?: string;
  registerName?: string;
  cashierName?: string;
}

const DEFAULT_LEGAL_FOOTER =
  'Documento equivalente a factura de venta. Conserve este comprobante. ' +
  'Gracias por su compra.';

/** Cuánto esperar como máximo por `afterprint` antes de limpiar de todas formas. */
const PRINT_CLEANUP_TIMEOUT_MS = 4000;
/** Cuánto esperar a que cargue el logo antes de imprimir de todas formas. */
const LOGO_LOAD_TIMEOUT_MS = 1200;

@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  private printing = false;

  /** true mientras hay una impresión en curso; útil para deshabilitar el botón "Imprimir". */
  isPrinting(): boolean {
    return this.printing;
  }

  /**
   * Genera el comprobante e imprime directamente, sin abrir pestaña ni ventana
   * externa: el contenido se renderiza en un `<iframe>` oculto dentro de la
   * página actual y se invoca `print()` sobre ese iframe. El usuario nunca sale
   * del contexto de la aplicación ni tiene que interactuar con nada fuera del
   * botón "Imprimir".
   */
  printReceipt(data: ReceiptPrintData): Promise<void> {
    if (this.printing) {
      // Ya hay una impresión en curso (protege contra doble clic / doble disparo).
      return Promise.resolve();
    }
    this.printing = true;

    return new Promise<void>((resolve, reject) => {
      let settled = false;
      let iframe: HTMLIFrameElement | null = null;

      const cleanup = () => {
        this.printing = false;
        if (iframe?.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      };

      const finish = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const fail = (err: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(err instanceof Error ? err : new Error('No se pudo imprimir el comprobante'));
      };

      try {
        iframe = document.createElement('iframe');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        iframe.style.visibility = 'hidden';

        iframe.onload = () => {
          const win = iframe?.contentWindow;
          const doc = iframe?.contentDocument;
          if (!win || !doc) {
            fail(new Error('No se pudo preparar el documento de impresión'));
            return;
          }

          win.onafterprint = finish;

          const triggerPrint = () => {
            try {
              win.focus();
              win.print();
              // No todos los navegadores disparan `afterprint` de forma confiable
              // (ej. al cancelar el diálogo en algunos entornos); nos aseguramos
              // de limpiar el iframe de todas formas tras un margen razonable.
              setTimeout(finish, PRINT_CLEANUP_TIMEOUT_MS);
            } catch (err) {
              fail(err);
            }
          };

          const img = doc.querySelector<HTMLImageElement>('.logo');
          if (img && !img.complete) {
            img.addEventListener('load', triggerPrint, { once: true });
            img.addEventListener('error', triggerPrint, { once: true });
            setTimeout(triggerPrint, LOGO_LOAD_TIMEOUT_MS);
          } else {
            triggerPrint();
          }
        };

        iframe.srcdoc = this.buildReceiptHtml(data);
        document.body.appendChild(iframe);
      } catch (err) {
        fail(err);
      }
    });
  }

  private buildReceiptHtml(data: ReceiptPrintData): string {
    const {
      sale,
      businessName,
      taxId,
      address,
      phone,
      email,
      logoUrl,
      ticketHeader,
      ticketFooter,
      invoiceResolution,
      warrantyPolicy,
      registerName,
      cashierName,
    } = data;

    const fmt = (value: number) =>
      new Intl.NumberFormat(DEFAULT_CURRENCY_LOCALE, {
        style: 'currency',
        currency: DEFAULT_CURRENCY_CODE,
        maximumFractionDigits: 0,
      }).format(value);

    const date = sale.completedAt ? new Date(sale.completedAt) : new Date();

    const itemsHtml = sale.items
      .map((item) => {
        const taxRate = item.taxRate ?? 0;
        const taxAmount = item.taxAmount ?? item.total - item.subtotal;
        const unitLabel =
          item.unitTypeCode || item.unitTypeName || item.unitTypeId || 'UND';
        return `
        <tr>
          <td class="col-product">
            <div class="product-name">${this.escape(item.productName ?? item.sku ?? 'Producto')}</div>
            ${item.sku ? `<div class="sku">SKU: ${this.escape(item.sku)}</div>` : ''}
          </td>
          <td class="num">${this.escape(unitLabel)}</td>
          <td class="num">${this.formatQty(item.quantity)}</td>
          <td class="num">${fmt(item.unitPrice)}</td>
          <td class="num">
            ${taxRate > 0 ? `${taxRate}%` : '0%'}
            <div class="tax-amt">${fmt(taxAmount)}</div>
          </td>
          <td class="num">${fmt(item.total)}</td>
        </tr>`;
      })
      .join('');

    const paymentsHtml = (sale.payments ?? [])
      .map(
        (p) => `
        <div class="pay-row">
          <span>${this.escape(p.paymentTypeName ?? p.paymentTypeCode ?? 'Pago')}</span>
          <span>${fmt(p.amount)}</span>
        </div>`,
      )
      .join('');

    const logoHtml = logoUrl
      ? `<img class="logo" src="${this.escapeAttr(logoUrl)}" alt="Logo" />`
      : '';

    const businessLines = [
      taxId ? `NIT / ID: ${this.escape(taxId)}` : '',
      address ? this.escape(address) : '',
      [phone ? `Tel: ${this.escape(phone)}` : '', email ? this.escape(email) : '']
        .filter(Boolean)
        .join(' · '),
    ]
      .filter(Boolean)
      .map((line) => `<div class="biz-line">${line}</div>`)
      .join('');

    const headerMsg = ticketHeader?.trim()
      ? `<div class="message header-msg">${this.formatMultiline(ticketHeader)}</div>`
      : '';

    const footerMsg = this.formatMultiline(
      ticketFooter?.trim() || DEFAULT_LEGAL_FOOTER,
    );

    const resolutionMsg = invoiceResolution?.trim()
      ? `<div class="legal-block"><div class="legal-label">Resolución de facturación</div><div class="message legal-msg">${this.formatMultiline(invoiceResolution)}</div></div>`
      : '';

    const warrantyMsg = warrantyPolicy?.trim()
      ? `<div class="legal-block"><div class="legal-label">Política de garantía</div><div class="message legal-msg">${this.formatMultiline(warrantyPolicy)}</div></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${this.escape(sale.documentNumber ?? sale.id ?? '')}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      margin: 0;
      padding: 10px;
      color: #111;
      width: 80mm;
    }
    .center { text-align: center; }
    .logo {
      max-width: 52mm;
      max-height: 28mm;
      object-fit: contain;
      margin: 0 auto 6px;
      display: block;
    }
    .business { font-size: 15px; font-weight: bold; margin-bottom: 2px; }
    .biz-line { font-size: 10px; color: #333; line-height: 1.35; }
    .muted { color: #444; font-size: 10px; }
    .divider { border-top: 1px dashed #333; margin: 8px 0; }
    .message {
      font-size: 10px;
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .header-msg { margin: 6px 0; font-weight: 600; }
    .legal-block { margin-top: 6px; }
    .legal-label { font-size: 9px; font-weight: bold; text-transform: uppercase; }
    .legal-msg { margin-top: 4px; font-size: 9px; color: #333; }
    .meta div { margin: 1px 0; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { padding: 3px 1px; vertical-align: top; }
    th {
      text-align: left;
      border-bottom: 1px solid #333;
      font-size: 9px;
      text-transform: uppercase;
    }
    .col-product { width: 32%; }
    .num { text-align: right; white-space: nowrap; font-size: 10px; }
    .product-name { font-weight: 600; word-break: break-word; white-space: normal; }
    .sku, .tax-amt { font-size: 9px; color: #555; }
    .totals { margin-top: 6px; }
    .totals .row, .pay-row {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin: 2px 0;
    }
    .total-line { font-size: 13px; font-weight: bold; margin-top: 4px; }
    .section-label { font-size: 10px; font-weight: bold; margin: 6px 0 2px; }
    @media print {
      body { width: 80mm; }
      @page { margin: 3mm; size: auto; }
    }
  </style>
</head>
<body>
  <div class="center">
    ${logoHtml}
    <div class="business">${this.escape(businessName ?? 'PuntoVenta')}</div>
    ${businessLines}
  </div>

  ${headerMsg ? `<div class="divider"></div>${headerMsg}` : ''}

  <div class="divider"></div>
  <div class="meta muted">
    <div>Factura: <strong>${this.escape(sale.documentNumber ?? '—')}</strong></div>
    <div>Fecha: ${date.toLocaleString('es-CO')}</div>
    ${registerName ? `<div>Caja: ${this.escape(registerName)}</div>` : ''}
    ${cashierName ? `<div>Cajero: ${this.escape(cashierName)}</div>` : ''}
    ${sale.customerName ? `<div>Cliente: ${this.escape(sale.customerName)}</div>` : ''}
  </div>

  <div class="divider"></div>
  <table>
    <thead>
      <tr>
        <th class="col-product">Producto</th>
        <th class="num">Und</th>
        <th class="num">Cant</th>
        <th class="num">P.Unit</th>
        <th class="num">IVA</th>
        <th class="num">Total</th>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>

  <div class="divider"></div>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${fmt(sale.subtotal)}</span></div>
    ${
      sale.discountAmount > 0
        ? `<div class="row"><span>Descuento</span><span>-${fmt(sale.discountAmount)}</span></div>`
        : ''
    }
    <div class="row"><span>IVA</span><span>${fmt(sale.taxAmount)}</span></div>
    <div class="row total-line"><span>TOTAL</span><span>${fmt(sale.total)}</span></div>
  </div>

  ${
    paymentsHtml
      ? `<div class="section-label">Formas de pago</div>${paymentsHtml}`
      : ''
  }
  <div class="totals">
    <div class="row"><span>Pagado</span><span>${fmt(sale.amountPaid)}</span></div>
    <div class="row"><span>Cambio</span><span>${fmt(sale.changeAmount)}</span></div>
  </div>

  <div class="divider"></div>
  ${resolutionMsg}
  ${warrantyMsg}
  <div class="center legal-msg message">${footerMsg}</div>
</body>
</html>`;
  }

  private formatQty(value: number): string {
    return Number.isInteger(value)
      ? String(value)
      : value.toLocaleString('es-CO', { maximumFractionDigits: 3 });
  }

  private formatMultiline(value: string): string {
    return this.escape(value).replace(/\r\n|\n|\r/g, '<br/>');
  }

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  private escapeAttr(value: string): string {
    return this.escape(value).replace(/'/g, '&#39;');
  }
}
