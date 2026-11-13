import { TestBed } from '@angular/core/testing';

import { AdminRepo } from '../admin/admin.repo';
import { FeesRepo } from '../fees/fees.repo';
import type { NewStudent } from '../students/students.repo';
import { StudentsRepo } from '../students/students.repo';
import { TripRepo } from '../trip/trip.repo';

import { AuthService } from './auth.service';
import { MOCK_REPO_PROVIDERS } from './providers';

const NOT_ALLOWED = 'Not allowed';

describe('RBAC and flows', () => {
  let auth: AuthService;
  let fees: FeesRepo;
  let students: StudentsRepo;
  let trip: TripRepo;
  let admin: AdminRepo;

  const newStudent = (name: string, veh: string): NewStudent => ({
    name,
    cls: '4',
    veh,
    stop: veh === 'v1' ? 't2' : 't5',
    gname: 'G ' + name,
    email: name.toLowerCase() + '@x.in',
    phone: '1',
  });

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...MOCK_REPO_PROVIDERS] });
    auth = TestBed.inject(AuthService);
    fees = TestBed.inject(FeesRepo);
    students = TestBed.inject(StudentsRepo);
    trip = TestBed.inject(TripRepo);
    admin = TestBed.inject(AdminRepo);
  });

  describe('signed out', () => {
    it('goes to /login and every repo refuses', async () => {
      expect(auth.home()).toBe('/login');
      await expect(fees.list()).rejects.toThrow(NOT_ALLOWED);
      await expect(students.list()).rejects.toThrow(NOT_ALLOWED);
      await expect(trip.roster('pickup')).rejects.toThrow(NOT_ALLOWED);
    });
  });

  describe('driver (own vehicle only)', () => {
    beforeEach(() => auth.login('u1'));

    it('lands on /driver', () => expect(auth.home()).toBe('/driver'));

    it('sees only students, fees and vehicles of own vehicle', async () => {
      const list = await students.list();
      expect(list).toHaveLength(5);
      expect(list.every((s) => s.vehicle === 'Van')).toBe(true);
      expect((await fees.list()).every((r) => r.veh === 'v1')).toBe(true);
      expect(await students.vehicles()).toHaveLength(1);
    });

    it('cannot touch another vehicle', async () => {
      await expect(students.add(newStudent('Sneak', 'v2'))).rejects.toThrow('own vehicle');
      await expect(students.stops('v2')).rejects.toThrow(NOT_ALLOWED);
      await expect(fees.record('s6', 30000, 'cash')).rejects.toThrow(NOT_ALLOWED);
      await expect(trip.tap('s6', 'pickup')).rejects.toThrow(NOT_ALLOWED);
    });

    it('cannot use parent or admin actions', async () => {
      await expect(trip.setGoing('s1', false, 'pickup')).rejects.toThrow(NOT_ALLOWED);
      await expect(trip.children()).rejects.toThrow(NOT_ALLOWED);
      await expect(admin.overview()).rejects.toThrow(NOT_ALLOWED);
      await expect(admin.setDriverActive('u1', false)).rejects.toThrow(NOT_ALLOWED);
    });

    it('onboards a student: seat limit, validation, and the new student shows up in fees', async () => {
      await students.add(newStudent('Neel', 'v1'));
      expect((await students.vehicles())[0].used).toBe(6);
      await expect(students.add(newStudent('Omkar', 'v1'))).rejects.toThrow('full');
      await expect(students.add(newStudent('Neel', 'v1'))).rejects.toThrow('full'); // full wins over duplicate
      await expect(students.add({ ...newStudent('Zed', 'v1'), email: 'nope' })).rejects.toThrow(/full|email/);
      const neel = (await fees.list()).find((r) => r.name === 'Neel');
      expect(neel?.balance).toBe(30000);
      expect(neel?.months).toBe(1);
    });

    it('records instalments oldest first and undo restores the balance', async () => {
      const rohan = (await fees.list()).find((r) => r.name === 'Rohan More')!;
      expect(rohan.balance).toBe(150000);
      const id = await fees.record(rohan.id, 100000, 'upi');
      expect((await fees.list()).find((r) => r.id === rohan.id)?.balance).toBe(50000);
      await fees.reverse(id, 'typed wrong');
      expect((await fees.list()).find((r) => r.id === rohan.id)?.balance).toBe(150000);
    });

    it('runs a trip: needs start, route order, undo, never blocked at the end', async () => {
      await expect(trip.tap('s1', 'pickup')).rejects.toThrow('Start the trip first');
      const roster = await trip.roster('pickup');
      expect(roster[0].stop).toBe('Hanuman Mandir');
      expect(roster.find((r) => r.id === 's2')?.state).toBe('off');
      await trip.start('pickup');
      await trip.tap('s1', 'pickup');
      expect((await trip.roster('pickup')).find((r) => r.id === 's1')?.state).toBe('boarded');
      await trip.tap('s1', 'pickup');
      expect((await trip.roster('pickup')).find((r) => r.id === 's1')?.state).toBe('wait');
      await trip.end('pickup');
      expect((await trip.state('pickup')).status).toBe('ended');
    });
  });

  describe('driver tools: ledger, fee plan, reminders, drop run', () => {
    beforeEach(() => auth.login('u1'));

    it('reversal needs a reason, appears in the ledger, and cannot be done twice', async () => {
      const id = await fees.record('s5', 30000, 'cash');
      await expect(fees.reverse(id, '  ')).rejects.toThrow('reason');
      await fees.reverse(id, 'wrong student');
      await expect(fees.reverse(id, 'again')).rejects.toThrow('Already reversed');
      const led = await fees.ledger();
      expect(led.find((r) => r.id === id)?.reversed).toBe(true);
      expect(led.some((r) => r.kind === 'reversal' && r.note === 'wrong student')).toBe(true);
    });

    it('a new fee plan must start after the current one, and only touches future dues', async () => {
      await expect(fees.addPlan(40000, '2026-06-01')).rejects.toThrow('after the current plan');
      await fees.addPlan(40000, '2027-04-01');
      const plans = await fees.plans();
      expect(plans.map((p) => p.amount)).toEqual([40000, 30000]);
      expect((await fees.statement('s5')).rows.every((r) => r.amt === 30000)).toBe(true);
    });

    it('sends reminders once per student per day', async () => {
      const first = await fees.remind();
      expect(first.sent).toBeGreaterThan(0);
      const second = await fees.remind();
      expect(second.sent).toBe(0);
      expect(second.skipped).toBe(first.sent);
    });

    it('runs the afternoon drop in reverse route order, separate from the morning run', async () => {
      const morning = await trip.roster('pickup');
      const afternoon = await trip.roster('drop');
      expect(morning[0].stop).toBe('Hanuman Mandir');
      expect(afternoon[0].stop).toBe('Garden Chowk');
      await trip.start('drop');
      await trip.tap('s4', 'drop');
      expect((await trip.state('drop')).status).toBe('started');
      expect((await trip.state('pickup')).status).toBe('idle');
      auth.login('g3');
      expect((await trip.parent('s4', 'drop')).picked).toBeTruthy();
    });
  });

  describe('parent (own children only)', () => {
    beforeEach(() => auth.login('g1')); // Mr. Patil: Akshay and Ishita

    it('lands on /parent and sees only own children', async () => {
      expect(auth.home()).toBe('/parent');
      expect((await trip.children()).map((c) => c.name)).toEqual(['Akshay Patil', 'Ishita Patil']);
    });

    it('cannot read or change another child', async () => {
      await expect(trip.parent('s3', 'pickup')).rejects.toThrow(NOT_ALLOWED);
      await expect(trip.setGoing('s3', false, 'pickup')).rejects.toThrow(NOT_ALLOWED);
      await expect(fees.statement('s3')).rejects.toThrow(NOT_ALLOWED);
    });

    it('reads own fees but cannot do driver or admin things', async () => {
      expect((await fees.statement('s1')).balance).toBe(0);
      expect((await fees.statement('s2')).balance).toBe(90000);
      await expect(students.list()).rejects.toThrow(NOT_ALLOWED);
      await expect(fees.record('s1', 100, 'cash')).rejects.toThrow(NOT_ALLOWED);
      await expect(trip.start('pickup')).rejects.toThrow(NOT_ALLOWED);
      await expect(admin.overview()).rejects.toThrow(NOT_ALLOWED);
    });

    it('sets Not going, the driver sees it, and it locks once the trip starts', async () => {
      await trip.setGoing('s1', false, 'pickup');
      expect((await trip.parent('s1', 'pickup')).going).toBe(false);
      auth.login('u1');
      expect((await trip.roster('pickup')).find((r) => r.id === 's1')?.state).toBe('off');
      await trip.start('pickup');
      auth.login('g1');
      await expect(trip.setGoing('s1', true, 'pickup')).rejects.toThrow('already started');
    });

    it('tracks progress: stops before my stop, then picked up', async () => {
      auth.login('u1');
      await trip.start('pickup');
      await trip.tap('s1', 'pickup');
      await trip.tap('s3', 'pickup');
      auth.login('g3'); // Mrs. Kulkarni: Harsha at stop 3, van has done stops 1 and 2
      expect((await trip.parent('s4', 'pickup')).away).toBe(0);
      auth.login('u1');
      await trip.tap('s4', 'pickup');
      auth.login('g3');
      expect((await trip.parent('s4', 'pickup')).picked).toBeTruthy();
    });

    it("another parent cannot change Patil's child", async () => {
      auth.login('g3');
      await expect(trip.setGoing('s1', true, 'pickup')).rejects.toThrow(NOT_ALLOWED);
    });
  });

  describe('admin (VanDesk)', () => {
    beforeEach(() => auth.login('admin'));

    it('lands on /admin and sees every vehicle with totals', async () => {
      expect(auth.home()).toBe('/admin');
      const o = await admin.overview();
      expect(o.vehicles).toHaveLength(2);
      expect(o.students).toBe(7);
      expect(o.outstanding).toBeGreaterThan(0);
    });

    it('cannot run operations', async () => {
      await expect(trip.start('pickup')).rejects.toThrow(NOT_ALLOWED);
      await expect(fees.record('s1', 100, 'cash')).rejects.toThrow(NOT_ALLOWED);
      await expect(students.add(newStudent('X', 'v1'))).rejects.toThrow(/own vehicle|Not allowed/);
    });

    it('suspends a driver: login blocked and an existing session is invalidated', async () => {
      auth.login('u1');
      auth.login('admin');
      await admin.setDriverActive('u1', false);
      expect((await admin.overview()).vehicles[0].active).toBe(false);
      expect(() => auth.login('u1')).toThrow('suspended');
      await admin.setDriverActive('u1', true);
      auth.login('u1');
      auth.login('admin');
      await admin.setDriverActive('u1', false);
      auth.session.set(auth.accounts().find((a) => a.id === 'u1') ?? null);
      expect(auth.valid()).toBe(false);
      expect(auth.home()).toBe('/login');
    });
  });
});
