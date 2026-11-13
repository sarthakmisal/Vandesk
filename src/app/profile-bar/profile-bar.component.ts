import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../core/auth.service';
import type { Lang } from '../core/i18n';
import { L, setLang } from '../core/i18n';

/** Top bar on every screen: who is signed in, language, log out. */
@Component({
  selector: 'app-profile-bar',
  templateUrl: './profile-bar.component.html',
  styleUrls: ['./profile-bar.component.scss'],
})
export class ProfileBarComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly langs: Lang[] = ['en', 'hi', 'mr'];
  readonly cur = L;
  readonly name = computed(() => this.auth.session()?.name ?? '');
  readonly role = computed(
    () => ({ admin: 'VanDesk admin', driver: 'Driver', parent: 'Parent' })[this.auth.session()?.role ?? 'parent'],
  );

  label(l: Lang): string {
    return l === 'en' ? 'EN' : l === 'hi' ? 'हि' : 'म';
  }

  set(l: Lang): void {
    setLang(l);
  }

  out(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
