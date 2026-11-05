import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth';
import { MockDb } from '../core/mock.db';
import { FeesRepo } from '../fees/fees.repo';
import { TripRepo } from '../trip/trip.repo';

export interface VOver {
  id: string;
  label: string;
  driver: string;
  driverId: string;
  active: boolean;
  used: number;
  cap: number;
  outstanding: number;
  trip: string;
}
export interface Overview {
  students: number;
  outstanding: number;
  collected: number;
  vehicles: VOver[];
}

export abstract class AdminRepo {
  abstract overview(): Promise<Overview>;
  abstract setDriverActive(driverId: string, active: boolean): Promise<void>;
}

@Injectable()
export class MockAdminRepo extends AdminRepo {
  private db = inject(MockDb);
  private auth = inject(AuthService);
  private fees = inject(FeesRepo);
  private trip = inject(TripRepo);

  async overview(): Promise<Overview> {
    this.auth.require('admin.view');
    const rows = await this.fees.list();
    const vehicles = await Promise.all(
      this.db.vehicles.map(async (v): Promise<VOver> => {
        const d = this.db.drivers.find((x) => x.veh === v.id);
        if (!d) throw Error('Driver not found');
        return {
          id: v.id,
          label: v.label,
          driver: d.name,
          driverId: d.id,
          active: d.active,
          used: this.db.students.filter((s) => s.veh === v.id && s.status !== 'left').length,
          cap: v.cap,
          outstanding: rows.filter((r) => r.veh === v.id).reduce((x, r) => x + r.balance, 0),
          trip: (await this.trip.status(v.id)).status,
        };
      }),
    );
    return {
      students: this.db.students.length,
      outstanding: rows.reduce((x, r) => x + r.balance, 0),
      collected: await this.fees.collectedToday(),
      vehicles,
    };
  }

  async setDriverActive(id: string, active: boolean): Promise<void> {
    this.auth.require('drivers.manage');
    const d = this.db.drivers.find((x) => x.id === id);
    if (!d) throw Error('Not found');
    d.active = active;
  }
}
