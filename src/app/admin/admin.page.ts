import { Component, inject, signal } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';

import { money } from '../core/format';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';

import type { Overview, VOver } from './admin.repo';
import { AdminRepo } from './admin.repo';

/** VanDesk team: platform overview and driver access. No daily operations. */
@Component({
  selector: 'app-admin',
  templateUrl: 'admin.page.html',
  styleUrls: ['admin.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class AdminPage {
  private readonly repo = inject(AdminRepo);
  private readonly toast = inject(ToastController);

  readonly o = signal<Overview | undefined>(undefined);
  readonly money = money;

  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.o.set(await this.repo.overview());
  }

  async toggle(v: VOver): Promise<void> {
    try {
      await this.repo.setDriverActive(v.driverId, !v.active);
    } catch (e) {
      const toast = await this.toast.create({ message: (e as Error).message, duration: 2500, color: 'dark' });
      await toast.present();
    }
    await this.load();
  }
}
