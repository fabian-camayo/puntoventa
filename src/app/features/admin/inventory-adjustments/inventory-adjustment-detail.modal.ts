import { Component, Input, OnInit, inject, signal } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonIcon,
  IonSpinner,
  IonBadge,
  ModalController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, swapVerticalOutline } from 'ionicons/icons';
import { InventoryAdjustmentDto, AdjustmentTypeDto } from '@puntoventa/shared';
import { InventoryService } from '@core/services/inventory.service';

addIcons({ closeOutline, swapVerticalOutline });

@Component({
  selector: 'app-inventory-adjustment-detail-modal',
  templateUrl: './inventory-adjustment-detail.modal.html',
  styleUrls: ['./inventory-adjustment-detail.modal.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonSpinner,
    IonBadge,
    TranslateModule,
  ],
})
export class InventoryAdjustmentDetailModal implements OnInit {
  private readonly inventoryService = inject(InventoryService);
  private readonly modalCtrl = inject(ModalController);

  @Input() adjustmentId = '';

  loading = signal(true);
  adjustment = signal<InventoryAdjustmentDto | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO');
  }

  typeLabel(type: AdjustmentTypeDto): string {
    switch (type) {
      case 'INCREASE':
        return 'Entrada manual';
      case 'DECREASE':
        return 'Salida manual';
      case 'SET':
        return 'Conteo físico';
      default:
        return type;
    }
  }

  typeColor(type: AdjustmentTypeDto): string {
    switch (type) {
      case 'INCREASE':
        return 'success';
      case 'DECREASE':
        return 'danger';
      case 'SET':
        return 'medium';
      default:
        return 'medium';
    }
  }

  private load(): void {
    this.inventoryService.getAdjustment(this.adjustmentId).subscribe({
      next: (adjustment) => {
        this.adjustment.set(adjustment);
        this.loading.set(false);
      },
      error: () => {
        this.adjustment.set(null);
        this.loading.set(false);
      },
    });
  }
}
