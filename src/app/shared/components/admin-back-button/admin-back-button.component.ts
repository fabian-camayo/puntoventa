import { Component, inject } from '@angular/core';
import { IonButton, IonIcon, NavController } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { arrowBackOutline } from 'ionicons/icons';

addIcons({ arrowBackOutline });

@Component({
  selector: 'app-admin-back',
  template: `
    <ion-button
      class="admin-back-btn"
      fill="clear"
      type="button"
      (click)="goBack()"
    >
      <ion-icon name="arrow-back-outline" slot="start"></ion-icon>
      {{ 'ADMIN.BACK_TO_PANEL' | translate }}
    </ion-button>
  `,
  styles: [
    `
      :host {
        display: block;
        flex-shrink: 0;
      }

      .admin-back-btn {
        --padding-start: 6px;
        --padding-end: 10px;
        margin: 0;
        height: 40px;
        font-weight: 600;
        text-transform: none;
        letter-spacing: 0;
        color: var(--pv-text-secondary);
        white-space: nowrap;
      }

      .admin-back-btn ion-icon {
        font-size: 1.15rem;
      }
    `,
  ],
  imports: [IonButton, IonIcon, TranslateModule],
})
export class AdminBackButton {
  private readonly navCtrl = inject(NavController);

  goBack(): void {
    void this.navCtrl.navigateRoot('/admin', {
      animated: true,
      animationDirection: 'back',
    });
  }
}
