import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth.service';
import { MockDb } from '../core/mock-db';
import type { MockFeesRepo } from '../fees/fees.repo';
import { FeesRepo } from '../fees/fees.repo';
import type { MockTripRepo } from '../trip/trip.repo';
import { TripRepo } from '../trip/trip.repo';

export interface VOver {
  id: string;
  label: string;
  name: string;
  reg: string;
  /** '' when the vehicle has no driver (retired). */
  driver: string;
  driverId: string;
  driverEmail: string;
  /** Driver account is active (not suspended). */
  active: boolean;
  inService: boolean;
  /** Monthly fee in force today, paise; null when none is set. */
  fee: number | null;
  stops: number;
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
export interface NewVehicle {
  name: string;
  regNo: string;
  capacity: number;
  /** Monthly fee in paise. Required: without a fee plan no dues are generated. */
  fee: number;
  driverName: string;
  driverEmail: string;
  /** Stop names in route order (more can be added later). */
  stops: string[];
}
export interface VehicleEdit {
  name: string;
  regNo: string;
  capacity: number;
}

/**
 * VanDesk team: set up buses, drivers, stops, fees and student placement. Daily operations (trips, payments) stay with drivers.
 * Every method throws Error(message) that is shown to the user.
 */
export abstract class AdminRepo {
  abstract overview(): Promise<Overview>;
  abstract setDriverActive(driverId: string, active: boolean): Promise<void>;
  abstract addVehicle(f: NewVehicle): Promise<void>;
  abstract updateVehicle(id: string, f: VehicleEdit): Promise<void>;
  /** Retire (must be empty; the driver loses access) or bring back into service. */
  abstract setInService(id: string, inService: boolean): Promise<void>;
  /** The previous driver is suspended. An existing driver without a vehicle is re-used by email. */
  abstract changeDriver(id: string, name: string, email: string): Promise<void>;
  /** New monthly fee from a date (first of a month); dues already generated never change. */
  abstract setFee(id: string, amount: number, from: string): Promise<void>;
  abstract addStop(veh: string, name: string, typical: string): Promise<void>;
  abstract updateStop(id: string, f: { name?: string; typical?: string }): Promise<void>;
  abstract moveStop(id: string, dir: 'up' | 'down'): Promise<void>;
  abstract deleteStop(id: string): Promise<void>;
  /** Move a student to another vehicle and/or stop (stop '' = none yet). Fees follow the student. */
  abstract moveStudent(id: string, veh: string, stop: string): Promise<void>;
}

@Injectable()
export class MockAdminRepo extends AdminRepo {
  private readonly db = inject(MockDb);
  private readonly auth = inject(AuthService);
  private readonly fees = inject(FeesRepo) as MockFeesRepo; // the mock admin reads and writes fee plans straight from the mock fees repo
  private readonly trip = inject(TripRepo) as MockTripRepo; // ... and trip status from the mock trip repo

  async overview(): Promise<Overview> {
    this.auth.require('admin.view');
    const rows = await this.fees.list();
    const vehicles = await Promise.all(
      this.db.vehicles.map(async (v) => {
        const d = this.db.drivers.find((x) => x.veh === v.id);
        return {
          id: v.id,
          label: v.label,
          name: v.short,
          reg: v.reg,
          driver: d?.name ?? '',
          driverId: d?.id ?? '',
          driverEmail: d?.email ?? '',
          active: d?.active ?? false,
          inService: v.inService,
          fee: this.fees.feeNow(v.id) || null,
          stops: this.db.stops.filter((s) => s.veh === v.id).length,
          used: this.used(v.id),
          cap: v.cap,
          outstanding: rows.filter((r) => r.veh === v.id).reduce((x, r) => x + r.balance, 0),
          trip: this.trip.adminStatus(v.id).status,
        };
      }),
    );
    vehicles.sort((a, b) => Number(!a.inService) - Number(!b.inService)); // retired last (stable sort keeps the id order)
    return {
      students: this.db.students.filter((s) => s.status !== 'left').length,
      outstanding: rows.reduce((x, r) => x + r.balance, 0),
      collected: await this.fees.collectedToday(),
      vehicles,
    };
  }

  async setDriverActive(id: string, active: boolean): Promise<void> {
    this.auth.require('drivers.manage');
    const d = this.db.drivers.find((x) => x.id === id);
    if (!d) {
      throw new Error('Not found');
    }
    d.active = active;
  }

