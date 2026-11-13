import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';

import type { Role } from './auth.service';
import { AuthService } from './auth.service';

/**
 * Route matches only for the given role. Anything else falls through to the `**` route,
 * which sends the user to their own home (or /login).
 */
export const roleGuard =
  (role: Role): CanMatchFn =>
  () => {
    const auth = inject(AuthService);
    return auth.valid() && auth.session()!.role === role;
  };

export const guestGuard: CanMatchFn = () => !inject(AuthService).valid();
