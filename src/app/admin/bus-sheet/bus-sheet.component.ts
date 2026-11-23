import type { OnInit } from '@angular/core';
import { Component, Input, inject, signal } from '@angular/core';
import { IonContent, ModalController } from '@ionic/angular';

import { money } from '../../core/format';
import type { Stop } from '../../core/mock-db';
import type { StudentsRepo } from '../../students/students.repo';
import { IconComponent } from '../../ui/icon.component';
import { Toast } from '../../ui/toast.service';
import type { AdminRepo, VOver } from '../admin.repo';

/** Next 12 month starts (a new fee applies from the first of a month; the current month's dues already exist). */
function nextMonths(): { value: string; label: string }[] {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + 1 + i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
    return { value, label: d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) };
  });
}

const val = (e: Event): string => (e.target as HTMLInputElement).value;

/** Everything about one bus: details, driver, monthly fee, stops and retiring it. Each action saves on its own. */
@Component({
  selector: 'app-bus-sheet',
  imports: [IonContent, IconComponent],
  templateUrl: './bus-sheet.component.html',
  styleUrl: './bus-sheet.component.scss',
})
export class BusSheetComponent implements OnInit {
  @Input({ required: true }) vehicleId!: string;
  @Input({ required: true }) repo!: AdminRepo; // passed in: modals use the root injector
  @Input({ required: true }) students!: StudentsRepo;

  // NB: never name this `modal`: Ionic reserves that property on components shown inside ion-modal.
  private readonly modalCtrl = inject(ModalController);
  private readonly toast = inject(Toast);

  readonly v = signal<VOver | undefined>(undefined);
  readonly stops = signal<Stop[]>([]);
  readonly months = nextMonths();
  readonly money = money;
  readonly busy = signal(false);

  // form values (text inputs are uncontrolled; these are read on save)
  edit = { name: '', regNo: '', capacity: '' };
  driver = { name: '', email: '' };
  fee = { amount: '', from: this.months[0].value };
  stop = { name: '', typical: '' };

  async ngOnInit(): Promise<void> {
    await this.load();
  }

  val = val;

  async load(): Promise<void> {
    const v = (await this.repo.overview()).vehicles.find((x) => x.id === this.vehicleId);
    this.v.set(v);
    if (v) {
      this.edit = { name: v.name, regNo: v.reg, capacity: String(v.cap) };
    }
    this.stops.set(await this.students.stops(this.vehicleId));
  }

  close(): Promise<boolean> {
    return this.modalCtrl.dismiss(true);
  }

  /** Runs one action, reports the result in a toast and refreshes the sheet. */
  private async run(fn: () => Promise<void>, done: string): Promise<boolean> {
    this.busy.set(true);
    try {
      await fn();
      this.toast.show(done);
      await this.load();
      return true;
    } catch (e) {
      this.toast.error((e as Error).message);
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  saveDetails(): Promise<boolean> {
    return this.run(
      () =>
        this.repo.updateVehicle(this.vehicleId, {
          name: this.edit.name.trim(),
          regNo: this.edit.regNo.trim(),
          capacity: Number(this.edit.capacity),
        }),
      'Saved',
    );
  }

  replaceDriver(): Promise<boolean> {
    return this.run(
      () => this.repo.changeDriver(this.vehicleId, this.driver.name.trim(), this.driver.email.trim()),
      'Driver changed',
    );
  }

  toggleDriver(): Promise<boolean> {
    const v = this.v()!;
    return this.run(
      () => this.repo.setDriverActive(v.driverId, !v.active),
      v.active ? 'Driver suspended' : 'Driver activated',
    );
  }

  saveFee(): Promise<boolean> {
    return this.run(
      () => this.repo.setFee(this.vehicleId, Math.round(Number(this.fee.amount) * 100), this.fee.from),
      'Fee scheduled',
    );
  }

  async addStop(): Promise<void> {
    if (
      await this.run(() => this.repo.addStop(this.vehicleId, this.stop.name.trim(), this.stop.typical), 'Stop added')
    ) {
      this.stop = { name: '', typical: '' };
    }
  }

  rename(s: Stop, e: Event): void {
    const name = val(e).trim();
    if (name && name !== s.name) {
      void this.run(() => this.repo.updateStop(s.id, { name }), 'Saved');
    }
  }

  retime(s: Stop, e: Event): void {
    const typical = val(e);
    if (typical !== s.typical) {
      void this.run(() => this.repo.updateStop(s.id, { typical }), 'Saved');
    }
  }

  move(s: Stop, dir: 'up' | 'down'): void {
    void this.run(() => this.repo.moveStop(s.id, dir), 'Route order updated');
  }

  remove(s: Stop): void {
    void this.run(() => this.repo.deleteStop(s.id), 'Stop removed');
  }

  setInService(on: boolean): Promise<boolean> {
    return this.run(() => this.repo.setInService(this.vehicleId, on), on ? 'Back in service' : 'Bus retired');
  }
}
