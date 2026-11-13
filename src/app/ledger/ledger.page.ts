import { Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonContent, ToastController } from '@ionic/angular';

import { money } from '../core/format';
import { L, T } from '../core/i18n';
import type { LedgerRow, PlanRow } from '../fees/fees.models';
import { FeesRepo } from '../fees/fees.repo';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';

/** Owner tools for the driver: monthly fee plan, payments ledger with reversals, reminders. */
@Component({
  selector: 'app-ledger',
  templateUrl: 'ledger.page.html',
  styleUrls: ['ledger.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class LedgerPage {
  private readonly repo = inject(FeesRepo);
  private readonly alert = inject(AlertController);
  private readonly toast = inject(ToastController);

  readonly rows = signal<LedgerRow[]>([]);
  readonly plans = signal<PlanRow[]>([]);
  readonly t = computed(() => T[L()]);
  readonly money = money;
  /** The plan in force today is the newest one that has already started. */
  readonly current = computed(() =>
    this.plans().find((p) => p.effective_from <= new Date().toISOString().slice(0, 10)),
  );
  readonly upcoming = computed(() =>
    this.plans().filter((p) => p.effective_from > new Date().toISOString().slice(0, 10)),
  );

  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.rows.set(await this.repo.ledger());
    this.plans.set(await this.repo.plans());
  }

  async changeFee(): Promise<void> {
    const next = new Date();
    next.setMonth(next.getMonth() + 1, 1);
    const a = await this.alert.create({
      header: 'New monthly fee',
      subHeader: 'Past dues do not change.',
      inputs: [
        { name: 'amount', type: 'number', placeholder: 'Amount in ₹', min: 1 },
        { name: 'from', type: 'date', value: next.toISOString().slice(0, 10) },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: (v: { amount: string; from: string }) =>
            void this.run(() => this.repo.addPlan(Math.round(+v.amount * 100), v.from), 'Fee updated'),
        },
      ],
    });
    await a.present();
  }

  async reverse(r: LedgerRow): Promise<void> {
    const a = await this.alert.create({
      header: 'Reverse this payment?',
      subHeader: `${r.student} · ${money(r.amount)}. The original stays in the ledger.`,
      inputs: [{ name: 'note', type: 'text', placeholder: 'Reason (required)' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Reverse',
          role: 'destructive',
          handler: (v: { note: string }) =>
            void this.run(() => this.repo.reverse(r.id, v.note ?? ''), 'Payment reversed'),
        },
      ],
    });
    await a.present();
  }

  async remind(): Promise<void> {
    await this.run(async () => {
      const r = await this.repo.remind();
      await this.say(
        r.sent
          ? `${r.sent} reminder emails sent` + (r.skipped ? ` · ${r.skipped} already sent today` : '')
          : r.skipped
            ? 'Already sent today'
            : 'No pending fees',
      );
    });
  }

  private async run(f: () => Promise<void>, ok?: string): Promise<void> {
    try {
      await f();
      if (ok) {
        await this.say(ok);
      }
    } catch (e) {
      await this.say((e as Error).message, 'danger');
    }
    await this.load();
  }

  private async say(message: string, color = 'dark'): Promise<void> {
    const toast = await this.toast.create({ message, duration: 2800, color });
    await toast.present();
  }
}
