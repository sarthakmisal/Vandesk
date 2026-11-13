import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { FeesPage } from './fees.page';

describe('FeesPage', () => {
  let component: FeesPage;
  let fixture: ComponentFixture<FeesPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FeesPage],
      providers: [provideRouter([]), provideIonicAngular(), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(FeesPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
