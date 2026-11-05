/**
 * Render tests: each screen is created with the real repos + seed data, signed in as the
 * right role, and checked for the text the user should see. Guards against template/runtime
 * errors that a compile alone cannot catch.
 */
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { AdminPage } from './admin/admin.page';
import { AuthService } from './core/auth';
import { REPO_PROVIDERS } from './core/providers';
import { setLang } from './fees/fees.models';
import { FeesPage } from './fees/fees.page';
import { LoginPage } from './login/login.page';
import { ParentPage } from './parent/parent.page';
import { StudentsPage } from './students/students.page';
import { TripPage } from './trip/trip.page';

interface Enterable {
  ionViewWillEnter?: () => unknown;
}

async function mount<T extends Enterable>(cls: new () => T, as: string | null): Promise<ComponentFixture<T>> {
  localStorage.clear();
  setLang('en');
  TestBed.configureTestingModule({
    imports: [cls],
    providers: [provideRouter([]), provideIonicAngular(), ...REPO_PROVIDERS],
  });
  if (as) TestBed.inject(AuthService).login(as);
  const fixture = TestBed.createComponent(cls);
  await fixture.componentInstance.ionViewWillEnter?.();
  await fixture.whenStable();
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}
const text = (f: ComponentFixture<unknown>): string => (f.nativeElement as HTMLElement).textContent ?? '';

describe('Screens render with seed data', () => {
  it('Login lists the admin, drivers and parents', async () => {
    const t = text(await mount(LoginPage, null));
    expect(t).toContain('VanDesk');
    expect(t).toContain('VanDesk team');
    expect(t).toContain('Ramesh Kale');
    expect(t).toContain('Suresh Wagh');
    expect(t).toContain('Mr. Patil');
    expect(t).toContain('admin@vandesk.test');
  });

  it('Fees shows pending total, collected today and the pending students', async () => {
    const f = await mount(FeesPage, 'u1');
    const t = text(f);
    expect(t).toContain('₹3,600'); // 360000 paise pending
    expect(t).toContain('Collected today');
    expect(t).toContain('Rohan More');
    expect(t).toContain('5 months pending');
    expect(t).not.toContain('Akshay Patil'); // fully paid
    expect(t).not.toContain('Diya Naik'); // other vehicle
    expect((f.nativeElement as HTMLElement).querySelectorAll('article.card').length).toBe(4);
  });

  it('Fees switches language live (signal-driven)', async () => {
    const f = await mount(FeesPage, 'u1');
    setLang('hi');
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(text(f)).toContain('बाकी');
    expect(text(f)).toContain('मिल गया');
  });

  it('Students shows seat usage and own-vehicle students', async () => {
    const t = text(await mount(StudentsPage, 'u1'));
    expect(t).toContain('5/6');
    expect(t).toContain('Akshay Patil');
    expect(t).toContain('Class 5');
    expect(t).toContain('Hanuman Mandir');
    expect(t).toContain('Add student');
    expect(t).not.toContain('Kabir Sinha');
  });

  it('Students search filters the list (real input event)', async () => {
    const f = await mount(StudentsPage, 'u1');
    const input = (f.nativeElement as HTMLElement).querySelector('input.x-in') as HTMLInputElement;
    input.value = 'rohan';
    input.dispatchEvent(new Event('input'));
    await f.whenStable();
    f.detectChanges();
    expect(text(f)).toContain('Rohan More');
    expect(text(f)).not.toContain('Akshay Patil');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await f.whenStable();
    f.detectChanges();
    expect(text(f)).toContain('Akshay Patil');
  });

  it('Trip shows the ready banner, start button and roster in route order', async () => {
    const t = text(await mount(TripPage, 'u1'));
    expect(t).toContain('Ready · 4 students');
    expect(t).toContain('Start trip');
    expect(t).toContain('Not coming'); // Ishita
    expect(t.indexOf('Akshay Patil')).toBeLessThan(t.indexOf('Rohan More'));
  });

  it('Trip start → banner flips to started with a live count', async () => {
    const f = await mount(TripPage, 'u1');
    await f.componentInstance.start();
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(text(f)).toContain('0/4 ✓');
    expect(text(f)).toContain('Reached school');
    await f.componentInstance.tap('s1');
    f.detectChanges();
    expect(text(f)).toContain('1/4 ✓');
  });

  it('Parent shows status message, stop timeline and going toggle', async () => {
    const t = text(await mount(ParentPage, 'g1'));
    expect(t).toContain('My children'); // two kids
    expect(t).toContain('Akshay');
    expect(t).toContain('Van has not started yet');
    expect(t).toContain('Hanuman Mandir');
    expect(t).toContain('your stop');
    expect(t).toContain('Usually at your stop ~07:05');
    expect(t).toContain('Not going today');
  });

  it('Parent fees tab shows the statement', async () => {
    const f = await mount(ParentPage, 'g1');
    f.componentInstance.pick('s2');
    await f.whenStable();
    f.componentInstance.tab = 'fees';
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    const t = text(f);
    expect(t).toContain('₹900'); // 90000 paise pending for Ishita
    expect(t).toContain('Jun 2026');
    expect(t).toContain('paid');
    expect(t).toContain('Fees are collected by your driver');
    f.destroy();
  });

  it('Admin shows platform totals and both vehicles', async () => {
    const t = text(await mount(AdminPage, 'admin'));
    expect(t).toContain('Platform');
    expect(t).toContain('Van · MH-20 AB 1234');
    expect(t).toContain('Mini bus · MH-20 CD 5678');
    expect(t).toContain('Driver · Ramesh Kale');
    expect(t).toContain('5/6 seats');
    expect(t).toContain('Active · Suspend');
  });

  it('Admin can suspend a driver, which then blocks that driver’s login', async () => {
    const f = await mount(AdminPage, 'admin');
    const o = f.componentInstance.o;
    expect(o).toBeDefined();
    await f.componentInstance.toggle((o as NonNullable<typeof o>).vehicles[0]);
    f.detectChanges();
    await f.whenStable();
    f.detectChanges();
    expect(text(f)).toContain('Suspended · Activate');
    expect(() => TestBed.inject(AuthService).login('u1')).toThrow('Account suspended. Contact VanDesk.');
  });
});
