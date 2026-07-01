import { Component } from '@angular/core';
import { IonRouterOutlet } from '@ionic/angular/standalone';
import { AppMenuComponent } from './shared/components/app-menu/app-menu.component';

@Component({
  selector: 'app-shell',
  template: `
    <div class="app-shell">
      <app-menu></app-menu>
      <main id="main-content" class="app-main">
        <ion-router-outlet></ion-router-outlet>
      </main>
    </div>
  `,
  styleUrls: ['./app-shell.page.scss'],
  imports: [AppMenuComponent, IonRouterOutlet],
})
export class AppShellPage {}
