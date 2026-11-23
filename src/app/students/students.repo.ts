import { Injectable, inject } from '@angular/core';

import { AuthService } from '../core/auth.service';
import type { Stop } from '../core/mock-db';
import { MockDb } from '../core/mock-db';
import { FeesRepo } from '../fees/fees.repo';
import type { MockFeesRepo } from '../fees/fees.repo';

export interface SRow {
  id: string;
  name: string;
  cls: string;
  vehicle: string;
  veh: string;
  stop: string;
  stopId: string;
  guardian: string;
}
export interface VSeat {
  id: string;
  label: string;
  short: string;
  cap: number;
  used: number;
}
export interface NewStudent {
  name: string;
  cls: string;
  veh: string;
  stop: string;
  gname: string;
  email: string;
  phone: string;
}

export abstract class StudentsRepo {
  abstract list(): Promise<SRow[]>;
  abstract vehicles(): Promise<VSeat[]>;
  abstract stops(veh: string): Promise<Stop[]>;
  /** Driver: own vehicle only. Admin: any vehicle in service. Throws Error(message) that is shown to the user. */
  abstract add(f: NewStudent): Promise<void>;
}

@Injectable()
export class MockStudentsRepo extends StudentsRepo {
  private readonly db = inject(MockDb);
  private readonly auth = inject(AuthService);
  private readonly fees = inject(FeesRepo) as MockFeesRepo; // the mock needs to know whether a vehicle has a fee plan

  async list(): Promise<SRow[]> {
    this.auth.require('students.read');
    return this.db.students
      .filter((s) => this.auth.canSee(s))
      .map((s) => ({
        id: s.id,
        name: s.name,
        cls: s.cls,
        vehicle: this.db.vehicles.find((v) => v.id === s.veh)?.short ?? '',
        veh: s.veh,
        stop: this.db.stops.find((t) => t.id === s.stop)?.name ?? '',
        stopId: s.stop,
        guardian: this.db.guardians.find((g) => g.id === s.gid)?.name ?? '',
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async vehicles(): Promise<VSeat[]> {
    this.auth.require('students.read');
    return this.mine().map((v) => ({ ...v, used: this.used(v.id) }));
  }

  async stops(veh: string): Promise<Stop[]> {
    this.auth.require('students.read');
    const admin = this.auth.session()?.role === 'admin' && this.db.vehicles.some((v) => v.id === veh);
    if (!admin && !this.mine().some((v) => v.id === veh)) {
      throw new Error('Not allowed');
    }
    return this.db.stops.filter((s) => s.veh === veh).sort((a, b) => a.seq - b.seq);
  }

  async add(f: NewStudent): Promise<void> {
    this.auth.require('students.add');
    if (this.auth.session()?.role !== 'admin' && !this.auth.ownsVeh(f.veh)) {
      throw new Error('You can only add students to your own vehicle');
    }
    const name = f.name.trim();
    const gname = f.gname.trim();
    const email = f.email.trim().toLowerCase();
    if (!name || !gname) {
      throw new Error('Student and guardian names are required');
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw new Error('Enter a valid guardian email');
    }
    const v = this.db.vehicles.find((x) => x.id === f.veh);
    if (!v) {
      throw new Error('Choose a vehicle');
    }
    if (!v.inService) {
      throw new Error(`${v.short} is not in service`);
    }
    if (!this.fees.feeNow(v.id)) {
      throw new Error(`Set a monthly fee for ${v.short} first`);
    }
    if (this.used(v.id) >= v.cap) {
      throw new Error(`${v.short} is full (${v.cap} of ${v.cap} seats). Choose another vehicle.`); // R-SEAT-1
    }
    let g = this.db.guardians.find((x) => x.email === email);
    if (this.db.students.some((s) => s.name.toLowerCase() === name.toLowerCase() && s.gid === g?.id)) {
      throw new Error('This student is already added');
    }
    if (!g) {
      g = { id: 'g' + ++this.db.n, name: gname, email, phone: f.phone.trim() };
      this.db.guardians.push(g);
    }
    this.db.students.push({
      id: 's' + ++this.db.n,
      name,
      cls: f.cls.trim(),
      veh: v.id,
      stop: f.stop,
      gid: g.id,
      status: 'active',
      joined: '2026-10',
    });
  }

  private used(v: string): number {
    return this.db.students.filter((s) => s.veh === v && s.status !== 'left').length;
  }

  private mine() {
    return this.db.vehicles.filter(
      (v) => v.inService && (this.auth.session()?.role === 'admin' || this.auth.ownsVeh(v.id)),
    );
  }
}
