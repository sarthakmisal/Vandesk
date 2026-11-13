import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';

import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { LedgerPage } from './ledger.page';

describe('LedgerPage', () => {
  let component: LedgerPage;
  let fixture: ComponentFixture<LedgerPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LedgerPage],
      providers: [provideRouter([]), provideIonicAngular(), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(LedgerPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
