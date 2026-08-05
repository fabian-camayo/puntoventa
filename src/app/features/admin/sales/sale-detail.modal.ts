import { Component, Input, inject } from '@angular/core';
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
  IonText,
  ModalController,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  printOutline,
  createOutline,
  banOutline,
  trashOutline,
} from 'ionicons/icons';
import { firstValueFrom } from 'rxjs';
import { SaleDto, SaleStatus } from '@puntoventa/shared';
import { ReceiptPrintService } from '@core/services/receipt-print.service';
import { SaleService } from '@core/services/sale.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';
import { SaleEditModal } from './sale-edit.modal';

addIcons({ closeOutline, printOutline, createOutline, banOutline, trashOutline });

@Component({
  selector: 'app-sale-detail-modal',
  templateUrl: './sale-detail.modal.html',
  styleUrls: ['./sale-detail.modal.scss'],
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
    IonText,
    TranslateModule,
    AppCurrencyPipe,
  ],
})
export class SaleDetailModal {
  private readonly modalCtrl = inject(ModalController);
  private readonly alertCtrl = inject(AlertController);
  private readonly toast = inject(ToastController);
  private readonly receiptPrint = inject(ReceiptPrintService);
  private readonly saleService = inject(SaleService);

  @Input({ required: true }) sale!: SaleDto;
  @Input() branchId?: string;
  @Input() canVoid = false;
  @Input() canDelete = false;
  @Input() businessName?: string;
  @Input() taxId?: string;
  @Input() address?: string;
  @Input() phone?: string;
  @Input() email?: string;
  @Input() logoUrl?: string;
  @Input() ticketHeader?: string;
  @Input() ticketFooter?: string;
  @Input() registerName?: string;

  readonly SaleStatus = SaleStatus;
  busy = false;

  get canEditSale(): boolean {
    return this.canVoid && this.sale.status === SaleStatus.COMPLETED;
  }

  get canVoidSale(): boolean {
    return this.canVoid && this.sale.status === SaleStatus.COMPLETED;
  }

  get canDeleteSale(): boolean {
    return this.canDelete && !!this.sale.id;
  }

  close(): void {
    void this.modalCtrl.dismiss();
  }

  print(): void {
    if (this.sale.status !== SaleStatus.COMPLETED) return;

    this.receiptPrint.printReceipt({
      sale: this.sale,
      businessName: this.businessName,
      taxId: this.taxId,
      address: this.address,
      phone: this.phone,
      email: this.email,
      logoUrl: this.logoUrl,
      ticketHeader: this.ticketHeader,
      ticketFooter: this.ticketFooter,
      registerName: this.registerName,
      cashierName: undefined,
    });
  }

  async openEdit(): Promise<void> {
    if (!this.canEditSale || !this.branchId || !this.sale.id) return;

    const modal = await this.modalCtrl.create({
      component: SaleEditModal,
      componentProps: {
        sale: this.sale,
        branchId: this.branchId,
      },
      cssClass: 'pv-form-modal',
    });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<SaleDto>();
    if (role === 'saved' && data) {
      this.sale = data;
      await this.modalCtrl.dismiss(data, 'changed');
    }
  }

  async confirmVoid(): Promise<void> {
    if (!this.canVoidSale || !this.sale.id || this.busy) return;

    const alert = await this.alertCtrl.create({
      header: 'Anular venta',
      message: `¿Anular la factura ${this.sale.documentNumber ?? ''}? Se restaurará el stock y se revertirá el efectivo en caja.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Anular', role: 'confirm', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.busy = true;
    try {
      const updated = await firstValueFrom(this.saleService.voidSale(this.sale.id));
      await this.showToast('Venta anulada correctamente', 'success');
      await this.modalCtrl.dismiss(updated, 'changed');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToast(message ?? 'No se pudo anular la venta', 'danger');
    } finally {
      this.busy = false;
    }
  }

  async confirmDelete(): Promise<void> {
    if (!this.canDeleteSale || !this.sale.id || this.busy) return;

    const isCompleted = this.sale.status === SaleStatus.COMPLETED;
    const alert = await this.alertCtrl.create({
      header: 'Eliminar venta',
      message: isCompleted
        ? `¿Eliminar la factura ${this.sale.documentNumber ?? ''}? Se restaurará el stock, se revertirá el efectivo en caja y la venta se borrará de forma permanente.`
        : '¿Eliminar esta venta de forma permanente?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Eliminar', role: 'confirm', cssClass: 'alert-button-danger' },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    if (role !== 'confirm') return;

    this.busy = true;
    try {
      await firstValueFrom(this.saleService.deleteSale(this.sale.id));
      await this.showToast('Venta eliminada', 'success');
      await this.modalCtrl.dismiss(null, 'changed');
    } catch (err: unknown) {
      const message = (err as { error?: { message?: string } })?.error?.message;
      await this.showToast(message ?? 'No se pudo eliminar la venta', 'danger');
    } finally {
      this.busy = false;
    }
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO');
  }

  private async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning',
  ): Promise<void> {
    const t = await this.toast.create({ message, duration: 2500, color });
    await t.present();
  }
}
