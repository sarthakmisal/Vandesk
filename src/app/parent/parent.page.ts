import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';

import type { Statement } from '../fees/fees.models';
import { L, T, money } from '../fees/fees.models';
import { FeesRepo } from '../fees/fees.repo';
import { ProfileBarComponent } from '../shared/profile-bar/profile-bar.component';
import type { PInfo } from '../trip/trip.repo';
import { TripRepo } from '../trip/trip.repo';

@Component({
  selector: 'app-parent',
  templateUrl: 'parent.page.html',
  imports: [IonContent, ProfileBarComponent],
})
export class ParentPage {
  private trip = inject(TripRepo);
  private fees = inject(FeesRepo);
  private toast = inject(ToastController);
  private cd = inject(ChangeDetectorRef);
  private timer?: ReturnType<typeof setInterval>;
  kids: { id: string; name: string }[] = [];
  child = '';
  p?: PInfo;
  fee?: Statement;
  tab: 'status' | 'fees' = 'status';
  m = money;

  get t(): Record<string, string> {
    return T[L()];
  }

  async ionViewWillEnter(): Promise<void> {
    this.kids = await this.trip.children();
    if (!this.kids.some((k) => k.id === this.child)) this.child = this.kids[0]?.id ?? '';
    await this.load();
    this.cd.markForCheck();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.load(), 15000); // polling, no websockets
  }

  ionViewWillLeave(): void {
    clearInterval(this.timer);
  }

  async load(): Promise<void> {
    if (this.child)
      [this.p, this.fee] = await Promise.all([this.trip.parent(this.child), this.fees.statement(this.child)]);
    this.cd.markForCheck();
  }

  pick(id: string): void {
    this.child = id;
    this.load();
  }

  async going(g: boolean): Promise<void> {
    try {
      await this.trip.setGoing(this.child, g);
    } catch (e) {
      (await this.toast.create({ message: (e as Error).message, duration: 2600, color: 'dark' })).present();
    }
    await this.load();
  }

  msg(): string {
    const p = this.p;
    if (!p) return '';
    return !p.going
      ? '✓ ' + this.t['notGoing']
      : p.status === 'idle'
        ? 'Van has not started yet'
        : p.picked
          ? '✓ Picked up at ' + p.picked
          : p.status === 'ended'
            ? 'Trip ended'
            : p.away === null
              ? 'Van has passed your stop'
              : p.away === 0
                ? 'Next stop is yours'
                : p.away + ' stops before yours';
  }

  mon(per: string): string {
    return 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[+per.slice(5) - 1] + ' ' + per.slice(0, 4);
  }
}
