import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { ParentPage } from './parent.page';

describe('ParentPage', () => {
  let component: ParentPage;
  let fixture: ComponentFixture<ParentPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ParentPage],
      providers: [provideRouter([]), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(ParentPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
