import { Component } from '@angular/core';
import { IonButtons, IonMenuButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-menu-button',
  template: `
    <ion-buttons slot="start">
      <ion-menu-button menu="app-menu" aria-label="Menú"></ion-menu-button>
    </ion-buttons>
  `,
  imports: [IonButtons, IonMenuButton],
})
export class MenuButtonComponent {}
