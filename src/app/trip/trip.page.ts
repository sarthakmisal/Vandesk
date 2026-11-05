import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';

import { L, T } from '../fees/fees.models';
import { ProfileBarComponent } from '../shared/profile-bar/profile-bar.component';

import type { TRow, TState } from './trip.repo';
import { TripRepo } from './trip.repo';

@Component({
  selector: 'app-trip',
  templateUrl: 'trip.page.html',
  styleUrls: ['trip.page.scss'],
  imports: [IonContent, ProfileBarComponent],
})
export class TripPage {
  private repo = inject(TripRepo);
  private toast = inject(ToastController);
  private cd = inject(ChangeDetectorRef);
  rows: TRow[] = [];
  st: TState = { status: 'idle' };

  get t(): Record<string, string> {
    return T[L()];
  }
  get done(): number {
    return this.rows.filter((r) => r.state === 'boarded').length;
  }
  get total(): number {
    return this.rows.filter((r) => r.state !== 'off').length;
  }

  ionViewWillEnter(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.rows = await this.repo.roster();
    this.st = await this.repo.state();
    this.cd.markForCheck();
  }

  private async run(f: () => Promise<void>) {
    try {
      await f();
    } catch (e) {
      (await this.toast.create({ message: (e as Error).message, duration: 2600, color: 'dark' })).present();
    }
    await this.load();
  }

  start(): Promise<void> {
    return this.run(() => this.repo.start());
  }
  end(): Promise<void> {
    return this.run(() => this.repo.end());
  }
  tap(id: string): Promise<void> {
    return this.run(() => this.repo.tap(id));
  }
  skip(id: string): Promise<void> {
    return this.run(() => this.repo.notThere(id));
  }
  reset(): Promise<void> {
    return this.run(() => this.repo.reset());
  }
}
