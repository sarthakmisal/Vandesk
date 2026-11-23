import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../environments/environment';

import { message } from './api';
import type { Student } from './mock-db';
import { MockDb } from './mock-db';

/**
 * RBAC. The mock repos use the checks below; with the real API the same rules live in server/auth.ts and domain.ts
 * (the UI is never the security boundary).
 */
export type Role = 'admin' | 'driver' | 'parent';
export type Perm =
  | 'fees.read'
  | 'fees.record'
  | 'students.read'
  | 'students.add'
  | 'trip.run'
  | 'attendance.set'
  | 'admin.view'
  | 'drivers.manage'
  | 'vehicles.manage'
  | 'students.move'
  | 'fees.plan';

export const PERMS: Record<Role, Perm[]> = {
  admin: [
    'admin.view',
    'drivers.manage',
    'vehicles.manage',
    'students.read',
    'students.add',
    'students.move',
    'fees.read',
    'fees.plan',
  ], // VanDesk team: set up buses, drivers, stops, fees and placements; no daily operations (trips, payments)
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

const KEY = 'vd_session'; // mock mode: account id
const TOKEN = 'vd_token'; // api mode: signed token

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly db = inject(MockDb);
  private readonly http = inject(HttpClient, { optional: true });
  readonly session = signal<Account | null>(null);

  constructor() {
    if (environment.useMock) {
      try {
        const id = localStorage.getItem(KEY);
        if (id) {
          this.session.set(this.accounts().find((a) => a.id === id) ?? null);
        }
      } catch {
        /* storage unavailable: start signed out */
      }
    }
  }

  /** App start (API mode): restore the session from the stored token before any route is matched. */
  async restore(): Promise<void> {
    if (environment.useMock || !this.http || !this.token()) {
      return;
    }
    try {
      this.session.set(
        await firstValueFrom(
          this.http.get<Account>(environment.apiUrl + '/me', { headers: { Authorization: `Bearer ${this.token()}` } }),
        ),
      );
    } catch {
      this.logout();
    }
  }

  token(): string | null {
    try {
      return localStorage.getItem(TOKEN);
    } catch {
      return null;
    }
  }

  /** API mode, step 1: email a 6-digit code. In development the server also returns it as devCode. */
  async requestOtp(email: string): Promise<{ devCode?: string }> {
    try {
      return await firstValueFrom(
        this.http!.post<{ devCode?: string }>(environment.apiUrl + '/auth/otp/request', { email }),
      );
    } catch (e) {
      throw new Error(message(e), { cause: e });
    }
  }

  /** API mode, step 2: exchange the code for a session. */
  async verifyOtp(email: string, code: string): Promise<void> {
    try {
      const r = await firstValueFrom(
        this.http!.post<{ token: string; account: Account }>(environment.apiUrl + '/auth/otp/verify', { email, code }),
      );
      localStorage.setItem(TOKEN, r.token);
      this.session.set(r.account);
    } catch (e) {
      throw new Error(message(e), { cause: e });
    }
  }

  /** Mock mode: demo sign-in by picking an account. */
  accounts(): Account[] {
    const admin: Account[] = [{ id: 'admin', name: 'VanDesk Admin', email: 'admin@vandesk.test', role: 'admin' }];
    const drivers: Account[] = this.db.drivers.map((d) => ({
      id: d.id,
      name: d.name,
      email: d.email,
      role: 'driver',
      veh: d.veh,
    }));
    const parents: Account[] = this.db.guardians.map((g) => ({
      id: g.id,
      name: g.name,
      email: g.email,
      role: 'parent',
      gid: g.id,
    }));
    return [...admin, ...drivers, ...parents];
  }

  login(id: string): void {
    const a = this.accounts().find((x) => x.id === id);
    if (!a) {
      throw new Error('Unknown account');
    }
    if (a.role === 'driver' && !this.db.drivers.find((d) => d.id === a.id)?.active) {
      throw new Error('Account suspended. Contact VanDesk.');
    }
    this.session.set(a);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* storage unavailable: session lasts until reload */
    }
  }

  logout(): void {
    this.session.set(null);
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(TOKEN);
    } catch {
      /* nothing to clear */
    }
  }

  /** Session still allowed? (mock: a suspended driver is signed out on the next navigation; API: the server answers 401) */
  valid(): boolean {
    const s = this.session();
    if (!s) {
      return false;
    }
    if (environment.useMock && s.role === 'driver' && !this.db.drivers.find((d) => d.id === s.id)?.active) {
      this.logout();
      return false;
    }
    return true;
  }

  home(): string {
    return this.valid() ? '/' + this.session()!.role : '/login';
  }

  can(p: Perm): boolean {
    const s = this.session();
    return !!s && PERMS[s.role].includes(p);
  }

  require(p: Perm): void {
    if (!this.can(p)) {
      throw new Error('Not allowed');
    }
  }

  /** Read scope: admin all, driver own vehicle, parent own children. */
  canSee(s: Student): boolean {
    const a = this.session();
    return (
      !!a &&
      (a.role === 'admin' || (a.role === 'driver' && s.veh === a.veh) || (a.role === 'parent' && s.gid === a.gid))
    );
  }

  ownsVeh(v: string): boolean {
    const a = this.session();
    return a?.role === 'driver' && a.veh === v;
  }

  ownsChild(sid: string): boolean {
    const s = this.db.students.find((x) => x.id === sid);
    const a = this.session();
    return !!s && a?.role === 'parent' && s.gid === a.gid;
  }
}
