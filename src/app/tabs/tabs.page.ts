import { Component, computed, inject } from '@angular/core';
import { IonTabs, IonTabBar, IonTabButton, IonLabel } from '@ionic/angular';

import { DrivingMode } from '../core/driving-mode';
import { L, T } from '../core/i18n';
import { IconComponent } from '../ui/icon.component';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  imports: [IonTabs, IonTabBar, IonTabButton, IonLabel, IconComponent],
})
export class TabsPage {
  readonly driving = inject(DrivingMode);
  readonly t = computed(() => T[L()]);
}
