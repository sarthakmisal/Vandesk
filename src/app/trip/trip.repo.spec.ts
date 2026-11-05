import { TestBed } from '@angular/core/testing';

import { AuthService } from '../core/auth';
import { REPO_PROVIDERS } from '../core/providers';

import { TripRepo } from './trip.repo';

describe('TripRepo', () => {
  let repo: TripRepo;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [...REPO_PROVIDERS] });
    repo = TestBed.inject(TripRepo);
    auth = TestBed.inject(AuthService);
  });

  it('roster is in route order and shows "not going" children as off', async () => {
    auth.login('u1');
    const r = await repo.roster();
    expect(r.map((x) => x.name)).toEqual([
      'Akshay Patil',
      'Ishita Patil',
      'Karthik Joshi',
      'Harsha Kulkarni',
      'Rohan More',
    ]);
    expect(r.find((x) => x.name === 'Ishita Patil')?.state).toBe('off');
    expect(r.filter((x) => x.state === 'wait').length).toBe(4);
  });

  it('cannot tap before the trip starts', async () => {
    auth.login('u1');
    await expect(repo.tap('s1')).rejects.toThrow('Start the trip first');
  });

  it('start → tap picks up → tap again undoes → ✕ marks not there', async () => {
    auth.login('u1');
    await repo.start();
    expect((await repo.state()).status).toBe('started');
    await repo.tap('s1');
    expect((await repo.roster()).find((x) => x.id === 's1')?.state).toBe('boarded');
    await repo.tap('s1');
    expect((await repo.roster()).find((x) => x.id === 's1')?.state).toBe('wait');
    await repo.notThere('s3');
    expect((await repo.roster()).find((x) => x.id === 's3')?.state).toBe('skipped');
  });

  it('end is never blocked and records the end state', async () => {
    auth.login('u1');
    await repo.end();
    expect((await repo.state()).status).toBe('ended');
  });

  it("a driver cannot touch another vehicle's student", async () => {
    auth.login('u2');
    await repo.start();
    await expect(repo.tap('s1')).rejects.toThrow('Not allowed');
  });

  it('parent sees how many stops away the van is', async () => {
    auth.login('u1');
    await repo.start();
    await repo.tap('s1'); // boarded at stop #1
    auth.login('g2'); // Mrs. Joshi, child at stop #2
    const info = await repo.parent('s3');
    expect(info.status).toBe('started');
    expect(info.away).toBe(0);
    expect(info.locked).toBe(true);
    expect(info.last?.stop).toBe('Hanuman Mandir');
    expect(info.stops.find((s) => s.mine)?.name).toBe('Ganpati Mandir');
    auth.login('g4'); // Mrs. More, child at stop #3
    expect((await repo.parent('s5')).away).toBe(1);
  });

  it('parent sees picked-up time once boarded', async () => {
    auth.login('u1');
    await repo.start();
    await repo.tap('s1');
    auth.login('g1');
    const info = await repo.parent('s1');
    expect(info.picked).toMatch(/^\d\d:\d\d$/);
    expect(info.away).toBeNull();
  });

  it('parent can toggle going before the trip, but not after it starts (R-ATT-3)', async () => {
    auth.login('g1');
    expect((await repo.parent('s2')).going).toBe(false);
    await repo.setGoing('s2', true);
    expect((await repo.parent('s2')).going).toBe(true);
    auth.login('u1');
    await repo.start();
    auth.login('g1');
    await expect(repo.setGoing('s2', false)).rejects.toThrow('Trip already started. Please call the driver.');
  });

  it("parent cannot read or change another family's child", async () => {
    auth.login('g1');
    await expect(repo.parent('s5')).rejects.toThrow('Not allowed');
    await expect(repo.setGoing('s5', false)).rejects.toThrow('Not allowed');
    expect((await repo.children()).map((c) => c.name)).toEqual(['Akshay Patil', 'Ishita Patil']);
  });

  it('reset clears trips and restores the seed', async () => {
    auth.login('u1');
    await repo.start();
    await repo.reset();
    expect((await repo.state()).status).toBe('idle');
  });
});
