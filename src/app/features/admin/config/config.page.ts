import { Component } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { settingsOutline } from 'ionicons/icons';

addIcons({ settingsOutline });

@Component({
  selector: 'app-config',
  template: `
    <ion-content class="page-content">
      <div class="page-container">
        <div class="page-title-bar">
          <h1>
            <ion-icon name="settings-outline"></ion-icon>
            {{ 'ADMIN.CONFIG' | translate }}
          </h1>
        </div>
        <div class="pv-card pv-card-body">
          <p>Módulo de configuración — implementar</p>
        </div>
      </div>
    </ion-content>
  `,
  imports: [IonContent, IonIcon, TranslateModule],
})
export class ConfigPage {}