  async addVehicle(f: NewVehicle): Promise<void> {
    this.auth.require('vehicles.manage');
    const reg = this.reg(f.regNo);
    this.regFree(reg);
    const name = f.name.trim();
    if (!name || reg.length < 4 || !(f.capacity >= 1) || !(f.fee > 0)) {
      throw new Error('Fill in the bus name, registration, seats and monthly fee');
    }
    const id = 'v' + ++this.db.n;
    this.claimDriver(id, f.driverName, f.driverEmail, true);
    this.db.vehicles.push({ id, label: `${name} · ${reg}`, short: name, reg, cap: f.capacity, inService: true });
    this.fees.setFee(id, f.fee, '2026-10-01');
    f.stops
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s, i) => this.db.stops.push({ id: 't' + ++this.db.n, veh: id, name: s, seq: i + 1, typical: '' }));
  }

  async updateVehicle(id: string, f: VehicleEdit): Promise<void> {
    this.auth.require('vehicles.manage');
    const v = this.vehicle(id);
    const reg = this.reg(f.regNo);
    if (reg !== v.reg) {
      this.regFree(reg, id);
    }
    const used = this.used(id);
    if (f.capacity < used) {
      throw new Error(`${used} students ride this vehicle. Move some first or keep at least ${used} seats.`);
    }
    Object.assign(v, { short: f.name.trim(), reg, cap: f.capacity, label: `${f.name.trim()} · ${reg}` });
  }

  async setInService(id: string, inService: boolean): Promise<void> {
    this.auth.require('vehicles.manage');
    const v = this.vehicle(id);
    if (inService) {
      v.inService = true;
      return;
    }
    const used = this.used(id);
    if (used) {
      throw new Error(`Move the ${used} student${used === 1 ? '' : 's'} to another vehicle first`);
    }
    v.inService = false;
    this.park(id);
  }

  async changeDriver(id: string, name: string, email: string): Promise<void> {
    this.auth.require('vehicles.manage');
    if (!this.vehicle(id).inService) {
      throw new Error('Restore this vehicle first');
    }
    const old = this.db.drivers.find((d) => d.veh === id);
    if (old) {
      old.veh = '';
    }
    try {
      const next = this.claimDriver(id, name, email, false);
      if (old && old !== next) {
        old.active = false;
      }
    } catch (e) {
      if (old) {
        old.veh = id;
      }
      throw e;
    }
  }

  async setFee(id: string, amount: number, from: string): Promise<void> {
    this.auth.require('fees.plan');
    this.vehicle(id);
    this.fees.setFee(id, amount, from);
  }

  async addStop(veh: string, name: string, typical: string): Promise<void> {
    this.auth.require('vehicles.manage');
    this.vehicle(veh);
    const seq = Math.max(0, ...this.db.stops.filter((s) => s.veh === veh).map((s) => s.seq)) + 1;
    this.db.stops.push({ id: 't' + ++this.db.n, veh, name: name.trim(), seq, typical });
  }

  async updateStop(id: string, f: { name?: string; typical?: string }): Promise<void> {
    this.auth.require('vehicles.manage');
    const s = this.stop(id);
    s.name = f.name?.trim() || s.name;
    s.typical = f.typical ?? s.typical;
  }

  async moveStop(id: string, dir: 'up' | 'down'): Promise<void> {
    this.auth.require('vehicles.manage');
    const s = this.stop(id);
    const mates = this.db.stops.filter((x) => x.veh === s.veh).sort((a, b) => a.seq - b.seq);
    const other = mates[mates.indexOf(s) + (dir === 'up' ? -1 : 1)];
    if (other) {
      [s.seq, other.seq] = [other.seq, s.seq];
    }
  }

  async deleteStop(id: string): Promise<void> {
    this.auth.require('vehicles.manage');
    const s = this.stop(id);
    const n = this.db.students.filter((x) => x.stop === id && x.status !== 'left').length;
    if (n) {
      throw new Error(`${n} student${n === 1 ? ' uses' : 's use'} this stop. Move ${n === 1 ? 'him' : 'them'} first.`);
    }
    this.db.stops.splice(this.db.stops.indexOf(s), 1);
  }

  async moveStudent(id: string, veh: string, stop: string): Promise<void> {
    this.auth.require('students.move');
    const s = this.db.students.find((x) => x.id === id && x.status !== 'left');
    if (!s) {
      throw new Error('Not found');
    }
    const v = this.vehicle(veh);
    if (s.veh !== veh) {
      if (!v.inService) {
        throw new Error(`${v.short} is not in service`);
      }
      if (!this.fees.feeNow(veh)) {
        throw new Error(`Set a monthly fee for ${v.short} first`);
      }
      if (this.used(veh) >= v.cap) {
        throw new Error(`${v.short} is full (${v.cap} of ${v.cap} seats). Choose another vehicle.`);
      }
    }
    if (stop && !this.db.stops.some((x) => x.id === stop && x.veh === veh)) {
      throw new Error('Choose a stop on this vehicle');
    }
    s.veh = veh;
    s.stop = stop;
  }

  private used(v: string): number {
    return this.db.students.filter((s) => s.veh === v && s.status !== 'left').length;
  }

  private vehicle(id: string) {
    const v = this.db.vehicles.find((x) => x.id === id);
    if (!v) {
      throw new Error('Not found');
    }
    return v;
  }

  private stop(id: string) {
    const s = this.db.stops.find((x) => x.id === id);
    if (!s) {
      throw new Error('Not found');
    }
    return s;
  }

  private reg(s: string): string {
    return s.trim().toUpperCase().replace(/\s+/g, ' ');
  }

  private regFree(reg: string, except?: string): void {
    if (this.db.vehicles.some((v) => v.reg === reg && v.id !== except)) {
      throw new Error('A vehicle with this registration number already exists');
    }
  }

  /** A driver without a vehicle has nothing to do, so the account is suspended. */
  private park(vehicleId: string): void {
    const d = this.db.drivers.find((x) => x.veh === vehicleId);
    if (d) {
      d.veh = '';
      d.active = false;
    }
  }

  /** Re-uses a driver without a vehicle (same email), otherwise creates the account. */
  private claimDriver(veh: string, name: string, emailRaw: string, create: boolean) {
    const email = emailRaw.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error('Enter a valid email');
    }
    const d = this.db.drivers.find((x) => x.email === email);
    if (!d) {
      if (this.db.guardians.some((g) => g.email === email) || email === 'admin@vandesk.test') {
        throw new Error('This email belongs to another kind of account');
      }
      if (!name.trim()) {
        throw new Error('Enter the driver name');
      }
      const created = { id: 'u' + ++this.db.n, name: name.trim(), email, veh, active: true };
      this.db.drivers.push(created);
      return created;
    }
    if (d.veh && d.veh !== veh) {
      throw new Error(`This driver already drives ${this.vehicle(d.veh).short}`);
    }
    if (create && d.veh === veh) {
      throw new Error('Driver already assigned');
    }
    d.veh = veh;
    d.active = true;
    return d;
  }
}
