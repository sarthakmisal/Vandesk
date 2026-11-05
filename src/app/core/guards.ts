import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';

import type { Role } from './auth';
import { AuthService } from './auth';

/** Route matches only for the given role. Anything else falls through to the `**` route, which sends the user home (or to /login). */
export const roleGuard =
  (role: Role): CanMatchFn =>
  () => {
    const a = inject(AuthService);
    return a.valid() && a.session?.role === role;
  };

export const guestGuard: CanMatchFn = () => !inject(AuthService).valid();
