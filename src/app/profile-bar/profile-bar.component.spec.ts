import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { MOCK_REPO_PROVIDERS } from '../core/providers';

import { ProfileBarComponent } from './profile-bar.component';

describe('ProfileBarComponent', () => {
  let component: ProfileBarComponent;
  let fixture: ComponentFixture<ProfileBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileBarComponent],
      providers: [provideRouter([]), ...MOCK_REPO_PROVIDERS],
    }).compileComponents();

    fixture = TestBed.createComponent(ProfileBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
