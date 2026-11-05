import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { IonContent, ModalController, ToastController } from '@ionic/angular';

import { ProfileBarComponent } from '../shared/profile-bar/profile-bar.component';

import type { Mode, Row } from './fees.models';
import { L, T, money } from './fees.models';
import { FeesRepo } from './fees.repo';
import { PaySheetComponent } from './pay-sheet.component';

@Component({
  selector: 'app-fees',
  templateUrl: 'fees.page.html',
  styleUrls: ['fees.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class FeesPage {
  private repo = inject(FeesRepo);
  private modalCtrl = inject(ModalController);
  private toast = inject(ToastController);
  private cd = inject(ChangeDetectorRef);
  rows: Row[] = [];
  today = 0;
  loading = true;
  err = false;
  m = money;
  skeleton = [1, 2, 3, 4];

  get t(): Record<string, string> {
    return T[L()];
  }
  get pending(): number {
    return this.rows.reduce((a, r) => a + r.balance, 0);
  }
  hue = (s: string): string => `hsl(${[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 70% 92%)`;

  ionViewWillEnter(): void {
    this.load(); // refresh on every tab visit (new students appear)
  }

  async load(): Promise<void> {
    try {
      [this.rows, this.today] = await Promise.all([this.repo.list(), this.repo.collectedToday()]);
      this.err = false;
    } catch {
      this.err = true;
    } finally {
      this.loading = false;
      this.cd.markForCheck();
    }
  }

  async open(r: Row): Promise<void> {
    const m = await this.modalCtrl.create({
      component: PaySheetComponent,
      componentProps: { row: r, t: this.t },
      breakpoints: [0, 0.8],
      initialBreakpoint: 0.8,
    });
    await m.present();
    const { data } = await m.onDidDismiss<{ amount: number; mode: Mode }>();
    if (data) await this.done(r, data);
  }

  private async done(r: Row, d: { amount: number; mode: Mode }) {
    try {
      const id = await this.repo.record(r.id, d.amount, d.mode);
      await this.load();
      const to = await this.toast.create({
        message: `✓ ${r.name} · ${money(d.amount)}`,
        duration: 8000,
        position: 'bottom',
        color: 'dark',
        buttons: [
          {
            text: this.t['undo'],
            handler: async () => {
              await this.repo.undo(id);
              await this.load();
            },
          },
        ],
      });
      await to.present();
    } catch (e) {
      (await this.toast.create({ message: (e as Error).message, duration: 2500, color: 'danger' })).present();
    }
  }
}
