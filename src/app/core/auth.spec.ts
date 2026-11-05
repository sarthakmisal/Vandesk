import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth';
import { MockDb } from './mock.db';

describe('AuthService (RBAC)', () => {
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    auth = TestBed.inject(AuthService);
  });

  it('starts signed out and sends users to /login', () => {
    expect(auth.valid()).toBe(false);
    expect(auth.home()).toBe('/login');
  });

  it('lists admin, 2 drivers and 6 parents', () => {
    const roles = auth.accounts().map((a) => a.role);
    expect(roles.filter((r) => r === 'admin').length).toBe(1);
    expect(roles.filter((r) => r === 'driver').length).toBe(2);
    expect(roles.filter((r) => r === 'parent').length).toBe(6);
  });

  it('logs each role in and routes to its own home', () => {
    auth.login('admin');
    expect(auth.home()).toBe('/admin');
    auth.login('u1');
    expect(auth.home()).toBe('/driver');
    auth.login('g1');
    expect(auth.home()).toBe('/parent');
  });

  it('restores the session from localStorage', () => {
    auth.login('u2');
    TestBed.resetTestingModule();
    expect(TestBed.inject(AuthService).session?.id).toBe('u2');
  });

  it('logout clears the session', () => {
    auth.login('u1');
    auth.logout();
    expect(auth.valid()).toBe(false);
    expect(localStorage.getItem('vd_session')).toBeNull();
  });

  it('rejects unknown accounts and suspended drivers', () => {
    expect(() => auth.login('nope')).toThrow('Unknown account');
    TestBed.inject(MockDb).drivers[0].active = false;
    expect(() => auth.login('u1')).toThrow('Account suspended. Contact VanDesk.');
  });

  it('signs a driver out on the next check once suspended', () => {
    auth.login('u1');
    expect(auth.valid()).toBe(true);
    TestBed.inject(MockDb).drivers[0].active = false;
    expect(auth.valid()).toBe(false);
    expect(auth.session).toBeNull();
  });

  it('enforces permissions per role', () => {
    auth.login('g1');
    expect(auth.can('fees.record')).toBe(false);
    expect(auth.can('attendance.set')).toBe(true);
    expect(() => auth.require('trip.run')).toThrow('Not allowed');
    auth.login('u1');
    expect(auth.can('fees.record')).toBe(true);
    expect(auth.can('drivers.manage')).toBe(false);
    auth.login('admin');
    expect(auth.can('drivers.manage')).toBe(true);
    expect(auth.can('fees.record')).toBe(false);
  });

  it('scopes reads: driver own vehicle, parent own children, admin all', () => {
    const db = TestBed.inject(MockDb);
    auth.login('u1');
    const onV1 = db.students.filter((s) => auth.canSee(s)).length;
    auth.login('u2');
    const onV2 = db.students.filter((s) => auth.canSee(s)).length;
    auth.login('g1');
    const mine = db.students.filter((s) => auth.canSee(s)).map((s) => s.name);
    auth.login('admin');
    const all = db.students.filter((s) => auth.canSee(s)).length;
    expect(onV1).toBe(5);
    expect(onV2).toBe(2);
    expect(mine).toEqual(['Akshay Patil', 'Ishita Patil']);
    expect(all).toBe(7);
  });
});
