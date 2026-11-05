import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth';
import { REPO_PROVIDERS } from './core/providers';

describe('Route-level RBAC', () => {
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter(routes), ...REPO_PROVIDERS] });
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
  });

  const go = async (url: string): Promise<string> => {
    await router.navigateByUrl(url);
    return router.url;
  };

  it('signed-out users land on /login from anywhere', async () => {
    expect(await go('/')).toBe('/login');
    expect(await go('/driver/fees')).toBe('/login');
    expect(await go('/admin')).toBe('/login');
    expect(await go('/does/not/exist')).toBe('/login');
  });

  it('a driver lands on the Fees tab and can reach all three tabs', async () => {
    auth.login('u1');
    expect(await go('/')).toBe('/driver/fees');
    expect(await go('/driver')).toBe('/driver/fees');
    expect(await go('/driver/students')).toBe('/driver/students');
    expect(await go('/driver/trip')).toBe('/driver/trip');
  });

  it('a parent is sent to /parent and cannot open driver or admin areas', async () => {
    auth.login('g1');
    expect(await go('/')).toBe('/parent');
    expect(await go('/driver/fees')).toBe('/parent');
    expect(await go('/admin')).toBe('/parent');
  });

  it('an admin is sent to /admin and cannot open driver or parent areas', async () => {
    auth.login('admin');
    expect(await go('/')).toBe('/admin');
    expect(await go('/driver/trip')).toBe('/admin');
    expect(await go('/parent')).toBe('/admin');
  });

  it('a signed-in user is bounced away from /login to their home', async () => {
    auth.login('u2');
    expect(await go('/login')).toBe('/driver/fees');
  });

  it('unknown sub-paths never give a blank screen (go home)', async () => {
    auth.login('u1');
    expect(await go('/driver/fees/garbage')).toBe('/driver/fees');
    expect(await go('/nope')).toBe('/driver/fees');
  });

  it('logging out (as the profile bar does) lands on /login and re-locks the driver area', async () => {
    auth.login('u1');
    await go('/driver/fees');
    auth.logout();
    expect(await go('/login')).toBe('/login');
    expect(await go('/driver/fees')).toBe('/login');
  });

  it('a suspended driver is bounced to /login on the next navigation', async () => {
    auth.login('u1');
    await go('/driver/fees');
    TestBed.inject((await import('./core/mock.db')).MockDb).drivers[0].active = false;
    expect(await go('/driver/trip')).toBe('/login');
  });
});
