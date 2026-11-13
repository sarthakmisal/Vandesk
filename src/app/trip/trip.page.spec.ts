import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { AuthService } from '../core/auth.service';
import { DrivingMode } from '../core/driving-mode';
import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { TripPage } from './trip.page';

describe('TripPage', () => {
  let component: TripPage;
  let fixture: ComponentFixture<TripPage>;
  let driving: DrivingMode;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TripPage],
      providers: [provideRouter([]), provideIonicAngular(), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    TestBed.inject(AuthService).login('u1'); // Ramesh, driver of the Van
    driving = TestBed.inject(DrivingMode);
    fixture = TestBed.createComponent(TripPage);
    component = fixture.componentInstance;
    component.setDir('pickup');
    await component.load();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows one student at a time and moves to the next by itself', async () => {
    await component.start();
    expect(component.plan().current?.name).toBe('Akshay Patil'); // first stop; Ishita is Not going today
    expect(component.plan().next?.name).toBe('Karthik Joshi');
    expect(driving.on()).toBe(true); // tab bar hidden while driving

    await component.mark(component.plan().current!);
    expect(component.plan().current?.name).toBe('Karthik Joshi');
    expect(component.plan().position).toBe(2);
  });

  it('undo brings the last student straight back', async () => {
    await component.start();
    await component.mark(component.plan().current!);
    await component.undo();
    expect(component.plan().current?.name).toBe('Akshay Patil');
  });

  it('"not here" skips to the next student', async () => {
    await component.start();
    await component.skip(component.plan().current!);
    expect(component.plan().current?.name).toBe('Karthik Joshi');
    expect(component.plan().skipped).toBe(1);
  });

  it('offers the end button when everyone is done, then shows the tab bar again', async () => {
    await component.start();
    while (component.plan().current) {
      await component.mark(component.plan().current!);
    }
    expect(component.plan().current).toBeUndefined();
    await component.end();
    expect(component.st().status).toBe('ended');
    expect(driving.on()).toBe(false);
  });

  it('the afternoon drop starts from the last stop', async () => {
    component.setDir('drop');
    await component.load();
    await component.start();
    expect(component.plan().current?.name).toBe('Harsha Kulkarni'); // Garden Chowk is the last stop on the Van route
  });
});
