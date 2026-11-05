import { inject } from '@angular/core';
import type { Routes } from '@angular/router';

import { AuthService } from './core/auth';
import { guestGuard, roleGuard } from './core/guards';

// RBAC at the route level: each area only matches for its role; everything else falls to `**`,
// which sends the user to their own home (or /login). No blank screens, no cross-role URLs.
export const routes: Routes = [
  {
    path: 'login',
    canMatch: [guestGuard],
    loadComponent: () => import('./login/login.page').then((m) => m.LoginPage),
  },
  {
    path: 'driver',
    canMatch: [roleGuard('driver')],
    loadChildren: () => import('./tabs/tabs.routes').then((m) => m.routes),
  },
  {
    path: 'parent',
    canMatch: [roleGuard('parent')],
    loadComponent: () => import('./parent/parent.page').then((m) => m.ParentPage),
  },
  {
    path: 'admin',
    canMatch: [roleGuard('admin')],
    loadComponent: () => import('./admin/admin.page').then((m) => m.AdminPage),
  },
  { path: '**', redirectTo: () => inject(AuthService).home() },
];
