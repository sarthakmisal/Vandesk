import { TestBed } from '@angular/core/testing';

import { AuthService } from '../core/auth';
import { REPO_PROVIDERS } from '../core/providers';

import type { NewStudent} from './students.repo';
import { StudentsRepo } from './students.repo';

const form = (over: Partial<NewStudent> = {}): NewStudent => ({
  name: 'Tara Shah',
  cls: '4',
  veh: 'v1',
  stop: 't1',
  gname: 'Mrs. Shah',
  email: 'shah@mail.test',
  phone: '9800000000',
  ...over,
});

describe('StudentsRepo', () => {
  let repo: StudentsRepo;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...REPO_PROVIDERS] });
    repo = TestBed.inject(StudentsRepo);
    auth = TestBed.inject(AuthService);
  });

  it('driver lists only own students, sorted by name, with stop and vehicle', async () => {
    auth.login('u1');
    const rows = await repo.list();
    expect(rows.map((r) => r.name)).toEqual([
      'Akshay Patil',
      'Harsha Kulkarni',
      'Ishita Patil',
      'Karthik Joshi',
      'Rohan More',
    ]);
    expect(rows[0]).toMatchObject({ vehicle: 'Van', stop: 'Hanuman Mandir', guardian: 'Mr. Patil' });
  });

  it('driver sees only own vehicle seats; admin sees both', async () => {
    auth.login('u1');
    expect(await repo.vehicles()).toEqual([expect.objectContaining({ id: 'v1', cap: 6, used: 5 })]);
    auth.login('admin');
    expect((await repo.vehicles()).length).toBe(2);
  });

  it('returns stops in route order and blocks other vehicles', async () => {
    auth.login('u1');
    expect((await repo.stops('v1')).map((s) => s.name)).toEqual([
      'Hanuman Mandir',
      'Ganpati Mandir',
      'Garden Chowk',
      'Bus Stand',
    ]);
    await expect(repo.stops('v2')).rejects.toThrow('Not allowed');
  });

  it('adds a student and consumes a seat', async () => {
    auth.login('u1');
    await repo.add(form());
    expect((await repo.vehicles())[0].used).toBe(6);
    expect((await repo.list()).some((r) => r.name === 'Tara Shah')).toBe(true);
  });

  it('refuses a full vehicle (R-SEAT-1)', async () => {
    auth.login('u1');
    await repo.add(form());
    await expect(repo.add(form({ name: 'Another Kid', email: 'x@mail.test' }))).rejects.toThrow(
      'Van is full (6 of 6 seats). Choose another vehicle.',
    );
  });

  it('validates names and email', async () => {
    auth.login('u1');
    await expect(repo.add(form({ name: ' ' }))).rejects.toThrow('Student and guardian names are required');
    await expect(repo.add(form({ email: 'not-an-email' }))).rejects.toThrow('Enter a valid guardian email');
  });

  it('refuses a duplicate student for the same guardian', async () => {
    auth.login('u1');
    await expect(repo.add(form({ name: 'Akshay Patil', email: 'mrpatil@mail.test' }))).rejects.toThrow(
      'This student is already added',
    );
  });

  it('only lets a driver add to their own vehicle; parents cannot add', async () => {
    auth.login('u1');
    await expect(repo.add(form({ veh: 'v2', stop: 't5' }))).rejects.toThrow(
      'You can only add students to your own vehicle',
    );
    auth.login('g1');
    await expect(repo.add(form())).rejects.toThrow('Not allowed');
  });
});
