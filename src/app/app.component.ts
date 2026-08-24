import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { AppFooterComponent } from './shared/components/app-footer/app-footer.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, AppFooterComponent],
})
export class AppComponent {}
