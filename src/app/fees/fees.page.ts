import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, ModalController, ToastController } from '@ionic/angular';

import { money } from '../core/format';
import { L, T } from '../core/i18n';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';

import type { Mode, Row } from './fees.models';
import { FeesRepo } from './fees.repo';
import { PaySheetComponent } from './pay-sheet/pay-sheet.component';

@Component({
  selector: 'app-fees',
  templateUrl: 'fees.page.html',
  styleUrls: ['fees.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class FeesPage {
  private readonly repo = inject(FeesRepo);
  private readonly modal = inject(ModalController);
  private readonly toast = inject(ToastController);

  readonly rows = signal<Row[]>([]);
  readonly today = signal(0);
  readonly loading = signal(true);
  readonly err = signal(false);
  readonly pending = computed(() => this.rows().reduce((a, r) => a + r.balance, 0));
  readonly t = computed(() => T[L()]);
  readonly money = money;
  readonly skeleton = [1, 2, 3, 4];

  /** Refresh on every tab visit so newly added students appear. */
  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      const [rows, today] = await Promise.all([this.repo.list(), this.repo.collectedToday()]);
      this.rows.set(rows);
      this.today.set(today);
      this.err.set(false);
    } catch {
      this.err.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  hue(name: string): string {
    return `hsl(${[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 70% 92%)`;
  }

  async open(row: Row): Promise<void> {
    const modal = await this.modal.create({
      component: PaySheetComponent,
      componentProps: { row },
      breakpoints: [0, 0.8],
      initialBreakpoint: 0.8,
    });
    await modal.present();
    const { data } = await modal.onDidDismiss<{ amount: number; mode: Mode }>();
    if (data) {
      await this.done(row, data);
    }
  }

  private async done(row: Row, d: { amount: number; mode: Mode }): Promise<void> {
    try {
      const id = await this.repo.record(row.id, d.amount, d.mode);
      await this.load();
      const toast = await this.toast.create({
        message: `✓ ${row.name} · ${money(d.amount)}`,
        duration: 8000,
        position: 'bottom',
        color: 'dark',
        buttons: [
          {
            text: this.t().undo,
            handler: async () => {
              await this.repo.reverse(id, 'Undo');
              await this.load();
            },
          },
        ],
      });
      await toast.present();
    } catch (e) {
      const toast = await this.toast.create({ message: (e as Error).message, duration: 2500, color: 'danger' });
      await toast.present();
    }
  }
}
