import { Component, computed, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { busOutline, peopleOutline, receiptOutline, walletOutline } from 'ionicons/icons';

import { DrivingMode } from '../core/driving-mode';
import { L, T } from '../core/i18n';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
})
export class TabsPage {
  readonly driving = inject(DrivingMode);
  readonly t = computed(() => T[L()]);

  constructor() {
    addIcons({ walletOutline, peopleOutline, busOutline, receiptOutline });
  }
}
