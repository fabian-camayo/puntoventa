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
import { closeOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { AUDIT_MODULES, AUDIT_ACTIONS, AuditLogDto } from '@puntoventa/shared';
import { AuditService } from '@core/services/audit.service';

addIcons({ closeOutline, shieldCheckmarkOutline });

interface DiffRow {
  field: string;
  before: string;
  after: string;
}

@Component({
  selector: 'app-audit-detail-modal',
  templateUrl: './audit-detail.modal.html',
  styleUrls: ['./audit-detail.modal.scss'],
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
export class AuditDetailModal implements OnInit {
  private readonly auditService = inject(AuditService);
  private readonly modalCtrl = inject(ModalController);

  @Input() logId = '';

  loading = signal(true);
  log = signal<AuditLogDto | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  dismiss(): void {
    void this.modalCtrl.dismiss();
  }

  formatDate(value?: string): string {
    if (!value) return '—';
    return new Date(value).toLocaleString('es-CO', { dateStyle: 'full', timeStyle: 'medium' });
  }

  moduleLabel(value: string): string {
    return AUDIT_MODULES.find((m) => m.value === value)?.label ?? value;
  }

  actionLabel(value: string): string {
    return AUDIT_ACTIONS.find((a) => a.value === value)?.label ?? value;
  }

  actionColor(action: string): string {
    switch (action) {
      case 'CREATE':
        return 'success';
      case 'DELETE':
      case 'VOID':
        return 'danger';
      case 'UPDATE':
      case 'CONFIG_CHANGE':
        return 'warning';
      case 'LOGIN':
        return 'primary';
      case 'LOGOUT':
        return 'medium';
      default:
        return 'tertiary';
    }
  }

  /** Filas Campo/Antes/Después cuando hay tanto oldValues como newValues (UPDATE). */
  diffRows(): DiffRow[] {
    const l = this.log();
    if (!l?.oldValues || !l?.newValues) return [];

    const keys = new Set([...Object.keys(l.oldValues), ...Object.keys(l.newValues)]);
    return [...keys].map((field) => ({
      field,
      before: this.formatValue(l.oldValues?.[field]),
      after: this.formatValue(l.newValues?.[field]),
    }));
  }

  /** Datos creados (solo newValues) o eliminados (solo oldValues). */
  snapshotRows(source: 'newValues' | 'oldValues'): DiffRow[] {
    const l = this.log();
    const data = l?.[source];
    if (!data) return [];
    return Object.entries(data).map(([field, value]) => ({
      field,
      before: '',
      after: this.formatValue(value),
    }));
  }

  hasDiff(): boolean {
    const l = this.log();
    return !!(l?.oldValues && l?.newValues);
  }

  isCreationOnly(): boolean {
    const l = this.log();
    return !!(l?.newValues && !l?.oldValues);
  }

  isDeletionOnly(): boolean {
    const l = this.log();
    return !!(l?.oldValues && !l?.newValues);
  }

  private formatValue(value: unknown): string {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  private load(): void {
    this.auditService.getById(this.logId).subscribe({
      next: (log) => {
        this.log.set(log);
        this.loading.set(false);
      },
      error: () => {
        this.log.set(null);
        this.loading.set(false);
      },
    });
  }
}
