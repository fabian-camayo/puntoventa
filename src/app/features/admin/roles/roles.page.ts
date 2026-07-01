import { Component } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { shieldOutline } from 'ionicons/icons';

addIcons({ shieldOutline });

@Component({
  selector: 'app-roles',
  template: `
    <ion-content class="page-content">
      <div class="page-container">
        <div class="page-title-bar">
          <h1>
            <ion-icon name="shield-outline"></ion-icon>
            {{ 'ADMIN.ROLES' | translate }}
          </h1>
        </div>
        <div class="pv-card pv-card-body">
          <p>Módulo de roles — implementar CRUD</p>
        </div>
      </div>
    </ion-content>
  `,
  imports: [IonContent, IonIcon, TranslateModule],
})
export class RolesPage {}
