import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import { money } from '../core/format';
import { L, T } from '../core/i18n';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';
import { IconComponent } from '../ui/icon.component';
import { Toast } from '../ui/toast.service';

import type { Mode, Row } from './fees.models';
import { FeesRepo } from './fees.repo';
import { PaySheetComponent } from './pay-sheet/pay-sheet.component';

@Component({
  selector: 'app-fees',
  templateUrl: 'fees.page.html',
  styleUrls: ['fees.page.scss'],
  imports: [IonContent, ProfileBarComponent, IconComponent],
})
export class FeesPage {
  private readonly repo = inject(FeesRepo);
  private readonly modal = inject(ModalController);
  private readonly toast = inject(Toast);

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

  async open(row: Row): Promise<void> {
    const modal = await this.modal.create({
      component: PaySheetComponent,
      componentProps: { row },
      cssClass: 'vd-sheet',
      breakpoints: [0, 0.64],
      initialBreakpoint: 0.64,
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
      this.toast.show(`${row.name} · ${money(d.amount)} received`, {
        ms: 8000,
        action: {
          label: this.t().undo,
          run: async () => {
            await this.repo.reverse(id, 'Undo');
            await this.load();
          },
        },
      });
    } catch (e) {
      this.toast.error((e as Error).message);
    }
  }
}
