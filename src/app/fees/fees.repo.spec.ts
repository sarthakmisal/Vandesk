import { TestBed } from '@angular/core/testing';

import { AuthService } from '../core/auth';
import { REPO_PROVIDERS } from '../core/providers';

import { FeesRepo } from './fees.repo';

describe('FeesRepo', () => {
  let repo: FeesRepo;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...REPO_PROVIDERS] });
    repo = TestBed.inject(FeesRepo);
    auth = TestBed.inject(AuthService);
  });

  it('driver sees only own-vehicle students with pending fees, oldest first', async () => {
    auth.login('u1');
    const rows = await repo.list();
    expect(rows.map((r) => r.name)).toEqual(['Rohan More', 'Ishita Patil', 'Karthik Joshi', 'Harsha Kulkarni']);
    expect(rows.reduce((a, r) => a + r.balance, 0)).toBe(360000);
  });

  it('builds cumulative pay steps (1 month, 2 months … all)', async () => {
    auth.login('u1');
    const rohan = (await repo.list())[0];
    expect(rohan.months).toBe(5);
    expect(rohan.steps).toEqual([30000, 60000, 90000, 120000, 150000]);
  });

  it('records a payment against the oldest dues and tracks collected today', async () => {
    auth.login('u1');
    expect(await repo.collectedToday()).toBe(0);
    await repo.record('s5', 60000, 'cash');
    const rohan = (await repo.list()).find((r) => r.id === 's5');
    expect(rohan?.balance).toBe(90000);
    expect(rohan?.months).toBe(3);
    expect(await repo.collectedToday()).toBe(60000);
  });

  it('removes a student from the list once fully paid', async () => {
    auth.login('u1');
    await repo.record('s4', 60000, 'upi');
    expect((await repo.list()).some((r) => r.id === 's4')).toBe(false);
  });

  it('undo writes a reversal, restores the balance and is idempotent', async () => {
    auth.login('u1');
    const pid = await repo.record('s5', 30000, 'cash');
    await repo.undo(pid);
    await repo.undo(pid);
    const rohan = (await repo.list()).find((r) => r.id === 's5');
    expect(rohan?.balance).toBe(150000);
    expect(await repo.collectedToday()).toBe(0);
  });

  it('rejects non-positive amounts', async () => {
    auth.login('u1');
    await expect(repo.record('s5', 0, 'cash')).rejects.toThrow('amount');
  });

  it("blocks a driver from recording on another vehicle's student", async () => {
    auth.login('u2');
    await expect(repo.record('s5', 30000, 'cash')).rejects.toThrow('Not allowed');
  });

  it('blocks parents from recording payments', async () => {
    auth.login('g4');
    await expect(repo.record('s5', 30000, 'cash')).rejects.toThrow('Not allowed');
  });

  it('parent gets a read-only statement for own child only', async () => {
    auth.login('g1');
    const st = await repo.statement('s2');
    expect(st.name).toBe('Ishita Patil');
    expect(st.balance).toBe(90000);
    expect(st.rows.length).toBe(5);
    expect(st.rows.filter((r) => r.paid >= r.amt).length).toBe(2);
    await expect(repo.statement('s5')).rejects.toThrow('Not allowed');
  });

  it('a newly joined student gets dues from their join month', async () => {
    const db = (await import('../core/mock.db')).MockDb;
    const mock = TestBed.inject(db);
    auth.login('u1');
    mock.students.push({
      id: 's99',
      name: 'New Kid',
      cls: '2',
      veh: 'v1',
      stop: 't1',
      gid: 'g1',
      status: 'active',
      joined: '2026-10',
    });
    const row = (await repo.list()).find((r) => r.id === 's99');
    expect(row?.months).toBe(1);
    expect(row?.balance).toBe(30000);
  });
});
