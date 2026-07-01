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
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, printOutline } from 'ionicons/icons';
import { SaleDto, SaleStatus } from '@puntoventa/shared';
import { ReceiptPrintService } from '@core/services/receipt-print.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';

addIcons({ closeOutline, printOutline });

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
  private readonly receiptPrint = inject(ReceiptPrintService);

  @Input({ required: true }) sale!: SaleDto;
  @Input() businessName?: string;
  @Input() ticketHeader?: string;
  @Input() ticketFooter?: string;
  @Input() registerName?: string;

  readonly SaleStatus = SaleStatus;

  close(): void {
    void this.modalCtrl.dismiss();
  }

  print(): void {
    if (this.sale.status !== SaleStatus.COMPLETED) return;

    this.receiptPrint.printReceipt({
      sale: this.sale,
      businessName: this.businessName,
      ticketHeader: this.ticketHeader,
      ticketFooter: this.ticketFooter,
      registerName: this.registerName,
      cashierName: undefined,
    });
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO');
  }
}
