import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { TripPage } from './trip.page';

describe('TripPage', () => {
  let component: TripPage;
  let fixture: ComponentFixture<TripPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TripPage],
      providers: [provideRouter([]), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(TripPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
