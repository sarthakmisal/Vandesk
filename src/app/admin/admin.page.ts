import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';

import { money } from '../fees/fees.models';
import { ProfileBarComponent } from '../shared/profile-bar/profile-bar.component';

import type { Overview, VOver } from './admin.repo';
import { AdminRepo } from './admin.repo';

@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class AdminPage {
  private repo = inject(AdminRepo);
  private toast = inject(ToastController);
  private cd = inject(ChangeDetectorRef);
  o?: Overview;
  m = money;

  ionViewWillEnter(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.o = await this.repo.overview();
    this.cd.markForCheck();
  }

  async toggle(v: VOver): Promise<void> {
    try {
      await this.repo.setDriverActive(v.driverId, !v.active);
    } catch (e) {
      (await this.toast.create({ message: (e as Error).message, duration: 2500, color: 'dark' })).present();
    }
    await this.load();
  }
}
