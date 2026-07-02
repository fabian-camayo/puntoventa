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
import { closeOutline, cashOutline } from 'ionicons/icons';
import { RegisterSessionDto } from '@puntoventa/shared';
import { RegisterService } from '@core/services/register.service';
import { AppCurrencyPipe } from '@shared/pipes/app-currency.pipe';

addIcons({ closeOutline, cashOutline });

@Component({
  selector: 'app-register-session-detail-modal',
  templateUrl: './register-session-detail.modal.html',
  styleUrls: ['./register-session-detail.modal.scss'],
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
    AppCurrencyPipe,
  ],
})
export class RegisterSessionDetailModal implements OnInit {
  private readonly registerService = inject(RegisterService);
  private readonly modalCtrl = inject(ModalController);

  @Input() sessionId = '';

  loading = signal(true);
  session = signal<RegisterSessionDto | null>(null);

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

  private load(): void {
    this.registerService.getSession(this.sessionId).subscribe({
      next: (session) => {
        this.session.set(session);
        this.loading.set(false);
      },
      error: () => {
        this.session.set(null);
        this.loading.set(false);
      },
    });
  }
}
