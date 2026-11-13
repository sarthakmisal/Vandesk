import { Component, computed, inject, signal } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';

import { environment } from '../../environments/environment';
import type { Direction } from '../core/direction';
import { defaultDirection } from '../core/direction';
import { Geo } from '../core/geo';
import { L, T } from '../core/i18n';
import { ProfileBarComponent } from '../profile-bar/profile-bar.component';

import type { TRow, TState } from './trip.repo';
import { TripRepo } from './trip.repo';

/** Driver flow: Start trip, one tap per student (location captured at the tap), Reached school. Morning = pickup, afternoon = drop. */
@Component({
  selector: 'app-trip',
  templateUrl: 'trip.page.html',
  styleUrls: ['trip.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class TripPage {
  private readonly repo = inject(TripRepo);
  private readonly toast = inject(ToastController);
  private readonly geo = inject(Geo);

  readonly mock = environment.useMock;
  readonly dir = signal<Direction>(defaultDirection());
  readonly rows = signal<TRow[]>([]);
  readonly st = signal<TState>({ status: 'idle' });
  readonly t = computed(() => T[L()]);
  readonly done = computed(() => this.rows().filter((r) => r.state === 'boarded').length);
  readonly total = computed(() => this.rows().filter((r) => r.state !== 'off').length);
  readonly banner = computed(() => {
    const s = this.st();
    if (s.status === 'idle') {
      return `Ready · ${this.total()} students`;
    }
    return s.status === 'started'
      ? `Started ${s.startedAt} · ${this.done()}/${this.total()} ✓`
      : `🏫 ${this.dir() === 'pickup' ? 'Reached school' : 'Finished'} ${s.endedAt}`;
  });

  ionViewWillEnter(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.rows.set(await this.repo.roster(this.dir()));
    this.st.set(await this.repo.state(this.dir()));
  }

  setDir(d: Direction): void {
    this.dir.set(d);
    void this.load();
  }

  label(r: TRow): string {
    if (r.state === 'boarded') {
      return '✓ ' + r.at;
    }
    return r.state === 'skipped' ? '✕' : this.dir() === 'pickup' ? this.t().picked : '🏠 Dropped';
  }

  start(): Promise<void> {
    return this.run(() => this.repo.start(this.dir()));
  }

  end(): Promise<void> {
    return this.run(() => this.repo.end(this.dir()));
  }

  /** The tap is never held up for GPS: wait at most ~1.5 s for a fix, then send with or without it. */
  tap(id: string): Promise<void> {
    return this.run(async () => this.repo.tap(id, this.dir(), this.mock ? undefined : await this.geo.fix()));
  }

  skip(id: string): Promise<void> {
    return this.run(() => this.repo.notThere(id, this.dir()));
  }

  reset(): Promise<void> {
    return this.run(() => this.repo.reset());
  }

  private async run(f: () => Promise<void>): Promise<void> {
    try {
      await f();
    } catch (e) {
      const toast = await this.toast.create({ message: (e as Error).message, duration: 2600, color: 'dark' });
      await toast.present();
    }
    await this.load();
  }
}
