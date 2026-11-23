import type { OnDestroy } from '@angular/core';
import { Component, computed, inject, signal } from '@angular/core';
import { IonContent } from '@ionic/angular';

import { environment } from '../../environments/environment';
import type { Direction } from '../core/direction';
import { defaultDirection } from '../core/direction';
import { DrivingMode } from '../core/driving-mode';
import { Geo } from '../core/geo';
import { L, T } from '../core/i18n';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';
import { IconComponent } from '../ui/icon.component';
import { Toast } from '../ui/toast.service';

import { planTrip } from './next-student';
import type { TRow, TState } from './trip.repo';
import { TripRepo } from './trip.repo';

/**
 * Driver screen for a phone on a stand. One student at a time, one big button.
 * Morning = pickup (stops in route order), afternoon = drop (route in reverse). The next student appears by itself (see next-student.ts).
 */
@Component({
  selector: 'app-trip',
  templateUrl: 'trip.page.html',
  styleUrls: ['trip.page.scss'],
  imports: [IonContent, ProfileBarComponent, IconComponent],
})
export class TripPage implements OnDestroy {
  private readonly repo = inject(TripRepo);
  private readonly toast = inject(Toast);
  private readonly geo = inject(Geo);
  private readonly driving = inject(DrivingMode);

  readonly mock = environment.useMock;
  readonly dir = signal<Direction>(defaultDirection());
  readonly rows = signal<TRow[]>([]);
  readonly st = signal<TState>({ status: 'idle' });
  readonly menu = signal(false); // driver chose to see the tab bar while a trip is running
  readonly last = signal<{ id: string; name: string; kind: 'boarded' | 'skipped' } | undefined>(undefined);
  readonly t = computed(() => T[L()]);
  readonly plan = computed(() => planTrip(this.rows(), this.dir()));
  readonly pct = computed(() => {
    const p = this.plan();
    return p.total ? ((p.done + p.skipped) / p.total) * 100 : 0;
  });
  readonly doneLabel = computed(() => (this.dir() === 'pickup' ? this.t().picked : this.t().dropped));
  readonly endLabel = computed(() => (this.dir() === 'pickup' ? this.t().end : this.t().finish));

  ionViewWillEnter(): void {
    void this.load();
  }

  ionViewWillLeave(): void {
    this.driving.on.set(false);
  }

  ngOnDestroy(): void {
    this.driving.on.set(false);
  }

  async load(): Promise<void> {
    this.rows.set(await this.repo.roster(this.dir()));
    this.st.set(await this.repo.state(this.dir()));
    this.driving.on.set(this.st().status === 'started' && !this.menu());
  }

  setDir(d: Direction): void {
    this.dir.set(d);
    this.last.set(undefined);
    void this.load();
  }

  toggleMenu(): void {
    this.menu.update((m) => !m);
    this.driving.on.set(this.st().status === 'started' && !this.menu());
  }

  start(): Promise<void> {
    return this.run(() => this.repo.start(this.dir()));
  }

  end(): Promise<void> {
    return this.run(async () => {
      await this.repo.end(this.dir());
      this.last.set(undefined);
    });
  }

  /** The one big button. The tap is never held up for GPS: wait at most ~1.5 s for a fix, then send with or without it. */
  mark(r: TRow): Promise<void> {
    return this.run(async () => {
      await this.repo.tap(r.id, this.dir(), this.mock ? undefined : await this.geo.fix());
      this.last.set({ id: r.id, name: r.name, kind: 'boarded' });
      navigator.vibrate?.(40); // small buzz so the driver knows it registered without looking
    });
  }

  /** Small link: the student is not at the stop. */
  skip(r: TRow): Promise<void> {
    return this.run(async () => {
      await this.repo.notThere(r.id, this.dir());
      this.last.set({ id: r.id, name: r.name, kind: 'skipped' });
    });
  }

  /** Small link: tapped by mistake. Tapping the same student again reverses it, and they come back as the current student. */
  undo(): Promise<void> {
    const l = this.last();
    return this.run(async () => {
      if (l) {
        await (l.kind === 'boarded' ? this.repo.tap(l.id, this.dir()) : this.repo.notThere(l.id, this.dir()));
      }
      this.last.set(undefined);
    });
  }

  reset(): Promise<void> {
    return this.run(() => this.repo.reset());
  }

  private async run(f: () => Promise<void>): Promise<void> {
    try {
      await f();
    } catch (e) {
      this.toast.error((e as Error).message);
    }
    await this.load();
  }
}
