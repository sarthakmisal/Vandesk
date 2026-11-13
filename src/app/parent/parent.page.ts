import type { OnDestroy } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';

import type { Direction } from '../core/direction';
import { defaultDirection } from '../core/direction';
import { money } from '../core/format';
import { L, T } from '../core/i18n';
import type { Statement } from '../fees/fees.models';
import { FeesRepo } from '../fees/fees.repo';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';
import type { PInfo } from '../trip/trip.repo';
import { TripRepo } from '../trip/trip.repo';

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/** Parent flow: own children only. Track the van, set Going / Not going (until the trip starts), read-only fees. */
@Component({
  selector: 'app-parent',
  templateUrl: 'parent.page.html',
  styleUrls: ['parent.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class ParentPage implements OnDestroy {
  private readonly trip = inject(TripRepo);
  private readonly fees = inject(FeesRepo);
  private readonly toast = inject(ToastController);
  private timer?: ReturnType<typeof setInterval>;

  readonly kids = signal<{ id: string; name: string }[]>([]);
  readonly child = signal('');
  readonly p = signal<PInfo | undefined>(undefined);
  readonly fee = signal<Statement | undefined>(undefined);
  readonly tab = signal<'status' | 'fees'>('status');
  readonly dir = signal<Direction>(defaultDirection());
  readonly t = computed(() => T[L()]);
  readonly money = money;
  readonly msg = computed(() => {
    const p = this.p();
    if (!p) {
      return '';
    }
    if (!p.going) {
      return '✓ ' + this.t().notGoing;
    }
    if (p.status === 'idle') {
      return 'Van has not started yet';
    }
    if (p.picked) {
      return (p.direction === 'pickup' ? '✓ Picked up at ' : '✓ Dropped at ') + p.picked;
    }
    if (p.status === 'ended') {
      return 'Trip ended';
    }
    return p.away === null
      ? 'Van has passed your stop'
      : p.away === 0
        ? 'Next stop is yours'
        : p.away + ' stops before yours';
  });

  async ionViewWillEnter(): Promise<void> {
    const kids = await this.trip.children();
    this.kids.set(kids);
    if (!kids.some((k) => k.id === this.child())) {
      this.child.set(kids[0]?.id ?? '');
    }
    await this.load();
    clearInterval(this.timer);
    this.timer = setInterval(() => void this.load(), 15000); // polling, no websockets
  }

  ionViewWillLeave(): void {
    clearInterval(this.timer);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  async load(): Promise<void> {
    const id = this.child();
    if (!id) {
      return;
    }
    const [p, fee] = await Promise.all([this.trip.parent(id, this.dir()), this.fees.statement(id)]);
    this.p.set(p);
    this.fee.set(fee);
  }

  pick(id: string): void {
    this.child.set(id);
    void this.load();
  }

  async going(g: boolean): Promise<void> {
    try {
      await this.trip.setGoing(this.child(), g, this.dir());
    } catch (e) {
      const toast = await this.toast.create({ message: (e as Error).message, duration: 2600, color: 'dark' });
      await toast.present();
    }
    await this.load();
  }

  setDir(d: Direction): void {
    this.dir.set(d);
    void this.load();
  }

  /** Opens the (rounded) last-stop location in OpenStreetMap. */
  mapUrl(p: { lat: number; lng: number }): string {
    return `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=16/${p.lat}/${p.lng}`;
  }

  mon(per: string): string {
    return MONTHS[+per.slice(5) - 1] + ' ' + per.slice(0, 4);
  }
}
