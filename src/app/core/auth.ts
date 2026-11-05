import { Injectable, inject } from '@angular/core';

import type { Student } from './mock.db';
import { MockDb } from './mock.db';

/** RBAC. NOTE: this mirrors the server rules for the demo; the real API must enforce the same checks (the UI is never the security boundary). */
export type Role = 'admin' | 'driver' | 'parent';
export type Perm =
  | 'fees.read'
  | 'fees.record'
  | 'students.read'
  | 'students.add'
  | 'trip.run'
  | 'attendance.set'
  | 'admin.view'
  | 'drivers.manage';

export const PERMS: Record<Role, Perm[]> = {
  admin: ['admin.view', 'drivers.manage', 'students.read', 'fees.read'], // VanDesk team: oversight, no daily operations
  driver: ['fees.read', 'fees.record', 'students.read', 'students.add', 'trip.run'], // own vehicle only
  parent: ['fees.read', 'attendance.set'], // own children only
};

export interface Account {
  id: string;
  name: string;
  email: string;
  role: Role;
  veh?: string;
  gid?: string;
}

const KEY = 'vd_session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private db = inject(MockDb);
  session: Account | null = null;

  constructor() {
    try {
      const id = localStorage.getItem(KEY);
      if (id) this.session = this.accounts().find((a) => a.id === id) ?? null;
    } catch {
      /* storage unavailable: start signed out */
    }
  }

  accounts(): Account[] {
    return [
      { id: 'admin', name: 'VanDesk Admin', email: 'admin@vandesk.test', role: 'admin' },
      ...this.db.drivers.map((d): Account => ({ id: d.id, name: d.name, email: d.email, role: 'driver', veh: d.veh })),
      ...this.db.guardians.map((g): Account => ({ id: g.id, name: g.name, email: g.email, role: 'parent', gid: g.id })),
    ];
  }

  login(id: string): void {
    const a = this.accounts().find((x) => x.id === id);
    if (!a) throw Error('Unknown account');
    if (a.role === 'driver' && !this.db.drivers.find((d) => d.id === a.id)?.active)
      throw Error('Account suspended. Contact VanDesk.');
    this.session = a;
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  }

  logout(): void {
    this.session = null;
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  }

  /** Session still allowed? (a suspended driver is signed out on the next navigation) */
  valid(): boolean {
    const s = this.session;
    if (!s) return false;
    if (s.role === 'driver' && !this.db.drivers.find((d) => d.id === s.id)?.active) {
      this.logout();
      return false;
    }
    return true;
  }

  home(): string {
    return this.valid() && this.session ? '/' + this.session.role : '/login';
  }

  can(p: Perm): boolean {
    return !!this.session && PERMS[this.session.role].includes(p);
  }

  require(p: Perm): void {
    if (!this.can(p)) throw Error('Not allowed');
  }

  /** Read scope: admin all, driver own vehicle, parent own children. */
  canSee(s: Student): boolean {
    const a = this.session;
    return (
      !!a &&
      (a.role === 'admin' || (a.role === 'driver' && s.veh === a.veh) || (a.role === 'parent' && s.gid === a.gid))
    );
  }

  ownsVeh(v: string): boolean {
    return this.session?.role === 'driver' && this.session.veh === v;
  }

  ownsChild(sid: string): boolean {
    const s = this.db.students.find((x) => x.id === sid);
    return !!s && this.session?.role === 'parent' && s.gid === this.session.gid;
  }
}
