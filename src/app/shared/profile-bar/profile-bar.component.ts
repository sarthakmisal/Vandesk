import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../core/auth';
import type { Lang } from '../../fees/fees.models';
import { L, setLang } from '../../fees/fees.models';

/** Top bar on every screen: who is signed in, language, logout. */
@Component({
  selector: 'app-profile-bar',
  templateUrl: 'profile-bar.component.html',
  styleUrls: ['profile-bar.component.scss'],
})
export class ProfileBarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  langs: Lang[] = ['en', 'hi', 'mr'];

  get n(): string {
    return this.auth.session?.name ?? '';
  }
  get role(): string {
    return ({ admin: 'VanDesk admin', driver: 'Driver', parent: 'Parent' } as Record<string, string>)[
      this.auth.session?.role ?? 'parent'
    ];
  }
  get cur(): Lang {
    return L();
  }
  label(l: Lang): 'EN' | 'हि' | 'म' {
    return l === 'en' ? 'EN' : l === 'hi' ? 'हि' : 'म';
  }
  set(l: Lang): void {
    setLang(l);
  }
  out(): void {
    this.auth.logout();
    this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
