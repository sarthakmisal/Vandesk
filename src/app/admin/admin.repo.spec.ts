import { TestBed } from '@angular/core/testing';

import { AuthService } from '../core/auth.service';
import { MOCK_REPO_PROVIDERS } from '../core/providers';
import { FeesRepo } from '../fees/fees.repo';
import { StudentsRepo } from '../students/students.repo';

import type { NewVehicle } from './admin.repo';
import { AdminRepo } from './admin.repo';

const bus: NewVehicle = {
  name: 'Tempo',
  regNo: 'mh-20  ef 9012',
  capacity: 2,
  fee: 25000,
  driverName: 'Anil More',
  driverEmail: 'Anil@Vandesk.test',
  stops: ['Temple Road', 'Lake View', 'School Gate'],
};

describe('Admin: buses, drivers, stops, fees, placement (mock)', () => {
  let auth: AuthService;
  let admin: AdminRepo;
  let students: StudentsRepo;
  let fees: FeesRepo;

  const vehicle = async (id: string) => (await admin.overview()).vehicles.find((v) => v.id === id)!;
  const newBus = async (over: Partial<NewVehicle> = {}) => {
    await admin.addVehicle({ ...bus, ...over });
    return (await admin.overview()).vehicles.find((v) => v.reg === 'MH-20 EF 9012')!;
  };

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...MOCK_REPO_PROVIDERS] });
    auth = TestBed.inject(AuthService);
    admin = TestBed.inject(AdminRepo);
    students = TestBed.inject(StudentsRepo);
    fees = TestBed.inject(FeesRepo);
    auth.login('admin');
  });

  it('onboards a bus with driver, first fee and stops in route order', async () => {
    const v = await newBus();
    expect(v).toMatchObject({
      reg: 'MH-20 EF 9012',
      name: 'Tempo',
      cap: 2,
      fee: 25000,
      stops: 3,
      driver: 'Anil More',
      driverEmail: 'anil@vandesk.test',
      inService: true,
    });
    expect((await students.stops(v.id)).map((s) => s.name)).toEqual(['Temple Road', 'Lake View', 'School Gate']);
    expect(auth.accounts().some((a) => a.email === 'anil@vandesk.test' && a.role === 'driver' && a.veh === v.id)).toBe(
      true,
    );
  });

  it('rejects a duplicate registration, a parent or admin email and a driver who already has a bus', async () => {
    await expect(admin.addVehicle({ ...bus, regNo: 'MH-20 AB 1234', driverEmail: 'x@vandesk.test' })).rejects.toThrow(
      'already exists',
    );
    await expect(admin.addVehicle({ ...bus, driverEmail: 'mrpatil@mail.test' })).rejects.toThrow(
      'another kind of account',
    );
    await expect(admin.addVehicle({ ...bus, driverEmail: 'ramesh@vandesk.test' })).rejects.toThrow('already drives');
    await expect(admin.addVehicle({ ...bus, fee: 0, driverEmail: 'y@vandesk.test' })).rejects.toThrow('Fill in');
    expect((await admin.overview()).vehicles).toHaveLength(2); // nothing half-created
  });

  it('adds students to any bus, enforces seats, and charges the bus fee', async () => {
    const v = await newBus();
    const stop = (await students.stops(v.id))[0].id;
    const add = (name: string) =>
      students.add({ name, cls: '4', veh: v.id, stop, gname: 'G', email: name.toLowerCase() + '@x.in', phone: '1' });
    await add('Tara');
    await add('Uma');
    await expect(add('Vik')).rejects.toThrow('is full');
    expect((await fees.list()).find((r) => r.name === 'Tara')?.balance).toBe(25000);
  });

  it('moves a student: stop must belong to the bus, a full bus is refused, history stays', async () => {
    const v = await newBus({ capacity: 1 });
    const before = await fees.statement('s6'); // Diya, on v2
    await expect(admin.moveStudent('s6', 'v1', 't5')).rejects.toThrow('Choose a stop on this vehicle');
    await admin.moveStudent('s6', v.id, '');
    await expect(admin.moveStudent('s7', v.id, '')).rejects.toThrow('is full');
    const moved = (await students.list()).find((s) => s.id === 's6')!;
    expect(moved).toMatchObject({ veh: v.id, stopId: '' });
    expect((await fees.statement('s6')).rows).toEqual(before.rows);
    await admin.moveStudent('s6', v.id, (await students.stops(v.id))[1].id); // same bus, full: only the stop changes
    expect((await students.list()).find((s) => s.id === 's6')?.stop).toBe('Lake View');
  });

  it('adds, reorders, renames and deletes stops; a stop in use cannot be deleted', async () => {
    const names = async () => (await students.stops('v1')).map((s) => s.name);
    await admin.addStop('v1', 'Mill Chowk', '07:40');
    expect((await names()).at(-1)).toBe('Mill Chowk');
    const last = (await students.stops('v1')).at(-1)!;
    await admin.moveStop(last.id, 'up');
    expect((await names()).slice(-2)).toEqual(['Mill Chowk', 'Bus Stand']);
    await admin.moveStop('t1', 'up'); // already first: no-op
    expect((await names())[0]).toBe('Hanuman Mandir');
    await admin.updateStop(last.id, { name: 'Mill Square' });
    expect(await names()).toContain('Mill Square');
    await expect(admin.deleteStop('t1')).rejects.toThrow('use this stop');
    await admin.deleteStop(last.id);
    expect(await names()).not.toContain('Mill Square');
  });

  it('sets a bus fee that must start after the current plan', async () => {
    await expect(admin.setFee('v1', 40000, '2026-06-01')).rejects.toThrow('after the current plan');
    await admin.setFee('v1', 40000, '2026-12-01');
    expect((await vehicle('v1')).fee).toBe(30000); // not in force yet
    await expect(admin.setFee('nope', 1, '2027-01-01')).rejects.toThrow('Not found');
  });

  it('edits the bus: seats cannot go below the students on board, reg stays unique', async () => {
    await expect(admin.updateVehicle('v1', { name: 'Van', regNo: 'MH-20 AB 1234', capacity: 2 })).rejects.toThrow(
      '5 students ride',
    );
    await expect(admin.updateVehicle('v1', { name: 'Van', regNo: 'MH-20 CD 5678', capacity: 6 })).rejects.toThrow(
      'already exists',
    );
    await admin.updateVehicle('v1', { name: 'Big van', regNo: 'mh-20 ab 1234', capacity: 8 });
    expect(await vehicle('v1')).toMatchObject({ name: 'Big van', cap: 8, label: 'Big van · MH-20 AB 1234' });
  });

  it('replaces the driver: the old one is suspended, the new one takes over; an unknown parent email is refused', async () => {
    await expect(admin.changeDriver('v1', 'Ravi', 'suresh@vandesk.test')).rejects.toThrow('already drives');
    expect(await vehicle('v1')).toMatchObject({ driver: 'Ramesh Kale', active: true }); // failed change leaves everything as it was
    await admin.changeDriver('v1', 'Ravi Pawar', 'ravi@vandesk.test');
    expect(await vehicle('v1')).toMatchObject({ driver: 'Ravi Pawar', active: true });
    expect(() => auth.login('u1')).toThrow('suspended');
    await admin.changeDriver('v1', 'Ramesh Kale', 'ramesh@vandesk.test'); // handing it back re-activates him
    expect(() => auth.login('u1')).not.toThrow();
    auth.login('admin');
  });

  it('retires only an empty bus, hides it from pickers, and can bring it back', async () => {
    const v = await newBus();
    await expect(admin.setInService('v1', false)).rejects.toThrow('Move the 5 students');
    await admin.setInService(v.id, false);
    const r = await vehicle(v.id);
    expect(r).toMatchObject({ inService: false, driver: '' });
    expect((await admin.overview()).vehicles.at(-1)?.id).toBe(v.id);
    expect((await students.vehicles()).some((x) => x.id === v.id)).toBe(false);
    await expect(admin.changeDriver(v.id, 'Anil More', 'anil@vandesk.test')).rejects.toThrow(
      'Restore this vehicle first',
    );
    await admin.setInService(v.id, true);
    await admin.changeDriver(v.id, 'Anil More', 'anil@vandesk.test');
    expect(await vehicle(v.id)).toMatchObject({ inService: true, driver: 'Anil More', active: true });
  });
});
