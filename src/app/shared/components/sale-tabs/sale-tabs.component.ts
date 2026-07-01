import { Component, Input, Output, EventEmitter } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline } from 'ionicons/icons';
import { SaleTab } from '@puntoventa/shared';
import { AppCurrencyPipe } from '../../pipes/app-currency.pipe';

addIcons({ addOutline, closeOutline });

@Component({
  selector: 'app-sale-tabs',
  templateUrl: './sale-tabs.component.html',
  styleUrls: ['./sale-tabs.component.scss'],
  imports: [IonButton, IonIcon, AppCurrencyPipe],
})
export class SaleTabsComponent {
  @Input() tabs: SaleTab[] = [];
  @Input() activeTabId: string | null = null;
  @Input() disableNewTab = false;
  @Output() tabSelect = new EventEmitter<string>();
  @Output() tabClose = new EventEmitter<{ id: string; event: Event }>();
  @Output() newTab = new EventEmitter<void>();

  onTabSelect(tabId: string): void {
    this.tabSelect.emit(tabId);
  }

  onTabClose(id: string, event: Event): void {
    event.stopPropagation();
    this.tabClose.emit({ id, event });
  }
}
