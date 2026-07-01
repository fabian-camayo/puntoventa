import { Component } from '@angular/core';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { peopleOutline } from 'ionicons/icons';

addIcons({ peopleOutline });

@Component({
  selector: 'app-users',
  template: `
    <ion-content class="page-content">
      <div class="page-container">
        <div class="page-title-bar">
          <h1>
            <ion-icon name="people-outline"></ion-icon>
            {{ 'ADMIN.USERS' | translate }}
          </h1>
        </div>
        <div class="pv-card pv-card-body">
          <p>Módulo de usuarios — implementar CRUD</p>
        </div>
      </div>
    </ion-content>
  `,
  imports: [IonContent, IonIcon, TranslateModule],
})
export class UsersPage {}
