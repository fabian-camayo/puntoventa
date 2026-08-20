import { Component, Input, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon,
  IonSpinner,
  ModalController,
  ToastController,
  AlertController,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { closeOutline, checkmarkOutline, cubeOutline, addOutline, removeOutline } from 'ionicons/icons';
import { startWith } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { INVENTORY_ADJUSTMENT_REASONS } from '@puntoventa/shared';
import { InventoryService } from '@core/services/inventory.service';
import { FieldErrorComponent } from '@shared/components/field-error/field-error.component';
import { isControlInvalid, notifyInvalidForm, extractApiError } from '@shared/utils/form-validation';

addIcons({ closeOutline, checkmarkOutline, cubeOutline, addOutline, removeOutline });

type OpMode = 'DELTA' | 'SET';
type Direction = 'IN' | 'OUT';

const OTHER_REASON = 'Otro';

@Component({
  selector: 'app-inventory-adjustment-modal',
  templateUrl: './inventory-adjustment.modal.html',
  styleUrls: ['./inventory-adjustment.modal.scss'],
  imports: [
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonSpinner,
    TranslateModule,
    FieldErrorComponent,
  ],
})
export class InventoryAdjustmentModal implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly inventoryService = inject(InventoryService);
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  @Input() branchId = '';
  @Input() productId = '';
  @Input() productName = '';
  @Input() sku = '';
  @Input() unit = '';
  @Input() currentQty = 0;

  readonly reasons = INVENTORY_ADJUSTMENT_REASONS;
  readonly otherReason = OTHER_REASON;
  saving = signal(false);
  newStock = signal(this.currentQty);
  readonly isInvalid = isControlInvalid;

  form = this.fb.nonNullable.group({
    opMode: ['DELTA' as OpMode, Validators.required],
    direction: ['IN' as Direction, Validators.required],
    amount: [null as number | null, [Validators.required, Validators.min(0.001)]],
    physicalQty: [null as number | null, [Validators.required, Validators.min(0)]],
    reason: ['', Validators.required],
    reasonOther: [''],
    notes: ['', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    this.newStock.set(this.currentQty);
    this.form.valueChanges.pipe(startWith(null)).subscribe(() => {
      this.newStock.set(this.computeNewStock(this.form.getRawValue()));
    });
    this.onOpModeChange('DELTA');
  }

  onOpModeChange(mode: unknown): void {
    if (mode !== 'DELTA' && mode !== 'SET') return;
    this.form.controls.opMode.setValue(mode);
    if (mode === 'DELTA') {
      this.form.controls.amount.setValidators([Validators.required, Validators.min(0.001)]);
      this.form.controls.physicalQty.clearValidators();
    } else {
      this.form.controls.physicalQty.setValidators([Validators.required, Validators.min(0)]);
      this.form.controls.amount.clearValidators();
    }
    this.form.controls.amount.updateValueAndValidity();
    this.form.controls.physicalQty.updateValueAndValidity();
  }

  onDirectionChange(value: unknown): void {
    if (value !== 'IN' && value !== 'OUT') return;
    this.form.controls.direction.setValue(value);
  }

  onReasonChange(value: string): void {
    this.form.controls.reason.setValue(value);
    if (value === OTHER_REASON) {
      this.form.controls.reasonOther.setValidators([Validators.required, Validators.maxLength(200)]);
    } else {
      this.form.controls.reasonOther.clearValidators();
    }
    this.form.controls.reasonOther.updateValueAndValidity();
  }

  dismiss(saved = false): void {
    void this.modalCtrl.dismiss(null, saved ? 'saved' : 'cancel');
  }

  async confirmAndSave(): Promise<void> {
    if (await notifyInvalidForm(this.form, this.toast)) return;

    const raw = this.form.getRawValue();
    const quantity = this.resolveSignedQuantity(raw);
    if (raw.opMode === 'DELTA' && quantity === 0) {
      const t = await this.toast.create({
        message: 'La cantidad debe ser distinta de cero',
        color: 'warning',
        duration: 3000,
      });
      await t.present();
      return;
    }

    const reason = raw.reason === OTHER_REASON ? raw.reasonOther.trim() : raw.reason;
    const previousQty = this.currentQty;
    const nextQty = this.computeNewStock(raw);

    const alert = await this.alertCtrl.create({
      header: 'Confirmar ajuste',
      message: this.buildConfirmMessage(previousQty, nextQty, reason),
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Confirmar',
          handler: () => {
            void this.save(raw.opMode, quantity, reason, raw.notes);
          },
        },
      ],
    });
    await alert.present();
  }

  private buildConfirmMessage(previousQty: number, nextQty: number, reason: string): string {
    return (
      `Producto: ${this.productName}\n` +
      `Stock actual: ${previousQty}\n` +
      `Stock nuevo: ${nextQty}\n` +
      `Motivo: ${reason}`
    ).replace(/\n/g, '<br>');
  }

  private async save(
    mode: OpMode,
    quantity: number,
    reason: string,
    notes: string,
  ): Promise<void> {
    if (!this.branchId || !this.productId) return;

    this.saving.set(true);
    try {
      await firstValueFrom(
        this.inventoryService.createManualAdjustment({
          branchId: this.branchId,
          productId: this.productId,
          mode,
          quantity,
          reason,
          notes: notes?.trim() || undefined,
        }),
      );
      this.dismiss(true);
    } catch (err: unknown) {
      const message = extractApiError(err, 'No se pudo registrar el ajuste');
      const t = await this.toast.create({ message, duration: 3500, color: 'danger' });
      await t.present();
    } finally {
      this.saving.set(false);
    }
  }

  private resolveSignedQuantity(raw: {
    opMode: OpMode;
    direction: Direction;
    amount: number | null;
    physicalQty: number | null;
  }): number {
    if (raw.opMode === 'SET') {
      return raw.physicalQty ?? 0;
    }
    const amount = raw.amount ?? 0;
    return raw.direction === 'OUT' ? -amount : amount;
  }

  private computeNewStock(raw: {
    opMode: OpMode;
    direction: Direction;
    amount: number | null;
    physicalQty: number | null;
  }): number {
    if (raw.opMode === 'SET') {
      return raw.physicalQty ?? this.currentQty;
    }
    const amount = raw.amount ?? 0;
    const signed = raw.direction === 'OUT' ? -amount : amount;
    return Math.round((this.currentQty + signed) * 1000) / 1000;
  }
}
