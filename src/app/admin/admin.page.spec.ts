import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { AdminPage } from './admin.page';

describe('AdminPage', () => {
  let component: AdminPage;
  let fixture: ComponentFixture<AdminPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminPage],
      providers: [provideRouter([]), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
